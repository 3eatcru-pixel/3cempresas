import React, { useState } from 'react';
import { Plus, Printer, RefreshCw } from 'lucide-react';
import { Store } from '../../../types';
import { useEcosystem } from '../../../context/EcosystemContext';
import { StorePeripheralForm } from './peripherals/StorePeripheralForm';
import { StorePeripheralsGrid } from './peripherals/StorePeripheralsGrid';
import { StorePrintJobsQueue } from './peripherals/StorePrintJobsQueue';
import { useStorePeripherals } from './peripherals/useStorePeripherals';

export interface StorePeripheralRecord {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  kind: 'PRINTER' | 'SCALE' | 'CUSTOMER_DISPLAY' | 'KDS_SCREEN';
  connectionType: 'LAN_RAW_9100' | 'USB_DEVICE' | 'BLUETOOTH' | 'SERIAL_COM' | 'BROWSER';
  station: 'CASHIER' | 'KITCHEN' | 'BAR' | 'EXPEDITION' | 'COUNTER' | 'ALL';
  host?: string | null;
  port?: number | null;
  devicePath?: string | null;
  baudRate?: number | null;
  paperWidthMm?: number | null;
  autoCut?: boolean;
  isDefault?: boolean;
  active?: boolean;
  status?: string;
  lastHeartbeatAt?: string | null;
  lastError?: string | null;
  lastWeightKg?: number | null;
}

export interface StorePrintJobRecord {
  id: string;
  storeId: string;
  station: string;
  peripheralId?: string | null;
  peripheralName?: string | null;
  connectionType?: string;
  routingMode?: string;
  status: 'QUEUED' | 'DISPATCHED' | 'PRINTED' | 'FAILED';
  bytes?: number;
  attempts?: number;
  createdAt: string;
  printedAt?: string | null;
  lastError?: string | null;
}

interface StorePeripheralsManagerProps {
  currentStore: Store;
}

const STATIONS: Array<{ id: string; label: string }> = [
  { id: 'ALL', label: 'Todas' },
  { id: 'CASHIER', label: 'Caixa' },
  { id: 'KITCHEN', label: 'Cozinha' },
  { id: 'BAR', label: 'Bar' },
  { id: 'EXPEDITION', label: 'Expedição' },
  { id: 'COUNTER', label: 'Balcão' },
];

export const StorePeripheralsManager: React.FC<StorePeripheralsManagerProps> = ({
  currentStore,
}) => {
  const { showNotification } = useEcosystem();
  const {
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
  } = useStorePeripherals(currentStore, showNotification);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stationFilter, setStationFilter] = useState<string>('ALL');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StorePeripheralRecord['kind']>('PRINTER');
  const [station, setStation] = useState<StorePeripheralRecord['station']>('CASHIER');
  const [connectionType, setConnectionType] =
    useState<StorePeripheralRecord['connectionType']>('LAN_RAW_9100');
  const [host, setHost] = useState('192.168.1.200');
  const [port, setPort] = useState('9100');
  const [devicePath, setDevicePath] = useState('COM3');
  const [paperWidthMm, setPaperWidthMm] = useState<58 | 80>(80);
  const [isDefault, setIsDefault] = useState(true);

  const handleRegisterPeripheral = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await registerPeripheral({
      name,
      kind,
      station,
      connectionType,
      host,
      port,
      devicePath,
      paperWidthMm,
      isDefault,
    });
    if (ok) {
      setName('');
      setIsFormOpen(false);
    }
  };

  const visiblePeripherals =
    stationFilter === 'ALL'
      ? peripherals
      : peripherals.filter((p) => p.station === stationFilter || p.station === 'ALL');

  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h4 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Printer className="w-4 h-4 text-amber-400" />
            <span>
              Gerenciador de Periféricos &amp; Fila de Impressão (
              <span className="font-mono tabular-nums">{peripherals.length}</span>)
            </span>
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Cadastre e monitore impressoras térmicas ESC/POS (LAN 9100 / USB), balanças seriais e displays por estação operacional.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPeripheralsAndQueue()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 cursor-pointer"
            title="Atualizar periféricos e fila"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Periférico
          </button>
        </div>
      </div>

      {peripherals.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {STATIONS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStationFilter(st.id)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                stationFilter === st.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      )}

      {isFormOpen && (
        <StorePeripheralForm
          name={name}
          onChangeName={setName}
          kind={kind}
          onChangeKind={(nextKind) => {
            setKind(nextKind);
            if (nextKind === 'SCALE') setConnectionType('SERIAL_COM');
            else if (nextKind === 'PRINTER') setConnectionType('LAN_RAW_9100');
          }}
          station={station}
          onChangeStation={setStation}
          connectionType={connectionType}
          onChangeConnectionType={setConnectionType}
          host={host}
          onChangeHost={setHost}
          port={port}
          onChangePort={setPort}
          devicePath={devicePath}
          onChangeDevicePath={setDevicePath}
          paperWidthMm={paperWidthMm}
          onChangePaperWidthMm={setPaperWidthMm}
          isDefault={isDefault}
          onChangeIsDefault={setIsDefault}
          submitting={submitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleRegisterPeripheral}
        />
      )}

      <StorePeripheralsGrid
        storeName={currentStore.name}
        peripherals={visiblePeripherals}
        onHeartbeat={(p) => void sendHeartbeat(p)}
        onTestPrint={(p) => void enqueueTestPrint(p)}
        onDelete={(p) => void deletePeripheral(p)}
      />

      <StorePrintJobsQueue
        printJobs={printJobs}
        onAckPrintJob={(job, status) => void ackPrintJob(job, status)}
        onRetryPrintJob={(job) => void retryPrintJob(job)}
      />
    </div>
  );
};
