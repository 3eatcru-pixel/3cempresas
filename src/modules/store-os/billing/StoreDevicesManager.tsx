import React, { useState } from 'react';
import { Laptop, Plus, Trash2, Wifi, RefreshCw, Key, ShieldOff, Link2 } from 'lucide-react';
import { Store, DeviceLicense, PlatformGovernance } from '../../../types';
import { getStoreMaxDevices } from '../../../utils/storeDomain';

interface StoreDevicesManagerProps {
  currentStore: Store;
  deviceLicenses: DeviceLicense[];
  governance?: PlatformGovernance;
  onRegisterDevice: (storeId: string, name: string, type: DeviceLicense['type']) => Promise<boolean>;
  onRevokeDevice: (deviceId: string) => Promise<void>;
  onPairDevice?: (deviceId: string, pairingCode?: string) => Promise<void>;
  onRegeneratePairing?: (deviceId: string) => Promise<string | null>;
  onRevokeToken?: (deviceId: string) => Promise<void>;
  onOpenUpgrade: () => void;
}

const DEVICE_TYPE_LABELS: Record<DeviceLicense['type'], string> = {
  POS_TERMINAL: 'Terminal PDV Balcão',
  KDS_MONITOR: 'Monitor KDS Cozinha',
  WAITER_TABLET: 'Tablet / Celular Garçom',
  BARCODE_SCANNER: 'Leitor Código de Barras',
  PRINTER_80MM: 'Impressora Térmica 80mm',
};

export const StoreDevicesManager: React.FC<StoreDevicesManagerProps> = ({
  currentStore,
  deviceLicenses,
  governance,
  onRegisterDevice,
  onRevokeDevice,
  onPairDevice,
  onRegeneratePairing,
  onRevokeToken,
  onOpenUpgrade,
}) => {
  const storeDevices = deviceLicenses.filter((d) => d.storeId === currentStore.id);
  const maxDevices = getStoreMaxDevices(currentStore, governance);
  const quotaReached = maxDevices < 999 && storeDevices.length >= maxDevices;

  const [isAdding, setIsAdding] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState<DeviceLicense['type']>('POS_TERMINAL');
  const [isSaving, setIsSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | DeviceLicense['type']>('ALL');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const visibleDevices =
    typeFilter === 'ALL' ? storeDevices : storeDevices.filter((d) => d.type === typeFilter);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim() || quotaReached) return;
    setIsSaving(true);
    try {
      const ok = await onRegisterDevice(currentStore.id, deviceName.trim(), deviceType);
      if (ok) {
        setDeviceName('');
        setIsAdding(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Laptop className="w-4 h-4 text-amber-400" />
            <span>Dispositivos &amp; Terminais ({currentStore.name})</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-mono tabular-nums border ${
                quotaReached
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              }`}
            >
              {maxDevices >= 999
                ? `${storeDevices.length} / Ilimitados`
                : `${storeDevices.length} / ${maxDevices}`}
            </span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {quotaReached
              ? `Limite de terminais do plano ${currentStore.subscriptionPlan} atingido (${storeDevices.length}/${maxDevices}). Solicite upgrade para parear mais dispositivos.`
              : `Conecte PDVs, monitores KDS, tablets e impressoras dentro da cota do plano (${maxDevices >= 999 ? 'Ilimitados' : `até ${maxDevices}`}).`}
          </p>
        </div>

        {quotaReached ? (
          <button
            type="button"
            onClick={onOpenUpgrade}
            className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer"
          >
            Ampliar Plano p/ Mais Terminais
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Parear Novo Dispositivo
          </button>
        )}
      </div>

      {storeDevices.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'ALL', label: `Todos (${storeDevices.length})` },
              { id: 'POS_TERMINAL', label: 'PDV' },
              { id: 'KDS_MONITOR', label: 'KDS' },
              { id: 'WAITER_TABLET', label: 'Garçom' },
              { id: 'PRINTER_80MM', label: 'Impressora' },
              { id: 'BARCODE_SCANNER', label: 'Leitor' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                typeFilter === f.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-slate-950/90 border border-emerald-500/30 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Terminal</label>
            <input
              type="text"
              required
              placeholder="Ex: Caixa 01, Tablet Salão 02"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Hardware</label>
            <select
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value as DeviceLicense['type'])}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
            >
              <option value="POS_TERMINAL">Terminal PDV Balcão</option>
              <option value="KDS_MONITOR">Monitor KDS Cozinha</option>
              <option value="WAITER_TABLET">Tablet / Celular Garçom</option>
              <option value="BARCODE_SCANNER">Leitor Código de Barras</option>
              <option value="PRINTER_80MM">Impressora Térmica 80mm</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
            >
              {isSaving ? 'Pareando...' : 'Ativar Terminal'}
            </button>
          </div>
        </form>
      )}

      {visibleDevices.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400 space-y-1">
          <p className="font-bold text-slate-300">
            {storeDevices.length === 0
              ? 'Nenhum terminal conectado nesta loja ainda.'
              : 'Nenhum dispositivo encontrado neste filtro.'}
          </p>
          <p className="text-[11px] text-slate-500">
            Clique em "Parear Novo Dispositivo" para vincular um PDV, KDS ou celular de garçom à {currentStore.name}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleDevices.map((dev) => {
            const isPendingPairing = !dev.paired || dev.status === 'PENDING_PAIRING';
            const isConfirming = confirmingDeleteId === dev.id;
            return (
              <div
                key={dev.id}
                className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white truncate">{dev.name}</span>
                      <span
                        className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                          dev.status === 'ONLINE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isPendingPairing
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <Wifi className="w-2.5 h-2.5" /> {dev.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                      {DEVICE_TYPE_LABELS[dev.type] || dev.type} • <span className="font-mono text-slate-500">{dev.deviceId}</span>
                    </div>
                  </div>

                  {isConfirming ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmingDeleteId(null);
                          void onRevokeDevice(dev.id);
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-500 hover:bg-rose-400 text-slate-950 text-[10px] font-black uppercase cursor-pointer"
                      >
                        Remover
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold cursor-pointer"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(dev.id)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer shrink-0"
                      title="Remover dispositivo desta loja"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {dev.pairingCode && (
                  <div className="space-y-1.5">
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-[10px]">
                      <span className="text-amber-300 font-bold flex items-center gap-1.5">
                        <Key className="w-3 h-3" /> Código de Pareamento:
                      </span>
                      <span className="font-mono font-black text-white tracking-wider">{dev.pairingCode}</span>
                    </div>
                    {(dev.type === 'WAITER_TABLET' || dev.type === 'POS_TERMINAL') && (
                      <p className="text-[10px] text-slate-400 px-1">
                        No <strong className="text-slate-200">3C Waiter → Dispositivo/PDQ</strong>: informe ID{' '}
                        <span className="font-mono text-white">{dev.deviceId}</span> + o código acima.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {onPairDevice && isPendingPairing && dev.pairingCode && (
                    <button
                      type="button"
                      onClick={() => onPairDevice(dev.id, dev.pairingCode)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <Link2 className="w-3 h-3" /> Parear Agora
                    </button>
                  )}
                  {onRegeneratePairing && (
                    <button
                      type="button"
                      onClick={() => onRegeneratePairing(dev.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-amber-400" /> Novo Código
                    </button>
                  )}
                  {onRevokeToken && dev.paired && (
                    <button
                      type="button"
                      onClick={() => onRevokeToken(dev.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[9px] font-black uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldOff className="w-3 h-3" /> Revogar Token
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
