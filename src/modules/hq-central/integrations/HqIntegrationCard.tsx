import React, { useState } from 'react';
import {
  CheckCircle2,
  Trash2,
  Clock,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  Send,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SystemIntegration } from '../../../types';

interface HqIntegrationCardProps {
  integration: SystemIntegration;
  isDevOwner: boolean;
  isTesting: boolean;
  onTest: (id: string) => void;
  onWebhookTest: (id: string, eventType: 'PING' | 'ORDER_COMMITTED' | 'PAYMENT_CONFIRMED') => Promise<any>;
  onSuspend: (id: string) => void;
  onDelete: (id: string) => void;
}

export const HqIntegrationCard: React.FC<HqIntegrationCardProps> = ({
  integration: integ,
  isDevOwner,
  isTesting,
  onTest,
  onWebhookTest,
  onSuspend,
  onDelete,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [webhookEvent, setWebhookEvent] = useState<'PING' | 'ORDER_COMMITTED' | 'PAYMENT_CONFIRMED'>('PING');
  const [isDispatchingWebhook, setIsDispatchingWebhook] = useState(false);
  const [lastWebhookResult, setLastWebhookResult] = useState<{
    deliveryId: string;
    signaturePreview: string;
    signatureMode: string;
    httpStatus: number | null;
    latencyMs: number;
  } | null>(null);

  const isLive =
    integ.status === 'CONNECTED' ||
    integ.status === 'ONLINE' ||
    integ.status === 'OPERATIONAL' ||
    integ.status === 'REACHABLE';
  const isConfigured = integ.status === 'CONFIGURED' || integ.status === 'STANDBY';
  const isSuspended = integ.status === 'SUSPENDED';

  const probeHistory = Array.isArray(integ.probeHistory) ? integ.probeHistory : [];

  const handleDispatchWebhook = async () => {
    setIsDispatchingWebhook(true);
    try {
      const res = await onWebhookTest(integ.id, webhookEvent);
      if (res?.deliveryId) {
        setLastWebhookResult({
          deliveryId: res.deliveryId,
          signaturePreview: res.signaturePreview,
          signatureMode: res.signatureMode,
          httpStatus: res.httpStatus,
          latencyMs: res.latencyMs,
        });
      }
    } finally {
      setIsDispatchingWebhook(false);
    }
  };

  return (
    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3 hover:border-amber-500/30 transition-colors">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-white text-sm uppercase tracking-tight">{integ.name}</span>
            <span className="text-[10px] font-mono text-slate-400">
              • {integ.isDemo ? 'SANDBOX' : 'DIRETO'} • {integ.category}
            </span>
          </div>
          {typeof integ.latencyMs === 'number' && (
            <span className="text-[11px] font-mono tabular-nums text-cyan-400">
              {integ.latencyMs}ms{integ.lastHttpStatus ? ` · HTTP ${integ.lastHttpStatus}` : ''}
            </span>
          )}
        </div>

        <div className="space-y-0.5 text-[11px] font-mono">
          <div className="text-slate-400">
            <span className="text-slate-500">TOKEN: </span>
            {integ.apiKeyMasked || '••••••••'}
          </div>
          {integ.endpointUrl && (
            <div className="text-cyan-400/90 truncate">
              <span className="text-slate-500">ENDPOINT: </span>
              {integ.endpointUrl}
            </div>
          )}
          <div className="text-slate-500 tabular-nums">
            Último Sync: {integ.lastSync}
          </div>
        </div>

        {integ.diagnosticMessage && (
          <div
            className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg border ${
              integ.status === 'ERROR' || integ.status === 'AUTH_FAILED'
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                : 'bg-slate-900 text-slate-300 border-slate-800'
            }`}
          >
            {integ.diagnosticMessage}
          </div>
        )}

        {lastWebhookResult && (
          <div className="text-[10px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 space-y-0.5 tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold">Delivery: {lastWebhookResult.deliveryId}</span>
              <span>HTTP {lastWebhookResult.httpStatus ?? 'ERR'} • {lastWebhookResult.latencyMs}ms</span>
            </div>
            <div className="text-slate-400 truncate">
              X-3C-Signature: {lastWebhookResult.signaturePreview} ({lastWebhookResult.signatureMode})
            </div>
          </div>
        )}

        {isDevOwner && integ.endpointUrl && !isSuspended && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              aria-label="Evento do Webhook de Teste"
              value={webhookEvent}
              onChange={(e) => setWebhookEvent(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-mono text-slate-200 cursor-pointer"
            >
              <option value="PING">EVENT: PING</option>
              <option value="ORDER_COMMITTED">EVENT: ORDER_COMMITTED</option>
              <option value="PAYMENT_CONFIRMED">EVENT: PAYMENT_CONFIRMED</option>
            </select>
            <button
              type="button"
              disabled={isDispatchingWebhook}
              onClick={handleDispatchWebhook}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-cyan-300 border border-slate-700 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              title="Disparar POST assinado com HMAC-SHA256"
            >
              <Send className="w-3 h-3" />
              {isDispatchingWebhook ? 'Enviando...' : 'Webhook HMAC'}
            </button>
          </div>
        )}

        {probeHistory.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <History className="w-3 h-3" />
              <span>Histórico de Probes ({probeHistory.length})</span>
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto bg-slate-900/80 border border-slate-800 rounded-xl p-2 font-mono text-[10px] tabular-nums">
                {probeHistory.map((entry, idx) => (
                  <div
                    key={`${entry.timestamp}-${idx}`}
                    className="flex items-start justify-between gap-2 border-b border-slate-800/70 pb-1 last:border-b-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <span className="text-slate-400">[{entry.kind === 'WEBHOOK_TEST' ? `WH:${entry.eventType || 'PING'}` : 'PROBE'}]</span>{' '}
                      <span className={entry.status === 'ERROR' || entry.status === 'AUTH_FAILED' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                        {entry.status}
                      </span>
                      <div className="text-slate-400 truncate">{entry.message}</div>
                    </div>
                    <div className="text-right text-slate-500 shrink-0">
                      <div>{typeof entry.latencyMs === 'number' ? `${entry.latencyMs}ms` : '--'}</div>
                      <div>{new Date(entry.timestamp).toLocaleTimeString('pt-BR')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-900 pt-3">
        <div>
          {isLive ? (
            <span className="text-emerald-400 text-[11px] font-bold uppercase tracking-tight flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {integ.status}
            </span>
          ) : isSuspended ? (
            <span className="text-rose-400 text-[11px] font-bold uppercase tracking-tight flex items-center gap-1">
              <PauseCircle className="w-3.5 h-3.5" /> SUSPENSO
            </span>
          ) : isConfigured ? (
            <span className="text-amber-400 text-[11px] font-bold uppercase tracking-tight flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> CONFIGURADO
            </span>
          ) : (
            <span className="text-rose-400 text-[11px] font-bold uppercase tracking-tight flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {integ.status || 'ERRO'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onDelete(integ.id);
                  setConfirmDelete(false);
                }}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded-lg transition-colors cursor-pointer"
              >
                Confirmar Remoção
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
              >
                Voltar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onTest(integ.id)}
                disabled={isTesting}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-[10px] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                title="Testar Conectividade da API"
              >
                <PlayCircle className="w-3 h-3" /> {isTesting ? 'Testando...' : 'Testar'}
              </button>
              {isDevOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => onSuspend(integ.id)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    title={isSuspended ? 'Ativar tráfego da API' : 'Suspender tráfego da API'}
                  >
                    {isSuspended ? 'Reativar' : 'Suspender'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all cursor-pointer"
                    title="Remover Integração"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
