import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Globe,
  Key,
  Link2,
  ShieldCheck,
  Smartphone,
  Webhook,
  X,
} from 'lucide-react';

export type WhatsAppConnectorMode = 'WA_ME' | 'CLOUD_API' | 'WEBHOOK';

export interface WhatsAppConnectorConfig {
  storeId: string;
  mode: WhatsAppConnectorMode;
  phoneNumberId: string;
  wabaId: string;
  webhookUrl: string;
  coexistence: boolean;
  hasToken: boolean;
  tokenMasked: string;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  updatedAt: string | null;
}

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  storeName: string;
  currentConfig: WhatsAppConnectorConfig;
  onClose: () => void;
  onSaveConfig: (payload: {
    mode: WhatsAppConnectorMode;
    phoneNumberId: string;
    wabaId: string;
    webhookUrl: string;
    token?: string;
    coexistence: boolean;
    clearToken?: boolean;
  }) => Promise<boolean>;
  onTestConnection: () => Promise<{
    ok: boolean;
    status: string;
    latencyMs: number;
    message: string;
  } | null>;
}

export const WhatsAppConnectModal: React.FC<WhatsAppConnectModalProps> = ({
  isOpen,
  storeName,
  currentConfig,
  onClose,
  onSaveConfig,
  onTestConnection,
}) => {
  const [mode, setMode] = useState<WhatsAppConnectorMode>(currentConfig.mode || 'WA_ME');
  const [phoneNumberId, setPhoneNumberId] = useState(currentConfig.phoneNumberId || '');
  const [wabaId, setWabaId] = useState(currentConfig.wabaId || '');
  const [webhookUrl, setWebhookUrl] = useState(currentConfig.webhookUrl || '');
  const [token, setToken] = useState('');
  const [coexistence, setCoexistence] = useState(currentConfig.coexistence !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    status: string;
    latencyMs: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMode(currentConfig.mode || 'WA_ME');
    setPhoneNumberId(currentConfig.phoneNumberId || '');
    setWabaId(currentConfig.wabaId || '');
    setWebhookUrl(currentConfig.webhookUrl || '');
    setCoexistence(currentConfig.coexistence !== false);
    setToken('');
    setTestResult(null);
  }, [isOpen, currentConfig]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const ok = await onSaveConfig({
        mode,
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        webhookUrl: webhookUrl.trim(),
        token: token.trim() || undefined,
        coexistence,
        clearToken: mode === 'WA_ME',
      });
      if (ok) {
        setToken('');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const res = await onTestConnection();
      if (res) setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl my-auto">
        <div className="flex justify-between items-start border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Conector WhatsApp da Loja · {storeName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Escolha entre links diretos zero-custo ou integração real via Server Core (cofre AES-256-GCM).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
          {(
            [
              { id: 'WA_ME', label: 'wa.me Direto', icon: Link2 },
              { id: 'CLOUD_API', label: 'Meta Cloud API', icon: Globe },
              { id: 'WEBHOOK', label: 'Webhook / API', icon: Webhook },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                <Icon size={14} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {mode === 'WA_ME' && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 size={15} /> Modo Padrão Zero-Custo Ativo
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                As campanhas e avisos de status de pedido abrem diretamente no WhatsApp Web ou App instalado usando o número da sua loja, sem taxa por conversa e sem dependência de aprovação externa.
              </p>
            </div>
          )}

          {mode === 'CLOUD_API' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    Phone Number ID (Meta) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 102938475654321"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">
                    WABA ID (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 987654321012345"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:border-emerald-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key size={12} className="text-emerald-400" />
                    Token Permanente (Bearer) {currentConfig.hasToken ? '(preencha apenas para substituir)' : '*'}
                  </span>
                  {currentConfig.hasToken && (
                    <span className="font-mono text-[10px] text-emerald-400">
                      Salvo: {currentConfig.tokenMasked}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required={!currentConfig.hasToken}
                  placeholder={
                    currentConfig.hasToken
                      ? 'Token protegido no cofre AES-256-GCM (deixe vazio para manter)'
                      : 'Cole o System User Token do Meta Business'
                  }
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:border-emerald-500 outline-none font-mono"
                />
              </div>

              <label className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={coexistence}
                  onChange={(e) => setCoexistence(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-semibold text-white">Coexistência com WhatsApp Business App</div>
                  <div className="text-[11px] text-slate-400">
                    Permite manter o atendimento manual no aparelho enquanto a Cloud API envia notificações.
                  </div>
                </div>
              </label>
            </div>
          )}

          {mode === 'WEBHOOK' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">
                  Endpoint HTTPS do Gateway (Evolution API / Z-API / Webhook Próprio) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://api.seudominio.com.br/whatsapp/send"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:border-emerald-500 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                  <span>Bearer Token / API Key (Opcional)</span>
                  {currentConfig.hasToken && (
                    <span className="font-mono text-[10px] text-emerald-400">
                      Salvo: {currentConfig.tokenMasked}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder="Chave de autorização enviada no header Authorization"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white px-3 py-2.5 rounded-xl focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>
          )}

          {/* Diagnostic feedback */}
          {(testResult || currentConfig.lastTestMessage) && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                (testResult ? testResult.ok : currentConfig.lastTestStatus === 'CONNECTED' || currentConfig.lastTestStatus === 'WA_ME_READY')
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              }`}
            >
              <ShieldCheck size={15} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5 min-w-0">
                <div className="font-bold">
                  {testResult
                    ? `${testResult.status} · ${testResult.latencyMs}ms`
                    : currentConfig.lastTestStatus || 'Diagnóstico'}
                </div>
                <div className="text-[11px] opacity-90">
                  {testResult ? testResult.message : currentConfig.lastTestMessage}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Activity size={14} className="text-emerald-400" />
              {isTesting ? 'Testando...' : 'Testar Conexão Salva'}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
