import React from 'react';
import { Printer, X } from 'lucide-react';

interface ThermalModalHeaderControlsProps {
  paperWidth: '80mm' | '58mm';
  setPaperWidth: (w: '80mm' | '58mm') => void;
  onClose: () => void;
}

export const ThermalModalHeaderControls: React.FC<ThermalModalHeaderControlsProps> = ({
  paperWidth,
  setPaperWidth,
  onClose,
}) => {
  return (
    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
      <div className="flex items-center gap-2">
        <Printer className="w-5 h-5 text-amber-400" />
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight">
            Emissor de Cupom Térmico (ESC/POS)
          </h3>
          <p className="text-[10px] text-slate-400">
            Zero Spooler • Impressão Direta sem Drivers Extras
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-bold font-mono">
          <button
            onClick={() => setPaperWidth('80mm')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              paperWidth === '80mm'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            80mm
          </button>
          <button
            onClick={() => setPaperWidth('58mm')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              paperWidth === '58mm'
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            58mm
          </button>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
