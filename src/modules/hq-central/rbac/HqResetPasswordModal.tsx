import React from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';

interface HqResetPasswordModalProps {
  resetPasswordResult: {
    uid: string;
    name: string;
    email: string;
    temporaryPassword: string;
  };
  copiedTempPass: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export const HqResetPasswordModal: React.FC<HqResetPasswordModalProps> = ({
  resetPasswordResult,
  copiedTempPass,
  onCopy,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white uppercase flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-sky-400" /> Senha Temporária Gerada pelo HQ
          </h3>
          <p className="text-xs text-slate-400">
            Todas as sessões anteriores de <strong className="text-white">{resetPasswordResult.name}</strong> ({resetPasswordResult.email}) foram revogadas.
          </p>
        </div>
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3">
          <code className="text-sm font-mono font-black text-amber-400 tracking-wider select-all">
            {resetPasswordResult.temporaryPassword}
          </code>
          <button
            type="button"
            onClick={onCopy}
            className="px-3 py-1.5 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {copiedTempPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedTempPass ? 'Copiada' : 'Copiar'}
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          Entregue esta senha temporária ao titular. No próximo login será solicitada a troca de senha.
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
