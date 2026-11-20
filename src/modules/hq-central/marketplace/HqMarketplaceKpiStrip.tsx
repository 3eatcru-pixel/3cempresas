import React from 'react';
import { PlatformGovernance } from '../../../types';

interface HqMarketplaceKpiStripProps {
  totalActiveStores: number;
  visibleVitrinesCount: number;
  featuredCount: number;
  hiddenCount: number;
  sponsoredCount: number;
  sponsoredMediaMrr: number;
  enabledConnectorsCount: number;
  isReadOnly: boolean;
  governance: PlatformGovernance;
}

export const HqMarketplaceKpiStrip: React.FC<HqMarketplaceKpiStripProps> = ({
  totalActiveStores,
  visibleVitrinesCount,
  featuredCount,
  hiddenCount,
  sponsoredCount,
  sponsoredMediaMrr,
  enabledConnectorsCount,
  isReadOnly,
  governance,
}) => {
  const deliveryFee = Number(governance.defaultPlatformDeliveryFee ?? 6.9);
  const commission = Number(governance.globalCommissionRate ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
        <div className="text-xs text-slate-400">Vitrines Publicadas</div>
        <div className="text-2xl font-bold text-white font-mono tabular-nums">
          {visibleVitrinesCount}
          <span className="text-sm font-normal text-slate-500"> / {totalActiveStores}</span>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {featuredCount} curadoria · {hiddenCount} ocultada(s)
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
        <div className="text-xs text-slate-400">Mídia &amp; Destaques Pagos</div>
        <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
          R$ {sponsoredMediaMrr.toFixed(2)}
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {sponsoredCount} campanha(s) · {enabledConnectorsCount} canal(is) externo(s)
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
        <div className="text-xs text-slate-400">Economia do Marketplace</div>
        <div className="text-2xl font-bold text-white font-mono tabular-nums">
          {commission.toFixed(1)}%
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Comissão Marketplace · Frete R$ {deliveryFee.toFixed(2)}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
        <div className="text-xs text-slate-400">Estado de Pedidos</div>
        <div
          className={`text-lg font-bold tracking-tight ${
            isReadOnly ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {isReadOnly ? 'Somente Leitura' : 'Operação Aberta'}
        </div>
        <div className="text-xs text-slate-500">
          {isReadOnly
            ? 'Novos pedidos pausados pelo HQ'
            : 'Checkout e vitrines recebendo pedidos'}
        </div>
      </div>
    </div>
  );
};
