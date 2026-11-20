import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, QrCode, RefreshCw, Truck, Wifi } from 'lucide-react';
import { apiClient } from '@3c/api-client';
import { Store } from '../../../../types';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';
import { useAuth } from '../../../../context/AuthContext';
import { useSyncStatus } from '../../../../hooks/useSyncStatus';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';

interface StoreFleetQrDisplayViewProps {
  currentStore: Store;
}

function generateLocalFallbackDriverPin(): string {
  const arr = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(arr);
  } else {
    arr[0] = Date.now();
  }
  const num = 100000 + (arr[0] % 900000);
  const str = String(num);
  return `${str.slice(0, 3)}-${str.slice(3)}`;
}

export const StoreFleetQrDisplayView: React.FC<StoreFleetQrDisplayViewProps> = ({
  currentStore,
}) => {
  const { getIdToken } = useAuth();
  const syncStatus = useSyncStatus();
  const pinStorageKey = `3ccorp_driver_pin_${currentStore.id}`;

  const [pairingPin, setPairingPin] = useState<string>(() => {
    const existing = getPlatformAdapters().storage.getItem(pinStorageKey);
    return existing && /^\d{3}-?\d{3}$/.test(existing) ? existing : '--- ---';
  });
  const [pinLoading, setPinLoading] = useState(true);
  const [pairError, setPairError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    let active = true;
    const loadServerDriverPin = async () => {
      setPinLoading(true);
      setPairError(null);
      try {
        const token = await getIdToken();
        if (token) {
          const res = await apiClient.getDriverPairingPin(currentStore.id, token);
          if (active && res?.pin) {
            setPairingPin(res.pin);
            getPlatformAdapters().storage.setItem(pinStorageKey, res.pin);
            setPinLoading(false);
            return;
          }
        }
      } catch (err: any) {
        if (active) {
          const cached = getPlatformAdapters().storage.getItem(pinStorageKey);
          if (cached && /^\d{3}-?\d{3}$/.test(cached)) {
            setPairingPin(cached);
          } else {
            const generated = generateLocalFallbackDriverPin();
            getPlatformAdapters().storage.setItem(pinStorageKey, generated);
            setPairingPin(generated);
          }
          setPairError(err?.message ? `Modo offline: ${err.message}` : null);
        }
      }
      if (active) setPinLoading(false);
    };

    void loadServerDriverPin();
    return () => {
      active = false;
    };
  }, [currentStore.id, pinStorageKey, getIdToken]);

  const handleRegeneratePin = async () => {
    setPinLoading(true);
    setPairError(null);
    try {
      const token = await getIdToken();
      if (token) {
        const res = await apiClient.regenerateDriverPairingPin(currentStore.id, token);
        if (res?.pin) {
          setPairingPin(res.pin);
          getPlatformAdapters().storage.setItem(pinStorageKey, res.pin);
          setPinLoading(false);
          return;
        }
      }
      throw new Error('Sessão não autenticada para regenerar o QR/PIN da frota própria.');
    } catch (err: any) {
      setPairError(err?.message || 'Falha ao regenerar QR/PIN da frota própria.');
    } finally {
      setPinLoading(false);
    }
  };

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        type: '3C_OWN_FLEET_DRIVER',
        fleetType: 'STORE_FLEET',
        storeId: currentStore.id,
        storeName: currentStore.name,
        tenantId: currentStore.tenantId || 'tenant-1',
        pin: pairingPin,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl || null,
        timestamp: Date.now(),
      }),
    [
      currentStore.id,
      currentStore.name,
      currentStore.tenantId,
      pairingPin,
      syncStatus.pairedEdge?.edgeBaseUrl,
    ]
  );

  return (
    <div className="text-center space-y-4">
      <div className="inline-flex p-3 bg-teal-500/10 border border-teal-500/20 rounded-2xl text-teal-400">
        <QrCode className="w-8 h-8" />
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-[10px] font-black uppercase tracking-wider text-teal-300 mb-1.5">
          <Truck className="w-3 h-3" /> Frota Própria do Estabelecimento
        </span>
        <h3 className="text-lg font-black text-white tracking-tight">
          QR Code para Motoristas Próprios
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Apresente este QR Code ou informe o PIN de 6 dígitos para vincular seus entregadores próprios à frota exclusiva de{' '}
          <strong className="text-teal-400">{currentStore.name}</strong>.
        </p>
      </div>

      <div className="bg-gradient-to-b from-teal-400 to-emerald-500 p-4 rounded-3xl shadow-xl inline-block border-4 border-slate-950 my-1">
        <LocalQrCode
          value={qrPayload}
          size={192}
          darkColor="#020617"
          lightColor="#2dd4bf"
          alt="QR Code Pareamento Frota Própria"
          className="w-48 h-48 rounded-xl mx-auto shadow-md"
        />
      </div>

      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400 font-mono">
          <span>
            Loja ID: <strong className="text-white">{currentStore.id}</strong>
          </span>
          {currentStore.slug && (
            <span>
              • Slug: <strong className="text-teal-400">{currentStore.slug}</strong>
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">
          PIN de Pareamento • Frota Própria
        </span>
        <span className="text-2xl font-black font-mono text-teal-400 tracking-wider block">
          {pinLoading ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-teal-400" />
          ) : (
            pairingPin
          )}
        </span>

        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={() => void handleRegeneratePin()}
            disabled={pinLoading}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-teal-400 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${pinLoading ? 'animate-spin' : ''}`} /> Gerar Novo QR/PIN
          </button>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard
                ?.writeText(qrPayload)
                .then(() => {
                  setCopiedPayload(true);
                  setTimeout(() => setCopiedPayload(false), 2500);
                })
                .catch(() => {});
            }}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" /> {copiedPayload ? 'QR Copiado!' : 'Copiar Dados QR'}
          </button>
        </div>
        {pairError && <p className="text-[11px] text-amber-300/90 font-medium pt-1">{pairError}</p>}
      </div>

      <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-left space-y-1">
        <div className="text-[10px] font-black uppercase tracking-wider text-teal-400">
          Como o motorista próprio se conecta:
        </div>
        <ol className="text-[11px] text-slate-400 space-y-0.5 list-decimal list-inside">
          <li>
            No aplicativo <strong className="text-white">3C Driver</strong>, toque em{' '}
            <strong className="text-teal-300">Parear Frota Própria (QR / PIN)</strong>.
          </li>
          <li>
            Escaneie/cole o QR Code acima ou digite a loja{' '}
            <strong className="text-white">{currentStore.id}</strong> e o PIN{' '}
            <strong className="text-teal-300">{pairingPin}</strong>.
          </li>
          <li>
            O motorista entra imediatamente na modalidade{' '}
            <strong className="text-white">Frota da Loja</strong>.
          </li>
        </ol>
      </div>

      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span>Despacho Direto da Frota Própria Ativo</span>
      </div>
    </div>
  );
};
