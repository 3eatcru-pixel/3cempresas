import React, { useMemo, useState } from 'react';
import { X, Calculator, CheckCircle2, AlertTriangle, Printer, FileDown } from 'lucide-react';
import { CashRegisterSession, Order, Store } from '../../../../types';
import { STORE_PAYMENT_METHODS_CATALOG } from '../../settings/SettingsCheckoutTab';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';

interface FinanceCashCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store;
  cashSession: CashRegisterSession;
  storeOrders: Order[];
  operatorName: string;
  onConfirmClose: (reconciliation: {
    countedCash: number;
    cashVariance: number;
    closingNotes: string;
    closedBy: string;
    paymentBreakdown: Record<string, number>;
  }) => Promise<void>;
}

const PAYMENT_LABEL_MAP: Record<string, string> = STORE_PAYMENT_METHODS_CATALOG.reduce(
  (acc, item) => {
    acc[item.id] = item.shortLabel;
    return acc;
  },
  {} as Record<string, string>
);

export const FinanceCashCloseModal: React.FC<FinanceCashCloseModalProps> = ({
  isOpen,
  onClose,
  store,
  cashSession,
  storeOrders,
  operatorName,
  onConfirmClose,
}) => {
  const expectedCash = Number(cashSession.finalCashCalculated || 0);
  const [countedCashInput, setCountedCashInput] = useState<string>(() => expectedCash.toFixed(2));
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const shiftOrders = useMemo(() => {
    const openedTs = cashSession.createdAt ? new Date(cashSession.createdAt).getTime() : 0;
    return storeOrders.filter((o) => {
      if (o.status === 'CANCELLED') return false;
      if (o.paymentStatus !== 'PAID' && o.status !== 'DELIVERED') return false;
      if (!openedTs || Number.isNaN(openedTs)) return true;
      const orderTs = o.createdAt ? new Date(o.createdAt).getTime() : 0;
      return orderTs >= openedTs;
    });
  }, [storeOrders, cashSession.createdAt]);

  const paymentBreakdown = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const ord of shiftOrders) {
      const method = ord.paymentMethod || 'OUTROS';
      totals[method] = Math.round(((totals[method] || 0) + Number(ord.total || 0)) * 100) / 100;
    }
    return totals;
  }, [shiftOrders]);

  const totalShiftSales = useMemo(
    () => Object.values(paymentBreakdown).reduce((acc, v) => acc + v, 0),
    [paymentBreakdown]
  );

  if (!isOpen) return null;

  const parsedCounted = Number.parseFloat(countedCashInput.replace(',', '.'));
  const countedCash = Number.isFinite(parsedCounted) && parsedCounted >= 0 ? parsedCounted : 0;
  const cashVariance = Math.round((countedCash - expectedCash) * 100) / 100;

  const buildZReportText = () => {
    const lines = [
      '========================================',
      `     FECHAMENTO DE CAIXA (RELATORIO Z)  `,
      '========================================',
      `Loja: ${store.name}`,
      `Turno ID: ${cashSession.id}`,
      `Aberto por: ${cashSession.openedBy} (${cashSession.openedAt})`,
      `Fechado por: ${operatorName} (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
      '----------------------------------------',
      `Fundo de Troco:  R$ ${Number(cashSession.initialCash || 0).toFixed(2).padStart(10)}`,
      `Suprimentos (+): R$ ${Number(cashSession.totalSuprimentos || 0).toFixed(2).padStart(10)}`,
      `Sangrias (-):    R$ ${Number(cashSession.totalSangrias || 0).toFixed(2).padStart(10)}`,
      `Esperado Gaveta: R$ ${expectedCash.toFixed(2).padStart(10)}`,
      `Contado Fisico:  R$ ${countedCash.toFixed(2).padStart(10)}`,
      `Diferenca:       R$ ${(cashVariance >= 0 ? '+' : '') + cashVariance.toFixed(2).padStart(9)}`,
      '----------------------------------------',
      `VENDAS NO TURNO (${shiftOrders.length} pedidos):`,
      ...Object.entries(paymentBreakdown).map(([method, amount]) => {
        const label = (PAYMENT_LABEL_MAP[method] || method).padEnd(16);
        return `${label} R$ ${amount.toFixed(2).padStart(10)}`;
      }),
      `TOTAL VENDAS:    R$ ${totalShiftSales.toFixed(2).padStart(10)}`,
      ...(closingNotes.trim() ? ['----------------------------------------', `Obs: ${closingNotes.trim()}`] : []),
      '========================================',
    ];
    return lines.join('\n');
  };

  const handlePrintZReport = () => {
    void getPlatformAdapters().printer.printEscPosText(buildZReportText());
  };

  const handleDownloadZReport = () => {
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    getPlatformAdapters().links.downloadTextFile(
      `FECHAMENTO_Z_${store.slug || store.id}_${dateTag}.txt`,
      buildZReportText(),
      'text/plain;charset=utf-8'
    );
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirmClose({
        countedCash,
        cashVariance,
        closingNotes: closingNotes.trim(),
        closedBy: operatorName,
        paymentBreakdown,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const varianceTone =
    Math.abs(cashVariance) < 0.01
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : cashVariance > 0
      ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
      : 'bg-rose-500/10 border-rose-500/30 text-rose-300';

  const varianceLabel =
    Math.abs(cashVariance) < 0.01
      ? 'Caixa Exato (Sem Divergência)'
      : cashVariance > 0
      ? `Sobra de Caixa (+R$ ${cashVariance.toFixed(2)})`
      : `Quebra de Caixa (-R$ ${Math.abs(cashVariance).toFixed(2)})`;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Fechamento de Turno &amp; Conferência de Gaveta (Relatório Z)
              </h3>
              <p className="text-[11px] text-slate-400">
                Aberto por <span className="text-slate-200 font-semibold">{cashSession.openedBy}</span> às{' '}
                <span className="font-mono tabular-nums">{cashSession.openedAt}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Drawer math summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500">Fundo Inicial</div>
              <div className="text-sm font-mono tabular-nums font-bold text-slate-200 mt-1">
                R$ {Number(cashSession.initialCash || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500">Suprimentos (+)</div>
              <div className="text-sm font-mono tabular-nums font-bold text-emerald-400 mt-1">
                + R$ {Number(cashSession.totalSuprimentos || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-[10px] uppercase font-bold text-slate-500">Sangrias (-)</div>
              <div className="text-sm font-mono tabular-nums font-bold text-rose-400 mt-1">
                - R$ {Number(cashSession.totalSangrias || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="text-[10px] uppercase font-bold text-amber-300">Esperado Gaveta</div>
              <div className="text-sm font-mono tabular-nums font-black text-white mt-1">
                R$ {expectedCash.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                Resumo por Meio de Pagamento ({shiftOrders.length} pedidos)
              </span>
              <span className="text-xs font-mono tabular-nums font-black text-emerald-400">
                Total: R$ {totalShiftSales.toFixed(2)}
              </span>
            </div>
            {Object.keys(paymentBreakdown).length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum pedido quitado registrado desde a abertura deste turno.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(paymentBreakdown).map(([method, amount]) => (
                  <div
                    key={method}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-400 font-medium truncate">
                      {PAYMENT_LABEL_MAP[method] || method}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white">
                      R$ {amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Physical Cash Count */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Valor Contado Fisicamente na Gaveta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-4 py-2.5 text-base font-mono tabular-nums font-bold text-white outline-none"
                />
              </div>

              <div className={`px-4 py-2.5 rounded-xl border flex items-center gap-2.5 ${varianceTone}`}>
                {Math.abs(cashVariance) < 0.01 ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <div className="text-xs font-bold">{varianceLabel}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Observações do Fechamento (Opcional)
              </label>
              <input
                type="text"
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Ex: Diferença de troco em moedas, retirada para cofre..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-slate-600 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintZReport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir Z
            </button>
            <button
              type="button"
              onClick={handleDownloadZReport}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" /> Baixar .txt
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleConfirm()}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wider cursor-pointer"
            >
              {submitting ? 'Fechando...' : 'Confirmar Fechamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
