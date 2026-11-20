import React from 'react';
import {
  Bike,
  Clock,
  Cpu,
  Globe,
  Network,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  UtensilsCrossed,
} from 'lucide-react';
import { apiClient } from '../../../core/api/apiClient';

export interface LiveHealthSnapshot {
  status?: string;
  uptimeSeconds?: number;
  activeTenants?: number;
  activeStores?: number;
  totalOrdersProcessed?: number;
  memoryUsage?: string;
  activeConnections?: number;
  persistenceDriver?: string;
  productionDatabaseReady?: boolean;
}

export type DiagnosticsMetricsResponse = Awaited<
  ReturnType<typeof apiClient.getDevDiagnosticsMetrics>
>;

interface ServerBackboneTopologyCardProps {
  liveOrdersGMV: number;
  ordersCount: number;
  liveSaaSMrr: number;
  storesCount: number;
  driversCount: number;
  tablesCount: number;
  deviceLicensesCount: number;
  liveHealth: LiveHealthSnapshot | null;
  healthLatencyMs: number | null;
  metrics: DiagnosticsMetricsResponse | null;
}

export const ServerBackboneTopologyCard: React.FC<ServerBackboneTopologyCardProps> = ({
  liveOrdersGMV,
  ordersCount,
  liveSaaSMrr,
  storesCount,
  driversCount,
  tablesCount,
  deviceLicensesCount,
  liveHealth,
  healthLatencyMs,
  metrics,
}) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Marketplace GMV (Pedidos Reais)',
            value: `R$ ${liveOrdersGMV.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            trend: `${ordersCount} pedido(s)`,
            icon: Globe,
            color: 'text-blue-400',
          },
          {
            label: 'Latência API (/health) & p95',
            value: metrics
              ? `${metrics.summary.p95Ms}ms p95`
              : healthLatencyMs !== null
              ? `${healthLatencyMs}ms`
              : '--',
            trend: `${metrics?.summary.rpm ?? 0} req/min`,
            icon: Clock,
            color: 'text-emerald-400',
          },
          {
            label: 'MRR SaaS Ativo',
            value: `R$ ${liveSaaSMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            trend: `${liveHealth?.activeTenants ?? 0} tenant(s)`,
            icon: Shield,
            color: 'text-amber-400',
          },
          {
            label: 'Conexões SSE / Terminais',
            value: String(metrics?.sseSessions.length ?? liveHealth?.activeConnections ?? 0),
            trend: `${deviceLicensesCount} licenças`,
            icon: Cpu,
            color: 'text-indigo-400',
          },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-slate-900 p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-xs text-slate-400 font-medium">{stat.label}</span>
              <div className={`p-2 rounded-xl bg-slate-950 border border-slate-800 ${stat.color}`}>
                <stat.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xl font-black text-white font-mono tabular-nums tracking-tight">
                {stat.value}
              </span>
              <span className="text-[11px] font-bold text-emerald-400 font-mono tabular-nums">
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Arquitetura Conectada pelo Server Core (Backbone Real) */}
      <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Network className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-tight">
                Backbone Server Core — Conexão Entre Pilares &amp; Aplicativos
              </h2>
              <p className="text-xs text-slate-400">
                Barramento único REST/SSE/HLC sob governança do HQ Central conectando Store OS, Marketplace, 3C Driver e 3C Waiter.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-lg whitespace-nowrap">
            {liveHealth?.status || 'ONLINE'} · {liveHealth?.persistenceDriver || 'json-memory'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          {[
            {
              title: 'HQ Central',
              role: 'Pilar 1 · Governança',
              route: '/api/v1/admin/*',
              domainKey: 'admin',
              stat: `${liveHealth?.activeTenants ?? 0} tenant(s)`,
              accent: 'text-indigo-400 border-indigo-500/25',
              icon: ShieldCheck,
            },
            {
              title: 'Store OS (Lojista)',
              role: 'Pilar 2 · PDV/KDS/Edge',
              route: '/api/v1/store/*',
              domainKey: 'store',
              stat: `${storesCount} loja(s) · ${deviceLicensesCount} lic.`,
              accent: 'text-amber-400 border-amber-500/25',
              icon: StoreIcon,
            },
            {
              title: 'Marketplace',
              role: 'Pilar 3 · Consumidor',
              route: '/api/v1/commerce/*',
              domainKey: 'commerce',
              stat: `${ordersCount} pedido(s)`,
              accent: 'text-emerald-400 border-emerald-500/25',
              icon: ShoppingBag,
            },
            {
              title: '3C Driver (App 1)',
              role: 'Satélite · Dual Fleet',
              route: '/api/v1/commerce/drivers',
              domainKey: 'maps',
              stat: `${driversCount} entregador(es)`,
              accent: 'text-sky-400 border-sky-500/25',
              icon: Bike,
            },
            {
              title: '3C Waiter (App 2)',
              role: 'Satélite · Salão BYOD',
              route: '/api/v1/sync/*',
              domainKey: 'sync',
              stat: `${tablesCount} mesa(s)`,
              accent: 'text-pink-400 border-pink-500/25',
              icon: UtensilsCrossed,
            },
          ].map((node) => {
            const domStats = metrics?.domains.find((d) => d.domain === node.domainKey);
            const Icon = node.icon;
            return (
              <div
                key={node.title}
                className={`bg-slate-950/90 border ${node.accent} rounded-xl p-3.5 space-y-2`}
              >
                <div className="flex items-center justify-between gap-2">
                  <Icon className={`w-4 h-4 ${node.accent.split(' ')[0]}`} />
                  <span className="text-[10px] font-mono text-slate-500">
                    {domStats ? `${domStats.count} reqs · ${domStats.p95Ms}ms` : 'Conectado'}
                  </span>
                </div>
                <div>
                  <div className="font-bold text-white truncate">{node.title}</div>
                  <div className="text-[11px] text-slate-400">{node.role}</div>
                </div>
                <div className="pt-1 border-t border-slate-900 flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span className="text-slate-500 truncate">{node.route}</span>
                  <span className="text-slate-200 font-semibold shrink-0">{node.stat}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
