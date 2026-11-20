import React from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { Sun, Moon, ShieldAlert, X } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { BrandLogo } from '../common/BrandLogo';

export const Header: React.FC = () => {
  const {
    setActiveSection,
    isDarkMode, toggleDarkMode,
    activeNotification,
  } = useEcosystem();
  const { authNotice, clearAuthNotice } = useAuth();
  const brandTheme = PILLAR_THEMES['store-os'];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveSection('portal')}
            className="cursor-pointer hover:opacity-90 transition-opacity rounded-lg"
            title="Ir para a página inicial"
          >
            <BrandLogo id="portal" size="sm" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleDarkMode}
            className={`p-1.5 text-slate-400 ${brandTheme.hoverTextClass} hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors cursor-pointer`}
            title="Alternar Tema Claro/Escuro"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Security / Session Notice Banner */}
      {authNotice && (
        <div className="bg-amber-600 text-slate-950 text-xs font-bold px-4 py-1.5 flex items-center justify-center gap-3 animate-fadeIn">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{authNotice}</span>
          <button
            type="button"
            onClick={clearAuthNotice}
            className="p-0.5 rounded hover:bg-slate-950/15 cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Notification Toast Bar */}
      {activeNotification && (
        <div className="bg-emerald-600 text-white text-xs font-medium px-4 py-1.5 text-center flex items-center justify-center gap-2 animate-fadeIn">
          <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping" />
          <span>{activeNotification}</span>
        </div>
      )}
    </header>
  );
};
