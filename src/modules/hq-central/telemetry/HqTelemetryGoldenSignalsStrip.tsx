import React from 'react';
import { Activity, Database, HardDrive, Layers, Unlock } from 'lucide-react';
import { InspectorResponse } from './telemetryTableUtils';

interface HqTelemetryGoldenSignalsStripProps {
  telemetry: InspectorResponse['telemetrySummary'] | undefined;
  totalEcosystemRecords: number;
  tablesCount: number;
  isDevOwner: boolean;
  onUnlockRateLimit: () => void;
}

export const HqTelemetryGoldenSignalsStrip: React.FC<HqTelemetryGoldenSignalsStripProps> = ({
  telemetry,
  totalEcosystemRecords,
  tablesCount,
  isDevOwner,
  onUnlockRateLimit,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">Tráfego HTTP &amp; RPM</span>
          <Activity className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="flex items-baseline justify-between font-mono tabular-nums">
          <span className="text-2xl font-black text-white">
            {telemetry?.summary.totalRequests ?? 0} reqs
          </span>
          <span className="text-xs font-bold text-indigo-400">
            {telemetry?.summary.rpm ?? 0} req/min
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Erros 4xx: {telemetry?.summary.errors4xx ?? 0} • 5xx:{' '}
          <span
            className={
              (telemetry?.summary.errors5xx || 0) > 0
                ? 'text-rose-400 font-bold'
                : 'text-emerald-400'
            }
          >
            {telemetry?.summary.errors5xx ?? 0} ({telemetry?.summary.errorRatePercent ?? 0}%)
          </span>
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">Latência Golden Signals</span>
          <Layers className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex items-baseline justify-between font-mono tabular-nums">
          <span className="text-2xl font-black text-emerald-400">
            {telemetry?.summary.p95Ms ?? 0}ms{' '}
            <span className="text-xs font-bold text-slate-400">p95</span>
          </span>
          <span className="text-xs font-bold text-slate-300">
            p50: {telemetry?.summary.p50Ms ?? 0}ms
          </span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          p99: {telemetry?.summary.p99Ms ?? 0}ms • SSE Ativas: {telemetry?.sseSessionsCount ?? 0}
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">Volume Total em Tabelas (TBL)</span>
          <Database className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-baseline justify-between font-mono tabular-nums">
          <span className="text-2xl font-black text-white">{totalEcosystemRecords}</span>
          <span className="text-xs font-bold text-amber-400">{tablesCount} tabelas</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Driver: {telemetry?.persistenceDriver || 'json-memory'} (
          {telemetry?.productionDatabaseReady ? 'PostgreSQL Ready' : 'Local Safe'})
        </div>
      </div>

      <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-400">Memória &amp; Rate Limiters</span>
          <HardDrive className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex items-baseline justify-between font-mono tabular-nums">
          <span className="text-2xl font-black text-white">
            {telemetry?.memoryRssMb ?? '--'} MB
          </span>
          <span className="text-xs font-bold text-cyan-400">
            Heap: {telemetry?.heapUsedMb ?? '--'} MB
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Uptime: {Math.floor((telemetry?.uptimeSeconds || 0) / 60)}m</span>
          {isDevOwner && (
            <button
              type="button"
              onClick={onUnlockRateLimit}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Unlock className="w-3 h-3" /> Limpar 429
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
