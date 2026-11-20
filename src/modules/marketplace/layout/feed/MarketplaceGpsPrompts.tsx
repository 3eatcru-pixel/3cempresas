import React from 'react';
import { MapPin, ShieldCheck, AlertTriangle } from 'lucide-react';
import { GeolocationPermissionState } from '../../../../components/common/map/mapUtils';

interface MarketplaceGpsPromptsProps {
  gpsPromptState: GeolocationPermissionState | null;
  setGpsPromptState: (val: GeolocationPermissionState | null) => void;
  onConfirmGpsPermission: () => void;
  showReconciliationHint: boolean;
  gpsVsAddressDistanceKm: number;
  gpsAccuracyMeters?: number | null;
  onRequestGeolocation?: () => void;
  onGpsButtonClick: () => void;
}

export const MarketplaceGpsPrompts: React.FC<MarketplaceGpsPromptsProps> = ({
  gpsPromptState,
  setGpsPromptState,
  onConfirmGpsPermission,
  showReconciliationHint,
  gpsVsAddressDistanceKm,
  gpsAccuracyMeters,
  onRequestGeolocation,
  onGpsButtonClick,
}) => {
  return (
    <>
      {gpsPromptState && (
        <div className="p-3.5 rounded-2xl bg-slate-900/95 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-2.5 text-xs">
            {gpsPromptState === 'denied' || gpsPromptState === 'unsupported' ? (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold text-white">
                {gpsPromptState === 'denied'
                  ? 'Permissão de GPS bloqueada no dispositivo'
                  : gpsPromptState === 'unsupported'
                  ? 'GPS não disponível neste navegador'
                  : 'Permitir uso do seu GPS real?'}
              </div>
              <p className="text-[11px] text-slate-400">
                {gpsPromptState === 'denied'
                  ? 'Libere o acesso à localização nas configurações do navegador/app para usar o GPS real, ou digite seu CEP/endereço acima.'
                  : gpsPromptState === 'unsupported'
                  ? 'Informe seu endereço ou CEP no campo acima para localizar lojas próximas.'
                  : 'Usamos sua localização real apenas para calcular distâncias até as lojas próximas e preencher seu endereço de entrega.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setGpsPromptState(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 cursor-pointer"
            >
              Agora não
            </button>
            {gpsPromptState !== 'unsupported' && (
              <button
                type="button"
                onClick={onConfirmGpsPermission}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black cursor-pointer"
              >
                {gpsPromptState === 'denied' ? 'Tentar Novamente' : 'Permitir GPS Real'}
              </button>
            )}
          </div>
        </div>
      )}

      {showReconciliationHint && (
        <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
          <div className="text-slate-300 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>
              Seu GPS real está a <strong className="text-cyan-300">{gpsVsAddressDistanceKm.toFixed(1)} km</strong> do
              endereço físico selecionado
              {gpsAccuracyMeters ? ` (±${gpsAccuracyMeters}m)` : ''} — filtrando lojas pelo endereço físico.
            </span>
          </div>
          {onRequestGeolocation && (
            <button
              type="button"
              onClick={onGpsButtonClick}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 font-bold text-[10px] uppercase tracking-wider shrink-0 cursor-pointer self-end sm:self-auto"
            >
              Usar meu GPS aqui
            </button>
          )}
        </div>
      )}
    </>
  );
};
