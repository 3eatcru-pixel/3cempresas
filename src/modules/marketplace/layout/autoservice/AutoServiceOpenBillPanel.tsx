import React from 'react';
import { Receipt, Users, Sparkles, CheckCircle2, Copy } from 'lucide-react';
import { Order } from '../../../../types';

interface AutoServiceOpenBillPanelProps {
  currentTable: number;
  currentTableOrders: Order[];
  tableTotalConsumed: number;
  unpaidSubtotal: number;
  includeServiceFee: boolean;
  setIncludeServiceFee: (v: boolean) => void;
  serviceFeeAmount: number;
  finalBillTotal: number;
  splitCount: number;
  setSplitCount: (n: number) => void;
  perPersonAmount: number;
  isBillRequested: boolean;
  pixKey: string;
  onCopyPix: () => void;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Recebido';
    case 'CONFIRMED':
    case 'IN_PREPARATION':
      return 'Em Preparo';
    case 'READY_FOR_PICKUP':
      return 'Pronto p/ Servir';
    default:
      return status;
  }
}

export const AutoServiceOpenBillPanel: React.FC<AutoServiceOpenBillPanelProps> = ({
  currentTable,
  currentTableOrders,
  tableTotalConsumed,
  unpaidSubtotal,
  includeServiceFee,
  setIncludeServiceFee,
  serviceFeeAmount,
  finalBillTotal,
  splitCount,
  setSplitCount,
  perPersonAmount,
  isBillRequested,
  pixKey,
  onCopyPix,
}) => {
  return (
    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <span className="text-xs font-bold uppercase text-slate-200 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-emerald-400" />
          Comanda Aberta • Mesa {String(currentTable).padStart(2, '0')}
        </span>
        <span className="text-xs font-mono font-extrabold text-emerald-400">
          Consumido: R$ {tableTotalConsumed.toFixed(2)}
        </span>
      </div>

      {currentTableOrders.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">
          Nenhum pedido lançado ainda nesta mesa. Escolha itens no cardápio e envie a primeira rodada!
        </p>
      ) : (
        <>
          <div className="space-y-2.5 max-h-52 overflow-y-auto custom-scrollbar pr-1">
            {currentTableOrders.map(order => (
              <div
                key={order.id}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-400 font-bold">
                    Rodada {order.code} • {order.customerName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold ${
                        order.paymentMethod === 'TABLE_BILL'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {order.paymentMethod === 'TABLE_BILL' ? 'Na Comanda' : `Pago (${order.paymentMethod})`}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold">
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </div>
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs font-mono text-slate-200">
                    <span>
                      {item.quantity}x {item.name}
                    </span>
                    <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {unpaidSubtotal > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeServiceFee}
                    onChange={e => setIncludeServiceFee(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Incluir 10% do Garçom (Opcional)
                  </span>
                </label>

                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-400 font-semibold">Dividir:</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 6].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSplitCount(n)}
                        className={`px-2 py-1 rounded-lg font-mono text-[11px] font-bold border transition-all cursor-pointer ${
                          splitCount === n
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Em aberto na Comanda:</span>
                  <span>R$ {unpaidSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Serviço Garçom (10% opcional):</span>
                  <span>{includeServiceFee ? `R$ ${serviceFeeAmount.toFixed(2)}` : 'Não incluído'}</span>
                </div>
                <div className="flex justify-between text-white font-black text-sm border-t border-slate-800 pt-1.5">
                  <span>Total para Fechamento:</span>
                  <span className="text-emerald-400">R$ {finalBillTotal.toFixed(2)}</span>
                </div>
                {splitCount > 1 && (
                  <div className="flex justify-between text-amber-400 font-bold text-xs pt-1">
                    <span>Valor por pessoa ({splitCount}x):</span>
                    <span>R$ {perPersonAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {isBillRequested && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Fechamento Solicitado • Mesa {String(currentTable).padStart(2, '0')}
            </span>
            <span className="text-xs font-mono font-bold text-white">
              R$ {finalBillTotal.toFixed(2)}
            </span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            {pixKey
              ? 'O garçom e o caixa já receberam sua solicitação. Se preferir pagar agora via PIX direto para a loja, use a chave abaixo:'
              : 'O garçom e o caixa já receberam sua solicitação de fechamento da conta.'}
          </p>
          {pixKey && (
            <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-mono text-white truncate">
                PIX: <strong>{pixKey}</strong>
              </span>
              <button
                type="button"
                onClick={onCopyPix}
                className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Copy className="w-3 h-3" /> Copiar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
