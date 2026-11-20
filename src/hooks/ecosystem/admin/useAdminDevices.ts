import React from 'react';
import { StorageAdapter } from '../../../services/databaseAdapter';
import { DeviceLicense, Store } from '../../../types';
import { apiClient } from '../../../core/api/apiClient';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { generateDeviceId } from '../../../utils/idGenerator';

interface UseAdminDevicesParams {
  adapter: StorageAdapter;
  isHqRole: boolean;
  profile: any;
  stores: Store[];
  setDeviceLicenses: React.Dispatch<React.SetStateAction<DeviceLicense[]>>;
  getIdToken: () => Promise<string | undefined>;
  showNotification: (msg: string) => void;
  logSystemEvent: (
    type: string,
    payload: string,
    channel: string,
    tenantId?: string
  ) => Promise<void>;
}

export const useAdminDevices = ({
  adapter,
  isHqRole,
  profile,
  stores,
  setDeviceLicenses,
  getIdToken,
  showNotification,
  logSystemEvent,
}: UseAdminDevicesParams) => {
  const revokeDeviceLicense = async (deviceId: string) => {
    try {
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = await getIdToken();
        if (isHqRole) {
          await adapter.deleteDeviceLicense(deviceId);
        } else {
          await apiClient.deleteStoreDevice(deviceId, token);
        }
      } else {
        await adapter.deleteDeviceLicense(deviceId);
      }
      setDeviceLicenses(prev => prev.filter(d => d.id !== deviceId));
      showNotification('Licença do dispositivo revogada.');
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao revogar licença.');
    }
  };

  const registerNewDeviceLicense = async (
    storeId: string,
    name: string,
    type: any,
    hardwareDeviceId?: string
  ): Promise<boolean> => {
    try {
      const id = generateDeviceId();
      const targetStore = stores.find(s => s.id === storeId);
      const resolvedTenantId = targetStore?.tenantId || profile?.tenantId;
      let localPairingCode: string | undefined;
      if (adapter.type !== 'SERVER_CORE_REST') {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        localPairingCode = `3C-${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      }
      const nowIso = new Date().toISOString();
      const license: DeviceLicense = {
        id,
        deviceId: hardwareDeviceId?.trim() || id,
        storeId,
        name,
        type,
        status: 'PENDING_PAIRING',
        paired: false,
        ...(localPairingCode ? { pairingCode: localPairingCode } : {}),
        ipAddress: 'Aguardando pareamento',
        lastPing: 'Aguardando pareamento',
        lastHeartbeatAt: null,
        appVersion: '5.2.1',
        ...(resolvedTenantId ? { tenantId: resolvedTenantId } : {}),
        createdAt: nowIso,
      };
      let res: any;
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = await getIdToken();
        res = isHqRole
          ? await adapter.saveDeviceLicense(license)
          : await apiClient.createStoreDevice(license, token);
      } else {
        res = await adapter.saveDeviceLicense(license);
      }
      const savedLicense: DeviceLicense = res?.device || license;
      setDeviceLicenses(prev => [...prev, savedLicense]);
      showNotification(
        `Terminal "${savedLicense.name}" registrado! Código de pareamento: ${savedLicense.pairingCode || 'Gerado pelo servidor'}`
      );
      return true;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao registrar dispositivo.');
      return false;
    }
  };

  const pairDevice = async (deviceId: string, pairingCode?: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Pareamento bloqueado: requer conexão com Server Core (Pilar 4).');
        return;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.pairHqDevice(deviceId, { pairingCode }, token)
        : await apiClient.pairStoreDevice(deviceId, { pairingCode }, token);
      if (res?.deviceToken) {
        getPlatformAdapters().storage.setItem(`3ccorp_device_token_${deviceId}`, res.deviceToken);
      }
      if (res?.device) {
        setDeviceLicenses(prev => prev.map(d => (d.id === deviceId ? res.device : d)));
      }
      showNotification('Terminal pareado e online!');
      logSystemEvent('DEVICE_PAIRED', `Dispositivo ${deviceId} pareado.`, isHqRole ? 'hq/devices' : 'store/devices');
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao parear dispositivo.');
    }
  };

  const regenerateDevicePairing = async (deviceId: string): Promise<string | null> => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Regeneração de código requer Server Core (Pilar 4).');
        return null;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.regenerateDevicePairing(deviceId, token)
        : await apiClient.regenerateStoreDevicePairing(deviceId, token);
      if (res?.device) {
        setDeviceLicenses(prev => prev.map(d => (d.id === deviceId ? res.device : d)));
      }
      showNotification(`Novo código de pareamento gerado: ${res.pairingCode}`);
      logSystemEvent(
        'DEVICE_PAIRING_REGENERATED',
        `Código regenerado para ${deviceId}`,
        isHqRole ? 'hq/devices' : 'store/devices'
      );
      return res.pairingCode;
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao regenerar código de pareamento.');
      return null;
    }
  };

  const revokeDeviceToken = async (deviceId: string) => {
    try {
      if (adapter.type !== 'SERVER_CORE_REST') {
        showNotification('Revogação de credencial requer Server Core (Pilar 4).');
        return;
      }
      const token = await getIdToken();
      const res = isHqRole
        ? await apiClient.revokeDeviceToken(deviceId, token)
        : await apiClient.revokeStoreDeviceToken(deviceId, token);
      getPlatformAdapters().storage.removeItem(`3ccorp_device_token_${deviceId}`);
      if (res?.device) {
        setDeviceLicenses(prev => prev.map(d => (d.id === deviceId ? res.device : d)));
      }
      showNotification('Token do terminal revogado! Novo pareamento exigido.');
      logSystemEvent(
        'DEVICE_TOKEN_REVOKED',
        `Credencial revogada para ${deviceId}`,
        isHqRole ? 'hq/devices' : 'store/devices'
      );
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao revogar token do terminal.');
    }
  };

  const heartbeatDevice = async (deviceId: string) => {
    try {
      const storedDeviceToken =
        getPlatformAdapters().storage.getItem(`3ccorp_device_token_${deviceId}`) || undefined;
      const token = await getIdToken();
      if (isHqRole) {
        await apiClient.heartbeatHqDevice(deviceId, {}, { deviceToken: storedDeviceToken, token });
      } else {
        await apiClient.heartbeatStoreDevice(deviceId, {}, { deviceToken: storedDeviceToken, token });
      }
      const nowIso = new Date().toISOString();
      setDeviceLicenses(prev =>
        prev.map(d =>
          d.id === deviceId ? { ...d, status: 'ONLINE', lastPing: nowIso, lastHeartbeatAt: nowIso } : d
        )
      );
      showNotification('Heartbeat enviado com sucesso.');
    } catch (e: any) {
      showNotification(e?.message || 'Falha ao registrar heartbeat.');
    }
  };

  return {
    revokeDeviceLicense,
    registerNewDeviceLicense,
    pairDevice,
    regenerateDevicePairing,
    revokeDeviceToken,
    heartbeatDevice,
  };
};
