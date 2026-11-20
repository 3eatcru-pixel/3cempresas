import React from 'react';
import { useEcosystem } from '../../context/EcosystemContext';

export const GlobalToast: React.FC = () => {
  const { activeNotification } = useEcosystem();

  if (!activeNotification) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] animate-fadeIn">
      <div className="bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-widest px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border-2 border-white/20 backdrop-blur-md">
        <div className="w-2 h-2 rounded-full bg-white animate-ping" />
        <span>{activeNotification}</span>
      </div>
    </div>
  );
};
