import React from 'react';
import { Globe, Save } from 'lucide-react';
import { ExternalDeliveryChannelConfig } from '../../../types';
import { StoreExternalChannelEntry } from './growthPanelTypes';

interface StoreExternalChannelsCardProps {
  availableConnectors: ExternalDeliveryChannelConfig[];
  channelsDraft: Record<string, StoreExternalChannelEntry>;
  canWrite: boolean;
  savingChannels: boolean;
  onUpdateChannel: (provider: string, patch: Partial<StoreExternalChannelEntry>) => void;
  onSaveExternalChannels: () => void;
}

export const StoreExternalChannelsCard: React.FC<StoreExternalChannelsCardProps> = ({
  availableConnectors,
  channelsDraft,
  canWrite,
  savingChannels,
  onUpdateChannel,
  onSaveExternalChannels,
}) => (
  <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
      <div className="flex items-start gap-2.5">
        <Globe className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
        <div>
          <h4 className="text-sm font-bold text-white">
            Integração com Marketplaces Externos (Unificação no KDS e PDV)
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Centralize pedidos de canais externos na mesma fila da cozinha, estoque e caixa do seu estabelecimento.
          </p>
        </div>
      </div>
      {canWrite && availableConnectors.length > 0 && (
        <button
          type="button"
          disabled={savingChannels}
          onClick={onSaveExternalChannels}
          className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          <Save className="w-3.5 h-3.5" />
          {savingChannels ? 'Salvando...' : 'Salvar Integrações'}
        </button>
      )}
    </div>

    {availableConnectors.length === 0 ? (
      <div className="p-6 text-center text-xs text-slate-500">
        Nenhum conector de canal externo está habilitado no momento.
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {availableConnectors.map((conn) => {
          const cfg = channelsDraft[conn.provider] || {
            enabled: false,
            merchantExternalId: '',
            autoAcceptOrders: false,
          };
          return (
            <div
              key={conn.provider}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-white">{conn.label}</div>
                  <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                    Add-on: R$ {Number(conn.monthlyAddonFee || 0).toFixed(2)}/mês
                    {conn.syncOrders ? ' · Pedidos' : ''}
                    {conn.syncCatalog ? ' · Cardápio' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => onUpdateChannel(conn.provider, { enabled: !cfg.enabled })}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer disabled:opacity-50 ${
                    cfg.enabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {cfg.enabled ? 'Conectado' : 'Ativar'}
                </button>
              </div>

              {cfg.enabled && (
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <input
                    type="text"
                    disabled={!canWrite}
                    maxLength={80}
                    value={cfg.merchantExternalId}
                    onChange={(e) =>
                      onUpdateChannel(conn.provider, { merchantExternalId: e.target.value })
                    }
                    placeholder="Merchant ID / Código da loja no canal"
                    className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!canWrite}
                      checked={cfg.autoAcceptOrders}
                      onChange={(e) =>
                        onUpdateChannel(conn.provider, { autoAcceptOrders: e.target.checked })
                      }
                      className="accent-indigo-500"
                    />
                    <span>Aceitar pedidos automaticamente e enviar direto ao KDS</span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </section>
);
