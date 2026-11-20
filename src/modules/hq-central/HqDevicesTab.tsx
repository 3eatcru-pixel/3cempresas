import React, { useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { Laptop, ShieldCheck, Plus, KeyRound, RefreshCw, ShieldOff, Check } from 'lucide-react';
import { PILLAR_THEMES, STATUS_COLORS, SURFACE_TOKENS, getStatusColorToken } from '@3c/design-system';
import { HqDeviceQuotaSummary } from './devices/HqDeviceQuotaSummary';
import { HqRegisterDeviceModal, NewDeviceFormState } from './devices/HqRegisterDeviceModal';

export const HqDevicesTab: React.FC = () => {
  const {
    stores,
    deviceLicenses,
    governance,
    registerNewDeviceLicense,
    regenerateDevicePairing,
    revokeDeviceToken,
    revokeDeviceLicense,
    showNotification,
  } = useEcosystem();

  const storeTheme = PILLAR_THEMES['store-os'];
  const warningToken = STATUS_COLORS.WARNING;
  const infoToken = STATUS_COLORS.INFO;
  const dangerToken = STATUS_COLORS.DANGER;
  const surface = SURFACE_TOKENS.dark;

  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('ALL');
  const [isRegistering, setIsRegistering] = useState(false);
  const [copiedDeviceId, setCopiedDeviceId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; kind: 'TOKEN' | 'LICENSE' } | null>(null);
  const [newDevice, setNewDevice] = useState<NewDeviceFormState>({
    name: '',
    storeId: stores[0]?.id || '',
    type: 'POS',
    deviceId: '',
  });

  const filteredDevices =
    selectedStoreFilter === 'ALL'
      ? deviceLicenses
      : deviceLicenses.filter((d) => d.storeId === selectedStoreFilter);

  const handleCopyPairingCode = (deviceId: string, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedDeviceId(deviceId);
    showNotification(`Código de pareamento ${code} copiado.`);
    setTimeout(() => {
      setCopiedDeviceId((curr) => (curr === deviceId ? null : curr));
    }, 2000);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.name || !newDevice.storeId) return;
    const ok = await registerNewDeviceLicense(
      newDevice.storeId,
      newDevice.name,
      newDevice.type,
      newDevice.deviceId
    );
    if (ok) {
      setIsRegistering(false);
      setNewDevice({
        name: '',
        storeId: stores[0]?.id || '',
        type: 'POS',
        deviceId: '',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Control Plane Boundary Notice */}
      <div className={`${warningToken.bgClass} border ${warningToken.borderClass} rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-start gap-3">
          <ShieldCheck className={`w-5 h-5 ${warningToken.textClass} shrink-0 mt-0.5`} />
          <div>
            <div className={`text-xs font-black ${warningToken.textClass} uppercase tracking-wider`}>
              Monitoramento de Terminais &amp; Pareamento de Dispositivos (Control Plane)
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
              Novos terminais entram como <strong>Aguardando Pareamento (PENDING_PAIRING)</strong> com código criptográfico de uso único e validade de 15 minutos. Após o pareamento autorizado, o terminal recebe credencial exclusiva (<code>X-Device-Token</code>) obrigatória para o envio de heartbeats.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsRegistering(true)}
          className={`px-4 py-2 ${storeTheme.accentBgClass} text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0`}
        >
          <Plus className="w-3.5 h-3.5" /> REGISTRAR TERMINAL
        </button>
      </div>

      <HqDeviceQuotaSummary
        stores={stores}
        deviceLicenses={deviceLicenses}
        governance={governance}
        selectedStoreFilter={selectedStoreFilter}
        onSelectStoreFilter={setSelectedStoreFilter}
      />

      {/* Terminals Table with Interactive Handshake & Heartbeat */}
      <div className={`${surface.elevatedBg} p-6 rounded-2xl border ${surface.border} space-y-4`}>
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono tabular-nums">
            <Laptop className="w-4 h-4 text-slate-400" /> Auditoria de Terminais Registrados ({filteredDevices.length})
          </h3>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className={`${surface.canvasBg} text-slate-400 uppercase font-mono`}>
              <tr>
                <th className="px-4 py-3">Dispositivo / Hardware</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estabelecimento</th>
                <th className="px-4 py-3">Código Pareamento</th>
                <th className="px-4 py-3">IP &amp; Heartbeat</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Governança</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDevices.map((dev) => {
                const store = stores.find((s) => s.id === dev.storeId);
                const isPending = dev.status === 'PENDING_PAIRING';
                const isOnline = dev.status === 'ONLINE';
                const statusToken = getStatusColorToken(dev.status);
                const isConfirmingToken = confirmAction?.id === dev.id && confirmAction.kind === 'TOKEN';
                const isConfirmingLicense = confirmAction?.id === dev.id && confirmAction.kind === 'LICENSE';

                return (
                  <tr key={dev.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-white flex items-center gap-2">
                      <Laptop className={`w-4 h-4 ${storeTheme.accentTextClass} shrink-0`} />
                      <div>
                        <div>{dev.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{dev.deviceId}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      <span className={`px-2 py-0.5 rounded ${surface.canvasBg} border ${surface.border} ${storeTheme.accentTextClass}`}>
                        {dev.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-200">
                      {store?.name || dev.storeId}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {dev.pairingCode ? (
                        <span className={`px-2 py-0.5 ${surface.canvasBg} border ${surface.border} ${warningToken.textClass} font-bold rounded flex items-center gap-1.5 w-max`}>
                          <KeyRound className={`w-3 h-3 ${storeTheme.accentTextClass}`} /> {dev.pairingCode}
                        </span>
                      ) : (
                        <span className="text-slate-600 font-mono text-[10px]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-[10px] text-slate-400">
                      <div>{dev.ipAddress || 'Aguardando pareamento'}</div>
                      <div className="text-slate-500">Ping: {dev.lastPing || 'Nunca'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${statusToken.badgeClass}`}>
                        {isOnline
                          ? 'PAREADO & ONLINE'
                          : isPending
                            ? 'AGUARDANDO PAREAMENTO'
                            : 'DESCONECTADO'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {dev.pairingCode && (
                          <button
                            type="button"
                            onClick={() => handleCopyPairingCode(dev.id, dev.pairingCode!)}
                            className={`px-2 py-1 bg-slate-800 hover:bg-slate-700 ${copiedDeviceId === dev.id ? 'text-emerald-400' : warningToken.textClass} font-bold text-[10px] rounded border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer`}
                            title="Copiar Código de Pareamento para o Lojista"
                          >
                            {copiedDeviceId === dev.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" /> Copiado
                              </>
                            ) : (
                              <>
                                <KeyRound className={`w-3 h-3 ${storeTheme.accentTextClass}`} /> Copiar Código
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => regenerateDevicePairing(dev.id)}
                          className={`px-2 py-1 ${infoToken.bgClass} hover:bg-sky-500/20 ${infoToken.textClass} font-bold text-[10px] rounded border ${infoToken.borderClass} transition-colors flex items-center gap-1 cursor-pointer`}
                          title="Gerar novo código de pareamento de uso único (15 min)"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerar Código
                        </button>
                        {dev.paired && (
                          isConfirmingToken ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  revokeDeviceToken(dev.id);
                                  setConfirmAction(null);
                                }}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded transition-colors cursor-pointer"
                              >
                                Confirmar Revogação
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded transition-colors cursor-pointer"
                              >
                                Voltar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ id: dev.id, kind: 'TOKEN' })}
                              className={`px-2 py-1 ${warningToken.bgClass} hover:bg-amber-500/20 ${warningToken.textClass} font-bold text-[10px] rounded border ${warningToken.borderClass} transition-colors flex items-center gap-1 cursor-pointer`}
                              title="Revogar token do terminal e exigir novo pareamento"
                            >
                              <ShieldOff className="w-3 h-3" /> Revogar Token
                            </button>
                          )
                        )}
                        {isConfirmingLicense ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                revokeDeviceLicense(dev.id);
                                setConfirmAction(null);
                              }}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] rounded transition-colors cursor-pointer"
                            >
                              Confirmar Remoção
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction(null)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded transition-colors cursor-pointer"
                            >
                              Voltar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ id: dev.id, kind: 'LICENSE' })}
                            className={`px-2 py-1 ${dangerToken.bgClass} hover:bg-rose-500/20 ${dangerToken.textClass} font-bold text-[10px] rounded border ${dangerToken.borderClass} transition-colors cursor-pointer`}
                            title="Revogar Licença do Terminal"
                          >
                            Remover Licença
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredDevices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 italic">
                    Nenhum terminal registrado para este filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isRegistering && (
        <HqRegisterDeviceModal
          stores={stores}
          newDevice={newDevice}
          onChange={setNewDevice}
          onClose={() => setIsRegistering(false)}
          onSubmit={handleRegisterSubmit}
        />
      )}
    </div>
  );
};
