import React from 'react';
import { Store } from '../../../types';

interface ShowcaseMultivendasBarProps {
  store: Store;
  segmentFilter: 'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE';
  onSelectSegment: (segment: 'ALL' | 'FOOD' | 'RETAIL' | 'SERVICE') => void;
  isLightMode: boolean;
  primaryColor: string;
}

export const ShowcaseMultivendasBar: React.FC<ShowcaseMultivendasBarProps> = ({
  store,
  segmentFilter,
  onSelectSegment,
  isLightMode,
  primaryColor,
}) => {
  const customSections = store.showcaseTemplate?.customSections;

  const segments = [
    { id: 'ALL' as const, label: 'Tudo', enabled: true },
    { id: 'FOOD' as const, label: '🍔 Comidas', enabled: customSections?.showFoodSection !== false },
    { id: 'RETAIL' as const, label: '🛍️ Varejo & Tech', enabled: customSections?.showRetailSection !== false },
    { id: 'SERVICE' as const, label: '✂️ Serviços', enabled: customSections?.showServicesSection !== false },
  ].filter((s) => s.enabled);

  return (
    <div
      className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isLightMode ? 'bg-white border-stone-200' : 'bg-slate-900/70 border-slate-800'
      }`}
    >
      <div>
        <div className={`text-xs font-black uppercase tracking-wider ${isLightMode ? 'text-stone-900' : 'text-white'}`}>
          {customSections?.title || 'Vitrine Multivendas Híbrida 360°'}
        </div>
        <div className="text-[11px] text-slate-400">
          Combine comidas, eletrônicos/varejo e agendamentos de serviços na mesma loja.
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {segments.map((seg) => (
          <button
            key={seg.id}
            type="button"
            onClick={() => onSelectSegment(seg.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
              segmentFilter === seg.id
                ? 'text-slate-950 shadow-md'
                : isLightMode
                ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
            style={segmentFilter === seg.id ? { backgroundColor: primaryColor } : undefined}
          >
            {seg.label}
          </button>
        ))}
      </div>
    </div>
  );
};
