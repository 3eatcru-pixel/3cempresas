import { useCallback, useEffect, useState } from 'react';
import { Store } from '../../../../types';
import {
  buildStandardContractHeaders,
  getPlatformAdapters,
} from '../../../../core/platform/PlatformAdapter';
import type {
  StorePeripheralRecord,
  StorePrintJobRecord,
} from '../StorePeripheralsManager';

export function useStorePeripherals(
  currentStore: Store,
  showNotification: (msg: string) => void
) {
  const [peripherals, setPeripherals] = useState<StorePeripheralRecord[]>([]);
  const [printJobs, setPrintJobs] = useState<StorePrintJobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const apiBase = getPlatformAdapters().network.getApiBaseUrl();

  const loadPeripheralsAndQueue = useCallback(async () => {
    if (!currentStore?.id) return;
    setLoading(true);
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: false });
      const [periphRes, jobsRes] = await Promise.all([
        fetch(`${apiBase}/store/peripherals?storeId=${encodeURIComponent(currentStore.id)}`, {
          headers,
        }),
        fetch(`${apiBase}/store/print-jobs?storeId=${encodeURIComponent(currentStore.id)}`, {
          headers,
        }),
      ]);
      if (periphRes.ok) {
        const list = await periphRes.json();
        if (Array.isArray(list)) setPeripherals(list);
      }
      if (jobsRes.ok) {
        const jobs = await jobsRes.json();
        if (Array.isArray(jobs)) setPrintJobs(jobs.slice(0, 12));
      }
    } catch {
      // silent fallback when offline
    } finally {
      setLoading(false);
    }
  }, [apiBase, currentStore?.id]);

  useEffect(() => {
    void loadPeripheralsAndQueue();
  }, [loadPeripheralsAndQueue]);

  const registerPeripheral = async (input: {
    name: string;
    kind: StorePeripheralRecord['kind'];
    station: StorePeripheralRecord['station'];
    connectionType: StorePeripheralRecord['connectionType'];
    host: string;
    port: string;
    devicePath: string;
    paperWidthMm: 58 | 80;
    isDefault: boolean;
  }): Promise<boolean> => {
    if (!input.name.trim()) {
      showNotification('Informe um nome para o periférico.');
      return false;
    }
    setSubmitting(true);
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const payload: Record<string, any> = {
        storeId: currentStore.id,
        name: input.name.trim(),
        kind: input.kind,
        station: input.station,
        connectionType: input.connectionType,
        isDefault: input.isDefault,
        active: true,
      };
      if (input.connectionType === 'LAN_RAW_9100') {
        payload.host = input.host.trim() || '192.168.1.200';
        payload.port = Number(input.port) || 9100;
      } else if (input.connectionType === 'SERIAL_COM' || input.connectionType === 'USB_DEVICE') {
        payload.devicePath = input.devicePath.trim() || 'COM3';
      }
      if (input.kind === 'PRINTER') {
        payload.paperWidthMm = input.paperWidthMm;
        payload.autoCut = true;
      }

      const res = await fetch(`${apiBase}/store/peripherals`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotification(data.error || 'Erro ao cadastrar periférico.');
        return false;
      }
      showNotification(`Periférico "${input.name.trim()}" configurado na estação ${input.station}!`);
      await loadPeripheralsAndQueue();
      return true;
    } catch {
      showNotification('Falha de rede ao salvar periférico.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const sendHeartbeat = async (periph: StorePeripheralRecord) => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const res = await fetch(
        `${apiBase}/store/peripherals/${encodeURIComponent(periph.id)}/heartbeat`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ status: 'ONLINE' }),
        }
      );
      if (res.ok) {
        showNotification(`Diagnóstico de "${periph.name}": ONLINE.`);
        await loadPeripheralsAndQueue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Falha ao testar periférico.');
      }
    } catch {
      showNotification('Erro ao enviar heartbeat do periférico.');
    }
  };

  const enqueueTestPrint = async (periph: StorePeripheralRecord) => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const content = [
        `=== TESTE ESC/POS ${currentStore.name.toUpperCase()} ===`,
        `Periferico: ${periph.name} (${periph.connectionType})`,
        `Estacao: ${periph.station} | Papel: ${periph.paperWidthMm || 80}mm`,
        `Data: ${new Date().toLocaleString('pt-BR')}`,
        `=========================================`,
      ].join('\n');

      const res = await fetch(`${apiBase}/store/print-jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeId: currentStore.id,
          station: periph.station,
          peripheralId: periph.id,
          content,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showNotification(data.error || 'Falha ao enfileirar impressão de teste.');
        return;
      }
      showNotification(`Página de teste enviada para "${periph.name}"!`);
      await loadPeripheralsAndQueue();
    } catch {
      showNotification('Falha ao disparar impressão de teste.');
    }
  };

  const retryPrintJob = async (job: StorePrintJobRecord) => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const content = [
        `=== REENVIO ESC/POS ${currentStore.name.toUpperCase()} ===`,
        `Job Anterior: ${job.id}`,
        `Estacao: ${job.station} | Destino: ${job.peripheralName || 'Padrao'}`,
        `Reenviado em: ${new Date().toLocaleString('pt-BR')}`,
        `==========================================`,
      ].join('\n');

      const res = await fetch(`${apiBase}/store/print-jobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          storeId: currentStore.id,
          station: job.station,
          peripheralId: job.peripheralId || undefined,
          content,
        }),
      });
      if (res.ok) {
        showNotification(`Trabalho reenviado para estação ${job.station}.`);
        await loadPeripheralsAndQueue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Não foi possível reenviar o trabalho.');
      }
    } catch {
      showNotification('Erro de rede ao reenviar impressão.');
    }
  };

  const ackPrintJob = async (job: StorePrintJobRecord, status: 'PRINTED' | 'FAILED') => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const res = await fetch(`${apiBase}/store/print-jobs/${encodeURIComponent(job.id)}/ack`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        showNotification(`Trabalho ${job.id.slice(0, 10)} marcado como ${status}.`);
        await loadPeripheralsAndQueue();
      }
    } catch {
      showNotification('Erro ao atualizar status de impressão.');
    }
  };

  const deletePeripheral = async (periph: StorePeripheralRecord) => {
    try {
      const headers = await buildStandardContractHeaders({ includeIdempotencyKey: true });
      const res = await fetch(`${apiBase}/store/peripherals/${encodeURIComponent(periph.id)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        showNotification(`Periférico "${periph.name}" removido.`);
        await loadPeripheralsAndQueue();
      } else {
        const err = await res.json().catch(() => ({}));
        showNotification(err.error || 'Erro ao remover periférico.');
      }
    } catch {
      showNotification('Erro ao excluir periférico.');
    }
  };

  return {
    peripherals,
    printJobs,
    loading,
    submitting,
    loadPeripheralsAndQueue,
    registerPeripheral,
    sendHeartbeat,
    enqueueTestPrint,
    retryPrintJob,
    ackPrintJob,
    deletePeripheral,
  };
}
