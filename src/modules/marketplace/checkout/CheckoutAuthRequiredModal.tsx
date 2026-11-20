import React from 'react';
import { User, UserPlus } from 'lucide-react';

interface CheckoutAuthRequiredModalProps {
  onSignIn: () => void;
  onSignUp?: () => void;
  onClose: () => void;
}

export const CheckoutAuthRequiredModal: React.FC<CheckoutAuthRequiredModalProps> = ({
  onSignIn,
  onSignUp,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-8 space-y-6 shadow-2xl animate-scaleIn text-center">
        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-[2rem] flex items-center justify-center mx-auto text-emerald-400">
          <User className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-white tracking-tight">Conta de Consumidor Necessária</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Para finalizar e acompanhar seu pedido em tempo real, entre ou crie sua conta de consumidor no Marketplace 3C.
          </p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={onSignIn}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group cursor-pointer"
          >
            <User className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Entrar como Consumidor
          </button>
          {onSignUp && (
            <button
              type="button"
              onClick={onSignUp}
              className="w-full py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Criar Conta de Consumidor
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Voltar ao Cardápio
          </button>
        </div>
      </div>
    </div>
  );
};
