import React, { useState, useEffect } from 'react';
import { Store, Globe, ChevronDown, Power, ShieldCheck, QrCode } from 'lucide-react';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { Driver } from '../../../types';

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

interface DriverNotebookHeaderProps {
  currentDriver: Driver;
  drivers: Driver[];
  currentDriverId: string;
  canSwitchDriver?: boolean;
  onSelectDriverId: (id: string) => void;
  onToggleDriverStatus: (id: string) => void;
  operationMode: 'STORE' | 'PLATFORM';
  onOpenModeModal: () => void;
  onOpenQrPairing?: () => void;
  isOnline: boolean;
  storeName?: string;
}

export const DriverNotebookHeader: React.FC<DriverNotebookHeaderProps> = ({
  currentDriver,
  drivers,
  currentDriverId,
  canSwitchDriver = true,
  onSelectDriverId,
  onToggleDriverStatus,
  operationMode,
  onOpenModeModal,
  onOpenQrPairing,
  isOnline,
  storeName,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [currentDriver.avatar]);

  const driverInitials = (currentDriver.name || 'EN')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 sm:p-5 text-slate-100 shadow-lg space-y-4">
      {/* Top Shift & Modality Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <BrandLogo id="driver" size="sm" />
          <button
            type="button"
            onClick={onOpenModeModal}
            className="min-h-[44px] flex items-center gap-2 bg-[#0B1117] hover:bg-slate-900 text-white px-3.5 py-2 rounded-xl border border-[#00CCBC]/40 font-bold text-xs transition-all cursor-pointer"
          >
            {operationMode === 'STORE' ? (
              <Store className="w-4 h-4 text-[#00CCBC]" />
            ) : (
              <Globe className="w-4 h-4 text-[#00CCBC]" />
            )}
            <span>
              {operationMode === 'STORE'
                ? `Frota da Loja${storeName ? ` • ${storeName}` : ''}`
                : 'Plataforma Aberta'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {onOpenQrPairing && (
            <button
              type="button"
              onClick={onOpenQrPairing}
              title="Parear Frota Própria da Loja via QR Code ou PIN de 6 dígitos"
              className="min-h-[44px] flex items-center gap-1.5 bg-[#00CCBC]/10 hover:bg-[#00CCBC]/20 text-[#00CCBC] px-3 py-2 rounded-xl border border-[#00CCBC]/30 font-black text-xs transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Parear Loja (QR / PIN)</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleDriverStatus(currentDriver.id)}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer border ${
              isOnline
                ? 'bg-[#00CCBC] text-slate-950 border-[#00CCBC] shadow-sm'
                : 'bg-[#0B1117] text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{isOnline ? 'EM TURNO • ONLINE' : 'OFFLINE'}</span>
          </button>
        </div>
      </div>

      {/* Rider Identity & Governance Scope */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            {currentDriver.avatar && !avatarFailed ? (
              <img
                src={currentDriver.avatar}
                alt={currentDriver.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-[#00CCBC]/50"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-[#00CCBC]/15 border-2 border-[#00CCBC]/50 text-[#00CCBC] font-black text-base flex items-center justify-center">
                {driverInitials}
              </div>
            )}
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#111922] ${
                isOnline ? 'bg-[#00CCBC]' : 'bg-slate-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-white leading-tight truncate">
                {currentDriver.name}
              </h1>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700">
                <ShieldCheck className="w-3 h-3 text-[#00CCBC]" />
                Conta Verificada
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {operationMode === 'STORE'
                ? 'Recebendo despachos da Loja'
                : 'Recebendo corridas da Plataforma Aberta'}{' '}
              • {formatVehicleLabel(currentDriver.vehicle)}
              {currentDriver.vehiclePlate ? ` (${currentDriver.vehiclePlate})` : ''}
            </p>
          </div>
        </div>

        {canSwitchDriver && drivers.length > 0 ? (
          <select
            value={currentDriverId}
            onChange={e => onSelectDriverId(e.target.value)}
            className="min-h-[44px] bg-[#0B1117] text-[#00CCBC] text-xs font-bold px-3 py-2 rounded-xl border border-slate-700 focus:outline-none cursor-pointer sm:max-w-[180px] truncate"
          >
            {drivers.map(d => (
              <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="bg-[#0B1117] px-3.5 py-2 rounded-xl border border-slate-800 text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Saldo Carteira</span>
            <span className="text-sm font-mono font-black text-[#00CCBC] tabular-nums">
              R$ {(Number(currentDriver.walletBalance) || 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
