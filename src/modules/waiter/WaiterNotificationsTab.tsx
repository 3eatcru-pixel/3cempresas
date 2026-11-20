import React, { useState } from 'react';
import { Bell, CheckCircle2, Utensils, MessageSquare, Send, ChefHat } from 'lucide-react';
import { Store, DiningTable, Order } from '../../types';
import { useEcosystem } from '../../context/EcosystemContext';

interface WaiterNotificationsTabProps {
  currentStore: Store;
  tables: DiningTable[];
  orders: Order[];
}

const QUICK_STORE_MESSAGES = [
  'Solicitar prioridade de preparo na Cozinha (KDS)',
  'Cliente solicitou presença do gerente / responsável no salão',
  'Solicitar apoio de limpeza / organização de mesa',
  'Dúvida sobre fechamento parcial ou divisão de comanda no Caixa',
];

export const WaiterNotificationsTab: React.FC<WaiterNotificationsTabProps> = ({
  currentStore,
  tables,
  orders,
}) => {
  const { showNotification, updateOrderStatus, logSystemEvent } = useEcosystem();

  const [acknowledgedCalls, setAcknowledgedCalls] = useState<string[]>([]);
  const [servingOrderId, setServingOrderId] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedTableNumber, setSelectedTableNumber] = useState<string>('');

  const billCalls = tables.filter(
    t => t.status === 'BILL_REQUESTED' && !acknowledgedCalls.includes(`table-bill-${t.id}`)
  );

  const readyOrders = orders.filter(
    o =>
      o.storeId === currentStore.id &&
      o.channel === 'TABLE' &&
      o.status === 'READY_FOR_PICKUP'
  );

  const handleAcknowledge = (callId: string, msg: string) => {
    setAcknowledgedCalls(prev => [...prev, callId]);
    showNotification(`Atendimento respondido: ${msg}`);
  };

  const handleSendStoreMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const tablePrefix = selectedTableNumber ? `[Mesa #${selectedTableNumber}] ` : '[Salão] ';
    logSystemEvent('WAITER_STORE_COMM', `${tablePrefix}${trimmed}`, 'INFO');
    showNotification(`Mensagem enviada ao estabelecimento (${currentStore.name}): ${tablePrefix}${trimmed}`);
    setCustomMessage('');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20 text-purple-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Notificações &amp; Comunicação com o Estabelecimento
            </h2>
            <p className="text-xs text-slate-400">
              Receba alertas das mesas e comunique-se em tempo real com a Cozinha e o Caixa de {currentStore.name}.
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-purple-400">
          {readyOrders.length + billCalls.length} Alertas Ativos
        </span>
      </div>

      {/* Dishes Ready Alerts Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
          <Utensils className="w-4 h-4" /> Pratos Prontos na Cozinha ({readyOrders.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {readyOrders.map(order => (
            <div key={order.id} className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <div className="text-xs font-black text-white flex items-center gap-2">
                  <span className="text-emerald-400 font-mono">#{order.code}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-bold text-[10px]">
                    Mesa #{order.tableNumber}
                  </span>
                </div>
                <div className="text-xs text-slate-300">
                  {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </div>
              </div>

              <button
                disabled={servingOrderId === order.id}
                onClick={async () => {
                  setServingOrderId(order.id);
                  try {
                    await updateOrderStatus(order.id, 'DELIVERED');
                  } finally {
                    setServingOrderId(null);
                  }
                }}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl shadow transition-transform active:scale-95 cursor-pointer"
              >
                {servingOrderId === order.id ? 'Servindo...' : `Servir Mesa #${order.tableNumber}`}
              </button>
            </div>
          ))}

          {readyOrders.length === 0 && (
            <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-xs text-slate-500 text-center">
              Nenhum prato aguardando retirada na cozinha no momento.
            </div>
          )}
        </div>
      </div>

      {/* Table Calls Section */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Chamados de Atendimento nas Mesas
        </h3>

        <div className="space-y-2.5">
          {billCalls.map(table => (
            <div key={table.id} className="bg-purple-950/30 border border-purple-500/40 p-4 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <div className="text-xs font-black text-white flex items-center gap-2">
                  <span className="text-purple-400 font-mono">Mesa #{table.tableNumber}</span>
                  <span className="px-2 py-0.5 rounded bg-purple-500 text-white font-bold text-[10px]">
                    Solicitou Conta
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Consumo registrado: <span className="font-mono text-white font-bold">R$ {(table.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={() => handleAcknowledge(`table-bill-${table.id}`, `Mesa #${table.tableNumber} (Fechamento de Conta)`)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow transition-transform active:scale-95 cursor-pointer"
              >
                Atender Fechamento
              </button>
            </div>
          ))}

          {billCalls.length === 0 && (
            <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-60" />
              <p className="text-xs font-bold text-slate-400 uppercase">Nenhum chamado pendente nas mesas neste momento!</p>
            </div>
          )}
        </div>
      </div>

      {/* Direct Communication with Store OS (Kitchen & Cashier) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
            <ChefHat className="w-4 h-4" /> Comunicação Direta com Cozinha &amp; Caixa
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-bold">Mesa (opcional):</span>
            <select
              value={selectedTableNumber}
              onChange={(e) => setSelectedTableNumber(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">Geral do Salão</option>
              {tables.map((t) => (
                <option key={t.id} value={String(t.tableNumber)}>
                  Mesa #{t.tableNumber}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {QUICK_STORE_MESSAGES.map((msg) => (
            <button
              key={msg}
              type="button"
              onClick={() => handleSendStoreMessage(msg)}
              className="text-left px-3.5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
            >
              • {msg}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendStoreMessage(customMessage);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Enviar aviso personalizado para a Cozinha ou Caixa..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={!customMessage.trim()}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Send className="w-3.5 h-3.5" /> Enviar
          </button>
        </form>
      </div>
    </div>
  );
};
