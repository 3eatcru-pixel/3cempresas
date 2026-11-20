import React from 'react';
import { DispatchLogItem } from '../hooks/useWhatsAppConnector';

interface WhatsAppDispatchHistoryCardProps {
  dispatchHistory: DispatchLogItem[];
}

export const WhatsAppDispatchHistoryCard: React.FC<WhatsAppDispatchHistoryCardProps> = ({
  dispatchHistory,
}) => {
  if (dispatchHistory.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <h4 className="text-xs font-bold text-slate-300">
        Registro de Disparos da Sessão ({dispatchHistory.length})
      </h4>
      <div className="divide-y divide-slate-800/70 max-h-44 overflow-y-auto custom-scrollbar">
        {dispatchHistory.map((item) => (
          <div
            key={item.id}
            className="py-2 flex items-center justify-between gap-2 text-[11px]"
          >
            <div className="truncate">
              <span className="font-semibold text-white">{item.customerName}</span>
              <span className="text-slate-500 font-mono"> · {item.phone}</span>
              {item.detail && <span className="text-slate-400"> · {item.detail}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono">
              <span
                className={
                  item.status === 'FAILED'
                    ? 'text-rose-400 font-bold'
                    : 'text-emerald-400 font-bold'
                }
              >
                {item.status === 'SENT'
                  ? 'Enviado API'
                  : item.status === 'OPENED_WA_ME'
                  ? 'wa.me Pronto'
                  : 'Falha'}
              </span>
              <span className="text-slate-500">{item.at}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
