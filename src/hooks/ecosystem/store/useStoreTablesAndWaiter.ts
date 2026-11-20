import React from 'react';
import { StorageAdapter } from '../../../services/adapters/StorageAdapterTypes';
import { CommerceService } from '../../../services/CommerceService';
import { DiningTable, MenuItem, Order, Store, TableStatus } from '../../../types';
import { EMPTY_STORE_PLACEHOLDER } from '../../../constants/platformDefaults';
import { generateStandardId, generateTableId } from '../../../utils/idGenerator';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { syncEngine } from '../../../core/sync/SyncEngine';

interface UseStoreTablesAndWaiterParams {
  adapter: StorageAdapter;
  stores: Store[];
  selectedStoreId: string;
  profile: any;
  setTables: React.Dispatch<React.SetStateAction<DiningTable[]>>;
  resolveActiveTenantId: (targetStoreId?: string) => string;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
}

export const useStoreTablesAndWaiter = ({
  adapter,
  stores,
  selectedStoreId,
  profile,
  setTables,
  resolveActiveTenantId,
  getIdToken,
  showNotification,
}: UseStoreTablesAndWaiterParams) => {
  const updateTableStatus = async (tableId: string, status: TableStatus) => {
    const platform = getPlatformAdapters();
    if (!platform.network.isOnline() && !platform.network.getEdgeBaseUrl()) {
      await syncEngine.enqueueMutation({
        entity: 'tables',
        entityId: tableId,
        storeId: selectedStoreId,
        appId: 'waiter',
        payload: { id: tableId, status, storeId: selectedStoreId },
      });
      showNotification(`Mesa ${status} salva na fila offline!`);
      return;
    }
    try {
      await adapter.updateTableStatus(tableId, status);
      showNotification(`Mesa atualizada para ${status}`);
    } catch {
      await syncEngine.enqueueMutation({
        entity: 'tables',
        entityId: tableId,
        storeId: selectedStoreId,
        appId: 'waiter',
        payload: { id: tableId, status, storeId: selectedStoreId },
      });
      showNotification(`Rede instável! Mesa ${status} enfileirada para sync.`);
    }
  };

  const createWaiterTableOrder = async (
    tableNumber: number,
    items: { menuItem: MenuItem; qty: number }[],
    waiterName: string
  ): Promise<Order | null> => {
    const store = stores.find((s) => s.id === selectedStoreId) || stores[0] || EMPTY_STORE_PLACEHOLDER;
    if (!store.id) {
      showNotification('Nenhuma loja ativa selecionada para lançar comanda.');
      return null;
    }
    const subtotal = items.reduce((sum, i) => sum + i.menuItem.price * i.qty, 0);
    const platform = getPlatformAdapters();

    if (!platform.network.isOnline() && !platform.network.getEdgeBaseUrl()) {
      const offlineOrderId = generateStandardId('ord');
      const offlineOrder: any = {
        id: offlineOrderId,
        code: `#M-${Math.floor(1000 + Math.random() * 9000)}`,
        storeId: store.id,
        tenantId: resolveActiveTenantId(store.id),
        channel: 'TABLE',
        tableNumber,
        customerName: `Mesa ${tableNumber}`,
        waiterName,
        items: items.map((i) => ({
          menuItemId: i.menuItem.id,
          name: i.menuItem.name,
          price: i.menuItem.price,
          quantity: i.qty,
          notes: (i as any).notes || '',
        })),
        total: subtotal,
        paymentMethod: 'TABLE_BILL',
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
      };
      await syncEngine.enqueueMutation({
        entity: 'orders',
        entityId: offlineOrderId,
        storeId: store.id,
        appId: 'waiter',
        payload: offlineOrder,
      });
      showNotification(`Sem internet: Comanda Mesa ${tableNumber} enfileirada para sincronização.`);
      return offlineOrder;
    }

    const token = await getIdToken();
    if (!token) {
      showNotification('Sessão expirada ou não autenticada. Faça login novamente para lançar comandas.');
      return null;
    }

    const orderData: any = {
      storeId: store.id,
      channel: 'TABLE',
      tableNumber,
      customerName: `Mesa ${tableNumber}`,
      waiterName,
      items: items.map((i) => ({
        menuItemId: i.menuItem.id,
        name: i.menuItem.name,
        price: i.menuItem.price,
        quantity: i.qty,
        notes: (i as any).notes || '',
      })),
      total: subtotal,
      paymentMethod: 'TABLE_BILL',
      token,
    };
    const result = await CommerceService.placeOrder(orderData);
    if (result.success) {
      showNotification(`Pedido da Mesa ${tableNumber} enviado à cozinha!`);
      const created = { id: result.transaction.orderId, code: result.transaction.code, ...orderData };
      return created;
    }
    showNotification(result.error || `Erro ao enviar pedido da Mesa ${tableNumber}.`);
    return null;
  };

  const addTable = async (tableNumber: number, capacity = 4) => {
    try {
      const store = stores.find((s) => s.id === selectedStoreId) || stores[0] || EMPTY_STORE_PLACEHOLDER;
      if (!store.id) {
        showNotification('Nenhuma loja ativa selecionada para criar mesas.');
        return;
      }
      const newTable: DiningTable = {
        id: generateTableId(),
        tableNumber,
        capacity,
        status: 'FREE',
        storeId: store.id,
        tenantId: store.tenantId || profile?.tenantId || 'tenant-1',
        activeItemsCount: 0,
        totalAmount: 0,
      };
      await adapter.saveTable(newTable);
      setTables((prev) => [...prev.filter((t) => t.id !== newTable.id), newTable]);
      showNotification(`Mesa #${tableNumber} criada para ${store.name}!`);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao criar mesa.');
    }
  };

  const provisionDefaultTables = async (count = 8) => {
    try {
      const store = stores.find((s) => s.id === selectedStoreId) || stores[0] || EMPTY_STORE_PLACEHOLDER;
      if (!store.id) {
        showNotification('Nenhuma loja ativa selecionada para gerar mesas.');
        return;
      }
      const created: DiningTable[] = [];
      for (let i = 1; i <= count; i++) {
        const table: DiningTable = {
          id: generateTableId(),
          tableNumber: i,
          capacity: i % 2 === 0 ? 4 : 2,
          status: 'FREE',
          storeId: store.id,
          tenantId: store.tenantId || profile?.tenantId || 'tenant-1',
          activeItemsCount: 0,
          totalAmount: 0,
        };
        await adapter.saveTable(table);
        created.push(table);
      }
      setTables((prev) => [...prev.filter((t) => t.storeId !== store.id), ...created]);
      showNotification(`${count} mesas criadas para ${store.name}!`);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao gerar mesas do salão.');
    }
  };

  const deleteTable = async (tableId: string): Promise<boolean> => {
    try {
      await adapter.deleteTable(tableId);
      setTables((prev) => prev.filter((t) => t.id !== tableId));
      showNotification('Mesa removida com sucesso.');
      return true;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao remover mesa.');
      return false;
    }
  };

  return {
    updateTableStatus,
    createWaiterTableOrder,
    addTable,
    provisionDefaultTables,
    deleteTable,
  };
};
