import React from 'react';
import { EcosystemSessionRole, Store } from '../../../types';
import { HqRbacUserRow } from './HqRbacUserRow';

interface HqRbacUsersTableProps {
  filteredUsers: any[];
  stores: Store[];
  callerUid?: string;
  callerRole?: string;
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

export const HqRbacUsersTable: React.FC<HqRbacUsersTableProps> = ({
  filteredUsers,
  stores,
  callerUid,
  callerRole,
  onUpdateRole,
  onUpdateCourierGovernance,
  onUpdateUserStore,
  onCustomizeUser,
  onToggleStatus,
  onRevokeSessions,
  onResetPassword,
  onDeleteUser,
}) => {
  const isCallerDevOwner = callerRole === 'DEV_OWNER';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 uppercase font-mono">
          <tr>
            <th className="px-4 py-3">Conta / Contato</th>
            <th className="px-4 py-3">Papel (Role)</th>
            <th className="px-4 py-3">Vínculo / Escopo</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Ações do HQ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {filteredUsers.map((u) => (
            <HqRbacUserRow
              key={u.uid || u.id}
              user={u}
              stores={stores}
              callerUid={callerUid}
              isCallerDevOwner={isCallerDevOwner}
              onUpdateRole={onUpdateRole}
              onUpdateCourierGovernance={onUpdateCourierGovernance}
              onUpdateUserStore={onUpdateUserStore}
              onCustomizeUser={onCustomizeUser}
              onToggleStatus={onToggleStatus}
              onRevokeSessions={onRevokeSessions}
              onResetPassword={onResetPassword}
              onDeleteUser={onDeleteUser}
            />
          ))}
          {filteredUsers.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic">
                Nenhuma conta encontrada para os filtros selecionados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
