import React from 'react';
import { QrCode, Printer, X, Sparkles } from 'lucide-react';
import { Store, DiningTable } from '../../../../types';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';

interface TableQrSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: Store;
  tables: DiningTable[];
}

export const TableQrSheetModal: React.FC<TableQrSheetModalProps> = ({
  isOpen,
  onClose,
  currentStore,
  tables,
}) => {
  if (!isOpen) return null;
  const origin = getPlatformAdapters().links.getOrigin();

  const handlePrintA4 = () => {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    } else {
      void getPlatformAdapters().printer.printEscPosText(`QR Mesas - ${currentStore.name}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl my-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-white text-base">
                Etiquetas de QR Code para as Mesas do Salão
              </h3>
              <p className="text-xs text-slate-400">
                Gere e imprima as etiquetas para os clientes pedirem direto da mesa sem esperar o
                garçom.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintA4}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:from-amber-400 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Folha A4</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Stickers Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
          {tables.map((t) => {
            const tableUrl = `${origin}/?store=${encodeURIComponent(currentStore.slug || currentStore.id)}&mesa=${t.tableNumber}`;
            return (
              <div
                key={t.id}
                className="bg-white text-slate-950 p-5 rounded-2xl border-2 border-slate-300 shadow-md text-center flex flex-col justify-between items-center space-y-3"
              >
                <div className="space-y-0.5">
                  <div className="text-[10px] font-black tracking-widest uppercase text-amber-600">
                    3C Commerce OS • {currentStore.name}
                  </div>
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    MESA #{t.tableNumber}
                  </div>
                </div>

                {/* Scannable Offline-Safe QR Code */}
                <div className="w-28 h-28 bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-center shadow-inner">
                  <LocalQrCode
                    value={tableUrl}
                    size={96}
                    darkColor="#020617"
                    lightColor="#ffffff"
                    alt={`QR Code Mesa ${t.tableNumber}`}
                    className="w-24 h-24 rounded-md"
                  />
                </div>

                <p className="text-[9px] text-slate-600 leading-tight font-medium">
                  Aponte a câmera do celular para ver o cardápio e fazer seu pedido na mesa.
                </p>

                <div className="text-[8px] font-mono font-bold text-slate-400 uppercase truncate max-w-full">
                  ?store={currentStore.slug || currentStore.id}&mesa={t.tableNumber}
                </div>
              </div>
            );
          })}
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Sparkles className="w-4 h-4" /> Giro de mesa 35% mais rápido
          </span>
          <span>Os pedidos caem direto no KDS da cozinha sem precisar de intervenção manual</span>
        </div>
      </div>
    </div>
  );
};
