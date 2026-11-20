import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { PillarEntrance } from '../common/PillarEntrance';
import { UtensilsCrossed, Tablet } from 'lucide-react';
import { PILLAR_THEMES, SURFACE_TOKENS } from '@3c/design-system';
import { DiningTable, MenuItem } from '../../types';

import { WaiterHeader } from '../../modules/waiter/WaiterHeader';
import { WaiterHomeTab } from '../../modules/waiter/WaiterHomeTab';
import { WaiterTableGrid } from '../../modules/waiter/WaiterTableGrid';
import { WaiterTableModal } from '../../modules/waiter/WaiterTableModal';
import { WaiterKitchenTab } from '../../modules/waiter/WaiterKitchenTab';
import { WaiterNotificationsTab } from '../../modules/waiter/WaiterNotificationsTab';
import { WaiterProfileTab } from '../../modules/waiter/WaiterProfileTab';
import { WaiterQrPairingModal } from '../../modules/waiter/WaiterQrPairingModal';
import { WaiterDeviceAccessModal } from '../../modules/waiter/WaiterDeviceAccessModal';
import { WaiterNavTabs, WaiterTabId } from '../../modules/waiter/layout/WaiterNavTabs';

export const WaiterPillar: React.FC = () => {
  const { profile, logout } = useAuth();
  const {
    tables,
    currentStore,
    setSelectedStoreId,
    menuItems,
    orders,
    updateTableStatus,
    updateOrderStatus,
    confirmOrderPayment,
    createWaiterTableOrder,
    showNotification
  } = useEcosystem();

  const normalizedRole = String(profile?.role || '').toUpperCase();
  const isAuthorized = ['WAITER', 'STORE_OWNER', 'STORE_MANAGER', 'REGIONAL_MANAGER'].includes(normalizedRole);

  const [activeTab, setActiveTab] = useState<WaiterTabId>('home');
  const [selectedTable, setSelectedTable] = useState<DiningTable | null>(null);
  const [waiterName, setWaiterName] = useState(() => profile?.name || 'Garçom');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDeviceAccessOpen, setIsDeviceAccessOpen] = useState(false);

  useEffect(() => {
    if (profile?.name) {
      setWaiterName(profile.name);
    }
  }, [profile?.name]);

  if (!isAuthorized) {
    return (
      <>
        <PillarEntrance
          title="3C Waiter — Terminal de Garçom"
          subtitle="Módulo Mobile Touch (BYOD) ou PDQ próprio da loja para atendimento de salão, comandas e sincronização instantânea com KDS."
          icon={<UtensilsCrossed className="w-8 h-8" />}
          requiredRole="WAITER"
          pillarId="waiter"
          colorClass={PILLAR_THEMES.waiter.accentTextClass}
          secondaryAction={
            <button
              type="button"
              onClick={() => setIsDeviceAccessOpen(true)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Tablet className="w-4 h-4 text-pink-400" />
              Parear Dispositivo / PDQ da Loja (Sem e-mail)
            </button>
          }
          features={[
            '1. Login Individual (E-mail da Lista da Loja) ou PDQ/Device próprio',
            '2. Minhas Mesas: Mapa visual de mesas (Livre/Ocupada/Conta)',
            '3. Mesa: Extrato detalhado de consumo e comandas',
            '4. Novo Pedido: Adição de produtos com observações customizadas',
            '5. Cozinha: Acompanhamento de pedidos no KDS em tempo real',
            '6. Conta: Calculadora de divisão de conta e 10% opcional',
            '7. Fechamento: Impressão de pré-conta e liberação de mesa',
            '8. Notificações: Central de chamados de atendimento e pratos prontos',
            '9. Perfil: Relatório de desempenho, vendas R$ e gorjetas',
          ]}
        />
        <WaiterDeviceAccessModal
          isOpen={isDeviceAccessOpen}
          onClose={() => setIsDeviceAccessOpen(false)}
          defaultStoreId={currentStore?.id}
          onSuccess={(info) => {
            if (info.storeId) {
              setSelectedStoreId(info.storeId);
            }
            showNotification(
              info.mode === 'PDQ'
                ? `PDQ / Dispositivo conectado ao salão de ${info.storeName || info.storeId}!`
                : `Terminal conectado ao salão de ${info.storeName || info.storeId} via PIN!`
            );
          }}
        />
      </>
    );
  }

  const storeTables = tables
    .filter(t => t.storeId === currentStore.id || (currentStore.id === 'store-1' && !t.storeId))
    .sort((a, b) => a.tableNumber - b.tableNumber);

  const handleSendOrderToKitchen = async (
    tableNum: number,
    items: { menuItem: MenuItem; qty: number; notes?: string }[]
  ): Promise<boolean> => {
    const created = await createWaiterTableOrder(tableNum, items, waiterName);
    if (created) {
      setSelectedTable(null);
      return true;
    }
    return false;
  };

  const handleCloseTableBill = async (
    tableId: string,
    paymentMethod:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK' = 'PIX'
  ) => {
    const targetTable = storeTables.find(t => t.id === tableId);
    if (targetTable) {
      const openTableOrders = orders.filter(
        o =>
          o.storeId === currentStore.id &&
          o.status !== 'DELIVERED' &&
          o.status !== 'CANCELLED' &&
          (o.tableNumber === targetTable.tableNumber ||
            o.customerName === `Mesa ${targetTable.tableNumber}` ||
            Boolean(o.code?.includes(`TBL-${targetTable.tableNumber}`)))
      );
      for (const ord of openTableOrders) {
        if (ord.paymentStatus !== 'PAID') {
          const settlementMethod =
            ord.paymentMethod && ord.paymentMethod !== 'TABLE_BILL' ? ord.paymentMethod : paymentMethod;
          const settled = await confirmOrderPayment(ord.id, settlementMethod);
          if (!settled) {
            showNotification(`Falha ao confirmar pagamento do pedido ${ord.code || ord.id}. Mesa mantida em aberto.`);
            return;
          }
        }
        await updateOrderStatus(ord.id, 'DELIVERED');
      }
    }
    await updateTableStatus(tableId, 'FREE');
    setSelectedTable(null);
    showNotification(
      `Mesa #${targetTable?.tableNumber || ''} encerrada (${paymentMethod}) por ${waiterName} com receita registrada no caixa!`
    );
  };

  const handlePairSuccess = (name: string) => {
    setWaiterName(name);
    showNotification(`Smartphone pareado com sucesso! Atendente: ${name}`);
  };

  const storeMenuItems = menuItems.filter(m => m.storeId === currentStore.id);
  const readyOrdersCount = orders.filter(
    o => o.storeId === currentStore.id && o.channel === 'TABLE' && o.status === 'READY_FOR_PICKUP'
  ).length;
  const billCallsCount = storeTables.filter(t => t.status === 'BILL_REQUESTED').length;

  return (
    <div className={`min-h-screen ${SURFACE_TOKENS.dark.canvasBg} ${SURFACE_TOKENS.dark.textPrimary} flex flex-col justify-between pb-20 sm:pb-6 selection:bg-pink-500 selection:text-white`}>
      <div className="max-w-5xl mx-auto w-full px-4 pt-4 space-y-4">
        <WaiterHeader
          currentStore={currentStore}
          waiterName={waiterName}
          setWaiterName={setWaiterName}
          profile={profile}
          onOpenQrPairing={() => setIsQrModalOpen(true)}
          onLogout={() => void logout()}
        />

        <WaiterNavTabs
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          readyOrdersCount={readyOrdersCount}
          billCallsCount={billCallsCount}
        />
      </div>

      <main className="max-w-5xl mx-auto w-full px-4 pt-4 flex-1">
        {activeTab === 'home' && (
          <WaiterHomeTab
            currentStore={currentStore}
            waiterName={waiterName}
            tables={storeTables}
            orders={orders}
            onNavigateTab={tab => setActiveTab(tab as any)}
            onSelectTable={tbl => setSelectedTable(tbl)}
            onOpenQrPairing={() => setIsQrModalOpen(true)}
          />
        )}

        {activeTab === 'tables' && (
          <WaiterTableGrid tables={storeTables} onSelectTable={tbl => setSelectedTable(tbl)} />
        )}

        {activeTab === 'kitchen' && (
          <WaiterKitchenTab
            currentStore={currentStore}
            orders={orders}
            waiterName={waiterName}
          />
        )}

        {activeTab === 'notifications' && (
          <WaiterNotificationsTab
            currentStore={currentStore}
            tables={storeTables}
            orders={orders}
          />
        )}

        {activeTab === 'profile' && (
          <WaiterProfileTab
            currentStore={currentStore}
            waiterName={waiterName}
            setWaiterName={setWaiterName}
            tables={storeTables}
            orders={orders}
            profile={profile}
            onOpenQrPairing={() => setIsQrModalOpen(true)}
            onLogout={() => void logout()}
          />
        )}
      </main>

      {selectedTable && (
        <WaiterTableModal
          selectedTable={selectedTable}
          storeMenuItems={storeMenuItems}
          waiterName={waiterName}
          onClose={() => setSelectedTable(null)}
          onSendOrderToKitchen={handleSendOrderToKitchen}
          onCloseTableBill={handleCloseTableBill}
        />
      )}

      {isQrModalOpen && (
        <WaiterQrPairingModal
          currentStore={currentStore}
          onClose={() => setIsQrModalOpen(false)}
          onPairSuccess={handlePairSuccess}
          isWaiterClient={true}
        />
      )}
    </div>
  );
};
