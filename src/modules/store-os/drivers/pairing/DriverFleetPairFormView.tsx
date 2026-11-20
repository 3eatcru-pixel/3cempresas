import React, { useState } from 'react';
import {
  AlertCircle,
  Bike,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  QrCode,
  Store as StoreIcon,
} from 'lucide-react';
import { apiClient } from '@3c/api-client';
import { Store } from '../../../../types';
import { useAuth } from '../../../../context/AuthContext';
import { useOptionalEcosystem } from '../../../../context/EcosystemContext';

interface DriverFleetPairFormViewProps {
  currentStore: Store;
  onClose: () => void;
  onPairSuccess?: (info: { storeId: string; storeName: string; driverName: string }) => void;
}

function formatPinInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
}

export const DriverFleetPairFormView: React.FC<DriverFleetPairFormViewProps> = ({
  currentStore,
  onClose,
  onPairSuccess,
}) => {
  const { profile, isAuthenticated, getIdToken, loginDriverWithPin, refreshProfile } = useAuth();
  const eco = useOptionalEcosystem();
  const availableStores = eco?.stores || (currentStore ? [currentStore] : []);

  const [pairError, setPairError] = useState<string | null>(null);
  const [qrRaw, setQrRaw] = useState('');
  const [storeIdInput, setStoreIdInput] = useState(currentStore?.id || 'store-1');
  const [pinInput, setPinInput] = useState('');
  const [driverNameInput, setDriverNameInput] = useState(() => profile?.name || '');
  const [phoneInput, setPhoneInput] = useState(() => profile?.phone || '');
  const [vehicleInput, setVehicleInput] = useState<'SCOOTER' | 'BIKE' | 'CAR'>('SCOOTER');
  const [plateInput, setPlateInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleQrPasteChange = (raw: string) => {
    setQrRaw(raw);
    setPairError(null);
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.storeId === 'string' && parsed.storeId.trim()) {
          setStoreIdInput(parsed.storeId.trim());
        }
        if (parsed.pin) {
          setPinInput(String(parsed.pin));
        }
      }
    } catch {
      // Allow partial paste while typing
    }
  };

  const handleDriverPairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPairError(null);

    const pinDigits = pinInput.replace(/\D/g, '');
    const hasQrJson = qrRaw.trim().startsWith('{');
    if (!hasQrJson && (!storeIdInput.trim() || pinDigits.length !== 6)) {
      setPairError('Informe o ID/Slug da loja e o PIN de 6 dígitos do QR Code da Frota Própria.');
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedRole = String(profile?.role || '').toUpperCase();
      const isAlreadyCourier =
        isAuthenticated && (normalizedRole === 'COURIER' || normalizedRole === 'DRIVER');

      if (isAlreadyCourier) {
        const token = await getIdToken();
        if (token) {
          let resolvedStoreId = storeIdInput.trim();
          let resolvedPin = pinDigits;
          if (hasQrJson) {
            try {
              const parsed = JSON.parse(qrRaw.trim());
              if (parsed?.storeId) resolvedStoreId = String(parsed.storeId).trim();
              if (parsed?.pin) resolvedPin = String(parsed.pin).replace(/\D/g, '');
            } catch {
              // fallback to inputs
            }
          }
          const verified = await apiClient.verifyDriverPairingPin(
            resolvedStoreId,
            {
              pin: resolvedPin,
              vehicle: vehicleInput,
              vehiclePlate: plateInput.trim() || undefined,
            },
            token
          );
          await refreshProfile();
          onPairSuccess?.({
            storeId: verified.storeId,
            storeName: verified.storeName,
            driverName: driverNameInput.trim() || profile?.name || 'Motorista Próprio',
          });
          onClose();
          return;
        }
      }

      const res = await loginDriverWithPin({
        storeId: storeIdInput.trim() || undefined,
        pin: pinDigits || undefined,
        qrPayload: hasQrJson ? qrRaw.trim() : undefined,
        driverName: driverNameInput.trim() || undefined,
        phone: phoneInput.trim() || undefined,
        vehicle: vehicleInput,
        vehiclePlate: plateInput.trim() || undefined,
      });

      onPairSuccess?.({
        storeId: res.store?.id || storeIdInput.trim(),
        storeName: res.store?.name || currentStore.name,
        driverName: driverNameInput.trim() || 'Motorista Próprio',
      });
      onClose();
    } catch (err: any) {
      setPairError(err?.message || 'Não foi possível parear com a Frota Própria da loja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleDriverPairSubmit(e)} className="space-y-4">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
        <div className="p-2.5 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400">
          <Bike className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-black text-white uppercase italic tracking-tight">
            Parear Frota Própria da Loja
          </h3>
          <p className="text-[11px] text-slate-400">
            Vincule seu app 3C Driver diretamente ao estabelecimento via QR Code ou PIN de 6 dígitos
          </p>
        </div>
      </div>

      {pairError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-xs text-rose-300 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{pairError}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-teal-400" /> Dados do QR Code da Loja (opcional)
          </label>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.readText()
                .then((text) => {
                  if (text) handleQrPasteChange(text);
                })
                .catch(() => {});
            }}
            className="text-[10px] font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3 h-3" /> Colar QR Copiado
          </button>
        </div>
        <textarea
          rows={2}
          value={qrRaw}
          onChange={(e) => handleQrPasteChange(e.target.value)}
          placeholder="Cole aqui o payload JSON do QR Code gerado no Store OS para preenchimento automático..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-teal-500 resize-none"
        />
      </div>

      {availableStores.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <StoreIcon className="w-3 h-3 text-teal-400" /> Selecionar Estabelecimento da Rede
          </label>
          <select
            value={
              availableStores.some((s) => s.id === storeIdInput || s.slug === storeIdInput)
                ? availableStores.find((s) => s.id === storeIdInput || s.slug === storeIdInput)!.id
                : ''
            }
            onChange={(e) => {
              if (e.target.value) setStoreIdInput(e.target.value);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-teal-500"
          >
            <option value="">Digitar ID ou Slug manualmente...</option>
            {availableStores.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.id})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <StoreIcon className="w-3 h-3 text-slate-400" /> Loja (ID ou Slug)
          </label>
          <input
            type="text"
            required
            value={storeIdInput}
            onChange={(e) => setStoreIdInput(e.target.value)}
            placeholder="Ex: store-1"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
            <KeyRound className="w-3 h-3 text-teal-400" /> PIN da Frota (6 dígitos)
          </label>
          <input
            type="text"
            inputMode="numeric"
            required
            value={pinInput}
            onChange={(e) => setPinInput(formatPinInput(e.target.value))}
            placeholder="000-000"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-teal-400 tracking-wider text-center focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Seu Nome (Motorista)
          </label>
          <input
            type="text"
            required
            value={driverNameInput}
            onChange={(e) => setDriverNameInput(e.target.value)}
            placeholder="Ex: Carlos Motoboy"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            WhatsApp / Telefone
          </label>
          <input
            type="text"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="(43) 99999-0000"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Veículo
          </label>
          <select
            value={vehicleInput}
            onChange={(e) => setVehicleInput(e.target.value as 'SCOOTER' | 'BIKE' | 'CAR')}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-teal-500"
          >
            <option value="SCOOTER">Moto / Scooter</option>
            <option value="BIKE">Bicicleta / E-Bike</option>
            <option value="CAR">Carro / Utilitário</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Placa (opcional)
          </label>
          <input
            type="text"
            value={plateInput}
            onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
            placeholder="ABC-1D23"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white uppercase focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Vincular e Entrar na Frota Própria
          </>
        )}
      </button>
    </form>
  );
};
