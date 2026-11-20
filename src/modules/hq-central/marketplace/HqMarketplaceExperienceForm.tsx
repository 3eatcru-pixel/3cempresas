import React from 'react';
import { Save, ShieldAlert } from 'lucide-react';

export interface MarketplaceExperienceDraft {
  marketplaceName: string;
  heroHeadline: string;
  heroSubtitle: string;
  recommendationsTitle: string;
  globalAnnouncementBanner: string;
  defaultPlatformDeliveryFee: number;
  globalCommissionRate: number;
  defaultDiscoveryRadiusKm: number;
  maxConcurrentOrdersPerStore: number;
  allowGuestBrowsing: boolean;
  enabledVerticals: string[];
  maintenanceMessage: string;
}

const MARKETPLACE_VERTICAL_OPTIONS = [
  { id: 'RESTAURANT', label: 'Gastronomia & Alimentos' },
  { id: 'RETAIL', label: 'Varejo & Comércio Físico' },
  { id: 'SERVICES', label: 'Serviços & Agendamentos' },
  { id: 'MULTI_COMMERCE', label: 'Multi-Comércio Híbrido' },
];

interface HqMarketplaceExperienceFormProps {
  draft: MarketplaceExperienceDraft;
  isDevOwner: boolean;
  saving: boolean;
  isReadOnly: boolean;
  autoDispatchEnabled: boolean;
  dynamicSurgeEnabled: boolean;
  aiEngineEnabled: boolean;
  togglingFlag: string | null;
  onChangeDraft: React.Dispatch<React.SetStateAction<MarketplaceExperienceDraft>>;
  onToggleVertical: (verticalId: string) => void;
  onToggleFlag: (
    flag:
      | 'marketplaceMaintenanceReadOnly'
      | 'autoDispatchEnabled'
      | 'dynamicSurgePricingEnabled'
      | 'aiEngineEnabled'
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqMarketplaceExperienceForm: React.FC<HqMarketplaceExperienceFormProps> = ({
  draft,
  isDevOwner,
  saving,
  isReadOnly,
  autoDispatchEnabled,
  dynamicSurgeEnabled,
  aiEngineEnabled,
  togglingFlag,
  onChangeDraft,
  onToggleVertical,
  onToggleFlag,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Experiência do Consumidor &amp; Regras da Plataforma
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            O HQ governa a vitrine do ecossistema, descoberta, taxas e disponibilidade. Produtos físicos, preços e atendimento pertencem ao Store OS de cada lojista.
          </p>
        </div>
        {!isDevOwner && (
          <span className="text-xs text-slate-500 font-mono">Somente leitura · DEV_OWNER</span>
        )}
      </div>

      {/* Identidade editorial do Marketplace */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Nome Público do Marketplace
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            maxLength={60}
            value={draft.marketplaceName}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, marketplaceName: e.target.value }))
            }
            placeholder="3C Marketplace"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Banner de Aviso Global (Topo do Marketplace)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            maxLength={300}
            value={draft.globalAnnouncementBanner}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, globalAnnouncementBanner: e.target.value }))
            }
            placeholder="Ex.: Frete reduzido na região central neste fim de semana"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Manchete Editorial da Home do Consumidor (Opcional)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            maxLength={140}
            value={draft.heroHeadline}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, heroHeadline: e.target.value }))}
            placeholder="Ex.: Descubra lojas, restaurantes e serviços perto de você"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">
            Subtítulo Editorial (Opcional)
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            maxLength={260}
            value={draft.heroSubtitle}
            onChange={(e) => onChangeDraft((prev) => ({ ...prev, heroSubtitle: e.target.value }))}
            placeholder="Ex.: Pedidos diretos com lojas verificadas e acompanhamento em tempo real."
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <label className="text-xs font-medium text-slate-300">
            Título da Faixa de Recomendações do Marketplace
          </label>
          <input
            type="text"
            disabled={!isDevOwner}
            maxLength={80}
            value={draft.recommendationsTitle}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, recommendationsTitle: e.target.value }))
            }
            placeholder="Recomendados para você"
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Parâmetros econômicos e de descoberta */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-800">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Taxa Base Entrega (R$)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            max={500}
            disabled={!isDevOwner}
            value={draft.defaultPlatformDeliveryFee}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                defaultPlatformDeliveryFee: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Comissão Global (%)</label>
          <input
            type="number"
            step="0.1"
            min={0}
            max={50}
            disabled={!isDevOwner}
            value={draft.globalCommissionRate}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                globalCommissionRate: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Raio Padrão (km)</label>
          <input
            type="number"
            min={1}
            max={100}
            disabled={!isDevOwner}
            value={draft.defaultDiscoveryRadiusKm}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                defaultDiscoveryRadiusKm: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Pedidos Simultâneos / Loja</label>
          <input
            type="number"
            min={1}
            max={5000}
            disabled={!isDevOwner}
            value={draft.maxConcurrentOrdersPerStore}
            onChange={(e) =>
              onChangeDraft((prev) => ({
                ...prev,
                maxConcurrentOrdersPerStore: Number(e.target.value),
              }))
            }
            className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Verticais habilitadas */}
      <div className="space-y-2.5 pt-4 border-t border-slate-800">
        <div className="text-xs font-medium text-slate-300">
          Verticais Comerciais Ativas na Descoberta
        </div>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_VERTICAL_OPTIONS.map((v) => {
            const active = draft.enabledVerticals.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                disabled={!isDevOwner}
                onClick={() => onToggleVertical(v.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                  active
                    ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {v.label} · {active ? 'Ativa' : 'Pausada'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles operacionais em tempo real + Circuit Breaker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-slate-800">
        <label className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
          <div>
            <div className="text-xs font-medium text-white">Navegação Aberta ao Consumidor</div>
            <div className="text-[11px] text-slate-500">
              Permite explorar vitrines antes de criar conta de consumidor.
            </div>
          </div>
          <input
            type="checkbox"
            disabled={!isDevOwner}
            checked={draft.allowGuestBrowsing}
            onChange={(e) =>
              onChangeDraft((prev) => ({ ...prev, allowGuestBrowsing: e.target.checked }))
            }
            className="w-4 h-4 accent-indigo-500 cursor-pointer"
          />
        </label>

        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div>
            <div className="text-xs font-medium text-white">Despacho Automático de Frota</div>
            <div className="text-[11px] text-slate-500">
              Distribui pedidos prontos automaticamente para motoristas da rede.
            </div>
          </div>
          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'autoDispatchEnabled'}
            onClick={() => onToggleFlag('autoDispatchEnabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              autoDispatchEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {autoDispatchEnabled ? 'Ativo' : 'Desligado'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div>
            <div className="text-xs font-medium text-white">Tarifa Dinâmica em Horários de Pico</div>
            <div className="text-[11px] text-slate-500">
              Ajuste de frete da plataforma em picos de demanda logística.
            </div>
          </div>
          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'dynamicSurgePricingEnabled'}
            onClick={() => onToggleFlag('dynamicSurgePricingEnabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              dynamicSurgeEnabled
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {dynamicSurgeEnabled ? 'Ativo' : 'Desligado'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div>
            <div className="text-xs font-medium text-white">Busca Inteligente do Consumidor</div>
            <div className="text-[11px] text-slate-500">
              Descoberta assistida de estabelecimentos no Marketplace.
            </div>
          </div>
          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'aiEngineEnabled'}
            onClick={() => onToggleFlag('aiEngineEnabled')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              aiEngineEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                : 'bg-slate-900 text-slate-400 border-slate-700'
            }`}
          >
            {aiEngineEnabled ? 'Ativo' : 'Desligado'}
          </button>
        </div>
      </div>

      {/* Circuit Breaker Somente Leitura */}
      <div className="pt-4 border-t border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-semibold text-white">
                Circuit Breaker — Modo Somente Leitura do Marketplace
              </div>
              <div className="text-[11px] text-slate-400">
                Pausa imediatamente novos pedidos no Marketplace mantendo vitrines visíveis para consulta.
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={!isDevOwner || togglingFlag === 'marketplaceMaintenanceReadOnly'}
            onClick={() => onToggleFlag('marketplaceMaintenanceReadOnly')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
              isReadOnly
                ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-rose-500/40'
            }`}
          >
            {isReadOnly ? 'Desativar Somente Leitura' : 'Ativar Modo Somente Leitura'}
          </button>
        </div>

        <input
          type="text"
          disabled={!isDevOwner}
          maxLength={240}
          value={draft.maintenanceMessage}
          onChange={(e) =>
            onChangeDraft((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
          }
          placeholder="Mensagem exibida ao consumidor caso o modo somente leitura esteja ativo"
          className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
        />
      </div>

      {isDevOwner && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando alterações...' : 'Salvar Governança do Marketplace'}
          </button>
        </div>
      )}
    </form>
  );
};
