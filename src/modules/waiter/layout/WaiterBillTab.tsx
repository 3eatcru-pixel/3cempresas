import React, { useState } from 'react';
import { Calculator, Printer, DollarSign, CheckCircle2 } from 'lucide-react';
import { StorePaymentMethod } from '../../../types';

interface WaiterBillTabProps {
  tableNumber: number;
  totalAmount: number;
  includeTip: boolean;
  setIncludeTip: (val: boolean) => void;
  splitGuests: number;
  setSplitGuests: (val: number) => void;
  selectedPaymentMethod: StorePaymentMethod;
  setSelectedPaymentMethod: (val: StorePaymentMethod) => void;
  acceptedPaymentMethods?: StorePaymentMethod[];
  handlePrintBill: () => void;
  handleFinalCloseBill: () => Promise<void> | void;
  serviceFeeAmount: number;
  grandTotalWithTip: number;
}

const WAITER_PAYMENT_OPTIONS: { id: StorePaymentMethod; label: string }[] = [
  { id: 'PIX', label: 'PIX' },
  { id: 'CREDIT_CARD', label: 'Crédito' },
  { id: 'DEBIT_CARD', label: 'Débito' },
  { id: 'CASH', label: 'Dinheiro' },
  { id: 'BOLETO', label: 'Boleto' },
  { id: 'BANK_TRANSFER', label: 'TED / Transf.' },
  { id: 'PAYMENT_LINK', label: 'Link Pagto.' },
];

export const WaiterBillTab: React.FC<WaiterBillTabProps> = ({
  tableNumber,
  includeTip,
  setIncludeTip,
  splitGuests,
  setSplitGuests,
  selectedPaymentMethod,
  setSelectedPaymentMethod,
  acceptedPaymentMethods,
  handlePrintBill,
  handleFinalCloseBill,
  serviceFeeAmount,
  grandTotalWithTip,
}) => {
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const enabledIds: StorePaymentMethod[] =
    Array.isArray(acceptedPaymentMethods) && acceptedPaymentMethods.length > 0
      ? acceptedPaymentMethods
      : WAITER_PAYMENT_OPTIONS.map((o) => o.id);
  const visibleMethods = WAITER_PAYMENT_OPTIONS.filter((o) => enabledIds.includes(o.id));
  const selectedLabel =
    visibleMethods.find((m) => m.id === selectedPaymentMethod)?.label || selectedPaymentMethod;

  const handleConfirmClose = async () => {
    if (isClosing) return;
    setIsClosing(true);
    try {
      await handleFinalCloseBill();
    } finally {
      setIsClosing(false);
      setConfirmingClose(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-purple-400">
            <Calculator className="w-4 h-4" /> Calculadora de Fechamento e Divisão
          </div>
          <button
            type="button"
            onClick={handlePrintBill}
            className="min-h-[36px] px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Imprimir Pré-Conta em Impressora 80mm"
          >
            <Printer className="w-4 h-4" /> Pré-Conta 80mm
          </button>
        </div>

        {/* Service Fee Toggle */}
        <label className="flex items-center justify-between p-3 bg-slate-900 rounded-xl border border-slate-800 cursor-pointer text-xs min-h-[44px]">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={includeTip}
              onChange={(e) => setIncludeTip(e.target.checked)}
              className="w-4 h-4 rounded text-purple-500 focus:ring-0 cursor-pointer accent-purple-500"
            />
            <span className="text-white font-semibold">Taxa de Serviço 10% (Gorjeta)</span>
          </div>
          <span className="font-mono tabular-nums text-purple-400 font-semibold">
            {includeTip
              ? `+ R$ ${serviceFeeAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'Desativada'}
          </span>
        </label>

        {/* Bill Splitter */}
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-semibold">Dividir conta entre pessoas</div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 6, 8].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setSplitGuests(num)}
                className={`flex-1 min-h-[40px] py-2 rounded-xl text-xs font-mono tabular-nums font-bold transition-colors cursor-pointer ${
                  splitGuests === num
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {num}p
              </button>
            ))}
          </div>
        </div>

        {/* Totals Summary */}
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-400">Total consolidado</div>
            <div className="text-xl font-bold text-white font-mono tabular-nums mt-0.5">
              R$ {grandTotalWithTip.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-purple-400">Por pessoa ({splitGuests}x)</div>
            <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-0.5">
              R${' '}
              {(grandTotalWithTip / splitGuests).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-2 pt-1">
          <div className="text-xs text-slate-400 font-semibold">
            Forma de pagamento ({visibleMethods.length} habilitada{visibleMethods.length === 1 ? '' : 's'})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {visibleMethods.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setSelectedPaymentMethod(pm.id)}
                className={`min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-semibold transition-colors border cursor-pointer whitespace-nowrap ${
                  selectedPaymentMethod === pm.id
                    ? 'bg-amber-500 text-slate-950 border-amber-500 font-bold'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>
        </div>

        {confirmingClose ? (
          <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/35 space-y-3">
            <p className="text-xs text-purple-200 text-center">
              Confirmar recebimento de{' '}
              <span className="font-mono tabular-nums font-bold text-white">
                R$ {grandTotalWithTip.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>{' '}
              via <span className="font-semibold text-white">{selectedLabel}</span> e liberar a{' '}
              <span className="font-semibold text-white">Mesa #{tableNumber}</span>?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isClosing}
                onClick={() => setConfirmingClose(false)}
                className="min-h-[44px] py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isClosing}
                onClick={handleConfirmClose}
                className="min-h-[44px] py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isClosing ? 'Liberando...' : 'Confirmar e Liberar'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClose(true)}
            className="w-full min-h-[48px] py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <DollarSign className="w-4 h-4" /> Fechar Conta e Liberar Mesa #{tableNumber}
          </button>
        )}
      </div>
    </div>
  );
};

