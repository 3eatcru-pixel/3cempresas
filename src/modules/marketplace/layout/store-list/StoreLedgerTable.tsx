import React from 'react';
import { Star, ShieldCheck } from 'lucide-react';
import { Store } from '../../../../types';

interface StoreLedgerTableProps {
  stores: Store[];
  getEffectiveFee: (store: Store) => number;
  onOpenStore: (slug: string) => void;
}

export const StoreLedgerTable: React.FC<StoreLedgerTableProps> = ({
  stores,
  getEffectiveFee,
  onOpenStore,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden shadow-2xl">
      <table className="w-full text-left text-xs font-medium">
        <thead className="bg-slate-950 text-slate-500 font-black uppercase tracking-[0.2em] text-[9px]">
          <tr>
            <th className="p-6 border-b border-slate-800">Estabelecimento</th>
            <th className="p-6 border-b border-slate-800">Segmento</th>
            <th className="p-6 border-b border-slate-800">Performance</th>
            <th className="p-6 border-b border-slate-800">Logística / Atendimento</th>
            <th className="p-6 border-b border-slate-800">Custo</th>
            <th className="p-6 border-b border-slate-800 text-right">Ação</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {stores.map((store) => {
            const fee = getEffectiveFee(store);
            return (
              <tr
                key={store.id}
                className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                onClick={() => onOpenStore(store.slug)}
              >
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <img
                      src={store.logo}
                      alt=""
                      className="w-10 h-10 rounded-2xl object-cover shadow-lg border border-slate-800"
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-200 group-hover:text-amber-400 transition-colors uppercase tracking-tight italic text-sm">
                          {store.name}
                        </span>
                        {store.isOpen === false && (
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[8px] font-black uppercase">
                            Fechada
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">
                        {store.address}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="p-6">
                  <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-[9px] text-slate-400 font-black uppercase tracking-widest">
                    {store.category}
                  </span>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-1.5 font-bold text-amber-500">
                    <Star size={14} className="fill-amber-500" />
                    <span>{store.rating.toFixed(1)}</span>
                  </div>
                </td>
                <td className="p-6 font-mono text-slate-400 text-[11px]">
                  {['SERVICES', 'BEAUTY'].includes(store.category)
                    ? 'AGENDAMENTO'
                    : `${store.deliveryTimeMin} MIN EST.`}
                </td>
                <td className="p-6 font-mono text-emerald-500 font-bold">
                  {['SERVICES', 'BEAUTY'].includes(store.category)
                    ? 'SEM FRETE'
                    : fee === 0
                    ? 'GRÁTIS'
                    : `R$ ${fee.toFixed(2)}`}
                </td>
                <td className="p-6 text-right">
                  <button className="p-3 bg-slate-800 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-all shadow-md cursor-pointer">
                    <ShieldCheck size={16} strokeWidth={2.5} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
