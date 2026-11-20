import { useState } from 'react';
import { Order, Store } from '../../../../types';
import { CommerceService } from '../../../../services/CommerceService';

interface UseRetailExchangeAndReturnParams {
  currentStore: Store;
  orders: Order[];
  showNotification: (msg: string) => void;
  getIdToken: () => Promise<string | null | undefined>;
}

export function useRetailExchangeAndReturn({
  currentStore,
  orders,
  showNotification,
  getIdToken,
}: UseRetailExchangeAndReturnParams) {
  const [returningIdx, setReturningIdx] = useState<number | null>(null);
  const [isExchangeOpen, setIsExchangeOpen] = useState(false);
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [selectedExchangeOrder, setSelectedExchangeOrder] = useState<Order | null>(null);
  const [exchangeReason, setExchangeReason] = useState('Troca de Tamanho / Variação');

  const handleProcessReturnItem = async (order: Order, itemIdx: number) => {
    const orderItem = order.items[itemIdx];
    if (!orderItem) return;

    const alreadyReturned = Number(orderItem.returnedQuantity) || 0;
    const remaining = Math.max(0, (Number(orderItem.quantity) || 0) - alreadyReturned);
    if (remaining <= 0) {
      showNotification(`Item "${orderItem.name}" já foi totalmente estornado.`);
      return;
    }

    const token = await getIdToken();
    if (!token) {
      showNotification('Sessão expirada. Faça login novamente para processar estornos.');
      return;
    }

    setReturningIdx(itemIdx);
    try {
      const res = await CommerceService.returnOrderItem({
        orderId: order.id,
        itemIndex: itemIdx,
        menuItemId: orderItem.menuItemId,
        variantId: orderItem.variantId,
        quantity: remaining,
        reason: exchangeReason,
        token,
      });

      if (!res.success) {
        showNotification(res.error || 'Não foi possível processar o estorno do item.');
        return;
      }

      if (res.order) {
        setSelectedExchangeOrder(res.order);
      }

      showNotification(
        `Estorno atômico de "${orderItem.name}" (${order.code}) concluído! Estoque e lançamento financeiro atualizados.`
      );
    } finally {
      setReturningIdx(null);
    }
  };

  const storeOrdersForExchange = orders
    .filter(
      (o) =>
        o.storeId === currentStore.id &&
        (o.code.toLowerCase().includes(exchangeSearch.toLowerCase()) ||
          o.customerName.toLowerCase().includes(exchangeSearch.toLowerCase()))
    )
    .slice(0, 12);

  return {
    isExchangeOpen,
    setIsExchangeOpen,
    exchangeSearch,
    setExchangeSearch,
    selectedExchangeOrder,
    setSelectedExchangeOrder,
    exchangeReason,
    setExchangeReason,
    storeOrdersForExchange,
    returningIdx,
    handleProcessReturnItem,
  };
}
