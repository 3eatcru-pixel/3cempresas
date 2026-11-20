import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';
import { DeviceLicense, Order, Store } from '../../../types';

interface HqOperationalAlertsBannerProps {
  stores: Store[];
  orders: Order[];
  deviceLicenses: DeviceLicense[];
  systemHealth?: {
    persistenceDriver?: string;
    productionDatabaseReady?: boolean;
    activeConnections?: number;
  };
}

interface WatchdogAlert {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  detail: string;
}

export const HqOperationalAlertsBanner: React.FC<HqOperationalAlertsBannerProps> = ({
  stores,
  orders,
  deviceLicenses,
  systemHealth,
}) => {
  const [expanded, setExpanded] = useState(false);

  const alerts = useMemo<WatchdogAlert[]>(() => {
    const nowMs = Date.now();
    const list: WatchdogAlert[] = [];

    const overdueOpenStores = stores.filter(
      (s) =>
        !s._deleted &&
        s.saasPaymentStatus === 'OVERDUE' &&
        s.isOpen &&
        String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
    );
    if (overdueOpenStores.length > 0) {
      list.push({
        id: 'overdue-open-stores',
        severity: 'CRITICAL',
        title: `${overdueOpenStores.length} loja(s) OVERDUE ainda aberta(s)`,
        detail: overdueOpenStores.map((s) => s.name).slice(0, 4).join(', '),
      });
    }

    const suspendedCount = stores.filter(
      (s) =>
        !s._deleted &&
        (s.tenantStatus === 'SUSPENDED' || String((s as any).status || '').toUpperCase() === 'SUSPENDED')
    ).length;
    if (suspendedCount > 0) {
      list.push({
        id: 'suspended-stores',
        severity: 'INFO',
        title: `${suspendedCount} loja(s) com operação suspensa`,
        detail: 'Acesso administrativo e vitrine bloqueados pelo Server Core.',
      });
    }

    const expiredPairing = deviceLicenses.filter((d) => {
      const expiresAt = (d as DeviceLicense & { pairingCodeExpiresAt?: string }).pairingCodeExpiresAt;
      if (d.status !== 'PENDING_PAIRING' || !expiresAt) return false;
      const exp = Date.parse(String(expiresAt));
      return Number.isFinite(exp) && exp < nowMs;
    });
    if (expiredPairing.length > 0) {
      list.push({
        id: 'expired-pairing',
        severity: 'WARNING',
        title: `${expiredPairing.length} terminal(is) com código de pareamento expirado`,
        detail: 'Regenere o código na aba Dispositivos para liberar a conexão do terminal.',
      });
    }

    const staleOrders = orders.filter((o) => {
      const st = String(o.status || '').toUpperCase();
      if (['COMPLETED', 'DELIVERED', 'CANCELLED', 'RETURNED'].includes(st)) return false;
      const created = Date.parse(String(o.createdAt || ''));
      return Number.isFinite(created) && nowMs - created > 24 * 60 * 60 * 1000;
    });
    if (staleOrders.length > 0) {
      list.push({
        id: 'stale-orders',
        severity: 'WARNING',
        title: `${staleOrders.length} pedido(s) em aberto há mais de 24h`,
        detail: 'Verifique possíveis pedidos travados em preparo ou entrega.',
      });
    }

    if (systemHealth && !systemHealth.productionDatabaseReady) {
      list.push({
        id: 'sandbox-persistence',
        severity: 'INFO',
        title: `Persistência local ativa (${systemHealth.persistenceDriver || 'json-memory'})`,
        detail: 'Ambiente operando em modo sandbox local; banco Cloud PostgreSQL não habilitado.',
      });
    }

    return list;
  }, [stores, orders, deviceLicenses, systemHealth]);

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;
  const hasUrgent = criticalCount > 0 || warningCount > 0;

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl border ${
              criticalCount > 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : warningCount > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {criticalCount > 0 ? (
              <ShieldAlert className="w-5 h-5" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight">
              Monitor Operacional do Ecossistema
            </h4>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-0.5">
              <span>{stores.filter((s) => !s._deleted).length} lojas</span>
              <span aria-hidden="true">·</span>
              <span>{orders.length} pedidos</span>
              <span aria-hidden="true">·</span>
              <span>{deviceLicenses.length} terminais</span>
              <span aria-hidden="true">·</span>
              <span className={hasUrgent ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                {criticalCount} críticos / {warningCount} avisos
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="px-4 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{expanded ? 'Ocultar Diagnóstico' : `Ver Diagnóstico (${alerts.length})`}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-800 pt-3 space-y-2">
          {alerts.length === 0 ? (
            <div className="text-xs text-emerald-400 font-medium py-2">
              Nenhuma anomalia operacional detectada nas lojas, pedidos ou dispositivos ativos.
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono font-bold text-[11px] ${
                        alert.severity === 'CRITICAL'
                          ? 'text-rose-400'
                          : alert.severity === 'WARNING'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      [{alert.severity}]
                    </span>
                    <span className="font-semibold text-white">{alert.title}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{alert.detail}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
