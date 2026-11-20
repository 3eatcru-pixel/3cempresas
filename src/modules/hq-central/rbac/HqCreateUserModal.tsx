import React from 'react';
import { UserPlus } from 'lucide-react';
import { EcosystemSessionRole, Store } from '../../../types';

export interface CreateUserFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: EcosystemSessionRole;
  storeId: string;
  courierFleetScope: 'PLATFORM_ONLY' | 'STORE_ONLY' | 'HYBRID';
  vehicle: 'SCOOTER' | 'BIKE' | 'CAR';
  vehiclePlate: string;
}

interface HqCreateUserModalProps {
  newUserData: CreateUserFormData;
  setNewUserData: React.Dispatch<React.SetStateAction<CreateUserFormData>>;
  stores: Store[];
  callerRole?: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqCreateUserModal: React.FC<HqCreateUserModalProps> = ({
  newUserData,
  setNewUserData,
  stores,
  callerRole,
  onClose,
  onSubmit,
}) => {
  const isCallerDevOwner = callerRole === 'DEV_OWNER';
  const isCourier = newUserData.role === 'COURIER';
  const needsStoreSelect =
    ['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'KITCHEN_STAFF', 'WAITER'].includes(newUserData.role) ||
    (isCourier && newUserData.courierFleetScope !== 'PLATFORM_ONLY');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <form
        onSubmit={onSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl my-auto"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            Criar Nova Conta de Usuário
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-bold">Nome Completo</label>
          <input
            type="text"
            required
            placeholder="Ex: Carlos Lojista ou Maria Cliente"
            value={newUserData.name}
            onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-bold">Endereço de E-mail</label>
          <input
            type="email"
            required
            placeholder="usuario@exemplo.com"
            value={newUserData.email}
            onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-bold">Telefone / WhatsApp (opcional)</label>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={newUserData.phone}
            onChange={(e) => setNewUserData({ ...newUserData, phone: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-bold">Senha Inicial (mín. 8 caracteres)</label>
          <input
            type="password"
            required
            minLength={8}
            placeholder="••••••••"
            value={newUserData.password}
            onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300 font-bold">Função / Papel no Ecossistema</label>
          <select
            value={newUserData.role}
            onChange={(e) => {
              const nextRole = e.target.value as EcosystemSessionRole;
              setNewUserData((prev) => ({
                ...prev,
                role: nextRole,
                storeId:
                  nextRole === 'COURIER' && prev.courierFleetScope === 'PLATFORM_ONLY'
                    ? ''
                    : prev.storeId || stores[0]?.id || '',
              }));
            }}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
          >
            <option value="STORE_OWNER">STORE_OWNER (Dono da Loja)</option>
            <option value="REGIONAL_MANAGER">REGIONAL_MANAGER (Gestor Regional da Loja)</option>
            <option value="STORE_MANAGER">STORE_MANAGER (Gerente de Loja)</option>
            <option value="CASHIER">CASHIER (Operador de PDV)</option>
            <option value="KITCHEN_STAFF">KITCHEN_STAFF (Cozinha KDS)</option>
            <option value="WAITER">WAITER (Garçom QR)</option>
            <option value="COURIER">COURIER (Entregador App Driver)</option>
            {isCallerDevOwner && <option value="SUPER_ADMIN">SUPER_ADMIN (Admin Global HQ)</option>}
            {isCallerDevOwner && <option value="DEV_OWNER">DEV_OWNER (Master Infra)</option>}
            <option value="CUSTOMER">CUSTOMER (Consumidor Marketplace)</option>
          </select>
        </div>

        {isCourier && (
          <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-teal-300 font-bold">Modalidade de Frota no App Driver</label>
              <select
                value={newUserData.courierFleetScope}
                onChange={(e) => {
                  const scope = e.target.value as CreateUserFormData['courierFleetScope'];
                  setNewUserData((prev) => ({
                    ...prev,
                    courierFleetScope: scope,
                    storeId: scope === 'PLATFORM_ONLY' ? '' : prev.storeId || stores[0]?.id || '',
                  }));
                }}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
              >
                <option value="PLATFORM_ONLY">Plataforma HQ (Rede aberta estilo Deliveroo/iFood)</option>
                <option value="STORE_ONLY">Frota da Loja (Exclusivo Store OS)</option>
                <option value="HYBRID">Híbrido (Alterna Loja e Plataforma no App)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-bold">Veículo</label>
                <select
                  value={newUserData.vehicle}
                  onChange={(e) =>
                    setNewUserData({ ...newUserData, vehicle: e.target.value as 'SCOOTER' | 'BIKE' | 'CAR' })
                  }
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2 rounded-xl font-bold focus:outline-none"
                >
                  <option value="SCOOTER">Moto / Scooter</option>
                  <option value="BIKE">Bicicleta / E-Bike</option>
                  <option value="CAR">Carro</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-300 font-bold">Placa (opcional)</label>
                <input
                  type="text"
                  placeholder="ABC-1D23"
                  value={newUserData.vehiclePlate}
                  onChange={(e) => setNewUserData({ ...newUserData, vehiclePlate: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2 rounded-xl font-mono focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {needsStoreSelect && (
          <div className="space-y-1">
            <label className="text-xs text-slate-300 font-bold">
              {isCourier ? 'Loja Vinculada (para Modo Loja)' : 'Loja / Filial de Vínculo'}
            </label>
            <select
              required={isCourier && newUserData.courierFleetScope !== 'PLATFORM_ONLY'}
              value={newUserData.storeId}
              onChange={(e) => setNewUserData({ ...newUserData, storeId: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.tenantId})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer"
          >
            Criar Conta
          </button>
        </div>
      </form>
    </div>
  );
};
