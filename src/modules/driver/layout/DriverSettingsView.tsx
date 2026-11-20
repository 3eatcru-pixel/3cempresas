import React, { useState, useEffect } from 'react';
import { Bell, Volume2, Navigation, Globe, X } from 'lucide-react';

interface DriverSettingsViewProps {
  driverId: string;
  onBack: () => void;
  onShowNotification?: (msg: string) => void;
}

interface DriverPreferences {
  notifications: boolean;
  audioAlerts: boolean;
  autoOpenMapOnAccept: boolean;
}

const DEFAULT_PREFS: DriverPreferences = {
  notifications: true,
  audioAlerts: true,
  autoOpenMapOnAccept: true,
};

const loadDriverPrefs = (driverId: string): DriverPreferences => {
  try {
    const raw = localStorage.getItem(`3c_driver_prefs_${driverId}`);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      notifications: typeof parsed.notifications === 'boolean' ? parsed.notifications : true,
      audioAlerts: typeof parsed.audioAlerts === 'boolean' ? parsed.audioAlerts : true,
      autoOpenMapOnAccept: typeof parsed.autoOpenMapOnAccept === 'boolean' ? parsed.autoOpenMapOnAccept : true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

export const DriverSettingsView: React.FC<DriverSettingsViewProps> = ({
  driverId,
  onBack,
  onShowNotification,
}) => {
  const [prefs, setPrefs] = useState<DriverPreferences>(() => loadDriverPrefs(driverId));

  useEffect(() => {
    setPrefs(loadDriverPrefs(driverId));
  }, [driverId]);

  const updatePref = (key: keyof DriverPreferences, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(`3c_driver_prefs_${driverId}`, JSON.stringify(next));
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  };

  const handleTestSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        onShowNotification?.('Áudio do navegador indisponível neste aparelho.');
        return;
      }
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      onShowNotification?.('Alerta sonoro de corrida testado.');
    } catch {
      onShowNotification?.('Não foi possível reproduzir o alerta sonoro.');
    }
  };

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-black text-white text-sm">Configurações do App</h3>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 text-xs">
        <label className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800 cursor-pointer">
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-[#00CCBC] shrink-0" />
            <div>
              <span className="font-bold text-white block">Alertas de Novos Despachos</span>
              <span className="text-[11px] text-slate-400">Exibir avisos quando houver novos pedidos</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.notifications}
            onChange={(e) => updatePref('notifications', e.target.checked)}
            className="w-4 h-4 accent-[#00CCBC] rounded cursor-pointer"
          />
        </label>

        <div className="p-3 bg-[#0B1117] rounded-xl border border-slate-800 space-y-2">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <Volume2 className="w-4 h-4 text-[#00CCBC] shrink-0" />
              <div>
                <span className="font-bold text-white block">Som de Alerta de Corridas</span>
                <span className="text-[11px] text-slate-400">Aviso sonoro para chamadas recebidas</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={prefs.audioAlerts}
              onChange={(e) => updatePref('audioAlerts', e.target.checked)}
              className="w-4 h-4 accent-[#00CCBC] rounded cursor-pointer"
            />
          </label>
          {prefs.audioAlerts && (
            <button
              type="button"
              onClick={handleTestSound}
              className="w-full py-2 rounded-lg bg-[#111922] hover:bg-slate-800 border border-slate-700 text-[#00CCBC] font-bold text-[11px] cursor-pointer transition-colors"
            >
              Testar Som de Alerta
            </button>
          )}
        </div>

        <label className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800 cursor-pointer">
          <div className="flex items-center gap-3">
            <Navigation className="w-4 h-4 text-[#00CCBC] shrink-0" />
            <div>
              <span className="font-bold text-white block">Abrir Mapa ao Aceitar Corrida</span>
              <span className="text-[11px] text-slate-400">Ir direto para a navegação GPS após o aceite</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefs.autoOpenMapOnAccept}
            onChange={(e) => updatePref('autoOpenMapOnAccept', e.target.checked)}
            className="w-4 h-4 accent-[#00CCBC] rounded cursor-pointer"
          />
        </label>

        <div className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <Globe className="w-4 h-4 text-[#00CCBC]" />
            <span className="font-bold text-white">Idioma do App</span>
          </div>
          <span className="font-bold text-[#00CCBC] font-mono">Português (BR)</span>
        </div>
      </div>
    </div>
  );
};
