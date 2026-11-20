import React from 'react';
import { Bike, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { FulfillmentModality } from '../../../utils/storeDomain';

interface ModalitySelectorProps {
  activeModality: FulfillmentModality;
  updateModality: (m: FulfillmentModality) => void;
  activeTable: number;
  updateTable: (t: number) => void;
  currentStoreAddress: string;
  allowedModalities?: FulfillmentModality[];
}

export const ModalitySelector: React.FC<ModalitySelectorProps> = ({
  activeModality,
  updateModality,
  activeTable,
  updateTable,
  currentStoreAddress,
  allowedModalities = ['DELIVERY', 'PICKUP', 'TABLE'],
}) => {
  const options = [
    { id: 'DELIVERY' as const, label: 'Delivery', icon: Bike },
    { id: 'PICKUP' as const, label: 'Retirada', icon: ShoppingBag },
    { id: 'TABLE' as const, label: 'Na Mesa', icon: UtensilsCrossed }
  ].filter(m => allowedModalities.includes(m.id));

  const gridColsClass =
    options.length === 1 ? 'grid-cols-1' : options.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <div className="space-y-4">
      {/* Modalidade de Consumo / Atendimento */}
      <div className="space-y-1.5">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          Como deseja receber / consumir:
        </label>
        <div className={`grid ${gridColsClass} gap-2`}>
          {options.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => updateModality(m.id)}
              className={`p-2.5 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                activeModality === m.id
                  ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-md'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <m.icon className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-wider">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Local / Mesa de Consumo */}
      {activeModality === 'TABLE' && allowedModalities.includes('TABLE') && (
        <div className="space-y-2 p-3 bg-slate-950/90 rounded-2xl border border-amber-500/30">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5" /> Número da Sua Mesa (Autoatendimento)
            </label>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Taxa: R$ 0,00
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            O pedido é enviado diretamente para a cozinha e vinculado à sua comanda na mesa (sem entrega/motoboy).
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Mesa:</span>
            <input
              type="number"
              min={1}
              max={99}
              value={activeTable}
              onChange={e => updateTable(parseInt(e.target.value) || 1)}
              className="w-16 bg-slate-900 border border-slate-700 text-sm font-black text-amber-400 p-1.5 rounded-xl text-center font-mono focus:outline-none"
            />
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[1, 2, 3, 4, 5, 8, 12].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateTable(n)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    activeTable === n ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Mesa {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeModality === 'PICKUP' && (
        <div className="p-3 bg-slate-950/90 rounded-2xl border border-blue-500/30 space-y-1">
          <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> Retirada no Balcão / Loja
          </div>
          <p className="text-xs text-white font-medium">{currentStoreAddress}</p>
          <p className="text-[10px] text-slate-400">Sem taxa de entrega. Retire diretamente no balcão ao ficar pronto.</p>
        </div>
      )}
    </div>
  );
};
