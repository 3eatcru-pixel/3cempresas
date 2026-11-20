import React from 'react';
import { UtensilsCrossed, Bell, CheckCircle2, Clock } from 'lucide-react';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';

interface AutoServiceActionsPanelProps {
  storeSlug?: string;
  currentTable: number;
  sessionToken: string;
  isLightMode: boolean;
  waiterCallCooldown: boolean;
  isBillRequested: boolean;
  onGoToMenu: () => void;
  onCallWaiter: () => void;
  onRequestBill: () => void;
}

export const AutoServiceActionsPanel: React.FC<AutoServiceActionsPanelProps> = ({
  storeSlug,
  currentTable,
  sessionToken,
  isLightMode,
  waiterCallCooldown,
  isBillRequested,
  onGoToMenu,
  onCallWaiter,
  onRequestBill,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
      <div
        className={`p-5 rounded-2xl border flex flex-col items-center text-center space-y-3 ${
          isLightMode ? 'bg-stone-50 border-stone-200' : 'bg-slate-950 border-slate-800'
        }`}
      >
        <div className="w-36 h-36 bg-white p-2 rounded-2xl border-2 border-slate-800 flex items-center justify-center shadow-lg">
          <LocalQrCode
            value={`https://${storeSlug}.3c-os.com/mesa/${currentTable}?session=${sessionToken}`}
            size={130}
            fgColor="#020617"
            bgColor="#ffffff"
          />
        </div>
        <div>
          <div className={`text-xs font-bold uppercase tracking-wider ${isLightMode ? 'text-stone-900' : 'text-white'}`}>
            QR Code Criptografado • Mesa {String(currentTable).padStart(2, '0')}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Escanear para vincular múltiplos smartphones à mesma comanda.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onGoToMenu}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Fazer Novo Pedido na Mesa {String(currentTable).padStart(2, '0')}</span>
        </button>

        <button
          type="button"
          onClick={onCallWaiter}
          disabled={waiterCallCooldown}
          className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            waiterCallCooldown
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-slate-800 hover:bg-slate-700 text-white'
          }`}
        >
          {waiterCallCooldown ? (
            <Clock className="w-4 h-4 text-slate-500 animate-spin" />
          ) : (
            <Bell className="w-4 h-4 text-amber-400" />
          )}
          <span>{waiterCallCooldown ? 'Aguardando Garçom...' : 'Chamar Garçom na Mesa'}</span>
        </button>

        <button
          type="button"
          onClick={onRequestBill}
          className="w-full py-3 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-emerald-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {isBillRequested ? 'Fechamento Já Solicitado (Reenviar)' : 'Solicitar Fechamento da Conta'}
          </span>
        </button>
      </div>
    </div>
  );
};
