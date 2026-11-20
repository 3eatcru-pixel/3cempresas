import React, { useState } from 'react';
import {
  Trash2,
  KeyRound,
  ShoppingBag,
  Ban,
  CheckCircle2,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { ROLE_COLORS, getStatusColorToken } from '@3c/design-system';
import { EcosystemSessionRole, Store } from '../../../types';
import {
  STORE_SCOPED_ROLES,
  getUserEffectiveStatus,
  normalizeRoleLabel,
} from './hqRbacHelpers';

export interface HqRbacUserRowProps {
  user: any;
  stores: Store[];
  callerUid?: string;
  isCallerDevOwner: boolean;
  onUpdateRole: (
    uid: string,
    role: EcosystemSessionRole,
    tenantId?: string,
    storeId?: string | null
  ) => void;
  onUpdateCourierGovernance?: (
    uid: string,
    updates: {
      fleetType?: 'PLATFORM_FLEET' | 'STORE_FLEET';
      allowedFleetModes?: ('PLATFORM_FLEET' | 'STORE_FLEET')[];
      storeId?: string | null;
      vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
      vehiclePlate?: string;
    }
  ) => void;
  onUpdateUserStore?: (uid: string, storeId: string | null) => void;
  onCustomizeUser?: (user: any) => void;
  onToggleStatus: (uid: string, nextStatus: 'ACTIVE' | 'DISABLED') => void;
  onRevokeSessions: (uid: string) => void;
  onResetPassword: (u: any, userId: string) => Promise<void>;
  onDeleteUser: (uid: string) => void;
}

export const HqRbacUserRow: React.FC<HqRbacUserRowProps> = ({
  user: u,
  stores,
  callerUid,
  isCallerDevOwner,
  onUpdateRole,
  onUpdateCourierGovernance,
  onUpdateUserStore,
  onCustomizeUser,
  onToggleStatus,
  onRevokeSessions,
  onResetPassword,
  onDeleteUser,
}) => {
  const userId = u.uid || u.id;
  const isSelf = Boolean(callerUid && userId === callerUid);
  const normalizedRole = normalizeRoleLabel(u.role) as EcosystemSessionRole;
  const isProtectedFromCaller =
    isSelf ||
    (!isCallerDevOwner && (normalizedRole === 'DEV_OWNER' || normalizedRole === 'SUPER_ADMIN'));
  const effectiveStatus = getUserEffectiveStatus(u);
  const statusToken = getStatusColorToken(effectiveStatus);
  const roleToken = ROLE_COLORS[normalizedRole] || ROLE_COLORS.CUSTOMER;
  const isDisabled = effectiveStatus === 'DISABLED';
  const isMarketplaceConsumer = normalizedRole === 'CUSTOMER';
  const isStoreScoped = STORE_SCOPED_ROLES.has(normalizedRole);
  const linkedStore = u.storeId ? stores.find((s) => s.id === u.storeId) : undefined;
  const ordersCount = Number(u.marketplaceOrdersCount || 0);
  const totalSpent = Number(u.marketplaceTotalSpent || 0);
  const blockedAppsCount = Array.isArray(u.blockedApps) ? u.blockedApps.length : 0;
  const extraBranchesCount = Array.isArray(u.allowedStoreIds) ? u.allowedStoreIds.length : 0;
  const [pendingDangerAction, setPendingDangerAction] = useState<'SUSPEND' | 'REVOKE' | 'DELETE' | null>(null);

  return (
    <tr className={`hover:bg-slate-800/40 ${isDisabled ? 'opacity-75' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5 font-bold text-white">
          <span>{u.name || u.email}</span>
          {isSelf && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded">
              VOCÊ
            </span>
          )}
          {u.mustChangePassword && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-sky-500/15 text-sky-300 border border-sky-500/30 rounded">
              SENHA TEMP
            </span>
          )}
        </div>
        <div className="text-[11px] font-mono text-slate-400">{u.email}</div>
        {u.phone && <div className="text-[10px] font-mono text-slate-500">{u.phone}</div>}
      </td>
      <td className="px-4 py-3 font-mono">
        <select
          value={normalizedRole}
          disabled={isProtectedFromCaller}
          onChange={(e) => {
            const nextRole = e.target.value as EcosystemSessionRole;
            const nextStoreId =
              STORE_SCOPED_ROLES.has(nextRole) || (nextRole === 'COURIER' && Boolean(u.storeId))
                ? u.storeId || null
                : null;
            const nextTenantId = nextRole === 'CUSTOMER' ? 'MARKETPLACE_PUBLIC' : u.tenantId;
            onUpdateRole(userId, nextRole, nextTenantId, nextStoreId);
          }}
          className={`bg-slate-950 border border-slate-800 text-xs ${roleToken.textClass} font-bold p-1.5 rounded-lg focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isCallerDevOwner && <option value="DEV_OWNER">DEV_OWNER (Master Infra)</option>}
          {isCallerDevOwner && <option value="SUPER_ADMIN">SUPER_ADMIN (Admin Global HQ)</option>}
          <option value="REGIONAL_MANAGER">REGIONAL_MANAGER (Gestor Regional Loja)</option>
          <option value="STORE_OWNER">STORE_OWNER (Dono da Loja)</option>
          <option value="STORE_MANAGER">STORE_MANAGER (Gerente de Loja)</option>
          <option value="CASHIER">CASHIER (Operador PDV)</option>
          <option value="KITCHEN_STAFF">KITCHEN_STAFF (Cozinha KDS)</option>
          <option value="WAITER">WAITER (Garçom QR)</option>
          <option value="COURIER">COURIER (Entregador HQ)</option>
          <option value="CUSTOMER">CUSTOMER (Consumidor Marketplace)</option>
        </select>
      </td>
      <td className="px-4 py-3 font-mono text-slate-400">
        {isMarketplaceConsumer ? (
          <div className="space-y-0.5">
            <div className="text-sky-300 font-bold flex items-center gap-1 text-[11px]">
              <ShoppingBag className="w-3 h-3" /> Marketplace Público
            </div>
            <div className="text-[10px] text-slate-400 tabular-nums">
              {ordersCount} pedido(s) • R$ {totalSpent.toFixed(2)}
            </div>
          </div>
        ) : normalizedRole === 'COURIER' ? (
          (() => {
            const modes: string[] =
              Array.isArray(u.allowedFleetModes) && u.allowedFleetModes.length > 0
                ? u.allowedFleetModes
                : [u.fleetType || (u.storeId ? 'STORE_FLEET' : 'PLATFORM_FLEET')];
            const scopeVal =
              modes.includes('STORE_FLEET') && modes.includes('PLATFORM_FLEET') && u.storeId
                ? 'HYBRID'
                : modes.includes('STORE_FLEET') && u.storeId
                ? 'STORE_ONLY'
                : 'PLATFORM_ONLY';
            return (
              <div className="space-y-1.5 min-w-[180px]">
                <select
                  disabled={isProtectedFromCaller || !onUpdateCourierGovernance}
                  value={scopeVal}
                  onChange={(e) => {
                    const nextScope = e.target.value as 'PLATFORM_ONLY' | 'STORE_ONLY' | 'HYBRID';
                    const targetStore =
                      nextScope === 'PLATFORM_ONLY' ? null : u.storeId || stores[0]?.id || null;
                    onUpdateCourierGovernance?.(userId, {
                      fleetType: nextScope === 'STORE_ONLY' ? 'STORE_FLEET' : 'PLATFORM_FLEET',
                      allowedFleetModes:
                        nextScope === 'HYBRID'
                          ? ['STORE_FLEET', 'PLATFORM_FLEET']
                          : nextScope === 'STORE_ONLY'
                          ? ['STORE_FLEET']
                          : ['PLATFORM_FLEET'],
                      storeId: targetStore,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 text-[11px] text-teal-300 font-bold p-1 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="PLATFORM_ONLY">Plataforma HQ</option>
                  <option value="STORE_ONLY">Frota da Loja</option>
                  <option value="HYBRID">Híbrido (Loja + HQ)</option>
                </select>
                {scopeVal !== 'PLATFORM_ONLY' && (
                  <select
                    disabled={isProtectedFromCaller || !onUpdateCourierGovernance}
                    value={u.storeId || stores[0]?.id || ''}
                    onChange={(e) =>
                      onUpdateCourierGovernance?.(userId, {
                        storeId: e.target.value || null,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-bold p-1 rounded-lg focus:outline-none cursor-pointer"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })()
        ) : isStoreScoped && onUpdateUserStore ? (
          <div className="space-y-1 min-w-[180px]">
            <select
              disabled={isProtectedFromCaller}
              value={u.storeId || ''}
              onChange={(e) => onUpdateUserStore(userId, e.target.value || null)}
              className="w-full bg-slate-950 border border-slate-800 text-[10px] text-emerald-400 font-bold p-1 rounded-lg focus:outline-none cursor-pointer"
            >
              <option value="">Escopo Tenant ({u.tenantId || 'tenant-1'})</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.id})
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-slate-500">{u.tenantId || 'tenant-1'}</span>
              {extraBranchesCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px]">
                  +{extraBranchesCount} filial(is)
                </span>
              )}
              {blockedAppsCount > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[9px]">
                  {blockedAppsCount} app(s) bloq.
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            <div className="text-[11px]">{u.tenantId || 'SEM TENANT'}</div>
            {linkedStore && <div className="text-[10px] text-emerald-400">{linkedStore.name}</div>}
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-mono">
        <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${statusToken.badgeClass}`}>
          {effectiveStatus === 'DISABLED'
            ? 'SUSPENSO'
            : effectiveStatus === 'PENDING_ACTIVATION'
            ? 'PENDENTE'
            : 'ATIVO'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {pendingDangerAction ? (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-rose-300">
              {pendingDangerAction === 'DELETE'
                ? 'Excluir conta?'
                : pendingDangerAction === 'SUSPEND'
                ? 'Suspender conta?'
                : 'Revogar sessões?'}
            </span>
            <button
              type="button"
              onClick={() => {
                if (pendingDangerAction === 'DELETE') onDeleteUser(userId);
                else if (pendingDangerAction === 'SUSPEND') onToggleStatus(userId, 'DISABLED');
                else onRevokeSessions(userId);
                setPendingDangerAction(null);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded transition-colors cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setPendingDangerAction(null)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded transition-colors cursor-pointer"
            >
              Voltar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {onCustomizeUser && (
              <button
                type="button"
                disabled={isProtectedFromCaller && !isSelf}
                onClick={() => onCustomizeUser(u)}
                className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-bold text-[10px] rounded border border-indigo-500/20 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Customizar lojas vinculadas, módulos bloqueados e dados da conta"
              >
                <Sliders className="w-3 h-3" /> Customizar
              </button>
            )}
            <button
              type="button"
              disabled={isProtectedFromCaller}
              onClick={() => {
                if (isDisabled) onToggleStatus(userId, 'ACTIVE');
                else setPendingDangerAction('SUSPEND');
              }}
              className={`px-2 py-1 font-bold text-[10px] rounded border transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed ${
                isDisabled
                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
              }`}
              title={
                isProtectedFromCaller
                  ? 'Conta protegida ou atual em uso'
                  : isDisabled
                  ? 'Reativar conta'
                  : 'Suspender conta e bloquear login/sessões'
              }
            >
              {isDisabled ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Reativar
                </>
              ) : (
                <>
                  <Ban className="w-3 h-3" /> Suspender
                </>
              )}
            </button>
            <button
              type="button"
              disabled={isProtectedFromCaller && !isSelf}
              onClick={() => setPendingDangerAction('REVOKE')}
              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-[10px] rounded border border-amber-500/20 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Revogar sessões ativas (invalida tokens imediatamente)"
            >
              <KeyRound className="w-3 h-3" /> Revogar
            </button>
            <button
              type="button"
              disabled={isProtectedFromCaller}
              onClick={() => onResetPassword(u, userId)}
              className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 font-bold text-[10px] rounded border border-sky-500/20 transition-colors cursor-pointer flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
              title={
                isProtectedFromCaller
                  ? 'Ação restrita para esta conta'
                  : 'Gerar nova senha temporária e revogar sessões'
              }
            >
              <RotateCcw className="w-3 h-3" /> Senha
            </button>
            <button
              type="button"
              onClick={() => setPendingDangerAction('DELETE')}
              disabled={isProtectedFromCaller}
              className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded border border-red-500/20 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={isProtectedFromCaller ? 'Ação restrita para esta conta' : 'Excluir Conta'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};
