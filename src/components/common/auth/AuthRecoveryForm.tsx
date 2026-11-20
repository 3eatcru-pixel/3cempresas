import React from 'react';
import { KeyRound, Mail, Lock } from 'lucide-react';
import { PILLAR_THEMES, SURFACE_TOKENS } from '@3c/design-system';

interface AuthRecoveryFormProps {
  recoveryStep: 'request' | 'reset';
  email: string;
  setEmail: (val: string) => void;
  recoveryCode: string;
  setRecoveryCode: (val: string) => void;
  recoveryNewPassword: string;
  setRecoveryNewPassword: (val: string) => void;
  onBackToLogin: () => void;
  onGoToReset: () => void;
}

export const AuthRecoveryForm: React.FC<AuthRecoveryFormProps> = ({
  recoveryStep,
  email,
  setEmail,
  recoveryCode,
  setRecoveryCode,
  recoveryNewPassword,
  setRecoveryNewPassword,
  onBackToLogin,
  onGoToReset,
}) => {
  const storeTheme = PILLAR_THEMES['store-os'];
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Endereço de E-mail da Conta
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="exemplo@empresa.com"
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all`}
          />
        </div>
      </div>

      <div className={`space-y-3 p-3.5 rounded-2xl ${surface.canvasBg} border ${surface.border}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-black ${storeTheme.accentTextClass} uppercase tracking-wider flex items-center gap-1.5`}>
            <KeyRound className="w-3.5 h-3.5" /> Recuperação de Senha
          </span>
          <button
            type="button"
            onClick={onBackToLogin}
            className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
          >
            Voltar ao Login
          </button>
        </div>

        {recoveryStep === 'reset' && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Código de Recuperação
              </label>
              <input
                type="text"
                required
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="Ex: A1B2C3D4"
                className={`w-full px-3 py-2.5 ${surface.elevatedBg} border border-slate-700 rounded-xl text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-500`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Nova Senha (mín. 8 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-9 pr-3 py-2.5 ${surface.elevatedBg} border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500`}
                />
              </div>
            </div>
          </>
        )}

        {recoveryStep === 'request' && (
          <button
            type="button"
            onClick={onGoToReset}
            className="text-[10px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer"
          >
            Já possuo um código de recuperação
          </button>
        )}
      </div>
    </div>
  );
};
