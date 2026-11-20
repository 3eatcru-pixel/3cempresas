import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { Store } from '../../types';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { syncEngine } from '../../core/sync/SyncEngine';
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '@3c/api-client';
import { WaiterQrHostView } from './layout/WaiterQrHostView';
import { WaiterPinClientForm } from './layout/WaiterPinClientForm';

interface WaiterQrPairingModalProps {
  currentStore: Store;
  onClose: () => void;
  onPairSuccess?: (waiterName: string, accessPin: string) => void;
  isWaiterClient?: boolean;
}

function generateLocalFallbackPin(): string {
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

export const WaiterQrPairingModal: React.FC<WaiterQrPairingModalProps> = ({
  currentStore,
  onClose,
  onPairSuccess,
  isWaiterClient = false,
}) => {
  const { profile, getIdToken } = useAuth();
  const syncStatus = useSyncStatus();
  const pinStorageKey = `3ccorp_waiter_pin_${currentStore.id}`;
  const [pairingPin, setPairingPin] = useState<string>(() => {
    const existing = getPlatformAdapters().storage.getItem(pinStorageKey);
    return existing && /^\d{3}-?\d{3}$/.test(existing) ? existing : '--- ---';
  });
  const [pinLoading, setPinLoading] = useState(!isWaiterClient);
  const [verifying, setVerifying] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [waiterNameInput, setWaiterNameInput] = useState(() => profile?.name || 'Garçom Mobile');
  const [edgeLanUrl, setEdgeLanUrl] = useState(syncStatus.pairedEdge?.edgeBaseUrl || '');
  const [pairError, setPairError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  useEffect(() => {
    if (profile?.name) {
      setWaiterNameInput(profile.name);
    }
  }, [profile?.name]);

  useEffect(() => {
    let active = true;
    if (isWaiterClient) return;

    const loadServerPin = async () => {
      setPinLoading(true);
      setPairError(null);
      try {
        const token = await getIdToken();
        if (token) {
          const res = await apiClient.getWaiterPairingPin(currentStore.id, token);
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
            const generated = generateLocalFallbackPin();
            getPlatformAdapters().storage.setItem(pinStorageKey, generated);
            setPairingPin(generated);
          }
          setPairError(err?.message ? `Modo offline: ${err.message}` : null);
        }
      }
      if (active) setPinLoading(false);
    };

    loadServerPin();
    return () => {
      active = false;
    };
  }, [currentStore.id, pinStorageKey, isWaiterClient]);

  const handleRegeneratePin = async () => {
    setPinLoading(true);
    setPairError(null);
    try {
      const token = await getIdToken();
      if (token) {
        const res = await apiClient.regenerateWaiterPairingPin(currentStore.id, token);
        if (res?.pin) {
          setPairingPin(res.pin);
          getPlatformAdapters().storage.setItem(pinStorageKey, res.pin);
          setPinLoading(false);
          return;
        }
      }
      throw new Error('Sessão não autenticada para regenerar o PIN da loja.');
    } catch (err: any) {
      setPairError(err?.message || 'Falha ao regenerar PIN da loja.');
    } finally {
      setPinLoading(false);
    }
  };

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        storeId: currentStore.id,
        storeName: currentStore.name,
        tenantId: currentStore.tenantId || 'tenant-1',
        pin: pairingPin,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl || null,
        edgeNodeId: syncStatus.pairedEdge?.nodeId || null,
        timestamp: Date.now(),
      }),
    [
      currentStore.id,
      currentStore.name,
      currentStore.tenantId,
      pairingPin,
      syncStatus.pairedEdge?.edgeBaseUrl,
      syncStatus.pairedEdge?.nodeId,
    ]
  );

  const handleManualPairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const manualDigits = manualCode.replace(/\D/g, '');
    if (manualDigits.length !== 6) {
      setPairError('Digite o código PIN completo de 6 dígitos (ex: 482-915).');
      return;
    }

    setPairError(null);
    setVerifying(true);
    try {
      const token = await getIdToken();
      if (!token) {
        setPairError('Faça login com sua conta de Garçom ou Gestor antes de parear o aparelho.');
        setVerifying(false);
        return;
      }

      try {
        await apiClient.verifyWaiterPairingPin(currentStore.id, manualDigits, token);
      } catch (err: any) {
        const msg = String(err?.message || '');
        const isNetworkFailure = /failed to fetch|network|err_connection/i.test(msg);
        if (!isNetworkFailure) {
          setPairError(msg || `PIN inválido para ${currentStore.name}. Verifique o código exibido no caixa.`);
          setVerifying(false);
          return;
        }
        const cachedPin = getPlatformAdapters().storage.getItem(pinStorageKey);
        const cachedDigits = cachedPin ? cachedPin.replace(/\D/g, '') : '';
        if (!cachedDigits || manualDigits !== cachedDigits) {
          setPairError(
            cachedDigits
              ? `PIN inválido no cache offline para ${currentStore.name}.`
              : 'Sem conexão com o servidor e nenhum PIN validado em cache local.'
          );
          setVerifying(false);
          return;
        }
      }

      if (edgeLanUrl.trim()) {
        try {
          await syncEngine.pairEdgeNode({
            storeId: currentStore.id,
            storeName: currentStore.name,
            edgeBaseUrl: edgeLanUrl.trim(),
            hostname: `waiter-${waiterNameInput.toLowerCase().replace(/\s+/g, '-')}`,
            preferLan: true,
          });
        } catch (err: any) {
          setPairError(err?.message || 'URL do Edge Node LAN inválida.');
          setVerifying(false);
          return;
        }
      }

      const formattedPin = `${manualDigits.slice(0, 3)}-${manualDigits.slice(3)}`;
      getPlatformAdapters().storage.setItem(pinStorageKey, formattedPin);
      if (onPairSuccess) {
        onPairSuccess(waiterNameInput.trim() || 'Garçom Mobile', formattedPin);
      }
      onClose();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl overflow-hidden p-6 space-y-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-950/50 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!isWaiterClient ? (
          <WaiterQrHostView
            currentStore={currentStore}
            qrPayload={qrPayload}
            pinLoading={pinLoading}
            pairingPin={pairingPin}
            pairError={pairError}
            copiedPayload={copiedPayload}
            pairedEdgeBaseUrl={syncStatus.pairedEdge?.edgeBaseUrl}
            onRegeneratePin={handleRegeneratePin}
            onCopyPayload={() => {
              navigator.clipboard
                ?.writeText(qrPayload)
                .then(() => {
                  setCopiedPayload(true);
                  setTimeout(() => setCopiedPayload(false), 2500);
                })
                .catch(() => {});
            }}
          />
        ) : (
          <WaiterPinClientForm
            currentStore={currentStore}
            waiterNameInput={waiterNameInput}
            setWaiterNameInput={setWaiterNameInput}
            manualCode={manualCode}
            setManualCode={setManualCode}
            edgeLanUrl={edgeLanUrl}
            setEdgeLanUrl={setEdgeLanUrl}
            pairError={pairError}
            verifying={verifying}
            onSubmit={handleManualPairSubmit}
          />
        )}
      </div>
    </div>
  );
};
