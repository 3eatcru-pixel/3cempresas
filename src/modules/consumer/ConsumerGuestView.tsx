import React from 'react';
import { User, Clock, MapPin, Gift, UserPlus } from 'lucide-react';

interface ConsumerGuestViewProps {
  onSignIn: () => void;
  onSignUp?: () => void;
}

export const ConsumerGuestView: React.FC<ConsumerGuestViewProps> = ({ onSignIn, onSignUp }) => {
  return (
    <div className="max-w-4xl mx-auto py-20 px-6 text-center space-y-8 animate-fadeIn">
      <div className="w-24 h-24 bg-slate-900 border border-emerald-500/30 rounded-[2.5rem] flex items-center justify-center mx-auto text-emerald-400 shadow-2xl">
        <User className="w-10 h-10" />
      </div>
      <div className="space-y-3">
        <h1 className="text-3xl font-black text-white tracking-tight italic uppercase">
          Conta do Consumidor • Marketplace 3C
        </h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
          Faça login ou crie sua conta de consumidor para acompanhar pedidos, gerenciar endereços, ganhar cashback e salvar suas lojas favoritas.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onSignIn}
          className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group cursor-pointer"
        >
          <User className="w-5 h-5 group-hover:scale-110 transition-transform" />
          Entrar como Consumidor
        </button>
        {onSignUp && (
          <button
            type="button"
            onClick={onSignUp}
            className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-emerald-400" />
            Criar Conta de Consumidor
          </button>
        )}
      </div>
      <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-6 opacity-60">
        <div className="flex flex-col items-center gap-2">
          <Clock className="w-6 h-6 text-slate-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Histórico de Pedidos
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <MapPin className="w-6 h-6 text-slate-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Endereços Salvos
          </span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Gift className="w-6 h-6 text-slate-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
            Programa de Pontos
          </span>
        </div>
      </div>
    </div>
  );
};
