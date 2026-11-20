import { db } from '../../config.ts';

export interface ConsolidatedOrderLine {
  menuItemId: string;
  quantity: number;
  notes?: string;
  variantId?: string;
  variantLabel?: string;
  serialNumber?: string;
}

export interface IngredientBatchDeduction {
  batchId: string;
  sku: string;
  itemName: string;
  previousQty: number;
  deltaQty: number;
  newQty: number;
}

export function consolidateOrderLines(items: any[]): {
  consolidatedLines: ConsolidatedOrderLine[];
  totalQtyByMenuItem: Map<string, number>;
} {
  const consolidatedLinesMap = new Map<string, ConsolidatedOrderLine>();
  const totalQtyByMenuItem = new Map<string, number>();

  for (const i of items) {
    if (!i.menuItemId || typeof i.menuItemId !== 'string') {
      throw new Error('Item com identificador (menuItemId) inválido ou ausente.');
    }

    const rawQty = Number(i.quantity);
    if (isNaN(rawQty) || rawQty <= 0 || !Number.isInteger(rawQty)) {
      throw new Error(`Quantidade inválida para o item '${i.menuItemId}': deve ser um número inteiro positivo.`);
    }
    if (rawQty > 100) {
      throw new Error('Quantidade excede o limite máximo permitido de 100 unidades por produto.');
    }

    const prevProductTotal = totalQtyByMenuItem.get(i.menuItemId) || 0;
    if (prevProductTotal + rawQty > 100) {
      throw new Error(`Quantidade total acumulada para '${i.menuItemId}' excede 100 unidades.`);
    }
    totalQtyByMenuItem.set(i.menuItemId, prevProductTotal + rawQty);

    const lineKey = `${i.menuItemId}::${i.variantId || ''}::${i.serialNumber || ''}`;
    const existing = consolidatedLinesMap.get(lineKey);
    if (existing) {
      existing.quantity += rawQty;
    } else {
      consolidatedLinesMap.set(lineKey, {
        menuItemId: i.menuItemId,
        quantity: rawQty,
        notes: i.notes,
        variantId: i.variantId,
        variantLabel: i.variantLabel,
        serialNumber: i.serialNumber,
      });
    }
  }

  return {
    consolidatedLines: Array.from(consolidatedLinesMap.values()),
    totalQtyByMenuItem,
  };
}

export async function calculateOrderCouponInTx(params: {
  transaction: any;
  couponCode: unknown;
  tenantId: string;
  storeId: string;
  subtotal: number;
}): Promise<{
  numDiscount: number;
  couponUpdateTask: { ref: any; nextUsageCount: number; data: any } | null;
}> {
  const { transaction, couponCode, tenantId, storeId, subtotal } = params;
  if (!couponCode || typeof couponCode !== 'string' || couponCode.trim().length === 0) {
    return { numDiscount: 0, couponUpdateTask: null };
  }

  const queryCode = couponCode.trim().toUpperCase();
  const couponsSnap = await db.collection('coupons').get();
  const couponDoc = couponsSnap.docs.find((d) => {
    const data = d.data();
    if (!data || data._deleted || data.isActive === false) return false;
    if (data.audience === 'MERCHANT') return false;
    if (data.tenantId && data.tenantId !== tenantId) return false;
    if (data.storeId && data.storeId !== storeId) return false;
    return data.code?.toUpperCase() === queryCode || data.id?.toUpperCase() === queryCode;
  });

  if (!couponDoc) {
    return { numDiscount: 0, couponUpdateTask: null };
  }

  const couponRef = db.collection('coupons').doc(couponDoc.id);
  const couponSnap = await transaction.get(couponRef);
  if (!couponSnap.exists) {
    return { numDiscount: 0, couponUpdateTask: null };
  }

  const couponData = couponSnap.data() || {};
  const valDate = couponData.validUntil || couponData.expiresAt;
  const expTs = valDate ? new Date(valDate).getTime() : NaN;
  const isExpired = valDate ? (!Number.isFinite(expTs) || expTs < Date.now()) : false;
  const isStoreValid = !couponData.storeId || couponData.storeId === storeId;
  const usageCount = couponData.usageCount || 0;
  const usageLimit = couponData.usageLimit || 999999;

  if (
    couponData.audience === 'MERCHANT' ||
    couponData.isActive === false ||
    couponData._deleted ||
    isExpired ||
    !isStoreValid ||
    usageCount >= usageLimit
  ) {
    return { numDiscount: 0, couponUpdateTask: null };
  }

  const minOrder = couponData.minOrderValue || 0;
  if (subtotal < minOrder) {
    return { numDiscount: 0, couponUpdateTask: null };
  }

  const rawDiscount =
    couponData.discountType === 'PERCENT'
      ? (subtotal * couponData.discountValue) / 100
      : Math.max(0, Number(couponData.discountValue) || 0);
  const cappedDiscount =
    couponData.maxDiscount && rawDiscount > Number(couponData.maxDiscount)
      ? Number(couponData.maxDiscount)
      : rawDiscount;
  const numDiscount = Math.round(Math.min(subtotal, Math.max(0, cappedDiscount)) * 100) / 100;

  return {
    numDiscount,
    couponUpdateTask: { ref: couponRef, nextUsageCount: usageCount + 1, data: couponData },
  };
}

export async function planBomFifoBatchDeductions(params: {
  itemReads: Array<{ ref: any; requestedQty: number }>;
  itemSnapMap: Map<string, any>;
  tenantId: string;
  storeId: string;
  allowSharedWarehouse: boolean;
}): Promise<IngredientBatchDeduction[]> {
  const { itemReads, itemSnapMap, tenantId, storeId, allowSharedWarehouse } = params;

  const totalRawMaterialsNeeded = new Map<string, { sku: string; name: string; quantityNeeded: number }>();
  for (const ir of itemReads) {
    const itemSnap = itemSnapMap.get(ir.ref.id);
    const itemData = itemSnap?.data();
    if (itemData?.recipe && Array.isArray(itemData.recipe)) {
      for (const recipeItem of itemData.recipe) {
        const ingredientSku = recipeItem.ingredientId || recipeItem.sku;
        const ingredientName = recipeItem.ingredientName || ingredientSku;
        const requiredForThisItem = (Number(recipeItem.quantityRequired ?? recipeItem.qty) || 0) * ir.requestedQty;

        const existing = totalRawMaterialsNeeded.get(ingredientSku);
        if (existing) {
          existing.quantityNeeded += requiredForThisItem;
        } else {
          totalRawMaterialsNeeded.set(ingredientSku, {
            sku: ingredientSku,
            name: ingredientName,
            quantityNeeded: requiredForThisItem,
          });
        }
      }
    }
  }

  if (totalRawMaterialsNeeded.size === 0) {
    return [];
  }

  const batchesSnap = await db.collection('inventory_batches').get();
  const allTenantBatches = batchesSnap.docs
    .map((d) => ({ ...d.data(), id: d.id }))
    .filter(
      (b) =>
        !b._deleted &&
        b.tenantId === tenantId &&
        (b.storeId === storeId || (allowSharedWarehouse && !b.storeId))
    );

  const batchCurrentStockMap = new Map<string, number>();
  allTenantBatches.forEach((b) => batchCurrentStockMap.set(b.id, Number(b.quantity) || 0));

  const ingredientBatchDeductions: IngredientBatchDeduction[] = [];

  for (const [ingredientSku, need] of totalRawMaterialsNeeded.entries()) {
    const matchingBatches = allTenantBatches
      .filter((b) => b.sku === ingredientSku)
      .sort((a, b) => new Date(a.expirationDate || 0).getTime() - new Date(b.expirationDate || 0).getTime());

    const totalAvailableForIngredient = matchingBatches.reduce((acc, b) => acc + (batchCurrentStockMap.get(b.id) || 0), 0);

    if (totalAvailableForIngredient < need.quantityNeeded) {
      throw new Error(
        `Estoque insuficiente de insumos (Ficha Técnica). Matéria-prima: '${need.name || ingredientSku}'. Necessário: ${need.quantityNeeded.toFixed(2)}, Disponível: ${totalAvailableForIngredient.toFixed(2)}.`
      );
    }

    let remainingToDeduct = need.quantityNeeded;
    for (const batch of matchingBatches) {
      if (remainingToDeduct <= 0) break;
      const currentBatchQty = batchCurrentStockMap.get(batch.id) || 0;
      if (currentBatchQty <= 0) continue;

      const deductFromThisLot = Math.min(currentBatchQty, remainingToDeduct);
      const newLotQty = Math.round((currentBatchQty - deductFromThisLot) * 1000) / 1000;
      batchCurrentStockMap.set(batch.id, newLotQty);
      ingredientBatchDeductions.push({
        batchId: batch.id,
        sku: batch.sku || ingredientSku,
        itemName: batch.name || need.name || ingredientSku,
        previousQty: currentBatchQty,
        deltaQty: -Math.round(deductFromThisLot * 1000) / 1000,
        newQty: newLotQty,
      });
      remainingToDeduct -= deductFromThisLot;
    }
  }

  return ingredientBatchDeductions;
}
