import React from 'react';
import { RotateCcw } from 'lucide-react';
import { StorePrintJobRecord } from '../StorePeripheralsManager';

interface StorePrintJobsQueueProps {
  printJobs: StorePrintJobRecord[];
  onAckPrintJob: (job: StorePrintJobRecord, status: 'PRINTED' | 'FAILED') => void;
  onRetryPrintJob?: (job: StorePrintJobRecord) => void;
}

export const StorePrintJobsQueue: React.FC<StorePrintJobsQueueProps> = ({
  printJobs,
  onAckPrintJob,
  onRetryPrintJob,
}) => {
  if (printJobs.length === 0) return null;

  return (
    <div className="pt-3 border-t border-slate-800 space-y-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        Fila Recente de Impressão ESC/POS (<span className="font-mono tabular-nums">{printJobs.length}</span>)
      </div>
      <div className="space-y-1.5">
        {printJobs.map((job) => (
          <div
            key={job.id}
            className="px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-2 text-[11px]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] text-amber-400">{job.station}</span>
              <span className="text-slate-300 truncate">
                {job.peripheralName || 'Roteamento Padrão'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono tabular-nums">({job.bytes || 0}B)</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                  job.status === 'PRINTED'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : job.status === 'FAILED'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {job.status}
              </span>
              {job.status === 'QUEUED' && (
                <button
                  type="button"
                  onClick={() => onAckPrintJob(job, 'PRINTED')}
                  className="px-2 py-0.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded text-[9px] font-bold cursor-pointer"
                >
                  Confirmar Impresso
                </button>
              )}
              {job.status === 'FAILED' && onRetryPrintJob && (
                <button
                  type="button"
                  onClick={() => onRetryPrintJob(job)}
                  className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Reenviar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
