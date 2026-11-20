import React, { useMemo, useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  Terminal,
  Shield,
  AlertCircle,
  CheckCircle2,
  Search,
  Download,
} from 'lucide-react';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

interface SystemLogsAppProps {
  onOpenTerminal?: () => void;
}

type LogStatusFilter = 'ALL' | 'SUCCESS' | 'ERROR';

export const SystemLogsApp: React.FC<SystemLogsAppProps> = ({ onOpenTerminal }) => {
  const { currentStore, eventLogs, showNotification } = useEcosystem();
  const activeTenantId = currentStore.tenantId;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>('ALL');

  // Strict tenant/store isolation for shell logs
  const tenantLogs = useMemo(
    () =>
      eventLogs
        .filter((log) => {
          if (log.tenantId && activeTenantId) {
            return log.tenantId === activeTenantId;
          }
          return String(log.payload || '').includes(currentStore.id);
        })
        .slice(0, 200)
        .map((log) => {
          const isErr =
            log.type.includes('ERROR') ||
            log.type.includes('FAIL') ||
            log.type.includes('DENIED');
          return {
            time: log.timeStr || new Date(log.timestamp).toLocaleTimeString(),
            user: log.user || 'system',
            action: log.type,
            target: String(log.payload || ''),
            status: (isErr ? 'ERROR' : 'SUCCESS') as 'ERROR' | 'SUCCESS',
          };
        }),
    [eventLogs, activeTenantId, currentStore.id]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredLogs = useMemo(
    () =>
      tenantLogs.filter((log) => {
        if (statusFilter !== 'ALL' && log.status !== statusFilter) return false;
        if (!normalizedSearch) return true;
        return (
          log.action.toLowerCase().includes(normalizedSearch) ||
          log.user.toLowerCase().includes(normalizedSearch) ||
          log.target.toLowerCase().includes(normalizedSearch)
        );
      }),
    [tenantLogs, statusFilter, normalizedSearch]
  );

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) {
      showNotification('Nenhum registro de auditoria para exportar no filtro atual.');
      return;
    }
    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const rows = [
      'Timestamp,Usuario,Acao,Detalhes,Status',
      ...filteredLogs.map((l) =>
        [l.time, l.user, l.action, l.target, l.status].map(escapeCsv).join(',')
      ),
    ].join('\n');
    const filename = `Auditoria_${currentStore.slug || currentStore.id}_${new Date()
      .toISOString()
      .split('T')[0]}.csv`;
    getPlatformAdapters().links.downloadTextFile(filename, rows);
    showNotification(`Logs exportados: ${filename}`);
  };

  return (
    <div className="flex flex-col h-full space-y-4 animate-fadeIn">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-slate-300">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-bold text-white">Auditoria de Operações</span>
          <span className="text-xs text-slate-500 font-mono">
            · {currentStore.id}
          </span>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Exportar CSV
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por ação, usuário ou detalhe..."
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
          {(
            [
              { id: 'ALL', label: `Todos (${tenantLogs.length})` },
              {
                id: 'SUCCESS',
                label: `Sucesso (${tenantLogs.filter((l) => l.status === 'SUCCESS').length})`,
              },
              {
                id: 'ERROR',
                label: `Alerta/Erro (${tenantLogs.filter((l) => l.status === 'ERROR').length})`,
              },
            ] as Array<{ id: LogStatusFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950 rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs font-mono tabular-nums">
          <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-4 py-3 font-sans font-semibold">Horário</th>
              <th className="px-4 py-3 font-sans font-semibold">Usuário</th>
              <th className="px-4 py-3 font-sans font-semibold">Evento</th>
              <th className="px-4 py-3 font-sans font-semibold">Detalhes</th>
              <th className="px-4 py-3 font-sans font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredLogs.map((log, i) => (
              <tr key={i} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{log.time}</td>
                <td className="px-4 py-2.5 text-blue-400 font-semibold whitespace-nowrap">{log.user}</td>
                <td className="px-4 py-2.5 text-slate-200 whitespace-nowrap">{log.action}</td>
                <td className="px-4 py-2.5 text-slate-400 max-w-xs truncate" title={log.target}>
                  {log.target.slice(0, 64) || '—'}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-sans font-semibold ${
                      log.status === 'SUCCESS' ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {log.status === 'SUCCESS' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    {log.status === 'SUCCESS' ? 'Sucesso' : 'Alerta'}
                  </span>
                </td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500 font-sans">
                  {tenantLogs.length === 0
                    ? `Nenhum evento registrado para ${currentStore.name}.`
                    : 'Nenhum log encontrado para o filtro aplicado.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <p className="tabular-nums">
          Exibindo {filteredLogs.length} de {tenantLogs.length} registros isolados do tenant ({activeTenantId || currentStore.id}).
        </p>
        <button
          type="button"
          onClick={onOpenTerminal}
          disabled={!onOpenTerminal}
          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold transition-colors cursor-pointer disabled:opacity-40"
        >
          <Terminal className="w-3.5 h-3.5" /> Abrir no Terminal
        </button>
      </div>
    </div>
  );
};

