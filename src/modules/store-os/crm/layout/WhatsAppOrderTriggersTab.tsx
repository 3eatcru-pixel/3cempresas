import React, { useState } from 'react';
import { Bell, Check, MessageSquare, Save, Send } from 'lucide-react';
import { AutomatedMessage, Order, Store } from '../../../../types';
import { WhatsAppConnectorMode } from './WhatsAppConnectModal';

interface WhatsAppOrderTriggersTabProps {
  currentStore: Store;
  triggers: AutomatedMessage[];
  recentOrders: Order[];
  connectorMode: WhatsAppConnectorMode;
  onSaveTrigger: (trigger: AutomatedMessage['trigger'], updates: { content?: string; isActive?: boolean }) => Promise<void>;
  onDispatchToOrder: (order: Order, messageText: string) => Promise<void>;
}

const TRIGGER_META: Record<
  AutomatedMessage['trigger'],
  { label: string; description: string; matchedStatuses: string[] }
> = {
  ORDER_PLACED: {
    label: 'Pedido Confirmado',
    description: 'Enviado quando o pedido entra na fila da loja ou cozinha.',
    matchedStatuses: ['PENDING', 'CONFIRMED', 'IN_PREPARATION'],
  },
  ORDER_READY: {
    label: 'Pedido Pronto',
    description: 'Avisa o cliente que o pedido está pronto para retirada ou expedição.',
    matchedStatuses: ['READY', 'READY_FOR_PICKUP'],
  },
  ORDER_OUT_FOR_DELIVERY: {
    label: 'Saiu para Entrega',
    description: 'Informa o despacho com nome do entregador e código do pedido.',
    matchedStatuses: ['OUT_FOR_DELIVERY'],
  },
  ORDER_COMPLETED: {
    label: 'Pedido Entregue / Concluído',
    description: 'Agradecimento pós-entrega para incentivar avaliação e recompra.',
    matchedStatuses: ['DELIVERED', 'COMPLETED'],
  },
};

const interpolateOrderTemplate = (template: string, order: Order, store: Store) =>
  template
    .replace(/{{name}}/g, order.customerName || 'Cliente')
    .replace(/{{orderCode}}/g, order.code || order.id.slice(-5))
    .replace(/{{storeName}}/g, store.name)
    .replace(/{{driverName}}/g, order.driverName || 'nosso entregador');

export const WhatsAppOrderTriggersTab: React.FC<WhatsAppOrderTriggersTabProps> = ({
  currentStore,
  triggers,
  recentOrders,
  connectorMode,
  onSaveTrigger,
  onDispatchToOrder,
}) => {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [sendingOrderId, setSendingOrderId] = useState<string | null>(null);

  const handleSaveContent = async (item: AutomatedMessage) => {
    const nextContent = drafts[item.trigger] ?? item.content;
    setSavingKey(item.trigger);
    try {
      await onSaveTrigger(item.trigger, { content: nextContent });
    } finally {
      setSavingKey(null);
    }
  };

  const resolveOrderTriggerTemplate = (order: Order): AutomatedMessage => {
    const found = triggers.find((t) => TRIGGER_META[t.trigger]?.matchedStatuses.includes(order.status));
    return found || triggers[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell size={16} className="text-emerald-400" />
            Gatilhos de Status de Pedido (Padrão Utility)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalize os avisos por etapa do pedido. Variáveis suportadas:{' '}
            <span className="font-mono text-slate-300">
              {'{{name}} · {{orderCode}} · {{storeName}} · {{driverName}}'}
            </span>
          </p>
        </div>
      </div>

      {/* 4 Editable Order Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {triggers.map((item) => {
          const meta = TRIGGER_META[item.trigger];
          const value = drafts[item.trigger] ?? item.content;
          const isDirty = drafts[item.trigger] !== undefined && drafts[item.trigger] !== item.content;

          return (
            <div
              key={item.trigger}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white">{meta?.label || item.trigger}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{meta?.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void onSaveTrigger(item.trigger, { isActive: !item.isActive })}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
                    item.isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                  }`}
                >
                  {item.isActive ? 'Ativo' : 'Pausado'}
                </button>
              </div>

              <textarea
                rows={3}
                value={value}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [item.trigger]: e.target.value }))
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
              />

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">{item.trigger}</span>
                <button
                  type="button"
                  disabled={!isDirty || savingKey === item.trigger}
                  onClick={() => void handleSaveContent(item)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {savingKey === item.trigger ? (
                    'Salvando...'
                  ) : isDirty ? (
                    <>
                      <Save size={12} /> Salvar Template
                    </>
                  ) : (
                    <>
                      <Check size={12} /> Salvo
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Dispatch to Recent Store Orders */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <MessageSquare size={14} className="text-blue-400" />
              Notificar Pedidos Recentes da Filial ({recentOrders.length})
            </h4>
            <p className="text-[11px] text-slate-400">
              Seleciona automaticamente o template correspondente ao status atual de cada pedido.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Modo: {connectorMode === 'WA_ME' ? 'wa.me Direto' : connectorMode}
          </span>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Nenhum pedido recente com telefone cadastrado nesta filial.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {recentOrders.map((order) => {
              const matchedTrigger = resolveOrderTriggerTemplate(order);
              const renderedMsg = matchedTrigger
                ? interpolateOrderTemplate(
                    drafts[matchedTrigger.trigger] ?? matchedTrigger.content,
                    order,
                    currentStore
                  )
                : '';
              const digits = String(order.customerPhone || '').replace(/\D/g, '');
              const waHref = `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}?text=${encodeURIComponent(renderedMsg)}`;

              return (
                <div
                  key={order.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-950/50"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-white">
                        #{order.code || order.id.slice(-5)}
                      </span>
                      <span className="text-slate-300 font-semibold truncate">
                        {order.customerName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        · {order.status} · {order.customerPhone}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-2xl">{renderedMsg}</p>
                  </div>

                  {connectorMode === 'WA_ME' ? (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Send size={12} /> Enviar wa.me
                    </a>
                  ) : (
                    <button
                      type="button"
                      disabled={sendingOrderId === order.id}
                      onClick={async () => {
                        setSendingOrderId(order.id);
                        try {
                          await onDispatchToOrder(order, renderedMsg);
                        } finally {
                          setSendingOrderId(null);
                        }
                      }}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send size={12} />
                      {sendingOrderId === order.id ? 'Enviando...' : 'Disparar via API'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
