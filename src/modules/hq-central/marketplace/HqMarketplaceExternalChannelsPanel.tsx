import React, { useEffect, useState } from 'react';
import { Globe, Save } from 'lucide-react';
import { ExternalDeliveryChannelConfig } from '../../../types';

interface HqMarketplaceExternalChannelsPanelProps {
  connectors: ExternalDeliveryChannelConfig[];
  isDevOwner: boolean;
  saving: boolean;
  onSaveConnectors: (next: ExternalDeliveryChannelConfig[]) => Promise<void>;
}

export const HqMarketplaceExternalChannelsPanel: React.FC<
  HqMarketplaceExternalChannelsPanelProps
> = ({ connectors, isDevOwner, saving, onSaveConnectors }) => {
  const [draft, setDraft] = useState<ExternalDeliveryChannelConfig[]>(connectors);

  useEffect(() => {
    setDraft(connectors);
  }, [connectors]);

  const updateRow = (
    provider: ExternalDeliveryChannelConfig['provider'],
    patch: Partial<ExternalDeliveryChannelConfig>
  ) => {
    setDraft((prev) =>
      prev.map((row) => (row.provider === provider ? { ...row, ...patch } : row))
    );
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Globe className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-white">
              Hub de Integração com Marketplaces Externos (iFood, Uber Eats, Deliveroo)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Habilite conectores oficiais para os lojistas unificarem pedidos externos dentro do Store OS e monetize como add-on mensal da plataforma.
            </p>
          </div>
        </div>
        {isDevOwner && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSaveConnectors(draft)}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar Conectores'}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/50 text-[11px] font-medium text-slate-400">
              <th className="py-3 px-4">Canal Externo</th>
              <th className="py-3 px-4">Disponível no Ecossistema</th>
              <th className="py-3 px-4">Add-on Mensal (R$)</th>
              <th className="py-3 px-4">Taxa Ecossistema (%)</th>
              <th className="py-3 px-4">Sincronização</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-xs">
            {draft.map((row) => (
              <tr key={row.provider} className="hover:bg-slate-800/30">
                <td className="py-3 px-4">
                  <div className="font-semibold text-white">{row.label}</div>
                  <div className="text-[11px] font-mono text-slate-500">{row.provider}</div>
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    disabled={!isDevOwner}
                    onClick={() => updateRow(row.provider, { enabled: !row.enabled })}
                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                      row.enabled
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                        : 'bg-slate-950 text-slate-400 border-slate-700'
                    }`}
                  >
                    {row.enabled ? 'Habilitado' : 'Desativado'}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    min={0}
                    step="1"
                    disabled={!isDevOwner}
                    value={row.monthlyAddonFee}
                    onChange={(e) =>
                      updateRow(row.provider, { monthlyAddonFee: Number(e.target.value) })
                    }
                    className="w-24 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step="0.1"
                    disabled={!isDevOwner}
                    value={row.revenueSharePercent}
                    onChange={(e) =>
                      updateRow(row.provider, { revenueSharePercent: Number(e.target.value) })
                    }
                    className="w-20 rounded-lg bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                  />
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3 text-slate-300">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isDevOwner}
                        checked={row.syncOrders}
                        onChange={(e) =>
                          updateRow(row.provider, { syncOrders: e.target.checked })
                        }
                        className="accent-indigo-500"
                      />
                      <span>Pedidos</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!isDevOwner}
                        checked={row.syncCatalog}
                        onChange={(e) =>
                          updateRow(row.provider, { syncCatalog: e.target.checked })
                        }
                        className="accent-indigo-500"
                      />
                      <span>Cardápio</span>
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
