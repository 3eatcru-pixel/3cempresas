import React from 'react';

interface HqRuntimePolicySectionProps {
  canEdit: boolean;
  runtimeStorageMaxMb: number;
  setRuntimeStorageMaxMb: (val: number) => void;
  runtimeTenantQuotaMb: number;
  setRuntimeTenantQuotaMb: (val: number) => void;
  runtimeFirebaseProjectId: string;
  setRuntimeFirebaseProjectId: (val: string) => void;
  runtimeEmailWebhookUrl: string;
  setRuntimeEmailWebhookUrl: (val: string) => void;
  runtimeExtraOrigins: string;
  setRuntimeExtraOrigins: (val: string) => void;
  runtimeSupabaseUrl: string;
  setRuntimeSupabaseUrl: (val: string) => void;
  runtimeSupabasePublishableKey: string;
  setRuntimeSupabasePublishableKey: (val: string) => void;
  runtimeSupabaseJwksUrl: string;
  setRuntimeSupabaseJwksUrl: (val: string) => void;
}

export const HqRuntimePolicySection: React.FC<HqRuntimePolicySectionProps> = ({
  canEdit,
  runtimeStorageMaxMb,
  setRuntimeStorageMaxMb,
  runtimeTenantQuotaMb,
  setRuntimeTenantQuotaMb,
  runtimeFirebaseProjectId,
  setRuntimeFirebaseProjectId,
  runtimeEmailWebhookUrl,
  setRuntimeEmailWebhookUrl,
  runtimeExtraOrigins,
  setRuntimeExtraOrigins,
  runtimeSupabaseUrl,
  setRuntimeSupabaseUrl,
  runtimeSupabasePublishableKey,
  setRuntimeSupabasePublishableKey,
  runtimeSupabaseJwksUrl,
  setRuntimeSupabaseJwksUrl,
}) => {
  return (
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
          <input
            type="number"
            min={1}
            max={50}
            disabled={!canEdit}
            value={runtimeStorageMaxMb}
            onChange={(e) => setRuntimeStorageMaxMb(parseInt(e.target.value, 10) || 2)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400">Cota Tenant Storage (MB)</label>
          <input
            type="number"
            min={5}
            max={2048}
            disabled={!canEdit}
            value={runtimeTenantQuotaMb}
            onChange={(e) => setRuntimeTenantQuotaMb(parseInt(e.target.value, 10) || 50)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-400">Firebase Project ID</label>
          <input
            type="text"
            disabled={!canEdit}
            value={runtimeFirebaseProjectId}
            onChange={(e) => setRuntimeFirebaseProjectId(e.target.value)}
            placeholder="Opcional (padrão env)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1 lg:col-span-2">
          <label className="text-[11px] font-bold text-slate-400">E-mail Webhook URL (HTTPS)</label>
          <input
            type="url"
            disabled={!canEdit}
            value={runtimeEmailWebhookUrl}
            onChange={(e) => setRuntimeEmailWebhookUrl(e.target.value)}
            placeholder="https://mailer.suaempresa.com.br/hook"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-5">
          <label className="text-[11px] font-bold text-slate-400">
            Origens CORS Extras Autorizadas (separadas por vírgula)
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={runtimeExtraOrigins}
            onChange={(e) => setRuntimeExtraOrigins(e.target.value)}
            placeholder="https://app.suaempresa.com.br, https://loja.suaempresa.com.br"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-emerald-300">
            Supabase URL (Público HTTPS)
          </label>
          <input
            type="url"
            disabled={!canEdit}
            value={runtimeSupabaseUrl}
            onChange={(e) => setRuntimeSupabaseUrl(e.target.value)}
            placeholder="https://seu-projeto.supabase.co"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-emerald-300">
            Supabase Publishable Key (Apenas chave pública)
          </label>
          <input
            type="text"
            disabled={!canEdit}
            value={runtimeSupabasePublishableKey}
            onChange={(e) => setRuntimeSupabasePublishableKey(e.target.value)}
            placeholder="sb_publishable_..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-emerald-300">
            Supabase JWKS URL (Opcional)
          </label>
          <input
            type="url"
            disabled={!canEdit}
            value={runtimeSupabaseJwksUrl}
            onChange={(e) => setRuntimeSupabaseJwksUrl(e.target.value)}
            placeholder="Auto-derivada da URL Supabase"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white disabled:opacity-50"
          />
        </div>
      </div>
      <p className="text-[10px] text-slate-500">
        Segredos como <code className="text-slate-300">SUPABASE_SECRET_KEY</code> /{' '}
        <code className="text-slate-300">service_role</code> e senha Postgres são bloqueados aqui e devem ficar
        exclusivamente no Secret Manager do Server Core.
      </p>
    </div>
  );
};
