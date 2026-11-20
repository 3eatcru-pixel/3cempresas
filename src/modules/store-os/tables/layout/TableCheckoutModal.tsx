import React, { useMemo, useState } from 'react';
import { X, Receipt, Users, CheckCircle2, Minus, Plus } from 'lucide-react';
import { DiningTable, Order, Store, StorePaymentMethod } from '../../../../types';
import { STORE_PAYMENT_METHODS_CATALOG } from '../../settings/SettingsCheckoutTab';

interface TableCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  table: DiningTable | null;
  store: Store;
  openOrders: Order[];
  onConfirmSettlement: (paymentMethod: StorePaymentMethod) => Promise<void>;
}

const DEFAULT_METHODS: StorePaymentMethod[] = [
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BOLETO',
  'BANK_TRANSFER',
  'PAYMENT_LINK',
];

export const TableCheckoutModal: React.FC<TableCheckoutModalProps> = ({
  isOpen,
  onClose,
  table,
  store,
  openOrders,
  onConfirmSettlement,
}) => {
  const enabledMethods = useMemo(() => {
    const configured = store.operationalSettings?.acceptedPaymentMethods;
    const allowedIds =
      Array.isArray(configured) && configured.length > 0 ? configured : DEFAULT_METHODS;
    return STORE_PAYMENT_METHODS_CATALOG.filter((pm) => allowedIds.includes(pm.id));
  }, [store.operationalSettings?.acceptedPaymentMethods]);

  const [selectedMethod, setSelectedMethod] = useState<StorePaymentMethod>(
    () => enabledMethods[0]?.id || 'PIX'
  );
  const [includeServiceFee, setIncludeServiceFee] = useState<boolean>(
    Boolean(store.operationalSettings?.serviceFee10)
  );
  const [splitPeople, setSplitPeople] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  const subtotal = useMemo(
    () => openOrders.reduce((acc, o) => acc + Number(o.total || 0), 0),
    [openOrders]
  );

  const aggregatedItems = useMemo(() => {
    const list: Array<{ name: string; quantity: number; unitPrice: number }> = [];
    for (const ord of openOrders) {
      for (const item of ord.items || []) {
        const existing = list.find(
          (i) => i.name === item.name && Math.abs(i.unitPrice - Number(item.price || 0)) < 0.01
        );
        if (existing) {
          existing.quantity += Number(item.quantity || 1);
        } else {
          list.push({
            name: item.name,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.price || 0),
          });
        }
      }
    }
    return list;
  }, [openOrders]);

  if (!isOpen || !table) return null;

  const serviceFee = includeServiceFee ? Math.round(subtotal * 0.1 * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal + serviceFee) * 100) / 100;
  const perPerson = splitPeople > 0 ? grandTotal / splitPeople : grandTotal;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirmSettlement(selectedMethod);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-tight">
                Fechamento de Conta • Mesa #{table.tableNumber}
              </h3>
              <p className="text-[11px] text-slate-400">
                <span className="font-mono tabular-nums">{openOrders.length}</span> comanda(s) em aberto • {store.name}
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
          {/* Itemized Summary */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Consumo Detalhado
            </div>
            {aggregatedItems.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhum pedido vinculado a esta mesa. Confirmar irá apenas liberar a mesa.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                {aggregatedItems.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center justify-between text-xs border-b border-slate-900 pb-1.5 last:border-0 last:pb-0"
                  >
                    <span className="text-slate-200 truncate pr-2">
                      <span className="font-mono tabular-nums font-bold text-amber-400 mr-1.5">
                        {item.quantity}x
                      </span>
                      {item.name}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-white shrink-0">
                      R$ {(item.quantity * item.unitPrice).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal Consumo</span>
                <span className="font-mono tabular-nums">R$ {subtotal.toFixed(2)}</span>
              </div>
              <label className="flex items-center justify-between text-slate-300 cursor-pointer select-none">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeServiceFee}
                    onChange={(e) => setIncludeServiceFee(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500"
                  />
                  <span>Taxa de Serviço Opcional (10%)</span>
                </span>
                <span className="font-mono tabular-nums text-amber-300">
                  + R$ {serviceFee.toFixed(2)}
                </span>
              </label>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                <span className="text-xs font-black uppercase text-white">Total a Receber</span>
                <span className="text-lg font-mono tabular-nums font-black text-emerald-400">
                  R$ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Split Calculator */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-xs font-bold text-white">Dividir Conta</div>
                <div className="text-[10px] text-slate-400">
                  Valor por pessoa:{' '}
                  <span className="font-mono tabular-nums font-bold text-indigo-300">
                    R$ {perPerson.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSplitPeople((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label="Diminuir pessoas"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center font-mono tabular-nums font-black text-sm text-white">
                {splitPeople}
              </span>
              <button
                type="button"
                onClick={() => setSplitPeople((p) => Math.min(12, p + 1))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                aria-label="Aumentar pessoas"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Explicit Payment Method Selector */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Forma de Recebimento (Obrigatório)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {enabledMethods.map((pm) => {
                const Icon = pm.icon;
                const active = selectedMethod === pm.id;
                return (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setSelectedMethod(pm.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-colors cursor-pointer ${
                      active
                        ? pm.badgeColor
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold truncate">{pm.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2">
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
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            {submitting
              ? 'Liquidando...'
              : openOrders.length > 0
              ? 'Confirmar Recebimento & Liberar'
              : 'Liberar Mesa'}
          </button>
        </div>
      </div>
    </div>
  );
};
