import React from 'react';
import { AlertTriangle, Compass } from 'lucide-react';

interface CheckoutRemoteGpsWarningProps {
  distanceFromGpsKm: number;
  confirmRemoteOrder: boolean;
  onChangeConfirmRemoteOrder: (checked: boolean) => void;
  onUseCurrentGpsAddress: () => void;
}

export const CheckoutRemoteGpsWarning: React.FC<CheckoutRemoteGpsWarningProps> = ({
  distanceFromGpsKm,
  confirmRemoteOrder,
  onChangeConfirmRemoteOrder,
  onUseCurrentGpsAddress,
}) => {
  return (
    <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs space-y-2.5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-black text-amber-300">
            Você está a {distanceFromGpsKm.toFixed(1)} km deste endereço de entrega
          </div>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            Seu GPS real indica que você está distante do endereço informado. Se estiver pedindo para outra pessoa ou outro local, confirme abaixo para pedir mesmo assim.
          </p>
        </div>
      </div>

      <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/70 border border-amber-500/30 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmRemoteOrder}
          onChange={(e) => onChangeConfirmRemoteOrder(e.target.checked)}
          className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
        />
        <span className="text-[11px] font-bold text-white">
          Confirmar e pedir para este endereço mesmo assim
        </span>
      </label>

      <button
        type="button"
        onClick={onUseCurrentGpsAddress}
        className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 cursor-pointer"
      >
        <Compass className="w-3 h-3" />
        <span>Atualizar para o endereço do meu GPS atual</span>
      </button>
    </div>
  );
};
