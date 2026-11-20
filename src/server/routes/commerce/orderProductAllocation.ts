import { db } from '../../config.ts';
import { isServiceCategory } from '../../../utils/storeDomain.ts';

export function validateDeliveryCoordinates(
  deliveryLatitude: unknown,
  deliveryLongitude: unknown
): { hasDeliveryLat: boolean; hasDeliveryLng: boolean; error: string | null } {
  const hasDeliveryLat = deliveryLatitude !== undefined && deliveryLatitude !== null;
  const hasDeliveryLng = deliveryLongitude !== undefined && deliveryLongitude !== null;
  if (hasDeliveryLat !== hasDeliveryLng) {
    return {
      hasDeliveryLat,
      hasDeliveryLng,
      error: 'Coordenadas de entrega incompletas: informe latitude e longitude juntas.',
    };
  }
  if (hasDeliveryLat && hasDeliveryLng) {
    if (
      typeof deliveryLatitude !== 'number' ||
      !Number.isFinite(deliveryLatitude) ||
      deliveryLatitude < -90 ||
      deliveryLatitude > 90 ||
      typeof deliveryLongitude !== 'number' ||
      !Number.isFinite(deliveryLongitude) ||
      deliveryLongitude < -180 ||
      deliveryLongitude > 180
    ) {
      return {
        hasDeliveryLat,
        hasDeliveryLng,
        error: 'Coordenadas de entrega inválidas (latitude -90..90, longitude -180..180).',
      };
    }
  }
  return { hasDeliveryLat, hasDeliveryLng, error: null };
}

export async function allocateAndPriceOrderItemsInTx(params: {
  transaction: any;
  storeId: string;
  storeData: Record<string, any>;
  consolidatedLines: Array<{
    menuItemId: string;
    quantity: number;
    notes?: string;
    variantId?: string;
    variantLabel?: string;
    serialNumber?: string;
  }>;
  totalQtyByMenuItem: Map<string, number>;
}) {
  const { transaction, storeId, storeData, consolidatedLines, totalQtyByMenuItem } = params;
  const distinctMenuItemIds = Array.from(totalQtyByMenuItem.keys());
  const itemRefsMap = new Map<string, any>();
  distinctMenuItemIds.forEach((id) => itemRefsMap.set(id, db.collection('menu_items').doc(id)));

  const itemSnapshotsList = await Promise.all(
    distinctMenuItemIds.map((id) => transaction.get(itemRefsMap.get(id)))
  );
  const itemSnapMap = new Map<string, any>();
  distinctMenuItemIds.forEach((id, idx) => itemSnapMap.set(id, itemSnapshotsList[idx]));

  const productWorkingState = new Map<
    string,
    {
      data: any;
      ref: any;
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
  >();

  for (const id of distinctMenuItemIds) {
    const snap = itemSnapMap.get(id);
    const ref = itemRefsMap.get(id);
    if (!snap.exists) {
      throw new Error(`Produto '${ref.id}' não existe no catálogo oficial.`);
    }
    const productData = snap.data() || {};
    if (productData.storeId !== storeId) {
      throw new Error(`Produto '${productData.name || ref.id}' não pertence ao estabelecimento '${storeId}'.`);
    }
    if (productData.isAvailable === false) {
      throw new Error(`Produto '${productData.name}' está temporariamente indisponível.`);
    }
    const initialProductStock = typeof productData.stock === 'number' ? productData.stock : 0;
    productWorkingState.set(id, {
      data: productData,
      ref,
      initialStock: initialProductStock,
      stock: initialProductStock,
      variants: Array.isArray(productData.variants)
        ? productData.variants.map((v: any) => ({ ...v }))
        : null,
      dirty: false,
      variantMovements: [],
    });
  }

  const itemReads = distinctMenuItemIds.map((id) => ({
    ref: itemRefsMap.get(id),
    requestedQty: totalQtyByMenuItem.get(id) || 0,
  }));

  let calculatedSubtotal = 0;
  const validatedItems: any[] = [];
  const isServiceStore = isServiceCategory(storeData.category);

  for (const line of consolidatedLines) {
    const state = productWorkingState.get(line.menuItemId)!;
    const productData = state.data;
    const isServiceItem =
      productData.specs?.segment === 'SERVICE' ||
      (!productData.specs?.segment && isServiceStore);

    if (!isServiceItem) {
      if (typeof productData.stock !== 'number') {
        throw new Error(`Estoque do produto '${productData.name}' não está configurado.`);
      }
      if (state.stock < line.quantity) {
        throw new Error(
          `Estoque insuficiente para '${productData.name}'. Disponível: ${state.stock}, Solicitado: ${line.quantity}.`
        );
      }
      state.stock -= line.quantity;
      state.dirty = true;

      if (line.variantId && state.variants) {
        const vIdx = state.variants.findIndex((v: any) => v.id === line.variantId);
        if (vIdx < 0) {
          throw new Error(
            `Variação '${line.variantLabel || line.variantId}' não encontrada para '${productData.name}'.`
          );
        }
        const currentVarStock = Number(state.variants[vIdx].stock) || 0;
        if (currentVarStock < line.quantity) {
          throw new Error(
            `Estoque insuficiente da variação '${line.variantLabel || line.variantId}' de '${productData.name}'. Disponível: ${currentVarStock}, Solicitado: ${line.quantity}.`
          );
        }
        const balanceAfterVar = currentVarStock - line.quantity;
        state.variants[vIdx].stock = balanceAfterVar;
        state.variantMovements.push({
          variantId: line.variantId,
          label: line.variantLabel,
          previousQty: currentVarStock,
          deltaQty: -line.quantity,
          balanceAfter: balanceAfterVar,
        });
      }
    }

    const officialUnitPrice = Math.max(0, Number(productData.price) || 0);
    calculatedSubtotal += officialUnitPrice * line.quantity;

    const itemEntry: any = {
      menuItemId: line.menuItemId,
      name: line.variantLabel
        ? `${productData.name || 'Item de Cardápio'} [${line.variantLabel}]`
        : productData.name || 'Item de Cardápio',
      price: officialUnitPrice,
      quantity: line.quantity,
    };
    if (line.notes) itemEntry.notes = line.notes;
    if (line.variantId) itemEntry.variantId = line.variantId;
    if (line.variantLabel) itemEntry.variantLabel = line.variantLabel;
    if (line.serialNumber) itemEntry.serialNumber = line.serialNumber;
    validatedItems.push(itemEntry);
  }

  const stockUpdates = Array.from(productWorkingState.entries())
    .filter(([, state]) => state.dirty)
    .map(([itemId, state]) => ({
      ref: state.ref,
      itemId,
      itemName: state.data?.name || itemId,
      initialStock: state.initialStock,
      newStock: state.stock,
      newVariants: state.variants,
      variantMovements: state.variantMovements,
    }));

  return {
    itemSnapMap,
    itemReads,
    validatedItems,
    stockUpdates,
    subtotal: Math.round(calculatedSubtotal * 100) / 100,
  };
}
