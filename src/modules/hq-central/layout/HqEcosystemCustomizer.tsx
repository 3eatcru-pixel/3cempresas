import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Percent,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { DEFAULT_PLATFORM_RUNTIME_POLICY } from '../../../constants/platformDefaults';
import { PlatformGovernance } from '../../../types';

interface HqEcosystemCustomizerProps {
  governance: PlatformGovernance;
  canEdit: boolean;
  onSaveGovernance: (updates: Partial<PlatformGovernance>) => Promise<void>;
}

export const HqEcosystemCustomizer: React.FC<HqEcosystemCustomizerProps> = ({
  governance,
  canEdit,
  onSaveGovernance,
}) => {
  const [customPlatformName, setCustomPlatformName] = useState(
    governance.customPlatformName || '3C Corp SaaS'
  );
  const [globalCommissionRate, setGlobalCommissionRate] = useState<number>(
    governance.globalCommissionRate ?? 12
  );
  const [defaultTrialDays, setDefaultTrialDays] = useState<number>(
    governance.defaultTrialDays ?? 7
  );
  const [defaultPlatformDeliveryFee, setDefaultPlatformDeliveryFee] = useState<number>(
    governance.defaultPlatformDeliveryFee ?? 8.9
  );
  const [maxConcurrentOrdersPerStore, setMaxConcurrentOrdersPerStore] = useState<number>(
    governance.maxConcurrentOrdersPerStore ?? 80
  );
  const [supportWhatsapp, setSupportWhatsapp] = useState(
    governance.supportWhatsapp || '+55 11 99999-3000'
  );
  const [supportEmail, setSupportEmail] = useState(
    governance.supportEmail || '3eatcru@gmail.com'
  );
  const [globalAnnouncementBanner, setGlobalAnnouncementBanner] = useState(
    governance.globalAnnouncementBanner || ''
  );
  const [maintenanceMessage, setMaintenanceMessage] = useState(
    governance.maintenanceMessage ||
      'Marketplace em janela rápida de manutenção preventiva. PDV e lojas físicas operam normalmente.'
  );
  const [runtimeStorageMaxMb, setRuntimeStorageMaxMb] = useState<number>(() =>
    Math.round((governance.runtimePolicy?.storageMaxObjectBytes ?? DEFAULT_PLATFORM_RUNTIME_POLICY.storageMaxObjectBytes) / (1024 * 1024))
  );
  const [runtimeTenantQuotaMb, setRuntimeTenantQuotaMb] = useState<number>(() =>
    Math.round((governance.runtimePolicy?.storageTenantQuotaBytes ?? DEFAULT_PLATFORM_RUNTIME_POLICY.storageTenantQuotaBytes) / (1024 * 1024))
  );
  const [runtimeExtraOrigins, setRuntimeExtraOrigins] = useState<string>(() =>
    (governance.runtimePolicy?.extraAllowedOrigins || []).join(', ')
  );
  const [runtimeFirebaseProjectId, setRuntimeFirebaseProjectId] = useState<string>(
    governance.runtimePolicy?.firebaseProjectIdOverride || ''
  );
  const [runtimeEmailWebhookUrl, setRuntimeEmailWebhookUrl] = useState<string>(
    governance.runtimePolicy?.emailWebhookUrl || ''
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomPlatformName(governance.customPlatformName || '3C Corp SaaS');
    setGlobalCommissionRate(governance.globalCommissionRate ?? 12);
    setDefaultTrialDays(governance.defaultTrialDays ?? 7);
    setDefaultPlatformDeliveryFee(governance.defaultPlatformDeliveryFee ?? 8.9);
    setMaxConcurrentOrdersPerStore(governance.maxConcurrentOrdersPerStore ?? 80);
    setSupportWhatsapp(governance.supportWhatsapp || '+55 11 99999-3000');
    setSupportEmail(governance.supportEmail || '3eatcru@gmail.com');
    setGlobalAnnouncementBanner(governance.globalAnnouncementBanner || '');
    setMaintenanceMessage(
      governance.maintenanceMessage ||
        'Marketplace em janela rápida de manutenção preventiva. PDV e lojas físicas operam normalmente.'
    );
    setRuntimeStorageMaxMb(
      Math.max(1, Math.round((governance.runtimePolicy?.storageMaxObjectBytes ?? DEFAULT_PLATFORM_RUNTIME_POLICY.storageMaxObjectBytes) / (1024 * 1024)))
    );
    setRuntimeTenantQuotaMb(
      Math.max(5, Math.round((governance.runtimePolicy?.storageTenantQuotaBytes ?? DEFAULT_PLATFORM_RUNTIME_POLICY.storageTenantQuotaBytes) / (1024 * 1024)))
    );
    setRuntimeExtraOrigins((governance.runtimePolicy?.extraAllowedOrigins || []).join(', '));
    setRuntimeFirebaseProjectId(governance.runtimePolicy?.firebaseProjectIdOverride || '');
    setRuntimeEmailWebhookUrl(governance.runtimePolicy?.emailWebhookUrl || '');
  }, [governance]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    try {
      const parsedOrigins = runtimeExtraOrigins
        .split(',')
        .map((o) => o.trim().replace(/\/+$/, ''))
        .filter(Boolean);
      await onSaveGovernance({
        customPlatformName: customPlatformName.trim() || '3C Corp SaaS',
        globalCommissionRate: Math.max(0, Math.min(50, Number(globalCommissionRate) || 0)),
        defaultTrialDays: Math.max(1, Math.min(365, Math.floor(Number(defaultTrialDays) || 7))),
        defaultPlatformDeliveryFee: Math.max(
          0,
          Math.min(500, Number(defaultPlatformDeliveryFee) || 0)
        ),
        maxConcurrentOrdersPerStore: Math.max(
          1,
          Math.min(5000, Math.floor(Number(maxConcurrentOrdersPerStore) || 80))
        ),
        supportWhatsapp: supportWhatsapp.trim(),
        supportEmail: supportEmail.trim(),
        globalAnnouncementBanner: globalAnnouncementBanner.trim(),
        maintenanceMessage: maintenanceMessage.trim(),
        runtimePolicy: {
          ...DEFAULT_PLATFORM_RUNTIME_POLICY,
          ...(governance.runtimePolicy || {}),
          storageMaxObjectBytes: Math.max(1, Math.min(50, Math.round(runtimeStorageMaxMb || 2))) * 1024 * 1024,
          storageTenantQuotaBytes: Math.max(5, Math.min(2048, Math.round(runtimeTenantQuotaMb || 50))) * 1024 * 1024,
          extraAllowedOrigins: parsedOrigins,
          firebaseProjectIdOverride: runtimeFirebaseProjectId.trim(),
          emailWebhookUrl: runtimeEmailWebhookUrl.trim(),
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: 'DEFAULT' | 'PROMO_EXPANSION' | 'PEAK_PROTECTION') => {
    if (!canEdit) return;
    if (preset === 'DEFAULT') {
      setGlobalCommissionRate(12);
      setDefaultTrialDays(7);
      setDefaultPlatformDeliveryFee(8.9);
      setMaxConcurrentOrdersPerStore(80);
      setGlobalAnnouncementBanner('');
    } else if (preset === 'PROMO_EXPANSION') {
      setGlobalCommissionRate(8);
      setDefaultTrialDays(14);
      setDefaultPlatformDeliveryFee(5.9);
      setMaxConcurrentOrdersPerStore(120);
      setGlobalAnnouncementBanner(
        'Campanha de Expansão HQ ativa: Taxa Marketplace reduzida para 8% e 14 dias de degustação para novas lojas!'
      );
    } else if (preset === 'PEAK_PROTECTION') {
      setGlobalCommissionRate(12);
      setDefaultTrialDays(7);
      setDefaultPlatformDeliveryFee(11.9);
      setMaxConcurrentOrdersPerStore(50);
      setGlobalAnnouncementBanner(
        'Operação de Alta Demanda ativa: prioridade para despacho automático e proteção de fila KDS.'
      );
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-indigo-400" />
            Customizações &amp; Regras Globais do Ecossistema
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Ajuste comissões, período de degustação padrão, taxas logísticas, canais de suporte e comunicados globais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => applyPreset('PROMO_EXPANSION')}
            className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-3 h-3" /> Preset Expansão (8% / 14d)
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => applyPreset('PEAK_PROTECTION')}
            className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-40"
          >
            Preset Alta Demanda
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => applyPreset('DEFAULT')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3 h-3" /> Padrão
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            Comissão Marketplace (%)
          </label>
          <input
            type="number"
            step="0.5"
            min={0}
            max={50}
            disabled={!canEdit}
            value={globalCommissionRate}
            onChange={(e) => setGlobalCommissionRate(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 block">
            Aplicada no split de pedidos B2C quando a loja não possui taxa própria
          </span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Degustação Padrão FREE (Dias)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            disabled={!canEdit}
            value={defaultTrialDays}
            onChange={(e) => setDefaultTrialDays(parseInt(e.target.value, 10) || 7)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 block">
            Concedida automaticamente ao provisionar novas lojas em plano FREE
          </span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            Taxa Base Frota HQ (R$)
          </label>
          <input
            type="number"
            step="0.5"
            min={0}
            max={500}
            disabled={!canEdit}
            value={defaultPlatformDeliveryFee}
            onChange={(e) => setDefaultPlatformDeliveryFee(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 block">
            Referência para corridas despachadas pela Frota Plataforma HQ
          </span>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-purple-400" />
            Limite Pedidos Simultâneos/Loja
          </label>
          <input
            type="number"
            min={1}
            max={5000}
            disabled={!canEdit}
            value={maxConcurrentOrdersPerStore}
            onChange={(e) => setMaxConcurrentOrdersPerStore(parseInt(e.target.value, 10) || 80)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white tabular-nums focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <span className="text-[10px] text-slate-500 block">
            Teto operacional para proteção de fila KDS por estabelecimento
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">Nome White-Label da Plataforma</label>
          <input
            type="text"
            disabled={!canEdit}
            value={customPlatformName}
            onChange={(e) => setCustomPlatformName(e.target.value)}
            placeholder="3C Corp SaaS"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">WhatsApp Oficial Suporte HQ</label>
          <input
            type="text"
            disabled={!canEdit}
            value={supportWhatsapp}
            onChange={(e) => setSupportWhatsapp(e.target.value)}
            placeholder="+55 11 99999-3000"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">E-mail Governança &amp; Suporte</label>
          <input
            type="email"
            disabled={!canEdit}
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="3eatcru@gmail.com"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-amber-400" />
            Comunicado / Banner Global para Lojistas &amp; Ecossistema
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={globalAnnouncementBanner}
            onChange={(e) => setGlobalAnnouncementBanner(e.target.value)}
            placeholder="Ex.: Nova atualização fiscal v5.2 disponível para todas as filiais..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-300">
            Mensagem Customizada do Circuit Breaker (Manutenção Marketplace)
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={maintenanceMessage}
            onChange={(e) => setMaintenanceMessage(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wide text-cyan-300">
            Variáveis de Runtime (HQ + Server Core • Segredos permanecem no Cofre/Server)
          </span>
          <span className="text-[10px] font-mono text-slate-500">runtimePolicy</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Max Objeto Storage (MB)</label>
            <input type="number" min={1} max={50} disabled={!canEdit} value={runtimeStorageMaxMb} onChange={(e) => setRuntimeStorageMaxMb(parseInt(e.target.value, 10) || 2)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Cota Tenant Storage (MB)</label>
            <input type="number" min={5} max={2048} disabled={!canEdit} value={runtimeTenantQuotaMb} onChange={(e) => setRuntimeTenantQuotaMb(parseInt(e.target.value, 10) || 50)} className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-400">Firebase Project ID</label>
            <input type="text" disabled={!canEdit} value={runtimeFirebaseProjectId} onChange={(e) => setRuntimeFirebaseProjectId(e.target.value)} placeholder="Opcional (padrão env)" className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50" />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-[11px] font-bold text-slate-400">E-mail Webhook URL (HTTPS)</label>
            <input type="url" disabled={!canEdit} value={runtimeEmailWebhookUrl} onChange={(e) => setRuntimeEmailWebhookUrl(e.target.value)} placeholder="https://mailer.suaempresa.com.br/hook" className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50" />
          </div>
          <div className="space-y-1 sm:col-span-2 lg:col-span-5">
            <label className="text-[11px] font-bold text-slate-400">Origens CORS Extras Autorizadas (separadas por vírgula)</label>
            <input type="text" disabled={!canEdit} value={runtimeExtraOrigins} onChange={(e) => setRuntimeExtraOrigins(e.target.value)} placeholder="https://app.suaempresa.com.br, https://loja.suaempresa.com.br" className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="text-[11px] text-slate-400">
          {globalAnnouncementBanner ? (
            <span className="text-amber-400 font-bold">
              Banner ativo: &ldquo;{globalAnnouncementBanner}&rdquo;
            </span>
          ) : (
            <span>Nenhum banner global exibido no momento.</span>
          )}
        </div>

        <button
          type="submit"
          disabled={!canEdit || saving}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase rounded-xl flex items-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Customizações Globais'}
        </button>
      </div>
    </form>
  );
};
