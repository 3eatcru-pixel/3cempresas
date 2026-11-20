import React, { useMemo, useState } from 'react';
import { RestEndpointSpec } from '../../types';
import { Play, Copy, Check, AlertTriangle } from 'lucide-react';
import { ServerRoutesSidebar, ConsoleHistoryEntry } from './console/ServerRoutesSidebar';
import { ServerExecutionTerminal } from './console/ServerExecutionTerminal';

export type HttpMethodOption = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ServerConsoleTabProps {
  restEndpoints: RestEndpointSpec[];
  selectedEndpoint: string;
  selectedMethod: HttpMethodOption;
  onSelectEndpoint: (path: string, method?: HttpMethodOption) => void;
  onChangePath: (path: string) => void;
  onChangeMethod: (method: HttpMethodOption) => void;
  simulatedPayload: string;
  setSimulatedPayload: (payload: string) => void;
  onExecute: () => Promise<void> | void;
  isLoading: boolean;
  executionStatus: string;
  executionLatency: number;
  executionResponse: any;
  hasAuthToken: boolean;
  quickStores?: { id: string; name: string }[];
}

const DESTRUCTIVE_PATH_PATTERNS = ['/admin/reset-sandbox', '/admin/restore', '/admin/backup'];

export const ServerConsoleTab: React.FC<ServerConsoleTabProps> = ({
  restEndpoints,
  selectedEndpoint,
  selectedMethod,
  onSelectEndpoint,
  onChangePath,
  onChangeMethod,
  simulatedPayload,
  setSimulatedPayload,
  onExecute,
  isLoading,
  executionStatus,
  executionLatency,
  executionResponse,
  hasAuthToken,
  quickStores = [],
}) => {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [history, setHistory] = useState<ConsoleHistoryEntry[]>([]);
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [quickTargetStoreId, setQuickTargetStoreId] = useState<string>('');

  const isBodyDisabled = selectedMethod === 'GET' || selectedMethod === 'DELETE';

  const jsonValidation = useMemo(() => {
    if (isBodyDisabled) return { valid: true, error: null };
    const trimmed = simulatedPayload.trim();
    if (!trimmed) return { valid: true, error: null };
    try {
      JSON.parse(trimmed);
      return { valid: true, error: null };
    } catch (e: any) {
      return { valid: false, error: e?.message || 'JSON inválido' };
    }
  }, [isBodyDisabled, simulatedPayload]);

  const isDestructiveCall = useMemo(() => {
    if (selectedMethod === 'DELETE') return true;
    return DESTRUCTIVE_PATH_PATTERNS.some((p) => selectedEndpoint.includes(p)) && selectedMethod !== 'GET';
  }, [selectedEndpoint, selectedMethod]);

  const handleCopyCurl = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const compactBody = simulatedPayload.replace(/\s+/g, ' ').trim().replace(/'/g, "'\\''");
    const bodyPart = isBodyDisabled
      ? ''
      : ` \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: idem-console-${Date.now()}" \\\n  -d '${compactBody}'`;
    const authPart = hasAuthToken ? ` \\\n  -H "Authorization: Bearer <JWT_TOKEN>"` : '';
    const rfcHeaders = ` \\\n  -H "X-3C-Contract-Version: 1.0" \\\n  -H "X-3C-App-Id: hq" \\\n  -H "X-3C-Platform: web"`;
    const curl = `curl -X ${selectedMethod} "${origin}${selectedEndpoint}"${rfcHeaders}${authPart}${bodyPart}`;
    navigator.clipboard?.writeText(curl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  const handleCopyJson = () => {
    if (!executionResponse) return;
    navigator.clipboard?.writeText(JSON.stringify(executionResponse, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const handleSafeExecute = async () => {
    if (!jsonValidation.valid) return;
    if (isDestructiveCall && !confirmDestructive) {
      setConfirmDestructive(true);
      return;
    }
    setConfirmDestructive(false);
    await onExecute();
    setHistory((prev) => [
      {
        id: `hist-${Date.now()}`,
        method: selectedMethod,
        path: selectedEndpoint,
        status: executionStatus === 'AGUARDANDO' ? 'EXECUTADO' : executionStatus,
        latencyMs: executionLatency,
        executedAt: new Date().toLocaleTimeString('pt-BR'),
      },
      ...prev.slice(0, 9),
    ]);
  };

  const handleApplyQuickStore = (targetStoreId: string) => {
    setQuickTargetStoreId(targetStoreId);
    if (!targetStoreId) return;
    if (!isBodyDisabled) {
      try {
        const parsed = JSON.parse(simulatedPayload || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          parsed.storeId = targetStoreId;
          setSimulatedPayload(JSON.stringify(parsed, null, 2));
        }
      } catch {
        // leave unparseable payload untouched
      }
    } else if (selectedEndpoint.includes('storeId=')) {
      onChangePath(selectedEndpoint.replace(/storeId=[^&]+/, `storeId=${encodeURIComponent(targetStoreId)}`));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
      <ServerRoutesSidebar
        restEndpoints={restEndpoints}
        selectedEndpoint={selectedEndpoint}
        selectedMethod={selectedMethod}
        history={history}
        onSelectEndpoint={onSelectEndpoint}
        onResetConfirmDestructive={() => setConfirmDestructive(false)}
      />

      {/* Right: Interactive Console Execution Box */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <select
                aria-label="Método HTTP"
                value={selectedMethod}
                onChange={(e) => {
                  setConfirmDestructive(false);
                  onChangeMethod(e.target.value as HttpMethodOption);
                }}
                className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 font-black font-mono text-xs cursor-pointer focus:outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={selectedEndpoint}
                onChange={(e) => {
                  setConfirmDestructive(false);
                  onChangePath(e.target.value);
                }}
                placeholder="/api/v1/..."
                className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono font-bold text-white text-xs focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyCurl}
                className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCurl ? 'cURL Copiado' : 'Copiar cURL'}</span>
              </button>
              <button
                type="button"
                onClick={handleSafeExecute}
                disabled={isLoading || !jsonValidation.valid}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                {confirmDestructive ? 'Confirmar Execução' : 'Executar REST'}
              </button>
            </div>
          </div>

          {quickStores.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-500">Injetar storeId:</span>
              <select
                aria-label="Selecionar loja alvo para console"
                value={quickTargetStoreId}
                onChange={(e) => handleApplyQuickStore(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 cursor-pointer"
              >
                <option value="">Selecionar loja do cluster...</option>
                {quickStores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {confirmDestructive && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  Operação destrutiva detectada (<code className="font-mono">{selectedMethod} {selectedEndpoint}</code>).
                  Clique novamente em Confirmar Execução para prosseguir.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDestructive(false)}
                className="px-2.5 py-1 bg-slate-900 rounded-lg text-slate-300 font-semibold cursor-pointer shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Request Payload Editor */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex flex-wrap items-center justify-between gap-2">
              <span>
                {isBodyDisabled
                  ? `Método ${selectedMethod} não envia body JSON (parâmetros via query string na URL)`
                  : 'JSON Request Body Payload (Entrada):'}
              </span>
              <div className="flex items-center gap-3 font-mono text-[10px]">
                {!isBodyDisabled && (
                  <span className={jsonValidation.valid ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                    {jsonValidation.valid ? 'JSON Válido' : `Erro JSON: ${jsonValidation.error}`}
                  </span>
                )}
                <span className={hasAuthToken ? 'text-emerald-400' : 'text-amber-400'}>
                  {hasAuthToken ? 'Bearer JWT Ativo' : 'Sem token JWT'}
                </span>
              </div>
            </label>
            <textarea
              value={simulatedPayload}
              onChange={(e) => setSimulatedPayload(e.target.value)}
              disabled={isBodyDisabled}
              rows={7}
              className={`w-full bg-[#05080e] border rounded-2xl p-4 font-mono text-xs focus:outline-none resize-none ${
                !jsonValidation.valid
                  ? 'border-rose-500/60 text-rose-300'
                  : isBodyDisabled
                  ? 'border-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
                  : 'border-slate-800 focus:border-amber-500/50 text-emerald-400'
              }`}
            />
          </div>
        </div>

        <ServerExecutionTerminal
          executionStatus={executionStatus}
          executionLatency={executionLatency}
          executionResponse={executionResponse}
          copiedJson={copiedJson}
          onCopyJson={handleCopyJson}
        />
      </div>
    </div>
  );
};
