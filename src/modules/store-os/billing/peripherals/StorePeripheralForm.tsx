import React from 'react';
import { StorePeripheralRecord } from '../StorePeripheralsManager';

interface StorePeripheralFormProps {
  name: string;
  onChangeName: (v: string) => void;
  kind: StorePeripheralRecord['kind'];
  onChangeKind: (nextKind: StorePeripheralRecord['kind']) => void;
  station: StorePeripheralRecord['station'];
  onChangeStation: (v: StorePeripheralRecord['station']) => void;
  connectionType: StorePeripheralRecord['connectionType'];
  onChangeConnectionType: (v: StorePeripheralRecord['connectionType']) => void;
  host: string;
  onChangeHost: (v: string) => void;
  port: string;
  onChangePort: (v: string) => void;
  devicePath: string;
  onChangeDevicePath: (v: string) => void;
  paperWidthMm: 58 | 80;
  onChangePaperWidthMm: (v: 58 | 80) => void;
  isDefault: boolean;
  onChangeIsDefault: (v: boolean) => void;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const StorePeripheralForm: React.FC<StorePeripheralFormProps> = ({
  name,
  onChangeName,
  kind,
  onChangeKind,
  station,
  onChangeStation,
  connectionType,
  onChangeConnectionType,
  host,
  onChangeHost,
  port,
  onChangePort,
  devicePath,
  onChangeDevicePath,
  paperWidthMm,
  onChangePaperWidthMm,
  isDefault,
  onChangeIsDefault,
  submitting,
  onCancel,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end"
    >
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-slate-400">Nome do Equipamento *</label>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Ex: Epson TM-T20X Caixa 01"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Hardware</label>
        <select
          value={kind}
          onChange={(e) => onChangeKind(e.target.value as StorePeripheralRecord['kind'])}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
        >
          <option value="PRINTER">Impressora Térmica ESC/POS</option>
          <option value="SCALE">Balança Serial (Toledo / Filizola)</option>
          <option value="CUSTOMER_DISPLAY">Display de Cliente</option>
          <option value="KDS_SCREEN">Monitor KDS Dedicado</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-slate-400">Estação Operacional</label>
        <select
          value={station}
          onChange={(e) => onChangeStation(e.target.value as StorePeripheralRecord['station'])}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
        >
          <option value="CASHIER">Frente de Caixa (PDV)</option>
          <option value="KITCHEN">Cozinha Principal</option>
          <option value="BAR">Bar / Copa</option>
          <option value="EXPEDITION">Expedição / Delivery</option>
          <option value="COUNTER">Balcão</option>
          <option value="ALL">Todas as Estações</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-slate-400">Interface de Conexão</label>
        <select
          value={connectionType}
          onChange={(e) =>
            onChangeConnectionType(e.target.value as StorePeripheralRecord['connectionType'])
          }
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
        >
          <option value="LAN_RAW_9100">Rede LAN TCP/IP (Porta 9100)</option>
          <option value="USB_DEVICE">USB Direto / Spooler</option>
          <option value="SERIAL_COM">Porta Serial (RS-232 / COM)</option>
          <option value="BLUETOOTH">Bluetooth</option>
          <option value="BROWSER">Impressão Navegador (Fallback)</option>
        </select>
      </div>

      {connectionType === 'LAN_RAW_9100' ? (
        <>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Endereço IP / Host *</label>
            <input
              type="text"
              required
              value={host}
              onChange={(e) => onChangeHost(e.target.value)}
              placeholder="192.168.1.200"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Porta TCP</label>
            <input
              type="number"
              value={port}
              onChange={(e) => onChangePort(e.target.value)}
              placeholder="9100"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
            />
          </div>
        </>
      ) : (
        <div className="space-y-1 sm:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-400">Caminho Porta / Dispositivo</label>
          <input
            type="text"
            value={devicePath}
            onChange={(e) => onChangeDevicePath(e.target.value)}
            placeholder="Ex: COM3 ou /dev/ttyUSB0"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
          />
        </div>
      )}

      {kind === 'PRINTER' && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase text-slate-400">Bobina Térmica</label>
          <select
            value={paperWidthMm}
            onChange={(e) => onChangePaperWidthMm(Number(e.target.value) as 58 | 80)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
          >
            <option value={80}>80mm (Padrão Fiscal/Cozinha)</option>
            <option value={58}>58mm (Compacta)</option>
          </select>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 sm:col-span-2 lg:col-span-1">
        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => onChangeIsDefault(e.target.checked)}
            className="accent-amber-500"
          />
          <span>Padrão da Estação</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </form>
  );
};
