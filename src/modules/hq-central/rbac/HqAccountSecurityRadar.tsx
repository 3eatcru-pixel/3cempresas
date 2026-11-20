import React from 'react';
import {
  Bike,
  KeyRound,
  RotateCcw,
  Search,
  Shield,
  ShoppingBag,
  Sliders,
  Store as StoreIcon,
  Users,
} from 'lucide-react';
import { AccountSecurityOverviewResponse } from '../../../../packages/api-client/src';
import { AccountSegment, StatusFilter } from './hqRbacHelpers';

interface HqAccountSecurityRadarProps {
  securityOverview: AccountSecurityOverviewResponse | null;
  segment: AccountSegment;
  onChangeSegment: (seg: AccountSegment) => void;
  counts: {
    total: number;
    marketplace: number;
    merchants: number;
    couriers: number;
    hq: number;
    suspended: number;
  };
  searchTerm: string;
  onChangeSearchTerm: (q: string) => void;
  statusFilter: StatusFilter;
  onChangeStatusFilter: (status: StatusFilter) => void;
  onGenerateTempPassword: (item: { uid: string; name: string; email: string }) => void;
}

export const HqAccountSecurityRadar: React.FC<HqAccountSecurityRadarProps> = ({
  securityOverview,
  segment,
  onChangeSegment,
  counts,
  searchTerm,
  onChangeSearchTerm,
  statusFilter,
  onChangeStatusFilter,
  onGenerateTempPassword,
}) => {
  return (
    <>
      {securityOverview && (
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Contas Ativas</div>
              <div className="text-sm font-black text-emerald-400 font-mono">
                {securityOverview.summary.activeCount} / {securityOverview.summary.totalAccounts}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Suspensas</div>
              <div className="text-sm font-black text-rose-400 font-mono">
                {securityOverview.summary.disabledCount}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Senha Temporária</div>
              <div className="text-sm font-black text-sky-400 font-mono">
                {securityOverview.summary.mustChangePasswordCount}
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <Sliders className="w-3 h-3 text-indigo-400" /> Apps Customizados
              </div>
              <div className="text-sm font-black text-indigo-300 font-mono">
                {securityOverview.summary.customBlockedAppsCount} conta(s)
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800/80 rounded-lg p-2.5">
              <div className="text-[10px] font-mono text-slate-400 uppercase">Multi-Filial</div>
              <div className="text-sm font-black text-amber-400 font-mono">
                {securityOverview.summary.multiBranchAccountsCount} conta(s)
              </div>
            </div>
          </div>

          {securityOverview.passwordRecoveryQueue.length > 0 && (
            <div className="border-t border-slate-800 pt-2.5">
              <div className="text-[10px] font-mono uppercase text-amber-400 font-bold mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> Fila de Recuperação Assistida / Troca Obrigatória (
                {securityOverview.passwordRecoveryQueue.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {securityOverview.passwordRecoveryQueue.slice(0, 6).map((item) => (
                  <div
                    key={item.uid}
                    className="bg-slate-900 border border-amber-500/30 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-[11px]"
                  >
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{item.email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGenerateTempPassword(item)}
                      className="px-2 py-1 bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 rounded text-[10px] font-mono font-bold cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" /> Gerar Senha Temp.
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Segment Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'ALL' as const, label: 'Todas as Contas', count: counts.total, icon: Users },
          {
            id: 'MARKETPLACE' as const,
            label: 'Consumidores Marketplace',
            count: counts.marketplace,
            icon: ShoppingBag,
          },
          {
            id: 'MERCHANTS' as const,
            label: 'Lojistas & Equipe',
            count: counts.merchants,
            icon: StoreIcon,
          },
          { id: 'COURIERS' as const, label: 'Entregadores', count: counts.couriers, icon: Bike },
          { id: 'HQ' as const, label: 'Governança HQ', count: counts.hq, icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = segment === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeSegment(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer border ${
                active
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                  active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-900 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail, telefone ou UID..."
            value={searchTerm}
            onChange={(e) => onChangeSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => onChangeStatusFilter(e.target.value as StatusFilter)}
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none cursor-pointer"
        >
          <option value="ALL">Status: Todos ({counts.total})</option>
          <option value="ACTIVE">Ativos ({counts.total - counts.suspended})</option>
          <option value="DISABLED">Suspensos ({counts.suspended})</option>
          <option value="PENDING_ACTIVATION">Pendentes</option>
        </select>
      </div>
    </>
  );
};
