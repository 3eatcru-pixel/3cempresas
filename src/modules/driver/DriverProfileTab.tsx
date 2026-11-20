import React, { useState, useEffect } from 'react';
import { Star, ShieldCheck, Store, Globe, QrCode, X, Save, User, Wallet } from 'lucide-react';
import { Driver } from '../../types';
import { DriverProfileMenu } from './layout/DriverProfileMenu';
import { DriverSupportView } from './layout/DriverSupportView';
import { DriverSettingsView } from './layout/DriverSettingsView';

const formatVehicleLabel = (vehicle?: string) => {
  switch (vehicle) {
    case 'SCOOTER':
      return 'Moto';
    case 'BIKE':
      return 'Bicicleta';
    case 'CAR':
      return 'Carro';
    default:
      return vehicle || 'Moto';
  }
};

interface DriverProfileTabProps {
  currentDriver: Driver;
  operationMode?: 'STORE' | 'PLATFORM';
  canOperatePlatform?: boolean;
  canOperateStore?: boolean;
  storeName?: string;
  storePhone?: string;
  hasActiveDelivery?: boolean;
  onOpenModeModal?: () => void;
  onOpenQrPairing?: () => void;
  onUpdateDriverProfile?: (
    driverId: string,
    updates: Partial<Pick<Driver, 'name' | 'phone' | 'vehicle' | 'vehiclePlate'>> & { pixKey?: string }
  ) => Promise<boolean>;
  onReportOccurrence?: (summary: string, kind: 'OCCURRENCE' | 'TICKET') => void;
  onShowNotification: (msg: string) => void;
  onLogout?: () => void;
}

export const DriverProfileTab: React.FC<DriverProfileTabProps> = ({
  currentDriver,
  operationMode = 'PLATFORM',
  canOperatePlatform = true,
  canOperateStore = false,
  storeName,
  storePhone,
  hasActiveDelivery = false,
  onOpenModeModal,
  onOpenQrPairing,
  onUpdateDriverProfile,
  onReportOccurrence,
  onShowNotification,
  onLogout,
}) => {
  const [activeSubView, setActiveSubView] = useState<'menu' | 'personal' | 'pix' | 'support' | 'settings'>('menu');
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [name, setName] = useState(currentDriver.name || '');
  const [phone, setPhone] = useState(currentDriver.phone || '');
  const [vehicle, setVehicle] = useState<'SCOOTER' | 'BIKE' | 'CAR'>(currentDriver.vehicle || 'SCOOTER');
  const [vehiclePlate, setVehiclePlate] = useState(currentDriver.vehiclePlate || '');
  const [pixKey, setPixKey] = useState<string>(() => {
    const fromDriver = (currentDriver as Driver & { pixKey?: string }).pixKey;
    if (fromDriver) return fromDriver;
    try {
      return localStorage.getItem(`3c_driver_pix_${currentDriver.id}`) || '';
    } catch {
      return '';
    }
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
    setName(currentDriver.name || '');
    setPhone(currentDriver.phone || '');
    setVehicle(currentDriver.vehicle || 'SCOOTER');
    setVehiclePlate(currentDriver.vehiclePlate || '');
    const fromDriver = (currentDriver as Driver & { pixKey?: string }).pixKey;
    if (fromDriver) {
      setPixKey(fromDriver);
    }
  }, [currentDriver]);

  const modalityScopeLabel =
    canOperatePlatform && canOperateStore
      ? 'Híbrido (Plataforma + Loja)'
      : canOperateStore
      ? `Frota Própria (${storeName || 'Estabelecimento'})`
      : 'Plataforma Aberta';

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onShowNotification('Informe seu nome completo.');
      return;
    }
    setSaving(true);
    try {
      if (onUpdateDriverProfile) {
        await onUpdateDriverProfile(currentDriver.id, {
          name: name.trim(),
          phone: phone.trim(),
          vehicle,
          vehiclePlate: vehiclePlate.trim().toUpperCase(),
        });
      } else {
        onShowNotification('Dados cadastrais atualizados com sucesso!');
      }
      setActiveSubView('menu');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pixKey.trim().length < 3) {
      onShowNotification('Informe uma chave PIX válida (CPF, CNPJ, E-mail, Celular ou Aleatória).');
      return;
    }
    setSaving(true);
    try {
      try {
        localStorage.setItem(`3c_driver_pix_${currentDriver.id}`, pixKey.trim());
      } catch {
        // ignore storage errors
      }
      if (onUpdateDriverProfile) {
        await onUpdateDriverProfile(currentDriver.id, { pixKey: pixKey.trim() });
      } else {
        onShowNotification('Chave PIX padrão salva para saques rápidos!');
      }
      setActiveSubView('menu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      {/* Top Header */}
      <div>
        <h2 className="text-lg font-black text-white">Meu Perfil &amp; Operação</h2>
        <p className="text-xs text-slate-400">
          Conta logística verificada • Operação em Plataforma Aberta e Frota Própria da Loja.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Driver Identity Card */}
        <div className="bg-[#111922] border border-slate-800 rounded-2xl p-5 text-center space-y-3.5 shadow-xl">
          {currentDriver.avatar && !avatarFailed ? (
            <img
              src={currentDriver.avatar}
              alt={currentDriver.name}
              referrerPolicy="no-referrer"
              onError={() => setAvatarFailed(true)}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-[#00CCBC] shadow-xl mx-auto"
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-[#00CCBC]/15 border-2 border-[#00CCBC] text-[#00CCBC] font-black text-2xl flex items-center justify-center shadow-xl mx-auto">
              {(currentDriver.name || 'EN')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || '')
                .join('')}
            </div>
          )}
          <div>
            <h3 className="text-base font-black text-white">{currentDriver.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {formatVehicleLabel(currentDriver.vehicle)}
              {currentDriver.vehiclePlate ? ` • ${currentDriver.vehiclePlate}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/20 tabular-nums">
              <Star className="w-3.5 h-3.5 fill-amber-400" /> {currentDriver.rating.toFixed(1)}
            </span>
            <span className="text-xs font-mono text-[#00CCBC] bg-[#00CCBC]/10 px-3 py-1 rounded-lg border border-[#00CCBC]/20 font-bold tabular-nums">
              {currentDriver.totalDeliveries} Entregas
            </span>
          </div>

          <div className="bg-[#0B1117] border border-slate-800 rounded-xl p-3 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#00CCBC]" /> Modalidade:
              </span>
              <span className="font-bold text-white text-right">{modalityScopeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400 flex items-center gap-1.5">
                {operationMode === 'STORE' ? (
                  <Store className="w-4 h-4 text-[#00CCBC]" />
                ) : (
                  <Globe className="w-4 h-4 text-[#00CCBC]" />
                )}
                Turno Atual:
              </span>
              <span className="font-bold text-[#00CCBC]">
                {operationMode === 'STORE' ? 'Frota Própria da Loja' : 'Plataforma Aberta'}
              </span>
            </div>
            {onOpenModeModal && (
              <button
                type="button"
                onClick={onOpenModeModal}
                className="w-full min-h-[40px] mt-1 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 cursor-pointer transition-colors"
              >
                Alternar Modalidade de Operação
              </button>
            )}
            {onOpenQrPairing && (
              <button
                type="button"
                onClick={onOpenQrPairing}
                className="w-full min-h-[40px] py-2 bg-[#00CCBC]/15 hover:bg-[#00CCBC]/25 text-[#00CCBC] font-bold text-xs rounded-xl border border-[#00CCBC]/30 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" /> Parear Loja (QR Code / PIN)
              </button>
            )}
          </div>
        </div>

        {/* Profile Links / Sub-views */}
        <div>
          {activeSubView === 'menu' && (
            <DriverProfileMenu
              currentDriver={currentDriver}
              hasActiveDelivery={hasActiveDelivery}
              onOpenPersonalData={() => setActiveSubView('personal')}
              onOpenPixConfig={() => setActiveSubView('pix')}
              onOpenQrPairing={onOpenQrPairing}
              onOpenSupport={() => setActiveSubView('support')}
              onOpenSettings={() => setActiveSubView('settings')}
              onShowNotification={onShowNotification}
              onLogout={onLogout}
            />
          )}

          {activeSubView === 'personal' && (
            <form
              onSubmit={handleSavePersonal}
              className="bg-[#111922] border border-slate-800 rounded-2xl p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-black text-white text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-[#00CCBC]" /> Meus Dados &amp; Veículo
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSubView('menu')}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0B1117] border border-slate-800 text-white font-bold focus:outline-none focus:border-[#00CCBC]"
                    placeholder="Seu nome"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">WhatsApp / Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-[#0B1117] border border-slate-800 text-white font-bold focus:outline-none focus:border-[#00CCBC]"
                    placeholder="(43) 99999-9999"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Veículo</label>
                    <select
                      value={vehicle}
                      onChange={(e) => setVehicle(e.target.value as 'SCOOTER' | 'BIKE' | 'CAR')}
                      className="w-full h-11 px-3 rounded-xl bg-[#0B1117] border border-slate-800 text-white font-bold focus:outline-none focus:border-[#00CCBC]"
                    >
                      <option value="SCOOTER">Moto</option>
                      <option value="BIKE">Bicicleta</option>
                      <option value="CAR">Carro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Placa do Veículo</label>
                    <input
                      type="text"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                      className="w-full h-11 px-3.5 rounded-xl bg-[#0B1117] border border-slate-800 text-white font-mono font-bold uppercase focus:outline-none focus:border-[#00CCBC]"
                      placeholder="ABC-1D23"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 bg-[#00CCBC] hover:bg-[#00b5a7] disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Dados Cadastrais'}
              </button>
            </form>
          )}

          {activeSubView === 'pix' && (
            <form
              onSubmit={handleSavePix}
              className="bg-[#111922] border border-slate-800 rounded-2xl p-5 space-y-4 text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-black text-white text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#00CCBC]" /> Dados Bancários &amp; Chave PIX
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSubView('menu')}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-400">
                  Chave PIX Principal para Repasses
                </label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-[#0B1117] border border-slate-800 text-white font-mono font-bold focus:outline-none focus:border-[#00CCBC]"
                  placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                />
                <p className="text-[11px] text-slate-400">
                  Esta chave PIX será preenchida automaticamente ao solicitar saques na aba Ganhos.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 bg-[#00CCBC] hover:bg-[#00b5a7] disabled:opacity-50 text-slate-950 font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Save className="w-4 h-4" /> {saving ? 'Salvando...' : 'Salvar Chave PIX Padrão'}
              </button>
            </form>
          )}

          {activeSubView === 'support' && (
            <DriverSupportView
              storeName={storeName}
              storePhone={storePhone}
              onReportOccurrence={onReportOccurrence}
              onBack={() => setActiveSubView('menu')}
              onShowNotification={onShowNotification}
            />
          )}

          {activeSubView === 'settings' && (
            <DriverSettingsView
              driverId={currentDriver.id}
              onBack={() => setActiveSubView('menu')}
              onShowNotification={onShowNotification}
            />
          )}
        </div>
      </div>
    </div>
  );
};
