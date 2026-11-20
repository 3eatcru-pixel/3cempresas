import React from 'react';
import { Utensils } from 'lucide-react';

interface SettingsDiningTabProps {
  darkKitchenMode: boolean;
  setDarkKitchenMode: (val: boolean) => void;
  serviceFee10: boolean;
  setServiceFee10: (val: boolean) => void;
  kdsAudioAlert: boolean;
  setKdsAudioAlert: (val: boolean) => void;
  sharedWarehouseMode: boolean;
  setSharedWarehouseMode: (val: boolean) => void;
}

export const SettingsDiningTab: React.FC<SettingsDiningTabProps> = ({
  darkKitchenMode,
  setDarkKitchenMode,
  serviceFee10,
  setServiceFee10,
  kdsAudioAlert,
  setKdsAudioAlert,
  sharedWarehouseMode,
  setSharedWarehouseMode,
}) => {
  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h4 className="font-bold text-sm text-white flex items-center gap-2">
          <Utensils className="w-4 h-4 text-pink-400" />
          <span>Salão, Atendimento & Mesas</span>
        </h4>
        <span className="text-[10px] text-slate-500 uppercase font-mono">Opcionais</span>
      </div>

      <div className="space-y-3">
        {/* Toggle 1: Dark Kitchen Mode */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="space-y-0.5 max-w-[75%]">
            <div className="text-xs font-bold text-white">Modo Exclusivo Delivery (Dark Kitchen)</div>
            <div className="text-[10px] text-slate-400">
              Oculta salão e reservas se o seu negócio for apenas entregas.
            </div>
          </div>
          <button
            onClick={() => setDarkKitchenMode(!darkKitchenMode)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              darkKitchenMode ? 'bg-pink-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                darkKitchenMode ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Toggle 2: Service Fee 10% */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="space-y-0.5 max-w-[75%]">
            <div className="text-xs font-bold text-white">Taxa de Serviço Opcional (10%)</div>
            <div className="text-[10px] text-slate-400">
              Calcula 10% de gorjeta para a equipe de garçons na comanda.
            </div>
          </div>
          <button
            onClick={() => setServiceFee10(!serviceFee10)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              serviceFee10 ? 'bg-emerald-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                serviceFee10 ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Toggle 3: KDS Beep Sound */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="space-y-0.5 max-w-[75%]">
            <div className="text-xs font-bold text-white">Sinal Sonoro no KDS da Cozinha</div>
            <div className="text-[10px] text-slate-400">
              Toca campainha no monitor de cozinha ao entrar novo pedido.
            </div>
          </div>
          <button
            onClick={() => setKdsAudioAlert(!kdsAudioAlert)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              kdsAudioAlert ? 'bg-amber-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                kdsAudioAlert ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* Toggle 4: Shared Warehouse Hub */}
        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
          <div className="space-y-0.5 max-w-[75%]">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              Estoque Hub Centralizado
              <span className="bg-blue-500/10 text-blue-500 text-[8px] px-1.5 py-0.5 rounded-full border border-blue-500/20">
                ESCALE
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              Compartilhe o mesmo estoque físico entre todas as marcas do grupo (Dark Kitchen Hub).
            </div>
          </div>
          <button
            onClick={() => setSharedWarehouseMode(!sharedWarehouseMode)}
            className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
              sharedWarehouseMode ? 'bg-indigo-500' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                sharedWarehouseMode ? 'right-0.5' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
