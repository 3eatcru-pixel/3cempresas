import React, { useMemo, useState } from 'react';
import { 
  Barcode, LayoutGrid, Zap, Clock, Monitor
} from 'lucide-react';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';

// Modular Hooks & Components
import { usePOSLogic } from './hooks/usePOSLogic';
import { POSCart } from './components/POSCart';
import { PosCashDrawerBanner } from './components/PosCashDrawerBanner';
import { POSRetailView } from './components/POSRetailView';
import { POSFoodView } from './components/POSFoodView';
import { POSServiceView } from './components/POSServiceView';
import { getStorePosMode, isMultiCommerceStore } from '../../../utils/storeDomain';
import { detectLocalTerminalInfo } from '../../../core/platform/PlatformAdapter';

export const POSApp: React.FC = () => {
  const logic = usePOSLogic();
  const [viewMode, setViewMode] = useState<'AUTO' | 'RETAIL' | 'FOOD' | 'SERVICE'>('AUTO');
  const localTerminal = useMemo(
    () =>
      detectLocalTerminalInfo({
        activeTransport: logic.isOffline ? 'OFFLINE' : undefined,
      }),
    [logic.isOffline]
  );

  const detectedMode = getStorePosMode(logic.currentStore);
  const activeMode = viewMode === 'AUTO' ? detectedMode : viewMode;
  const isMulti = isMultiCommerceStore(logic.currentStore);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full relative text-slate-100 animate-fadeIn">
      
      <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
           <div className="flex items-center gap-3">
             <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-500 border border-amber-500/20">
               <Zap size={20} className="fill-amber-500" />
             </div>
             <div>
               <h2 className="text-base font-black uppercase italic tracking-tighter leading-none flex flex-wrap items-center gap-2">
                 Terminal de Vendas
                 {localTerminal.isLocalTerminal && (
                   <span
                     title={localTerminal.detailLabel}
                     className="text-[9px] not-italic bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-lg font-mono font-bold inline-flex items-center gap-1"
                   >
                     <Monitor className="w-3 h-3 text-cyan-400" />
                     {localTerminal.label}
                   </span>
                 )}
                 {isMulti && (
                   <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full font-bold not-italic">
                     Modo Híbrido Multivendas
                   </span>
                 )}
                 {logic.isOffline && (
                   <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-md font-mono font-semibold not-italic">
                     OFFLINE
                   </span>
                 )}
               </h2>
               <p className="text-xs text-slate-400 mt-1">
                 {activeMode === 'RETAIL' ? 'Modo Varejo' : activeMode === 'FOOD' ? 'Modo Gastronomia' : 'Modo Serviços'}
                 {isMulti ? ' · Alterne livremente entre Gastronomia, Varejo e Serviços à direita' : ''}
               </p>
             </div>
           </div>

           <div className="flex items-center gap-2 flex-wrap">
             <PosCashDrawerBanner
               cashSession={logic.cashSession}
               operatorDefault={logic.operatorDefault}
               onOpenCashRegister={logic.openCashRegister}
             />
             <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-0.5">
               <button
                 type="button"
                 onClick={() => setViewMode('FOOD')}
                 title="Modo Gastronomia"
                 className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                   activeMode === 'FOOD' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                 }`}
               >
                 <LayoutGrid size={14} />
                 <span className="hidden sm:inline">Gastronomia</span>
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode('RETAIL')}
                 title="Modo Varejo"
                 className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                   activeMode === 'RETAIL' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                 }`}
               >
                 <Barcode size={14} />
                 <span className="hidden sm:inline">Varejo</span>
               </button>
               <button
                 type="button"
                 onClick={() => setViewMode('SERVICE')}
                 title="Modo Serviços"
                 className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                   activeMode === 'SERVICE' ? 'bg-blue-500 text-slate-950' : 'text-slate-400 hover:text-white'
                 }`}
               >
                 <Clock size={14} />
                 <span className="hidden sm:inline">Serviços</span>
               </button>
             </div>
           </div>
        </header>

        <div className="flex-1 overflow-hidden">
           {activeMode === 'RETAIL' && <POSRetailView logic={logic} />}
           {activeMode === 'FOOD' && <POSFoodView logic={logic} />}
           {activeMode === 'SERVICE' && <POSServiceView logic={logic} />}
        </div>
      </div>

      <div className="lg:col-span-1">
        <POSCart logic={logic} />
      </div>

      {logic.lastOrderForReceipt && (
        <ThermalReceiptModal
          isOpen={!!logic.lastOrderForReceipt}
          onClose={() => logic.setLastOrderForReceipt(null)}
          order={logic.lastOrderForReceipt}
          store={logic.currentStore}
        />
      )}
    </div>
  );
};
