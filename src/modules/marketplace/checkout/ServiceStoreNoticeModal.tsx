import React from 'react';
import { X, Calendar } from 'lucide-react';

interface ServiceStoreNoticeModalProps {
  storeName: string;
  onClose: () => void;
}

export const ServiceStoreNoticeModal: React.FC<ServiceStoreNoticeModalProps> = ({
  storeName,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl animate-scaleIn text-center">
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="w-16 h-16 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 rounded-2xl flex items-center justify-center mx-auto">
          <Calendar className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-black text-white uppercase">Agendamento de Serviço</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-white">{storeName}</strong> trabalha por hora marcada. Utilize a aba <strong className="text-indigo-400">Agendar Horário</strong> na vitrine da loja (sem carrinho de entrega).
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase rounded-xl tracking-wider cursor-pointer"
        >
          Voltar para Agendar na Vitrine
        </button>
      </div>
    </div>
  );
};
