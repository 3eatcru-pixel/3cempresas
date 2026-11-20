import React from 'react';
import { History, Trash2 } from 'lucide-react';

interface Notification {
  id: string;
  msg: string;
  time: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
}

interface NotificationTrayProps {
  isOpen: boolean;
  notifications: Notification[];
  onClearAll: () => void;
}

export const NotificationTray: React.FC<NotificationTrayProps> = ({
  isOpen,
  notifications,
  onClearAll
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute right-4 bottom-16 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-2xl rounded-3xl border border-slate-700/80 shadow-2xl p-5 z-50 animate-scaleIn space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white">
          <History className="w-4 h-4 text-amber-500" />
          <h4 className="text-xs font-black uppercase tracking-widest">Histórico de Notificações</h4>
        </div>
        <button 
          onClick={onClearAll} 
          className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
          title="Limpar tudo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2">
        {notifications.length === 0 ? (
          <div className="py-10 text-center text-slate-500 italic text-xs">Nenhuma notificação recente.</div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1 group hover:border-slate-700 transition-all">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${n.type === 'SUCCESS' ? 'bg-emerald-500' : n.type === 'WARNING' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                  <span className="text-[10px] font-mono text-slate-500">{n.time}</span>
                </div>
                <span className="text-[8px] font-black uppercase text-slate-600">{n.type}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-snug">{n.msg}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
