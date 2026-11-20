import React from 'react';
import { Trash2 } from 'lucide-react';
import { CityDirectoryRow, SourceFilter } from './cityMapsTypes';

interface CityMapsDirectoryTableProps {
  rowsCount: number;
  filteredRows: CityDirectoryRow[];
  sourceFilter: SourceFilter;
  onChangeSourceFilter: (filter: SourceFilter) => void;
  sourceCounts: {
    CITY_INDEX: number;
    STORE_DB: number;
    VIACEP_RANGE: number;
    SIGLON_LONDRINA: number;
  };
  errorMessage: string | null;
  isQueryingDirectory: boolean;
  onInspectRow: (row: CityDirectoryRow) => void;
  onDeleteIndexRow: (id: string) => void;
}

export const CityMapsDirectoryTable: React.FC<CityMapsDirectoryTableProps> = ({
  rowsCount,
  filteredRows,
  sourceFilter,
  onChangeSourceFilter,
  sourceCounts,
  errorMessage,
  isQueryingDirectory,
  onInspectRow,
  onDeleteIndexRow,
}) => {
  return (
    <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Diretório Territorial &amp; Faixas Numéricas</h3>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            {filteredRows.length} registro(s) encontrado(s)
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
          {(
            [
              { id: 'ALL', label: `Todos (${rowsCount})` },
              { id: 'CITY_INDEX', label: `Salvos (${sourceCounts.CITY_INDEX})` },
              { id: 'STORE_DB', label: `Lojas (${sourceCounts.STORE_DB})` },
              { id: 'VIACEP_RANGE', label: `ViaCEP (${sourceCounts.VIACEP_RANGE})` },
              { id: 'SIGLON_LONDRINA', label: `SIGLON (${sourceCounts.SIGLON_LONDRINA})` },
            ] as { id: SourceFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeSourceFilter(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                sourceFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300">
          {errorMessage}
        </div>
      )}

      {isQueryingDirectory ? (
        <div className="space-y-2 py-4">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="h-10 rounded-lg bg-slate-950 border border-slate-800/80 animate-pulse" />
          ))}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="py-10 text-center space-y-2">
          <p className="text-sm text-slate-300 font-medium">
            Nenhum logradouro ou faixa encontrada com estes filtros.
          </p>
          <p className="text-xs text-slate-500">
            Digite pelo menos 3 letras em Rua, informe um CEP completo ou clique em &quot;Limpar Filtros&quot;.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[11px] font-medium text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Localidade</th>
                <th className="py-2.5 px-3">Bairro / Região</th>
                <th className="py-2.5 px-3">Rua &amp; Número / Faixa</th>
                <th className="py-2.5 px-3">CEP</th>
                <th className="py-2.5 px-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 px-3 align-top">
                    <div className="font-medium text-white">
                      {row.city} - {row.stateUf}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {row.country} · {row.source}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    <div className="text-slate-200">{row.neighborhood || '—'}</div>
                    <div className="text-[11px] text-slate-500">{row.region}</div>
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    <div className="font-medium text-white">
                      {row.street}
                      {row.houseNumber ? `, ${row.houseNumber}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                      {row.numberRange || 'Sem faixa'}
                      {row.label ? ` · ${row.label}` : ''}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 align-top font-mono tabular-nums whitespace-nowrap text-slate-200">
                    {row.cep || '—'}
                  </td>
                  <td className="py-2.5 px-3 align-top text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onInspectRow(row)}
                        className="px-2.5 py-1 rounded border border-slate-700 hover:border-emerald-500 text-slate-200 hover:text-emerald-300 text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Focar
                      </button>
                      {row.source === 'CITY_INDEX' && (
                        <button
                          type="button"
                          onClick={() => onDeleteIndexRow(row.id)}
                          aria-label="Excluir registro"
                          className="p-1 rounded border border-slate-800 hover:border-red-500 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
