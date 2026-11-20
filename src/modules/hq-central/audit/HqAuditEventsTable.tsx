import React from 'react';
import { History, Search, RefreshCw, Download } from 'lucide-react';
import { STATUS_COLORS, PILLAR_THEMES } from '@3c/design-system';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

interface HqAuditEventsTableProps {
  logs: any[];
  logFilter: string;
  setLogFilter: (val: string) => void;
  isLoadingLogs: boolean;
  onRefresh: () => void;
}

const escapeCsv = (val: unknown) => {
  const s = String(val ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const HqAuditEventsTable: React.FC<HqAuditEventsTableProps> = ({
  logs,
  logFilter,
  setLogFilter,
  isLoadingLogs,
  onRefresh,
}) => {
  const storeOsTheme = PILLAR_THEMES['store-os'];
  const dangerToken = STATUS_COLORS.DANGER;
  const warningToken = STATUS_COLORS.WARNING;
  const successToken = STATUS_COLORS.SUCCESS;

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    const headers = ['Horario', 'Evento', 'Payload', 'Ator', 'Role', 'IP', 'Canal', 'TenantId'];
    const rows = logs.map((l) =>
      [
        l.timeStr || l.timestamp || '',
        l.type || '',
        l.payload || '',
        l.actorEmail || l.actorUid || 'SYSTEM',
        l.actorRole || '',
        l.sourceIp || 'local',
        l.channel || 'SYSTEM',
        l.tenantId || 'GLOBAL',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    getPlatformAdapters().links.downloadTextFile(
      `3C_HQ_AUDIT_LOGS_${dateStr}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
  };

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2 font-mono tabular-nums">
            <History className={`w-5 h-5 ${storeOsTheme.accentTextClass}`} /> Trilha de Auditoria Master ({logs.length})
          </h2>
          <p className="text-xs text-slate-400">
            Registro em tempo real de alterações administrativas, suspensões, licenças e comandos do cluster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={logFilter}
              onChange={(e) => setLogFilter(e.target.value)}
              placeholder="Filtrar evento, ator ou tenant..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={logs.length === 0}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Exportar eventos filtrados em CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoadingLogs}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase">
            <tr>
              <th className="px-4 py-3 border-b border-slate-800">Horário</th>
              <th className="px-4 py-3 border-b border-slate-800">Tipo de Evento</th>
              <th className="px-4 py-3 border-b border-slate-800">Detalhes Payload</th>
              <th className="px-4 py-3 border-b border-slate-800">Ator / IP / Req</th>
              <th className="px-4 py-3 border-b border-slate-800">Canal / Origem</th>
              <th className="px-4 py-3 border-b border-slate-800">Tenant ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {logs.length > 0 ? (
              logs.slice(0, 60).map((log, idx) => {
                const isError = String(log.type || '').includes('ERROR') || String(log.type || '').includes('FAIL');
                const badge = isError ? dangerToken : warningToken;
                return (
                  <tr key={log.id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 text-slate-400 tabular-nums whitespace-nowrap">{log.timeStr || log.timestamp}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${badge.badgeClass}`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-white truncate max-w-xs" title={String(log.payload || '')}>{log.payload}</td>
                    <td className="px-4 py-2.5 text-[10px] text-slate-400 whitespace-nowrap">
                      <div className="text-slate-200">{log.actorEmail || log.actorUid || 'SYSTEM'}</div>
                      <div className="text-slate-500">
                        {log.actorRole || '--'} • {log.sourceIp || 'local'} {log.requestId ? `• ${String(log.requestId).slice(0, 12)}` : ''}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 uppercase tracking-tighter text-[10px] font-bold">{log.channel || 'SYSTEM'}</td>
                    <td className={`px-4 py-2.5 ${successToken.textClass} font-bold`}>{log.tenantId || 'GLOBAL'}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic">
                  Nenhum evento correspondente registrado no log do cluster.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
