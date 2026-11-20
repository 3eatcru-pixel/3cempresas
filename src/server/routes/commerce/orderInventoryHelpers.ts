import { db } from '../../config.ts';
import {
  stageStockLedgerInTransaction,
  stageSyncOutboxInTransaction,
} from '../../persistence/PersistenceDriver.ts';

export interface VariantRestoreRequest {
  qty: number;
  label?: string;
}

export async function findLatestOpenCashSessionInTx(
  transaction: any,
  storeId: string,
  tenantId: string
): Promise<{ ref: any; snap: any } | null> {
  const cashSnap = await db.collection('cash_sessions').get();
  const openCashDoc = cashSnap.docs
    .filter((d) => {
      const s = d.data();
      return s.storeId === storeId && s.tenantId === tenantId && s.status === 'OPEN' && !s._deleted;
    })
    .sort((a, b) => new Date(b.data()?.openedAt || 0).getTime() - new Date(a.data()?.openedAt || 0).getTime())[0];

  if (!openCashDoc) return null;
  const ref = db.collection('cash_sessions').doc(openCashDoc.id);
  const snap = await transaction.get(ref);
  return { ref, snap };
}

export function settleOpenCashSessionInTransaction(
  transaction: any,
  openCashRef: any,
  openCashSnap: any,
  orderTotal: number,
  tenantId: string,
  storeId: string | null,
  hlc: string,
  nowIso: string
) {
  if (!openCashRef || !openCashSnap?.exists || openCashSnap.data()?.status !== 'OPEN' || orderTotal <= 0) {
    return;
  }
  const openCash = openCashSnap.data();
  const nextTotalSales = Math.round(((Number(openCash.totalSales) || 0) + orderTotal) * 100) / 100;
  const nextFinalCash = Math.round(((Number(openCash.finalCashCalculated) || 0) + orderTotal) * 100) / 100;

  transaction.update(openCashRef, {
    totalSales: nextTotalSales,
    finalCashCalculated: nextFinalCash,
    hlc,
    updatedAt: nowIso,
  });

  stageSyncOutboxInTransaction(transaction, {
    entity: 'cash_sessions',
    entityId: openCashRef.id,
    operation: 'UPSERT',
    tenantId,
    storeId,
    hlc,
    payload: {
      ...openCash,
      id: openCashRef.id,
      totalSales: nextTotalSales,
      finalCashCalculated: nextFinalCash,
      hlc,
      updatedAt: nowIso,
    },
  });
}

export function restoreMenuItemStockInTransaction(params: {
  transaction: any;
  menuRef: any;
  menuId: string;
  menuData: any;
  fallbackItemName?: string;
  qtyToRestore: number;
  variantsToRestore: Map<string, VariantRestoreRequest>;
  tenantId: string;
  storeId: string;
  orderId: string;
  orderCode?: string;
  hlc: string;
  nowIso: string;
}): number {
  const {
    transaction,
    menuRef,
    menuId,
    menuData,
    fallbackItemName,
    qtyToRestore,
    variantsToRestore,
    tenantId,
    storeId,
    orderId,
    orderCode,
    hlc,
    nowIso,
  } = params;

  if (!menuData || qtyToRestore <= 0) return 0;
  const isServiceItem = menuData.specs?.segment === 'SERVICE';
  if (isServiceItem || typeof menuData.stock !== 'number') return 0;

  const prevStock = Number(menuData.stock) || 0;
  const nextStock = prevStock + qtyToRestore;
  const menuPatch: Record<string, any> = {
    stock: nextStock,
    hlc,
    updatedAt: nowIso,
  };

  const clonedVariants = Array.isArray(menuData.variants)
    ? menuData.variants.map((v: any) => ({ ...v }))
    : null;

  if (clonedVariants) {
    for (const [variantId, vInfo] of variantsToRestore.entries()) {
      const vIdx = clonedVariants.findIndex((v: any) => v.id === variantId);
      if (vIdx >= 0 && vInfo.qty > 0) {
        const prevVarStock = Number(clonedVariants[vIdx].stock) || 0;
        const nextVarStock = prevVarStock + vInfo.qty;
        clonedVariants[vIdx].stock = nextVarStock;
        stageStockLedgerInTransaction(transaction, {
          tenantId,
          storeId,
          itemType: 'VARIANT',
          targetId: `${menuId}::${variantId}`,
          itemName: `${menuData.name || fallbackItemName || menuId} [${vInfo.label || variantId}]`,
          orderId,
          orderCode,
          previousQty: prevVarStock,
          deltaQty: vInfo.qty,
          balanceAfter: nextVarStock,
          reason: 'RETURN',
          hlc,
        });
      }
    }
    menuPatch.variants = clonedVariants;
  }

  transaction.update(menuRef, menuPatch);
  stageStockLedgerInTransaction(transaction, {
    tenantId,
    storeId,
    itemType: 'MENU_ITEM',
    targetId: menuId,
    itemName: menuData.name || fallbackItemName || menuId,
    orderId,
    orderCode,
    previousQty: prevStock,
    deltaQty: qtyToRestore,
    balanceAfter: nextStock,
    reason: 'RETURN',
    hlc,
  });
  stageSyncOutboxInTransaction(transaction, {
    entity: 'menu_items',
    entityId: menuId,
    operation: 'UPSERT',
    tenantId,
    storeId,
    hlc,
    payload: { ...menuData, ...menuPatch, id: menuId },
  });

  return qtyToRestore;
}
