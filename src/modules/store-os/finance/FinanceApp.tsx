import React, { useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { DollarSign, Filter, FileDown, Plus, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { apiClient } from '../../../core/api/apiClient';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { FinanceHistoryModal } from './layout/FinanceHistoryModal';
import { FinanceCashOpenModal } from './layout/FinanceCashOpenModal';
import { FinanceCashCloseModal } from './layout/FinanceCashCloseModal';
import { FinanceNewRecordModal } from './layout/FinanceNewRecordModal';
import { FinanceQuickActions } from './layout/FinanceQuickActions';
import { FinanceBalanceOverview } from './layout/FinanceBalanceOverview';

export const FinanceApp: React.FC = () => {
  const { getIdToken, profile } = useAuth();
  const {
    currentStore,
    orders,
    financialRecords,
    cashSession,
    addSangria,
    addSuprimento,
    openCashRegister,
    closeCashRegister,
    addFinancialRecord,
    markFinancialPaid,
    showNotification,
  } = useEcosystem();

  const [isOpeningModal, setIsOpeningModal] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);
  const [isNewRecordModal, setIsNewRecordModal] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID'>('ALL');
  const [isExportingSped, setIsExportingSped] = useState(false);

  const handleExportStoreSped = async () => {
    setIsExportingSped(true);
    try {
      const token = (await getIdToken()) || undefined;
      const content = await apiClient.exportStoreSpedText(currentStore.id, token);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      getPlatformAdapters().links.downloadTextFile(
        `SPED_${currentStore.slug || currentStore.id}_${dateStr}.txt`,
        content,
        'text/plain;charset=utf-8'
      );
      showNotification('Arquivo SPED Fiscal da loja exportado!');
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao exportar SPED fiscal da loja.');
    } finally {
      setIsExportingSped(false);
    }
  };

  const storeOrders = orders.filter((o) => o.storeId === currentStore.id);
  const storeRecords = financialRecords.filter((f) => f.storeId === currentStore.id);
  const visibleRecords = storeRecords.filter((f) => {
    if (ledgerFilter !== 'ALL' && f.type !== ledgerFilter) return false;
    if (statusFilter === 'PENDING' && f.status === 'PAID') return false;
    if (statusFilter === 'PAID' && f.status !== 'PAID') return false;
    return true;
  });

  const pendingPayableCount = storeRecords.filter(
    (f) => f.type === 'PAYABLE' && f.status !== 'PAID'
  ).length;

  const totalRevenue = storeRecords
    .filter((f) => f.type === 'RECEIVABLE')
    .reduce((acc, f) => acc + f.amount, 0);
  const totalExpense = storeRecords
    .filter((f) => f.type === 'PAYABLE')
    .reduce((acc, f) => acc + f.amount, 0);

  const isCashier = profile?.role === 'CASHIER';
  const isClosed = cashSession.status === 'CLOSED';
  const operatorLabel = profile?.name || profile?.email || 'Operador';

  const cycleLedgerFilter = () => {
    setLedgerFilter((prev) =>
      prev === 'ALL' ? 'RECEIVABLE' : prev === 'RECEIVABLE' ? 'PAYABLE' : 'ALL'
    );
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-amber-400" />
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            Financeiro &amp; Fluxo de Caixa
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isCashier && (
            <>
              <button
                type="button"
                onClick={() => setIsNewRecordModal(true)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 font-black uppercase transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Lançamento
              </button>
              <button
                type="button"
                onClick={handleExportStoreSped}
                disabled={isExportingSped}
                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-900 text-cyan-400 hover:bg-slate-800 border border-slate-700 font-bold uppercase transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Exportar SPED Fiscal da loja"
              >
                <FileDown className="w-3.5 h-3.5" />
                {isExportingSped ? 'Exportando...' : 'SPED (.txt)'}
              </button>
            </>
          )}
          {isClosed ? (
            <button
              type="button"
              onClick={() => setIsOpeningModal(true)}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black uppercase hover:bg-amber-400 transition-colors cursor-pointer"
            >
              ABRIR NOVO CAIXA
            </button>
          ) : (
            <>
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                Caixa Aberto • {cashSession.openedAt}
              </span>
              <button
                type="button"
                onClick={() => setIsClosingModal(true)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 font-black uppercase transition-colors cursor-pointer"
              >
                FECHAR TURNO (Z)
              </button>
            </>
          )}
        </div>
      </div>

      {isClosed && typeof cashSession.countedCash === 'number' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ClipboardCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                Último Fechamento Conferido ({cashSession.closedAt || '--:--'})
              </div>
              <div className="text-[11px] text-slate-400">
                Operador: <span className="text-slate-200">{cashSession.closedBy || cashSession.openedBy}</span>
                {cashSession.closingNotes ? ` • Obs: ${cashSession.closingNotes}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Esperado</span>
              <span className="text-slate-200 font-bold">
                R$ {Number(cashSession.finalCashCalculated || 0).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Contado</span>
              <span className="text-white font-bold">
                R$ {Number(cashSession.countedCash).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Diferença</span>
              <span
                className={`font-black ${
                  Math.abs(cashSession.cashVariance || 0) < 0.01
                    ? 'text-emerald-400'
                    : (cashSession.cashVariance || 0) > 0
                    ? 'text-sky-400'
                    : 'text-rose-400'
                }`}
              >
                {(cashSession.cashVariance || 0) >= 0 ? '+' : '-'}R${' '}
                {Math.abs(cashSession.cashVariance || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isCashier ? '' : 'lg:grid-cols-3'} gap-6`}>
        <div className={`${isCashier ? '' : 'lg:col-span-2'} space-y-4`}>
          <FinanceBalanceOverview
            finalCashCalculated={cashSession.finalCashCalculated}
            totalRevenue={totalRevenue}
            totalExpense={totalExpense}
            hideDre={isCashier}
          />
          <FinanceQuickActions
            onAddSangria={addSangria}
            onAddSuprimento={addSuprimento}
            disabled={isClosed}
          />
        </div>

        {/* Recent Ledger (Restricted from CASHIER RBAC) */}
        {!isCashier && (
          <div className="bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <span className="text-[11px] font-black text-white uppercase tracking-tight">
                    Contas &amp; Lançamentos
                  </span>
                  {pendingPayableCount > 0 && (
                    <span className="ml-2 text-[10px] font-mono tabular-nums text-amber-400">
                      {pendingPayableCount} pendente(s)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={cycleLedgerFilter}
                  title="Alternar tipo (Todos / Entradas / Saídas)"
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <Filter className="w-3 h-3" />
                  <span>
                    {ledgerFilter === 'ALL'
                      ? 'Todos'
                      : ledgerFilter === 'RECEIVABLE'
                      ? 'Entradas'
                      : 'Saídas'}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(
                  [
                    { id: 'ALL', label: 'Todos' },
                    { id: 'PENDING', label: 'Em Aberto' },
                    { id: 'PAID', label: 'Pagos' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                      statusFilter === tab.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar max-h-[420px]">
              {visibleRecords.slice(0, 20).map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex justify-between items-center gap-2 group hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-[11px] font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                      {rec.description}
                    </div>
                    <div className="text-[9px] text-slate-500 font-bold uppercase truncate">
                      {rec.category} {rec.dueDate ? `• Venc: ${rec.dueDate}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <div
                      className={`text-[11px] font-mono tabular-nums font-black ${
                        rec.type === 'RECEIVABLE' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {rec.type === 'RECEIVABLE' ? '+' : '-'} R$ {rec.amount.toFixed(2)}
                    </div>
                    {rec.status !== 'PAID' ? (
                      <button
                        type="button"
                        onClick={() => void markFinancialPaid(rec.id)}
                        className="px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold uppercase flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" /> Baixar
                      </button>
                    ) : (
                      <span className="text-[9px] text-slate-500 font-mono uppercase">PAGO</span>
                    )}
                  </div>
                </div>
              ))}
              {visibleRecords.length === 0 && (
                <div className="py-10 text-center opacity-40">
                  <DollarSign className="w-9 h-9 mx-auto mb-2 text-slate-500" />
                  <p className="text-[10px] font-bold uppercase text-slate-400">
                    Nenhum lançamento neste filtro
                  </p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className="p-3.5 bg-slate-950/80 text-[10px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest border-t border-slate-800 transition-colors cursor-pointer"
            >
              VER HISTÓRICO COMPLETO
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <FinanceCashOpenModal
        isOpen={isOpeningModal}
        onClose={() => setIsOpeningModal(false)}
        onConfirm={async (initialCash) => {
          await openCashRegister(initialCash, operatorLabel);
          setIsOpeningModal(false);
        }}
      />

      <FinanceCashCloseModal
        isOpen={isClosingModal}
        onClose={() => setIsClosingModal(false)}
        store={currentStore}
        cashSession={cashSession}
        storeOrders={storeOrders}
        operatorName={operatorLabel}
        onConfirmClose={async (reconciliation) => {
          await closeCashRegister(reconciliation);
        }}
      />

      <FinanceNewRecordModal
        isOpen={isNewRecordModal}
        onClose={() => setIsNewRecordModal(false)}
        storeId={currentStore.id}
        tenantId={currentStore.tenantId}
        onCreateRecord={addFinancialRecord}
      />

      <FinanceHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        storeRecords={storeRecords}
        totalRevenue={totalRevenue}
        totalExpense={totalExpense}
      />
    </div>
  );
};
