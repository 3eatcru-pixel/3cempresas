import React from 'react';
import { RotateCcw, X } from 'lucide-react';
import { Order } from '../../../../types';

interface RetailExchangeReturnModalProps {
  exchangeSearch: string;
  setExchangeSearch: (v: string) => void;
  exchangeReason: string;
  setExchangeReason: (v: string) => void;
  selectedExchangeOrder: Order | null;
  setSelectedExchangeOrder: (o: Order | null) => void;
  storeOrdersForExchange: Order[];
  returningIdx: number | null;
  onProcessReturnItem: (order: Order, itemIdx: number) => Promise<void>;
  onClose: () => void;
}

export const RetailExchangeReturnModal: React.FC<RetailExchangeReturnModalProps> = ({
  exchangeSearch,
  setExchangeSearch,
  exchangeReason,
  setExchangeReason,
  selectedExchangeOrder,
  setSelectedExchangeOrder,
  storeOrdersForExchange,
  returningIdx,
  onProcessReturnItem,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-pink-500/30 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl animate-scaleIn max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <RotateCcw className="w-5 h-5 text-pink-400" />
            <div>
              <h4 className="text-sm font-black uppercase text-white">Troca & Devolução (PDV)</h4>
              <p className="text-[11px] text-slate-400">
                Localize a venda original para estornar o item ao estoque e lançar crédito/reembolso.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Buscar por nº pedido (#1234) ou cliente..."
            value={exchangeSearch}
            onChange={(e) => setExchangeSearch(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
          />
          <select
            value={exchangeReason}
            onChange={(e) => setExchangeReason(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
          >
            <option value="Troca de Tamanho / Variação">Troca de Tamanho / Variação</option>
            <option value="Defeito / Garantia Técnica">Defeito / Garantia Técnica</option>
            <option value="Arrependimento / Devolução">Arrependimento / Devolução</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
          {selectedExchangeOrder ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs font-black text-white">
                    Pedido {selectedExchangeOrder.code} • {selectedExchangeOrder.customerName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Total: R$ {selectedExchangeOrder.total.toFixed(2)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedExchangeOrder(null)}
                  className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer"
                >
                  Voltar à lista
                </button>
              </div>
              <div className="space-y-2">
                {selectedExchangeOrder.items.map((it, idx) => {
                  const alreadyReturned = Number(it.returnedQuantity) || 0;
                  const isFullyReturned = alreadyReturned >= (Number(it.quantity) || 0);
                  const isBusy = returningIdx === idx;
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{it.quantity}x {it.name}</span>
                          {alreadyReturned > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono">
                              {alreadyReturned}/{it.quantity} estornado
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          R$ {(it.price * it.quantity).toFixed(2)}
                          {it.serialNumber ? ` • S/N: ${it.serialNumber}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isFullyReturned || isBusy || selectedExchangeOrder.status === 'CANCELLED'}
                        onClick={() => onProcessReturnItem(selectedExchangeOrder, idx)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${
                          isFullyReturned || selectedExchangeOrder.status === 'CANCELLED'
                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            : 'bg-pink-600 hover:bg-pink-500 text-white cursor-pointer disabled:opacity-50'
                        }`}
                      >
                        {isBusy ? 'Estornando...' : isFullyReturned ? 'Estornado' : 'Estornar Item'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : storeOrdersForExchange.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              Nenhuma venda encontrada para esta loja.
            </div>
          ) : (
            storeOrdersForExchange.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => setSelectedExchangeOrder(ord)}
                className="w-full p-3 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div>
                  <div className="text-xs font-black text-white">
                    {ord.code} • {ord.customerName}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {ord.items.length} item(ns) • {new Date(ord.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  R$ {ord.total.toFixed(2)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
