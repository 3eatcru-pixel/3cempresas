import React from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

interface ServerExecutionTerminalProps {
  executionStatus: string;
  executionLatency: number;
  executionResponse: any;
  copiedJson: boolean;
  onCopyJson: () => void;
}

export const ServerExecutionTerminal: React.FC<ServerExecutionTerminalProps> = ({
  executionStatus,
  executionLatency,
  executionResponse,
  copiedJson,
  onCopyJson,
}) => {
  return (
    <div className="bg-[#05080e] p-6 rounded-3xl border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white uppercase tracking-wider">Resposta HTTP Transacional</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-emerald-400 font-bold font-mono tabular-nums">{executionStatus}</span>
          <span className="text-slate-500">
            Tempo: <span className="text-amber-400 font-bold font-mono tabular-nums">{executionLatency}ms</span>
          </span>
          {executionResponse && (
            <button
              type="button"
              onClick={onCopyJson}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[10px] text-slate-300 flex items-center gap-1 cursor-pointer"
            >
              {copiedJson ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedJson ? 'Copiado' : 'Copiar JSON'}</span>
            </button>
          )}
        </div>
      </div>

      <pre className="font-mono text-xs text-slate-200 bg-[#020408] p-4 rounded-2xl border border-slate-900 overflow-x-auto max-h-72 leading-relaxed">
        {executionResponse
          ? JSON.stringify(executionResponse, null, 2)
          : '// Selecione uma rota ou informe o endpoint e clique em "Executar REST" para chamar o Express Server Core.'}
      </pre>
    </div>
  );
};
