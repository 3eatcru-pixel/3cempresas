import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Monitor,
  Printer,
  Scale,
  Send,
  Trash2,
  Usb,
  Wifi,
} from 'lucide-react';
import { StorePeripheralRecord } from '../StorePeripheralsManager';

interface StorePeripheralsGridProps {
  storeName: string;
  peripherals: StorePeripheralRecord[];
  onHeartbeat: (periph: StorePeripheralRecord) => void;
  onTestPrint: (periph: StorePeripheralRecord) => void;
  onDelete: (periph: StorePeripheralRecord) => void;
}

const getKindIcon = (k: StorePeripheralRecord['kind']) => {
  switch (k) {
    case 'SCALE':
      return <Scale className="w-4 h-4 text-sky-400" />;
    case 'CUSTOMER_DISPLAY':
    case 'KDS_SCREEN':
      return <Monitor className="w-4 h-4 text-purple-400" />;
    default:
      return <Printer className="w-4 h-4 text-amber-400" />;
  }
};

export const StorePeripheralsGrid: React.FC<StorePeripheralsGridProps> = ({
  storeName,
  peripherals,
  onHeartbeat,
  onTestPrint,
  onDelete,
}) => {
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<string | null>(null);

  if (peripherals.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center space-y-2">
        <Printer className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-xs font-bold text-slate-400">
          Nenhum periférico físico encontrado nesta seleção ({storeName}).
        </p>
        <p className="text-[11px] text-slate-500">
          Adicione impressoras térmicas LAN/USB ou balanças seriais para habilitar roteamento automático por estação.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {peripherals.map((periph) => {
        const isOnline = periph.status === 'ONLINE';
        const isConfirming = confirmingDeleteId === periph.id;
        return (
          <div
            key={periph.id}
            className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                  {getKindIcon(periph.kind)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-black text-white truncate">{periph.name}</span>
                    {periph.isDefault && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[8px] font-black uppercase">
                        Padrão
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                    <span>{periph.station}</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      {periph.connectionType === 'LAN_RAW_9100' ? (
                        <Wifi className="w-3 h-3 text-sky-400" />
                      ) : periph.connectionType === 'USB_DEVICE' ? (
                        <Usb className="w-3 h-3 text-amber-400" />
                      ) : (
                        <Cpu className="w-3 h-3 text-purple-400" />
                      )}
                      {periph.host
                        ? `${periph.host}:${periph.port || 9100}`
                        : periph.devicePath || periph.connectionType}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 shrink-0 ${
                  isOnline
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {isOnline ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                {periph.status || 'CONFIGURED'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-500 font-mono tabular-nums truncate">
                {periph.lastHeartbeatAt
                  ? `Heartbeat: ${new Date(periph.lastHeartbeatAt).toLocaleTimeString('pt-BR')}`
                  : 'Aguardando diagnóstico'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onHeartbeat(periph)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  title="Verificar conexão (Heartbeat)"
                >
                  <Activity className="w-3 h-3 text-emerald-400" /> Ping
                </button>
                {periph.kind === 'PRINTER' && (
                  <button
                    type="button"
                    onClick={() => onTestPrint(periph)}
                    className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    title="Disparar página de teste na fila ESC/POS"
                  >
                    <Send className="w-3 h-3" /> Teste ESC/POS
                  </button>
                )}
                {isConfirming ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDeleteId(null);
                        onDelete(periph);
                      }}
                      className="px-2 py-1 bg-rose-500 hover:bg-rose-400 text-slate-950 rounded-lg text-[10px] font-black uppercase cursor-pointer"
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDeleteId(null)}
                      className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
                    >
                      Não
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(periph.id)}
                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg cursor-pointer"
                    title="Remover periférico"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
