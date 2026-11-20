import React from 'react';
import { Sparkles } from 'lucide-react';

interface AiDiscoverySectionProps {
  loading: boolean;
  response: string | null;
  onSelectStore: (slug: string) => void;
}

export const AiDiscoverySection: React.FC<AiDiscoverySectionProps> = ({
  loading,
  response,
  onSelectStore
}) => {
  if (!loading && !response) return null;

  return (
    <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border border-indigo-500/20 rounded-3xl p-6 shadow-2xl animate-fadeIn relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
        <Sparkles size={120} className="text-amber-500" />
      </div>

      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500 border border-amber-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Análise de Descoberta IA 3C-OS</h3>
            <p className="text-[10px] text-slate-400 font-bold">Baseado no seu desejo e geolocalização na sua cidade</p>
          </div>
        </div>

        {loading ? (
          <div className="py-4 space-y-3">
            <div className="h-4 bg-slate-800 rounded-full w-3/4 animate-pulse" />
            <div className="h-4 bg-slate-800 rounded-full w-1/2 animate-pulse" />
            <p className="text-[11px] text-slate-500 font-mono italic">Processando semântica de busca com Gemini 3.8 Flash...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-200 leading-relaxed font-medium">
              {response}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] font-black rounded-lg border border-amber-500/20 uppercase">Sugestão Contextual Ativa</span>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-lg border border-emerald-500/20 uppercase">Lojas Próximas Validadas</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
