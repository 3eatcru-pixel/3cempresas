import React, { useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Utensils, Users, ArrowRight, QrCode, Smartphone, Plus } from 'lucide-react';
import { DiningTable, StorePaymentMethod, TableStatus } from '../../../types';
import { WaiterQrPairingModal } from '../../waiter/WaiterQrPairingModal';
import { TableQrSheetModal } from './layout/TableQrSheetModal';
import { TableHeatmapModal } from './layout/TableHeatmapModal';
import { TableGridItem } from './layout/TableGridItem';
import { TableCheckoutModal } from './layout/TableCheckoutModal';

export const TablesApp: React.FC = () => {
  const {
    currentStore,
    tables,
    orders,
    adminUsers,
    updateTableStatus,
    updateOrderStatus,
    confirmOrderPayment,
    addTable,
    provisionDefaultTables,
    deleteTable,
    showNotification,
  } = useEcosystem();
  const [showQrSheetModal, setShowQrSheetModal] = useState<boolean>(false);
  const [showPairingModal, setShowPairingModal] = useState<boolean>(false);
  const [showHeatmapModal, setShowHeatmapModal] = useState<boolean>(false);
  const [checkoutTable, setCheckoutTable] = useState<DiningTable | null>(null);

  const storeTables = tables
    .filter((t) => t.storeId === currentStore.id || (currentStore.id === 'store-1' && !t.storeId))
    .sort((a, b) => a.tableNumber - b.tableNumber);

  const storeWaitersCount = adminUsers.filter(
    (u) => u.storeId === currentStore.id && u.role === 'WAITER' && u.status === 'ACTIVE'
  ).length;

  const isOrderForTable = (o: typeof orders[number], tableNum: number) =>
    o.storeId === currentStore.id &&
    o.status !== 'DELIVERED' &&
    o.status !== 'CANCELLED' &&
    (o.tableNumber === tableNum ||
      o.customerName === `Mesa ${tableNum}` ||
      Boolean(o.code?.includes(`TBL-${tableNum}`)));

  const handleTableAction = async (tableId: string, currentStatus: TableStatus) => {
    const table = storeTables.find((t) => t.id === tableId);
    if (!table) return;

    if (currentStatus === 'BILL_REQUESTED') {
      setCheckoutTable(table);
      return;
    }

    const nextStatus: TableStatus = currentStatus === 'FREE' ? 'OCCUPIED' : 'BILL_REQUESTED';
    await updateTableStatus(tableId, nextStatus);
  };

  const handleConfirmTableSettlement = async (paymentMethod: StorePaymentMethod) => {
    if (!checkoutTable) return;
    const openTableOrders = orders.filter((o) => isOrderForTable(o, checkoutTable.tableNumber));
    for (const ord of openTableOrders) {
      if (ord.paymentStatus !== 'PAID') {
        const settled = await confirmOrderPayment(ord.id, paymentMethod);
        if (!settled) {
          showNotification(
            `Não foi possível confirmar o pagamento do pedido ${ord.code || ord.id}. Mesa não liberada.`
          );
          return;
        }
      }
      await updateOrderStatus(ord.id, 'DELIVERED');
    }

    await updateTableStatus(checkoutTable.id, 'FREE');
    showNotification(`Mesa #${checkoutTable.tableNumber} quitada (${paymentMethod}) e liberada!`);
    setCheckoutTable(null);
  };

  const handleAddSingleTable = async () => {
    const nextNumber =
      storeTables.length > 0 ? Math.max(...storeTables.map((t) => t.tableNumber)) + 1 : 1;
    await addTable(nextNumber, 4);
  };

  const freeCount = storeTables.filter((t) => t.status === 'FREE').length;
  const occupiedCount = storeTables.filter((t) => t.status === 'OCCUPIED').length;
  const billCount = storeTables.filter((t) => t.status === 'BILL_REQUESTED').length;

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2 gap-3">
        <div className="flex items-center gap-3">
          <Utensils className="w-6 h-6 text-pink-400" />
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Gestão de Mesas &amp; Salão
            </h3>
            <p className="text-[10px] text-slate-400">
              Controle de ocupação em tempo real para {currentStore.name}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddSingleTable}
            className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs rounded-xl border border-emerald-500/30 transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nova Mesa
          </button>

          <button
            type="button"
            onClick={() => setShowPairingModal(true)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Exibir QR Code para parear smartphone do garçom"
          >
            <Smartphone className="w-4 h-4" />
            <span>Parear Garçom BYOD</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQrSheetModal(true)}
            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Imprimir QR Codes de Mesa</span>
          </button>
          <div className="flex items-center gap-3 text-[10px] font-mono tabular-nums font-bold text-slate-400 uppercase tracking-wider pl-2 border-l border-slate-800">
            <span className="text-emerald-400">{freeCount} Livres</span>
            <span className="text-pink-400">{occupiedCount} Ocupadas</span>
            {billCount > 0 && <span className="text-amber-400">{billCount} Conta</span>}
          </div>
        </div>
      </div>

      {storeTables.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <Utensils className="w-12 h-12 text-pink-400/50 mx-auto" />
          <div className="space-y-1">
            <h4 className="text-base font-black text-white uppercase">
              Nenhuma mesa cadastrada em {currentStore.name}
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Gere automaticamente 8 mesas padrão para começar a receber comandas e gerar QR Codes de salão.
            </p>
          </div>
          <button
            type="button"
            onClick={() => provisionDefaultTables(8)}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl cursor-pointer"
          >
            Gerar 8 Mesas Padrão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {storeTables.map((table) => {
            const tableOrders = orders.filter((o) => isOrderForTable(o, table.tableNumber));
            const totalConsumption = tableOrders.reduce((acc, o) => acc + o.total, 0);

            return (
              <TableGridItem
                key={table.id}
                table={table}
                totalConsumption={totalConsumption}
                openOrdersCount={tableOrders.length}
                onTableAction={handleTableAction}
                onDeleteTable={(id) => deleteTable(id)}
              />
            );
          })}
        </div>
      )}

      {/* Footer Info & Salon Heatmap Button */}
      <div className="mt-8 bg-slate-900/50 p-5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-white font-black uppercase italic">App de Garçom Conectado</h4>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              {storeWaitersCount > 0
                ? `${storeWaitersCount} garçom(ns) ativo(s) vinculados a esta loja.`
                : 'Use Parear Garçom BYOD para conectar celulares ao salão.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowHeatmapModal(true)}
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-black text-[10px] rounded-xl border border-slate-700 transition-colors uppercase tracking-widest flex items-center gap-2 cursor-pointer"
        >
          MAPA DE CALOR DO SALÃO <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Modals */}
      <TableCheckoutModal
        isOpen={Boolean(checkoutTable)}
        onClose={() => setCheckoutTable(null)}
        table={checkoutTable}
        store={currentStore}
        openOrders={
          checkoutTable
            ? orders.filter((o) => isOrderForTable(o, checkoutTable.tableNumber))
            : []
        }
        onConfirmSettlement={handleConfirmTableSettlement}
      />

      <TableQrSheetModal
        isOpen={showQrSheetModal}
        onClose={() => setShowQrSheetModal(false)}
        currentStore={currentStore}
        tables={storeTables}
      />

      <TableHeatmapModal
        isOpen={showHeatmapModal}
        onClose={() => setShowHeatmapModal(false)}
        tables={storeTables}
        orders={orders.filter((o) => o.storeId === currentStore.id)}
      />

      {showPairingModal && (
        <WaiterQrPairingModal
          currentStore={currentStore}
          onClose={() => setShowPairingModal(false)}
          isWaiterClient={false}
        />
      )}
    </div>
  );
};
