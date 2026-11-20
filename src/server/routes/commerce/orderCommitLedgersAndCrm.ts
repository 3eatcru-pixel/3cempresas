import { db } from '../../config.ts';
import {
  stageStockLedgerInTransaction,
  stageSyncOutboxInTransaction,
} from '../../persistence/PersistenceDriver.ts';
import { settleOpenCashSessionInTransaction } from './orderInventoryHelpers.ts';

export interface OrderStockUpdateEntry {
  ref: any;
  itemId: string;
  itemName: string;
  initialStock: number;
  newStock: number;
  newVariants: any[] | null;
  variantMovements: Array<{
    variantId: string;
    label?: string;
    previousQty: number;
    deltaQty: number;
    balanceAfter: number;
  }>;
}

export interface BomBatchDeductionEntry {
  batchId: string;
  sku?: string;
  itemName: string;
  previousQty: number;
  deltaQty: number;
  newQty: number;
}

export function stageOrderStockAndBomLedgersInTx(params: {
  transaction: any;
  stockUpdates: OrderStockUpdateEntry[];
  ingredientBatchDeductions: BomBatchDeductionEntry[];
  tenantId: string;
  storeId: string;
  orderId: string;
  orderCode: string;
  orderHlc: string;
  nowIso: string;
}): void {
  const {
    transaction,
    stockUpdates,
    ingredientBatchDeductions,
    tenantId,
    storeId,
    orderId,
    orderCode,
    orderHlc,
    nowIso,
  } = params;

  for (const update of stockUpdates) {
    const patch: any = {
      stock: update.newStock,
      hlc: orderHlc,
      updatedAt: nowIso,
    };
    if (update.newVariants) {
      patch.variants = update.newVariants;
    }
    transaction.update(update.ref, patch);

    stageStockLedgerInTransaction(transaction, {
      tenantId,
      storeId,
      itemType: 'MENU_ITEM',
      targetId: update.itemId,
      itemName: update.itemName,
      deltaQty: update.newStock - update.initialStock,
      previousQty: update.initialStock,
      balanceAfter: update.newStock,
      reason: 'SALE',
      orderId,
      orderCode,
      hlc: orderHlc,
    });

    for (const vm of update.variantMovements) {
      stageStockLedgerInTransaction(transaction, {
        tenantId,
        storeId,
        itemType: 'VARIANT',
        targetId: `${update.itemId}::${vm.variantId}`,
        itemName: `${update.itemName} [${vm.label || vm.variantId}]`,
        deltaQty: vm.deltaQty,
        previousQty: vm.previousQty,
        balanceAfter: vm.balanceAfter,
        reason: 'SALE',
        orderId,
        orderCode,
        hlc: orderHlc,
      });
    }

    stageSyncOutboxInTransaction(transaction, {
      entity: 'menu_items',
      entityId: update.itemId,
      operation: 'UPSERT',
      tenantId,
      storeId,
      hlc: orderHlc,
      payload: {
        id: update.itemId,
        stock: update.newStock,
        ...(update.newVariants ? { variants: update.newVariants } : {}),
        updatedAt: nowIso,
      },
    });
  }

  for (const lotDeduc of ingredientBatchDeductions) {
    stageStockLedgerInTransaction(transaction, {
      tenantId,
      storeId,
      itemType: 'RAW_BATCH',
      targetId: lotDeduc.batchId,
      sku: lotDeduc.sku,
      itemName: lotDeduc.itemName,
      deltaQty: lotDeduc.deltaQty,
      previousQty: lotDeduc.previousQty,
      balanceAfter: lotDeduc.newQty,
      reason: 'BOM_FIFO',
      orderId,
      orderCode,
      hlc: orderHlc,
    });
    stageSyncOutboxInTransaction(transaction, {
      entity: 'inventory_batches',
      entityId: lotDeduc.batchId,
      operation: 'UPSERT',
      tenantId,
      storeId,
      hlc: orderHlc,
      payload: {
        id: lotDeduc.batchId,
        quantity: lotDeduc.newQty,
        updatedAt: nowIso,
      },
    });
  }
}

export function stageOrderFinancialTableAndCrmInTx(params: {
  transaction: any;
  orderId: string;
  orderCode: string;
  tenantId: string;
  storeId: string;
  channel: string;
  effectivePaymentMethod: string;
  validatedTotal: number;
  isPaymentSettledAtCreation: boolean;
  authenticatedUser: any;
  openCashResult: { ref: any; snap: any } | null;
  resRef: any;
  resSnap: any;
  matchingTableDoc: any;
  crmRef: any;
  crmDocId: string;
  crmSnap: any;
  isPosCrmLink?: boolean;
  customerName?: string;
  customerPhone?: string;
  orderHlc: string;
  nowIso: string;
}): void {
  const {
    transaction,
    orderId,
    orderCode,
    tenantId,
    storeId,
    channel,
    effectivePaymentMethod,
    validatedTotal,
    isPaymentSettledAtCreation,
    authenticatedUser,
    openCashResult,
    resRef,
    resSnap,
    matchingTableDoc,
    crmRef,
    crmDocId,
    crmSnap,
    isPosCrmLink = false,
    customerName,
    customerPhone,
    orderHlc,
    nowIso,
  } = params;

  if (effectivePaymentMethod !== 'TABLE_BILL' && validatedTotal > 0) {
    const finId = `fin-ord-${orderId}`;
    const finRef = db.collection('financial_records').doc(finId);
    const finRecord = {
      id: finId,
      tenantId,
      storeId,
      type: 'RECEIVABLE',
      category: 'VENDAS',
      description: `Venda ${channel} ${orderCode} (${effectivePaymentMethod})`,
      amount: validatedTotal,
      dueDate: nowIso.split('T')[0],
      status: isPaymentSettledAtCreation ? 'PAID' : 'PENDING',
      paymentMethod: effectivePaymentMethod,
      ...(isPaymentSettledAtCreation
        ? {
            paymentConfirmationType: 'MANUAL_OPERATOR',
            settlementSource: 'POS_OPERATOR_COUNTER',
            confirmedByUid: authenticatedUser.uid,
            confirmedByRole: authenticatedUser.role,
            confirmedAt: nowIso,
            paidAt: nowIso,
          }
        : {}),
      orderId,
      hlc: orderHlc,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    transaction.set(finRef, finRecord);
    stageSyncOutboxInTransaction(transaction, {
      entity: 'financial_records',
      entityId: finId,
      operation: 'UPSERT',
      tenantId,
      storeId,
      hlc: orderHlc,
      payload: finRecord,
    });

    if (isPaymentSettledAtCreation && openCashResult) {
      settleOpenCashSessionInTransaction(
        transaction,
        openCashResult.ref,
        openCashResult.snap,
        validatedTotal,
        tenantId,
        storeId,
        orderHlc,
        nowIso
      );
    }
  }

  if (resSnap?.exists && resRef) {
    transaction.update(resRef, {
      status: 'COMPLETED',
      updatedAt: nowIso,
    });
  }

  if (matchingTableDoc) {
    transaction.update(db.collection('tables').doc(matchingTableDoc.id), {
      status: 'OCCUPIED',
      hlc: orderHlc,
      updatedAt: nowIso,
    });
    stageSyncOutboxInTransaction(transaction, {
      entity: 'tables',
      entityId: matchingTableDoc.id,
      operation: 'UPSERT',
      tenantId,
      storeId,
      hlc: orderHlc,
      payload: {
        ...matchingTableDoc.data(),
        id: matchingTableDoc.id,
        status: 'OCCUPIED',
        hlc: orderHlc,
        updatedAt: nowIso,
      },
    });
  }

  if (crmRef) {
    const existingCrm = crmSnap?.exists ? (crmSnap.data() || {}) : {};
    const prevOrders = Number(existingCrm.totalOrders) || 0;
    const prevSpent = Number(existingCrm.totalSpent) || 0;
    const prevPoints = Number(existingCrm.loyaltyPoints) || 0;
    const nextOrders = prevOrders + 1;
    const nextSpent = Math.round((prevSpent + validatedTotal) * 100) / 100;
    const nextPoints = prevPoints + Math.max(1, Math.floor(validatedTotal));
    const nextTier =
      nextSpent >= 1000 || nextOrders >= 15
        ? 'GOLD'
        : nextSpent >= 300 || nextOrders >= 5
        ? 'SILVER'
        : 'BRONZE';

    const crmPayload = {
      id: crmDocId,
      storeId,
      tenantId,
      customerId: isPosCrmLink ? (existingCrm.customerId || crmDocId) : authenticatedUser.uid,
      name: existingCrm.name || customerName || (!isPosCrmLink ? authenticatedUser?.name : '') || 'Cliente Loja',
      phone: customerPhone || existingCrm.phone || '',
      email: isPosCrmLink ? (existingCrm.email || '') : (authenticatedUser?.email || existingCrm.email || ''),
      totalOrders: nextOrders,
      totalSpent: nextSpent,
      loyaltyPoints: nextPoints,
      loyaltyTier: nextTier,
      lastOrderDate: nowIso.slice(0, 10),
      hlc: orderHlc,
      createdAt: existingCrm.createdAt || nowIso,
      updatedAt: nowIso,
    };
    transaction.set(crmRef, crmPayload, { merge: true });
    stageSyncOutboxInTransaction(transaction, {
      entity: 'customers_crm',
      entityId: crmDocId,
      operation: 'UPSERT',
      tenantId,
      storeId,
      hlc: orderHlc,
      payload: crmPayload,
    });
  }
}
