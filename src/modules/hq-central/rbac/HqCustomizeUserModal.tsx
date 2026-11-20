import React, { useState } from 'react';
import { Sliders, X, Store as StoreIcon, ShieldAlert, Check, Phone, User } from 'lucide-react';
import { Store } from '../../../types';
import { STORE_SCOPED_ROLES, normalizeRoleLabel } from './hqRbacHelpers';

const STORE_OS_APPS = [
  { id: 'pos', label: 'Frente de Caixa (PDV)' },
  { id: 'kds', label: 'Cozinha (KDS)' },
  { id: 'tables', label: 'Salão & Mesas' },
  { id: 'waiter', label: 'App Garçom QR' },
  { id: 'catalog', label: 'Cardápio & Preços' },
  { id: 'inventory', label: 'Estoque & Lotes' },
  { id: 'suppliers', label: 'Fornecedores' },
  { id: 'finance', label: 'Financeiro & DRE' },
  { id: 'crm', label: 'CRM & Cupons' },
  { id: 'couriers', label: 'Frota & Entregadores' },
  { id: 'analytics', label: 'BI & Relatórios' },
  { id: 'settings', label: 'Configurações & Equipe' },
] as const;

interface HqCustomizeUserModalProps {
  user: any;
  stores: Store[];
  onClose: () => void;
  onSave: (
    uid: string,
    updates: {
      name?: string;
      phone?: string;
      storeId?: string | null;
      allowedStoreIds?: string[];
      blockedApps?: string[];
    }
  ) => Promise<void>;
}

export const HqCustomizeUserModal: React.FC<HqCustomizeUserModalProps> = ({
  user,
  stores,
  onClose,
  onSave,
}) => {
  const userId = user.uid || user.id;
  const normalizedRole = normalizeRoleLabel(user.role);
  const isStoreScoped = STORE_SCOPED_ROLES.has(normalizedRole);

  const [name, setName] = useState<string>(user.name || '');
  const [phone, setPhone] = useState<string>(user.phone || '');
  const [storeId, setStoreId] = useState<string>(user.storeId || '');
  const [allowedStoreIds, setAllowedStoreIds] = useState<string[]>(
    Array.isArray(user.allowedStoreIds) ? user.allowedStoreIds : []
  );
  const [blockedApps, setBlockedApps] = useState<string[]>(
    Array.isArray(user.blockedApps) ? user.blockedApps : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const toggleAllowedStore = (id: string) => {
    setAllowedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleBlockedApp = (appId: string) => {
    setBlockedApps((prev) =>
      prev.includes(appId) ? prev.filter((item) => item !== appId) : [...prev, appId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(userId, {
        name: name.trim() || user.name,
        phone: phone.trim(),
        storeId: isStoreScoped ? storeId || null : user.storeId ?? null,
        allowedStoreIds: isStoreScoped ? allowedStoreIds : [],
        blockedApps: isStoreScoped ? blockedApps : [],
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/60">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" /> Customizar Conta & Permissões Granulares
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {user.email} • Papel: <span className="text-amber-400 font-bold">{normalizedRole}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-500" /> Nome Exibido
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" /> Telefone / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 99999-9999"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {isStoreScoped && (
            <>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                    <StoreIcon className="w-3.5 h-3.5 text-emerald-400" /> Vínculo de Loja Principal & Filiais Autorizadas
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {allowedStoreIds.length} filial(is) extra(s)
                  </span>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1">
                    Unidade Principal (storeId)
                  </label>
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">Sem vínculo direto (Acesso no nível do Tenant)</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id}) — Tenant: {s.tenantId || 'tenant-1'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-slate-500 uppercase block mb-1.5">
                    Filiais Adicionais Autorizadas (Multi-Store / Multi-Branch)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {stores.map((s) => {
                      const isPrimary = s.id === storeId;
                      const isChecked = isPrimary || allowedStoreIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={isPrimary}
                          onClick={() => toggleAllowedStore(s.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-left text-[11px] font-mono flex items-center justify-between transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-bold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                          } ${isPrimary ? 'opacity-70 cursor-default' : ''}`}
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="text-[9px] ml-2 shrink-0">
                            {isPrimary ? 'PRINCIPAL' : isChecked ? 'AUTORIZADA' : '—'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" /> Restrição Granular de Módulos Store OS (blockedApps)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Clique nos módulos abaixo para bloquear ou liberar o acesso específico desta conta dentro do Store OS.
                    </p>
                  </div>
                  {blockedApps.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBlockedApps([])}
                      className="text-[10px] font-mono text-amber-400 hover:underline cursor-pointer"
                    >
                      Liberar Todos
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STORE_OS_APPS.map((app) => {
                    const isBlocked = blockedApps.includes(app.id);
                    return (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => toggleBlockedApp(app.id)}
                        className={`p-2 rounded-lg border text-left text-[11px] font-mono flex items-center justify-between transition-all cursor-pointer ${
                          isBlocked
                            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                            : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        }`}
                      >
                        <span className="truncate pr-1">{app.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                            isBlocked ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {isBlocked ? 'BLOQ' : 'ATIVO'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-amber-500 text-slate-950 font-black text-xs rounded-xl hover:bg-amber-400 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'SALVANDO...' : 'SALVAR CUSTOMIZAÇÃO DA CONTA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
