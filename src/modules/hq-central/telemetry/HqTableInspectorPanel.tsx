import React, { useState } from 'react';
import { Check, Copy, Download, Eye, Filter, RefreshCw, Search, X } from 'lucide-react';
import { Store } from '../../../types';
import { InspectorResponse, summarizeRowRecord } from './telemetryTableUtils';

interface HqTableInspectorPanelProps {
  selectedTable: string;
  inspectorData: InspectorResponse | null;
  activeTableDescription?: string;
  loading: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  tenantFilter: string;
  onTenantFilterChange: (t: string) => void;
  distinctTenants: string[];
  storeFilter: string;
  onStoreFilterChange: (s: string) => void;
  stores: Store[];
  includeDeleted: boolean;
  onIncludeDeletedChange: (v: boolean) => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export const HqTableInspectorPanel: React.FC<HqTableInspectorPanelProps> = ({
  selectedTable,
  inspectorData,
  activeTableDescription,
  loading,
  searchQuery,
  onSearchQueryChange,
  tenantFilter,
  onTenantFilterChange,
  distinctTenants,
  storeFilter,
  onStoreFilterChange,
  stores,
  includeDeleted,
  onIncludeDeletedChange,
  onRefresh,
  onExportCsv,
  onExportJson,
}) => {
  const [inspectingRow, setInspectingRow] = useState<Record<string, any> | null>(null);
  const [copiedRowJson, setCopiedRowJson] = useState<boolean>(false);

  return (
    <>
      <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded font-mono text-[10px] font-bold text-amber-400">
                TBL INSPECTOR
              </span>
              <h3 className="text-base font-black text-white font-mono">
                tbl.{inspectorData?.selectedTable || selectedTable}
              </h3>
              <span className="text-xs font-mono text-slate-400">
                ({inspectorData?.totalRows ?? 0} registros)
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTableDescription ||
                'Inspeção estruturada com redação automática de hashes e segredos.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={onExportJson}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> JSON
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="sm:col-span-5 relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRefresh();
              }}
              placeholder="Buscar ID, nome, e-mail, status..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-3 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <select
              value={tenantFilter}
              onChange={(e) => onTenantFilterChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 font-mono focus:outline-none"
            >
              <option value="ALL">Todos Tenants</option>
              {distinctTenants.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <select
              value={storeFilter}
              onChange={(e) => onStoreFilterChange(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none"
            >
              <option value="ALL">Todas as Lojas</option>
              {stores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRefresh}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg cursor-pointer shrink-0"
            >
              Filtrar
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => onIncludeDeletedChange(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-indigo-500"
            />
            <span>Incluir registros marcados com soft-delete (_deleted)</span>
          </label>
          <span className="font-mono">
            Exibindo {inspectorData?.rows.length ?? 0} de {inspectorData?.totalRows ?? 0}
          </span>
        </div>

        {/* Records Table */}
        <div className="overflow-x-auto border border-slate-800 rounded-xl flex-1 max-h-[520px]">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] sticky top-0 border-b border-slate-800">
              <tr>
                <th className="px-3 py-2.5">ID / Chave</th>
                <th className="px-3 py-2.5">Registro / Atributos</th>
                <th className="px-3 py-2.5">Escopo (Tenant / Loja)</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Atualizado em</th>
                <th className="px-3 py-2.5 text-right">Inspeção</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(inspectorData?.rows || []).map((row, idx) => {
                const rowId = String(row.id || row.uid || row.nodeId || `row-${idx}`);
                const summary = summarizeRowRecord(selectedTable, row);
                return (
                  <tr key={`${rowId}-${idx}`} className="hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 font-mono text-[11px] text-amber-400 font-bold whitespace-nowrap max-w-[150px] truncate">
                      {rowId}
                    </td>
                    <td className="px-3 py-2.5 max-w-[240px]">
                      <div className="font-bold text-white truncate">{summary.primaryLabel}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {summary.secondaryLabel}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-300 whitespace-nowrap">
                      {summary.scopeLabel}
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ['ACTIVE', 'PAID', 'ONLINE', 'COMPLETED', 'DELIVERED', 'CONNECTED', 'OK', 'OPEN', 'PAIRED'].includes(
                            summary.statusBadge
                          )
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : ['SUSPENDED', 'DISABLED', 'OVERDUE', 'CANCELLED', 'CRITICAL', 'REJECTED'].includes(
                                summary.statusBadge
                              )
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {summary.statusBadge}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      {summary.timestampLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setInspectingRow(row)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-300 text-slate-200 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border border-slate-700 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" /> JSON
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && (inspectorData?.rows.length || 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 italic">
                    Nenhum registro encontrado na tabela{' '}
                    <span className="font-mono text-slate-300">tbl.{selectedTable}</span> para os
                    filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row JSON Inspection Modal */}
      {inspectingRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-white font-mono">
                  tbl.{selectedTable} • {String(inspectingRow.id || inspectingRow.uid || 'registro')}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Visualização JSON auditada (segredos e hashes sensíveis omitidos)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(JSON.stringify(inspectingRow, null, 2));
                    setCopiedRowJson(true);
                    setTimeout(() => setCopiedRowJson(false), 1800);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedRowJson ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedRowJson ? 'Copiado' : 'Copiar JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingRow(null)}
                  className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-300 overflow-auto max-h-[65vh] leading-relaxed">
              {JSON.stringify(inspectingRow, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </>
  );
};
