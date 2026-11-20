import React from 'react';
import { QrCode } from 'lucide-react';
import { Store } from '../../../types';
import { LocalQrCode } from '../../../components/common/LocalQrCode';

interface ShowcaseSelfServiceTabProps {
  store: Store;
  modalTable: number;
  setModalTable: (table: number) => void;
  onSelectTable: (table: number) => void;
}

export const ShowcaseSelfServiceTab: React.FC<ShowcaseSelfServiceTabProps> = ({
  store,
  modalTable,
  setModalTable,
  onSelectTable,
}) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-5 max-w-xl mx-auto text-center shadow-lg animate-fadeIn">
      <div className="space-y-1">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
          <QrCode className="w-7 h-7" />
        </div>
        <h3 className="text-base font-black text-stone-900 uppercase tracking-tight">Autoatendimento na Mesa</h3>
        <p className="text-xs text-stone-500">
          Peça diretamente da sua mesa em <strong className="text-stone-800">{store.name}</strong> pelo celular com comanda digital.
        </p>
      </div>

      {/* Table Selector */}
      <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-left">
        <div className="flex justify-between items-center text-xs font-bold text-stone-700">
          <span>Sua Mesa no Salão:</span>
          <span className="font-mono text-amber-600 bg-amber-100 px-2 py-0.5 rounded font-black">
            MESA {String(modalTable).padStart(2, '0')}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setModalTable(n)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modalTable === n
                  ? 'bg-amber-500 text-slate-950 shadow font-black'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-amber-400'
              }`}
            >
              Mesa {n}
            </button>
          ))}
        </div>
      </div>

      {/* QR Code */}
      <div className="w-32 h-32 bg-white p-2 rounded-2xl border border-stone-300 mx-auto flex items-center justify-center shadow">
        <LocalQrCode
          value={`https://${store.slug}.3c-os.com/mesa/${modalTable}`}
          size={110}
          fgColor="#020617"
          bgColor="#ffffff"
        />
      </div>

      <button
        type="button"
        onClick={() => onSelectTable(modalTable)}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <span>Fazer Pedido para Mesa {modalTable}</span>
      </button>
    </div>
  );
};
