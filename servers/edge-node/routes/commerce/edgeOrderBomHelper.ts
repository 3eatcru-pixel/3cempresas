import {
  buildStockLedgerEntry,
  buildSyncOutboxEntry,
} from '../../../../src/server/persistence/PersistenceDriver.ts';
import { SqliteWalDriver } from '../../../../src/server/persistence/SqliteWalDriver.ts';
import { generateIdempotencyKey, isServiceCategory } from '@3c/commerce-engine';

export interface ConsolidatedOrderLine {
  menuItemId: string;
  quantity: number;
  notes?: string;
  variantId?: string;
  variantLabel?: string;
  serialNumber?: string;
}

export interface ProductWorkingState {
  data: any;
  initialStock: number;
  stock: number;
  variants: any[] | null;
  dirty: boolean;
  variantMovements: Array<{
    variantId: string;
    label?: string;
    previousQty: number;
    deltaQty: number;
    balanceAfter: number;
  }>;
}

export interface IngredientBatchDeduction {
  batch: any;
  previousQty: number;
  deltaQty: number;
  newQty: number;
}

export interface CouponUpdateTarget {
  id: string;
  data: any;
  nextUsageCount: number;
}

export function consolidateEdgeOrderLines(items: any[]): {
  consolidatedLines: ConsolidatedOrderLine[];
  totalQtyByMenuItem: Map<string, number>;
} {
  const consolidatedLinesMap = new Map<string, ConsolidatedOrderLine>();
  const totalQtyByMenuItem = new Map<string, number>();

  for (const line of items) {
    if (!line?.menuItemId || typeof line.menuItemId !== 'string') {
      throw new Error('Item com identificador (menuItemId) inválido ou ausente.');
    }
    const rawQty = Number(line.quantity);
    if (isNaN(rawQty) || rawQty <= 0 || !Number.isInteger(rawQty) || rawQty > 100) {
      throw new Error(`Quantidade inválida para o item '${line.menuItemId}': deve ser inteiro entre 1 e 100.`);
    }
    const prevProductTotal = totalQtyByMenuItem.get(line.menuItemId) || 0;
    if (prevProductTotal + rawQty > 100) {
      throw new Error(`Quantidade total acumulada para '${line.menuItemId}' excede 100 unidades.`);
    }
    totalQtyByMenuItem.set(line.menuItemId, prevProductTotal + rawQty);

    const lineKey = `${line.menuItemId}::${line.variantId || ''}::${line.serialNumber || ''}`;
    const existing = consolidatedLinesMap.get(lineKey);
    if (existing) {
      existing.quantity += rawQty;
    } else {
      consolidatedLinesMap.set(lineKey, {
        menuItemId: line.menuItemId,
        quantity: rawQty,
        notes: line.notes,
        variantId: line.variantId,
        variantLabel: line.variantLabel,
        serialNumber: line.serialNumber,
      });
    }
  }

  return {
    consolidatedLines: Array.from(consolidatedLinesMap.values()),
    totalQtyByMenuItem,
  };
}

export async function prepareEdgeOrderStockAndBom(params: {
  tx: any;
  driver: SqliteWalDriver;
  storeId: string;
  storeData: any;
  consolidatedLines: ConsolidatedOrderLine[];
  totalQtyByMenuItem: Map<string, number>;
}): Promise<{
  productWorkingState: Map<string, ProductWorkingState>;
  validatedItems: any[];
  calculatedSubtotal: number;
  ingredientBatchDeductions: IngredientBatchDeduction[];
}> {
  const { tx, driver, storeId, storeData, consolidatedLines, totalQtyByMenuItem } = params;
  const distinctMenuItemIds = Array.from(totalQtyByMenuItem.keys());
  const productWorkingState = new Map<string, ProductWorkingState>();

  for (const id of distinctMenuItemIds) {
    const itemSnap = await tx.get({ collectionName: 'menu_items', id });
    if (!itemSnap.exists) {
      throw new Error(`Produto '${id}' não existe no cache local do Edge.`);
    }
    const itemData = itemSnap.data();
    if (itemData.storeId && itemData.storeId !== storeId) {
      throw new Error(`Produto '${id}' não pertence à loja '${storeId}'.`);
    }
    if (itemData.isAvailable === false) {
      throw new Error(`Produto '${itemData.name || id}' encontra-se indisponível.`);
    }
    const initStock = typeof itemData.stock === 'number' ? itemData.stock : 0;
    productWorkingState.set(id, {
      data: itemData,
      initialStock: initStock,
      stock: initStock,
      variants: Array.isArray(itemData.variants)
        ? itemData.variants.map((v: any) => ({ ...v }))
        : null,
      dirty: false,
      variantMovements: [],
    });
  }

  let calculatedSubtotal = 0;
  const validatedItems: any[] = [];
  const totalRawMaterialsNeeded = new Map<string, { sku: string; name: string; quantityNeeded: number }>();

  for (const line of consolidatedLines) {
    const state = productWorkingState.get(line.menuItemId)!;
    const itemData = state.data;
    const isService =
      itemData.specs?.segment === 'SERVICE' ||
      (!itemData.specs?.segment && isServiceCategory(storeData.category));

    if (!isService) {
      if (state.stock < line.quantity) {
        throw new Error(`Estoque insuficiente no Edge para '${itemData.name}'. Disponível: ${state.stock}, Solicitado: ${line.quantity}.`);
      }
      state.stock -= line.quantity;
      state.dirty = true;

      if (line.variantId && state.variants) {
        const vIdx = state.variants.findIndex((v: any) => v.id === line.variantId);
        if (vIdx < 0) {
          throw new Error(`Variação '${line.variantLabel || line.variantId}' não encontrada para '${itemData.name}'.`);
        }
        const currentVarStock = Number(state.variants[vIdx].stock) || 0;
        if (currentVarStock < line.quantity) {
          throw new Error(
            `Estoque insuficiente da variação '${line.variantLabel || line.variantId}' de '${itemData.name}'.`
          );
        }
        const nextVarStock = currentVarStock - line.quantity;
        state.variants[vIdx].stock = nextVarStock;
        state.variantMovements.push({
          variantId: line.variantId,
          label: line.variantLabel,
          previousQty: currentVarStock,
          deltaQty: -line.quantity,
          balanceAfter: nextVarStock,
        });
      }
    }

    if (Array.isArray(itemData.recipe)) {
      for (const recipeItem of itemData.recipe) {
        const ingredientSku = recipeItem.ingredientId || recipeItem.sku;
        if (!ingredientSku) continue;
        const ingredientName = recipeItem.ingredientName || ingredientSku;
        const reqQty = (Number(recipeItem.quantityRequired ?? recipeItem.qty) || 0) * line.quantity;
        const existingNeed = totalRawMaterialsNeeded.get(ingredientSku);
        if (existingNeed) {
          existingNeed.quantityNeeded += reqQty;
        } else {
          totalRawMaterialsNeeded.set(ingredientSku, {
            sku: ingredientSku,
            name: ingredientName,
            quantityNeeded: reqQty,
          });
        }
      }
    }

    const price = Math.max(0, Number(itemData.price) || 0);
    calculatedSubtotal += price * line.quantity;
    const itemEntry: any = {
      menuItemId: line.menuItemId,
      name: line.variantLabel ? `${itemData.name} [${line.variantLabel}]` : itemData.name,
      price,
      quantity: line.quantity,
    };
    if (line.notes) itemEntry.notes = line.notes;
    if (line.variantId) itemEntry.variantId = line.variantId;
    if (line.variantLabel) itemEntry.variantLabel = line.variantLabel;
    if (line.serialNumber) itemEntry.serialNumber = line.serialNumber;
    validatedItems.push(itemEntry);
  }

  const ingredientBatchDeductions: IngredientBatchDeduction[] = [];
  if (totalRawMaterialsNeeded.size > 0) {
    const allowSharedWarehouse = Boolean(storeData?.operationalSettings?.sharedWarehouseMode);
    const allLocalBatches = (await driver.listDocs<any>('inventory_batches')).filter(
      (b) => !b._deleted && (b.storeId === storeId || (allowSharedWarehouse && !b.storeId))
    );
    const batchStockMap = new Map<string, number>();
    allLocalBatches.forEach((b) => batchStockMap.set(b.id, Number(b.quantity) || 0));

    for (const [ingredientSku, need] of totalRawMaterialsNeeded.entries()) {
      const matchingBatches = allLocalBatches
        .filter((b) => b.sku === ingredientSku)
        .sort(
          (a, b) =>
            new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime()
        );
      const totalAvail = matchingBatches.reduce((acc, b) => acc + (batchStockMap.get(b.id) || 0), 0);
      if (totalAvail < need.quantityNeeded) {
        throw new Error(
          `Estoque insuficiente de insumos (Ficha Técnica) no Edge. Matéria-prima: '${need.name || ingredientSku}'. Necessário: ${need.quantityNeeded.toFixed(2)}, Disponível: ${totalAvail.toFixed(2)}.`
        );
      }

      let remaining = need.quantityNeeded;
      for (const batch of matchingBatches) {
        if (remaining <= 0) break;
        const currentQty = batchStockMap.get(batch.id) || 0;
        if (currentQty <= 0) continue;
        const deduct = Math.min(currentQty, remaining);
        const newQty = Math.round((currentQty - deduct) * 1000) / 1000;
        batchStockMap.set(batch.id, newQty);
        ingredientBatchDeductions.push({
          batch,
          previousQty: currentQty,
          deltaQty: -Math.round(deduct * 1000) / 1000,
          newQty,
        });
        remaining -= deduct;
      }
    }
  }

  return {
    productWorkingState,
    validatedItems,
    calculatedSubtotal,
    ingredientBatchDeductions,
  };
}

export async function computeEdgeDeliveryAndDiscount(params: {
  driver: SqliteWalDriver;
  storeId: string;
  storeData: any;
  subtotal: number;
  deliveryModality: string;
  channel: string;
  couponCode?: string;
}): Promise<{
  numDeliveryFee: number;
  numDiscount: number;
  couponUpdateTarget: CouponUpdateTarget | null;
}> {
  const { driver, storeId, storeData, subtotal, deliveryModality, channel, couponCode } = params;

  let numDeliveryFee = 0;
  if (deliveryModality !== 'PICKUP' && channel !== 'PICKUP' && channel !== 'WAITER_TABLE' && channel !== 'TABLE') {
    if (
      deliveryModality === 'STORE_FLEET' &&
      typeof storeData.ownFleetCustomFee === 'number' &&
      Number.isFinite(storeData.ownFleetCustomFee)
    ) {
      numDeliveryFee = Math.max(0, storeData.ownFleetCustomFee);
    } else {
      numDeliveryFee = Math.max(0, Number(storeData.deliveryFee) || 0);
    }
  }

  let numDiscount = 0;
  let couponUpdateTarget: CouponUpdateTarget | null = null;
  if (couponCode && typeof couponCode === 'string' && couponCode.trim().length > 0) {
    const queryCode = couponCode.trim().toUpperCase();
    const localCoupons = await driver.listDocs<any>('coupons');
    const couponData = localCoupons.find(
      (c) =>
        !c._deleted &&
        c.audience !== 'MERCHANT' &&
        (c.code?.toUpperCase() === queryCode || c.id?.toUpperCase() === queryCode)
    );
    if (couponData) {
      const valDate = couponData.validUntil || couponData.expiresAt;
      const expTs = valDate ? new Date(valDate).getTime() : NaN;
      const isExpired = valDate ? (!Number.isFinite(expTs) || expTs < Date.now()) : false;
      const isStoreValid = !couponData.storeId || couponData.storeId === storeId;
      const usageCount = couponData.usageCount || 0;
      const usageLimit = couponData.usageLimit || 999999;
      if (
        couponData.isActive !== false &&
        !isExpired &&
        isStoreValid &&
        usageCount < usageLimit &&
        subtotal >= (couponData.minOrderValue || 0)
      ) {
        const rawDiscount =
          couponData.discountType === 'PERCENT'
            ? (subtotal * Number(couponData.discountValue || 0)) / 100
            : Math.max(0, Number(couponData.discountValue) || 0);
        const cappedDiscount =
          couponData.maxDiscount && rawDiscount > Number(couponData.maxDiscount)
            ? Number(couponData.maxDiscount)
            : rawDiscount;
        numDiscount = Math.round(Math.min(subtotal, Math.max(0, cappedDiscount)) * 100) / 100;
        couponUpdateTarget = { id: couponData.id, data: couponData, nextUsageCount: usageCount + 1 };
      }
    }
  }

  return { numDeliveryFee, numDiscount, couponUpdateTarget };
}

export function applyEdgeOrderStockAndCouponWrites(params: {
  tx: any;
  tenantId: string;
  storeId: string;
  nodeId: string;
  hlc: string;
  nowIso: string;
  orderId: string;
  orderCode: string;
  couponUpdateTarget: CouponUpdateTarget | null;
  productWorkingState: Map<string, ProductWorkingState>;
  ingredientBatchDeductions: IngredientBatchDeduction[];
}): void {
  const {
    tx,
    tenantId,
    storeId,
    nodeId,
    hlc,
    nowIso,
    orderId,
    orderCode,
    couponUpdateTarget,
    productWorkingState,
    ingredientBatchDeductions,
  } = params;

  if (couponUpdateTarget) {
    const cpnData = couponUpdateTarget.data || {};
    tx.update(
      { collectionName: 'coupons', id: couponUpdateTarget.id },
      { usageCount: couponUpdateTarget.nextUsageCount, hlc, updatedAt: nowIso }
    );
    const couponOutbox = {
      ...buildSyncOutboxEntry({
        entity: 'coupons',
        entityId: couponUpdateTarget.id,
        operation: 'UPSERT',
        tenantId: cpnData.tenantId || tenantId,
        storeId: cpnData.storeId || storeId,
        nodeId,
        hlc,
        idempotencyKey: generateIdempotencyKey(),
        payload: {
          id: couponUpdateTarget.id,
          usageCount: couponUpdateTarget.nextUsageCount,
        },
      }),
      deltaUsage: 1,
    };
    tx.set({ collectionName: 'sync_outbox', id: couponOutbox.id }, couponOutbox, { merge: false });
  }

  for (const [itemId, state] of productWorkingState.entries()) {
    if (!state.dirty) continue;
    const patch: any = { stock: state.stock, hlc, updatedAt: nowIso };
    if (state.variants) patch.variants = state.variants;
    tx.update({ collectionName: 'menu_items', id: itemId }, patch);

    const ledger = buildStockLedgerEntry({
      tenantId,
      storeId,
      itemType: 'MENU_ITEM',
      targetId: itemId,
      itemName: state.data.name,
      deltaQty: state.stock - state.initialStock,
      previousQty: state.initialStock,
      balanceAfter: state.stock,
      reason: 'SALE',
      orderId,
      orderCode,
      nodeId,
      hlc,
    });
    tx.set({ collectionName: 'stock_ledger', id: ledger.id }, ledger, { merge: false });

    for (const vm of state.variantMovements) {
      const vLedger = buildStockLedgerEntry({
        tenantId,
        storeId,
        itemType: 'VARIANT',
        targetId: `${itemId}::${vm.variantId}`,
        itemName: `${state.data.name} [${vm.label || vm.variantId}]`,
        deltaQty: vm.deltaQty,
        previousQty: vm.previousQty,
        balanceAfter: vm.balanceAfter,
        reason: 'SALE',
        orderId,
        orderCode,
        nodeId,
        hlc,
      });
      tx.set({ collectionName: 'stock_ledger', id: vLedger.id }, vLedger, { merge: false });
    }

    const stockOutbox = {
      ...buildSyncOutboxEntry({
        entity: 'menu_items',
        entityId: itemId,
        operation: 'UPSERT',
        tenantId,
        storeId,
        nodeId,
        hlc,
        idempotencyKey: generateIdempotencyKey(),
        payload: { id: itemId, name: state.data.name },
      }),
      deltaQty: state.stock - state.initialStock,
      ...(state.variantMovements.length > 0
        ? {
            variantDeltas: state.variantMovements.map((vm) => ({
              variantId: vm.variantId,
              deltaQty: vm.deltaQty,
            })),
          }
        : {}),
    };
    tx.set({ collectionName: 'sync_outbox', id: stockOutbox.id }, stockOutbox, { merge: false });
  }

  for (const deduc of ingredientBatchDeductions) {
    tx.update(
      { collectionName: 'inventory_batches', id: deduc.batch.id },
      { quantity: deduc.newQty, hlc, updatedAt: nowIso }
    );
    const rawLedger = buildStockLedgerEntry({
      tenantId,
      storeId,
      itemType: 'RAW_BATCH',
      targetId: deduc.batch.id,
      sku: deduc.batch.sku,
      itemName: deduc.batch.name || deduc.batch.sku,
      deltaQty: deduc.deltaQty,
      previousQty: deduc.previousQty,
      balanceAfter: deduc.newQty,
      reason: 'BOM_FIFO',
      orderId,
      orderCode,
      nodeId,
      hlc,
    });
    tx.set({ collectionName: 'stock_ledger', id: rawLedger.id }, rawLedger, { merge: false });

    const batchOutbox = {
      ...buildSyncOutboxEntry({
        entity: 'inventory_batches',
        entityId: deduc.batch.id,
        operation: 'UPSERT',
        tenantId,
        storeId,
        nodeId,
        hlc,
        idempotencyKey: generateIdempotencyKey(),
        payload: {
          id: deduc.batch.id,
          sku: deduc.batch.sku,
          name: deduc.batch.name,
        },
      }),
      deltaQty: deduc.deltaQty,
    };
    tx.set({ collectionName: 'sync_outbox', id: batchOutbox.id }, batchOutbox, { merge: false });
  }
}
