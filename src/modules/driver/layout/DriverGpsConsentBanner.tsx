import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { GeolocationPermissionState } from '../../../components/common/map/mapUtils';

interface DriverGpsConsentBannerProps {
  routeStarted: boolean;
  gpsPermState: GeolocationPermissionState;
  onRequestDriverGps: () => void;
}

export const DriverGpsConsentBanner: React.FC<DriverGpsConsentBannerProps> = ({
  routeStarted,
  gpsPermState,
  onRequestDriverGps,
}) => {
  return (
    <>
      {/* 3-Step Rider Workflow Indicator */}
      <div className="grid grid-cols-3 gap-2 bg-[#111922] border border-slate-800 p-2 rounded-2xl text-[11px] font-bold">
        <div className="px-2.5 py-2 rounded-xl bg-[#00CCBC]/15 text-[#00CCBC] border border-[#00CCBC]/30 text-center">
          1. Coletado
        </div>
        <div
          className={`px-2.5 py-2 rounded-xl text-center border ${
            routeStarted
              ? 'bg-[#00CCBC] text-slate-950 border-[#00CCBC] font-black'
              : 'bg-[#0B1117] text-slate-300 border-slate-800'
          }`}
        >
          2. Em Rota GPS
        </div>
        <div className="px-2.5 py-2 rounded-xl bg-[#0B1117] text-slate-400 border border-slate-800 text-center">
          3. PIN 4 Dígitos
        </div>
      </div>

      {gpsPermState !== 'granted' && (
        <div className="p-3.5 rounded-2xl bg-[#111922] border border-[#00CCBC]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-[#00CCBC] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-white">
                {gpsPermState === 'denied'
                  ? 'Permissão de GPS real bloqueada'
                  : gpsPermState === 'unsupported'
                  ? 'GPS não suportado neste dispositivo'
                  : 'Permitir acesso ao seu GPS real?'}
              </div>
              <p className="text-[11px] text-slate-400">
                {gpsPermState === 'denied'
                  ? 'Autorize a localização nas configurações do navegador/app Android para enviar sua posição ao vivo ao cliente e à loja.'
                  : gpsPermState === 'unsupported'
                  ? 'O mapa exibirá a rota a partir do endereço físico da loja até o cliente.'
                  : 'Necessário para traçar sua rota em tempo real e atualizar sua posição no rastreio da entrega.'}
              </p>
            </div>
          </div>
          {gpsPermState !== 'unsupported' && (
            <button
              type="button"
              onClick={onRequestDriverGps}
              className="px-3.5 py-2 rounded-xl bg-[#00CCBC] hover:bg-[#00b4a6] text-slate-950 font-black text-xs shrink-0 cursor-pointer"
            >
              {gpsPermState === 'denied' ? 'Tentar Novamente' : 'Permitir GPS Real'}
            </button>
          )}
        </div>
      )}
    </>
  );
};
