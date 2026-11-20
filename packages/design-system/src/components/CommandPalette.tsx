import React, { useState, useEffect, useRef } from 'react';
import { Search, Zap, Command, ArrowRight } from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAction: (id: string, title: string) => void;
  apps: { id: string; title: string; icon: any; category: string }[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onRunAction, apps }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredApps = apps.filter(
    (app) =>
      app.title.toLowerCase().includes(search.toLowerCase()) ||
      app.category.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredApps.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredApps.length) % (filteredApps.length || 1));
      } else if (e.key === 'Enter') {
        if (filteredApps[selectedIndex]) {
          onRunAction(filteredApps[selectedIndex].id, filteredApps[selectedIndex].title);
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredApps, selectedIndex, onRunAction, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/40 backdrop-blur-sm flex items-start justify-center pt-24 px-4 animate-fadeIn">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <Search className="w-5 h-5 text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="O que você deseja fazer no 3C OS? (Apps, Comandos...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-slate-600"
          />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-black text-slate-400">
            <span className="text-[12px] font-sans">⎋</span> ESC
          </div>
        </div>

        <div className="max-h-[350px] overflow-y-auto py-2 custom-scrollbar">
          {filteredApps.length > 0 ? (
            filteredApps.map((app, i) => (
              <button
                key={app.id}
                onClick={() => {
                  onRunAction(app.id, app.title);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center justify-between px-5 py-3 transition-colors text-left ${
                  i === selectedIndex ? 'bg-amber-500/10' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2 rounded-xl border ${
                      i === selectedIndex
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <app.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div
                      className={`text-xs font-black uppercase tracking-tight ${
                        i === selectedIndex ? 'text-white' : 'text-slate-300'
                      }`}
                    >
                      {app.title}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {app.category}
                    </div>
                  </div>
                </div>
                {i === selectedIndex && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-amber-500/80 uppercase">Executar</span>
                    <ArrowRight className="w-4 h-4 text-amber-500" />
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="p-10 text-center space-y-2 opacity-30">
              <Zap className="w-8 h-8 mx-auto text-slate-500" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma ferramenta encontrada</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[9px] text-slate-600 font-bold uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Command className="w-3 h-3" /> NAVEGAR
            </span>
            <span className="flex items-center gap-1">↩ SELECIONAR</span>
          </div>
          <div>3C COMMERCE OS v5.2.1 • BRASIL</div>
        </div>
      </div>
    </div>
  );
};
