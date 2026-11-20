import React, { useState } from 'react';
import { UserPlus, Users, Lock } from 'lucide-react';
import { UserRole, Store } from '../../../../types';
import { BLOCKABLE_STORE_MODULES } from '../../layout/storeOsAppsList';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (
    name: string,
    email: string,
    role: UserRole,
    password: string,
    blockedApps?: string[],
    targetStoreId?: string | null
  ) => Promise<void>;
  callerRole?: string;
  accessibleStores?: Store[];
  defaultStoreId?: string;
  showNotification: (msg: string) => void;
}

const ASSIGNABLE_ROLES: Array<{ value: UserRole; label: string; level: number }> = [
  { value: 'REGIONAL_MANAGER', label: 'Gestor Regional Multi-Filial (Store OS)', level: 70 },
  { value: 'STORE_MANAGER', label: 'Gerente / Supervisor de Unidade (Store OS)', level: 60 },
  { value: 'CASHIER', label: 'Operador de Caixa / Recepção (Store OS)', level: 50 },
  { value: 'KITCHEN_STAFF', label: 'Técnico / Produção / Cozinha (Store OS)', level: 40 },
  { value: 'WAITER', label: 'Garçom / Atendente de Salão (App 3C Waiter)', level: 30 },
];

const CALLER_LEVEL: Record<string, number> = {
  DEV_OWNER: 100,
  SUPER_ADMIN: 90,
  STORE_OWNER: 80,
  REGIONAL_MANAGER: 70,
  STORE_MANAGER: 60,
};

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({
  isOpen,
  onClose,
  onInvite,
  callerRole,
  accessibleStores = [],
  defaultStoreId,
  showNotification,
}) => {
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('CASHIER');
  const [selectedBlockedApps, setSelectedBlockedApps] = useState<string[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(defaultStoreId || '');

  const callerLevel = CALLER_LEVEL[callerRole || ''] || 0;
  const allowedOptions = ASSIGNABLE_ROLES.filter(
    (opt) => callerRole === 'DEV_OWNER' || opt.level < callerLevel
  );

  if (!isOpen) return null;

  const canChooseBranch =
    ['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER'].includes(callerRole || '') &&
    accessibleStores.length > 1;

  const toggleBlockedModule = (moduleId: string) => {
    setSelectedBlockedApps((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || newPassword.length < 8) {
      showNotification('Preencha nome, e-mail e uma senha inicial com no mínimo 8 caracteres.');
      return;
    }

    const resolvedStoreId =
      newRole === 'REGIONAL_MANAGER' && (!selectedStoreId || selectedStoreId === '__ALL__')
        ? null
        : (selectedStoreId && selectedStoreId !== '__ALL__' ? selectedStoreId : (defaultStoreId || undefined));

    await onInvite(
      newName,
      newEmail,
      newRole,
      newPassword,
      newRole === 'WAITER' ? [] : selectedBlockedApps,
      resolvedStoreId
    );
    onClose();
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewRole('CASHIER');
    setSelectedBlockedApps([]);
    setSelectedStoreId(defaultStoreId || '');
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Convidar Colaborador
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <Users className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Nome Completo
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Pedro Alvares"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              E-mail de Acesso
            </label>
            <input
              type="email"
              required
              placeholder="exemplo@3c-os.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Senha Inicial (mín. 8 caracteres)
            </label>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
              Papel / Função
            </label>
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value as UserRole)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 appearance-none"
            >
              {allowedOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {canChooseBranch && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                Filial / Unidade Vinculada
              </label>
              <select
                value={selectedStoreId || defaultStoreId || ''}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 appearance-none"
              >
                {newRole === 'REGIONAL_MANAGER' && (
                  <option value="__ALL__">Todas as filiais da empresa (Multi-Filial)</option>
                )}
                {accessibleStores.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.branchLabel ? `${st.branchLabel} — ${st.name}` : st.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {newRole === 'WAITER' ? (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-semibold leading-relaxed">
              O garçom entra no app <strong className="text-white">3C Waiter</strong> usando este e-mail e senha liberados na lista da loja. Para maquininhas/PDQs próprios sem e-mail individual, pareie o terminal em <strong className="text-white">Minha Assinatura → Dispositivos</strong>.
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <Lock className="w-3 h-3 text-amber-400" />
                Módulos Bloqueados Inicialmente ({selectedBlockedApps.length})
              </label>
              <div className="max-h-32 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1 custom-scrollbar">
                {BLOCKABLE_STORE_MODULES.map((mod) => {
                  const isBlocked = selectedBlockedApps.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg text-[10px] cursor-pointer ${
                        isBlocked ? 'bg-rose-500/15 text-rose-300' : 'text-slate-300 hover:bg-slate-900'
                      }`}
                    >
                      <span className="truncate">{mod.title}</span>
                      <input
                        type="checkbox"
                        checked={isBlocked}
                        onChange={() => toggleBlockedModule(mod.id)}
                        className="accent-rose-500 cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-750 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-indigo-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              Confirmar Convite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
