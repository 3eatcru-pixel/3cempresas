import React from 'react';
import { Sliders, ShieldAlert } from 'lucide-react';
import { PlatformGovernance } from '../../../types';

interface HqFeatureFlagsProps {
  featureFlags: PlatformGovernance['featureFlags'];
  canToggle?: boolean;
  onToggleFlag: (key: keyof PlatformGovernance['featureFlags']) => void;
}

const FLAG_CATALOG: Record<string, { label: string; description: string; isCircuitBreaker?: boolean }> = {
  marketplaceMaintenanceReadOnly: {
    label: 'Modo Manutenção do Marketplace (Somente Leitura)',
    description: 'Bloqueia novos pedidos online (HTTP 503) mantendo PDV/Loja Física e Edge operando.',
    isCircuitBreaker: true,
  },
  offlineSyncEngineEnabled: {
    label: 'Motor de Operação Offline & Sync HLC',
    description: 'Sincronização bidirecional Cloud Core <-> Edge LAN.',
  },
  autoDispatchEnabled: {
    label: 'Despacho Automático de Entregadores',
    description: 'Atribuição automática de rotas na frota ativa.',
  },
  dynamicSurgePricingEnabled: {
    label: 'Precificação Dinâmica de Entrega',
    description: 'Ajuste determinístico de taxa por raio e demanda.',
  },
  waiterTableSelfServiceEnabled: {
    label: 'Autoatendimento em Mesa (Garçom / QR)',
    description: 'Abertura de comanda e envio direto para cozinha.',
  },
  aiEngineEnabled: {
    label: 'Motor AI Engine (Opcional)',
    description: 'Habilita rotas pagas de IA (desativado = modo 100% determinístico).',
  },
  aiMenuAssistantEnabled: {
    label: 'Assistente AI de Cardápio (Opcional)',
    description: 'Sugestões de catálogo nas lojas quando Gemini estiver ativo.',
  },
  firebaseEnabled: {
    label: 'Firebase Auth & Firestore (Opcional)',
    description:
      'Liga ou desliga em 1 clique o login Google e a sincronização Firebase no ecossistema (executado pelo Backbone Server Core).',
  },
};

export const HqFeatureFlags: React.FC<HqFeatureFlagsProps> = ({
  featureFlags,
  canToggle = true,
  onToggleFlag,
}) => {
  const [confirmingBreakerKey, setConfirmingBreakerKey] = React.useState<string | null>(null);

  const orderedKeys = Array.from(
    new Set([
      'marketplaceMaintenanceReadOnly',
      'firebaseEnabled',
      ...Object.keys(featureFlags || {}),
    ])
  ) as Array<keyof PlatformGovernance['featureFlags']>;

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-amber-400" /> Governança &amp; Circuit Breakers da Plataforma
        </h3>
        <span className="text-xs text-amber-400 font-mono">
          {canToggle ? 'Governança DEV' : 'Somente Leitura'}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        Ligue ou desligue módulos e travas operacionais em todos os tenants instantaneamente sem redeploy.
      </p>
      <div className="space-y-2.5">
        {orderedKeys.map((key) => {
          const enabled = Boolean(featureFlags?.[key]);
          const meta = FLAG_CATALOG[key] || {
            label: key.replace(/([A-Z])/g, ' $1'),
            description: 'Controle global da infraestrutura do SaaS.',
          };
          const isBreakerActive = Boolean(meta.isCircuitBreaker && enabled);
          const isConfirming = confirmingBreakerKey === String(key);

          return (
            <div
              key={key}
              className={`flex items-center justify-between bg-slate-950 p-3 rounded-xl border text-xs ${
                isBreakerActive ? 'border-amber-500/40' : 'border-slate-800'
              }`}
            >
              <div className="min-w-0 pr-3">
                <span className="text-slate-200 font-bold flex items-center gap-1.5">
                  {meta.isCircuitBreaker && (
                    <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${isBreakerActive ? 'text-amber-400' : 'text-slate-500'}`} />
                  )}
                  {meta.label}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {meta.description}
                </span>
              </div>
              {isConfirming ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleFlag(key);
                      setConfirmingBreakerKey(null);
                    }}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-[10px] font-black cursor-pointer"
                  >
                    Confirmar Trava
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingBreakerKey(null)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] font-bold cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canToggle}
                  onClick={() => {
                    if (!canToggle) return;
                    if (meta.isCircuitBreaker && !enabled) {
                      setConfirmingBreakerKey(String(key));
                      return;
                    }
                    onToggleFlag(key);
                  }}
                  className={`px-3 py-1 rounded font-mono text-[11px] font-bold transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                    meta.isCircuitBreaker
                      ? enabled
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                      : enabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {meta.isCircuitBreaker
                    ? enabled
                      ? 'TRAVA ATIVA'
                      : 'OPERAÇÃO NORMAL'
                    : enabled
                    ? 'ATIVO NO SAAS'
                    : 'DESATIVADO'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
