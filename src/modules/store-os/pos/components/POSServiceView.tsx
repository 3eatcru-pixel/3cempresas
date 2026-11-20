import React, { useState, useEffect } from 'react';
import { Plus, Zap, Clock } from 'lucide-react';
import { MenuItem } from '../../../../types';
import { useEcosystem } from '../../../../context/EcosystemContext';

interface POSServiceViewProps {
  logic: any;
}

const formatElapsed = (sec: number): string => {
  const hrs = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const secs = String(sec % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

export const POSServiceView: React.FC<POSServiceViewProps> = ({ logic }) => {
  const { adminUsers, users, currentStore } = useEcosystem();
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (logic.selectedItems.length === 0) {
      setElapsedSec(0);
    }
  }, [logic.selectedItems.length]);

  const professionals = Array.from(
    new Map(
      [...adminUsers, ...users]
        .filter((u) => u.storeId === currentStore.id)
        .map((u) => [u.id || u.uid || u.email, u])
    ).values()
  );

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="bg-blue-600/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
         <div className="flex items-center gap-3">
            <Clock className="text-blue-400 w-5 h-5" />
            <div>
               <p className="text-xs font-black text-white uppercase">Sessão de Atendimento Ativa</p>
               <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest italic">
                 {logic.selectedProfessionalName
                   ? `Profissional: ${logic.selectedProfessionalName}`
                   : 'Vinculando serviços aos profissionais'}
               </p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-[10px] text-slate-500 font-bold uppercase">Tempo Decorrido</p>
            <p className="text-sm font-mono font-black text-blue-400">{formatElapsed(elapsedSec)}</p>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="grid grid-cols-1 gap-3">
          {logic.filteredItems.map((item: MenuItem) => (
            <div
              key={item.id}
              className="bg-slate-900 p-4 rounded-2xl border-2 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-blue-500/30 transition-all"
            >
              <div className="flex items-center gap-4">
                 <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-blue-400">
                    <Zap size={20} />
                 </div>
                 <div>
                    <h4 className="font-black text-sm text-white uppercase group-hover:text-blue-400 transition-colors">{item.name}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {item.category} • R$ {item.price.toFixed(2)}
                    </p>
                 </div>
              </div>
              
              <div className="flex items-center gap-3">
                 <div className="space-y-1">
                    <p className="text-[9px] text-slate-500 font-bold uppercase text-right">Executado por:</p>
                    <select
                      value={logic.selectedProfessionalName || ''}
                      onChange={(e) => logic.setSelectedProfessionalName(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-[10px] font-bold text-slate-300 px-3 py-1.5 rounded-lg outline-none focus:border-blue-500"
                    >
                       <option value="">Selecionar Profissional...</option>
                       {professionals.map(p => (
                         <option key={p.id || p.uid} value={p.name}>
                           {p.name}
                         </option>
                       ))}
                    </select>
                 </div>
                 <button 
                   onClick={() => logic.handleAddItem(item)}
                   className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg transition-all active:scale-90 cursor-pointer"
                 >
                   <Plus size={18} strokeWidth={3} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
