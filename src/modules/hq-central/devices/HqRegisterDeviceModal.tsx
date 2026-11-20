import React from 'react';
import { Laptop } from 'lucide-react';
import { PILLAR_THEMES, STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import type { Store } from '../../../types';

export interface NewDeviceFormState {
  name: string;
  storeId: string;
  type: 'POS' | 'KDS' | 'WAITER' | 'PRINTER';
  deviceId: string;
}

interface HqRegisterDeviceModalProps {
  stores: Store[];
  newDevice: NewDeviceFormState;
  onChange: (next: NewDeviceFormState) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqRegisterDeviceModal: React.FC<HqRegisterDeviceModalProps> = ({
  stores,
  newDevice,
  onChange,
  onClose,
  onSubmit,
}) => {
  const storeTheme = PILLAR_THEMES['store-os'];
  const warningToken = STATUS_COLORS.WARNING;
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className={`${surface.elevatedBg} border ${surface.border} rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200`}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-base flex items-center gap-2 uppercase tracking-tighter italic">
            <Laptop className={`w-5 h-5 ${storeTheme.accentTextClass}`} />
            Registrar Novo Terminal
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Nome do Terminal</label>
            <input
              type="text"
              required
              placeholder="Ex: Terminal PDV Principal"
              value={newDevice.name}
              onChange={(e) => onChange({ ...newDevice, name: e.target.value })}
              className={`w-full ${surface.canvasBg} border ${surface.border} text-xs text-white p-3 rounded-xl focus:border-amber-500 outline-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Tipo de Hardware</label>
              <select
                value={newDevice.type}
                onChange={(e) => onChange({ ...newDevice, type: e.target.value as NewDeviceFormState['type'] })}
                className={`w-full ${surface.canvasBg} border ${surface.border} text-xs text-white p-3 rounded-xl font-bold focus:border-amber-500 outline-none cursor-pointer`}
              >
                <option value="POS">PDV / Caixa</option>
                <option value="KDS">KDS Cozinha</option>
                <option value="WAITER">Comanda Garçom</option>
                <option value="PRINTER">Spooler Impressora</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Estabelecimento</label>
              <select
                value={newDevice.storeId}
                onChange={(e) => onChange({ ...newDevice, storeId: e.target.value })}
                className={`w-full ${surface.canvasBg} border ${surface.border} text-xs text-white p-3 rounded-xl font-bold focus:border-amber-500 outline-none cursor-pointer`}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">MAC / Serial (Opcional)</label>
            <input
              type="text"
              placeholder="Deixe em branco para gerar ID automático"
              value={newDevice.deviceId}
              onChange={(e) => onChange({ ...newDevice, deviceId: e.target.value })}
              className={`w-full ${surface.canvasBg} border ${surface.border} text-[11px] font-mono text-white p-3 rounded-xl focus:border-amber-500 outline-none`}
            />
          </div>

          <div className={`p-3 ${warningToken.bgClass} border ${warningToken.borderClass} rounded-xl text-[10px] ${warningToken.textClass}`}>
            O terminal será gerado com status <strong>PENDING_PAIRING</strong> e um código criptográfico de uso único (TTL 15 min) emitido pelo Server Core.
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`flex-[2] px-4 py-3 ${storeTheme.accentBgClass} hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer`}
          >
            Gerar Licença
          </button>
        </div>
      </form>
    </div>
  );
};
