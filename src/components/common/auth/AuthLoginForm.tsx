import React from 'react';
import { Mail, Lock } from 'lucide-react';
import { SURFACE_TOKENS } from '@3c/design-system';

interface AuthLoginFormProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  onForgotPassword: () => void;
  emailPlaceholder?: string;
  accentTextClass?: string;
}

export const AuthLoginForm: React.FC<AuthLoginFormProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  onForgotPassword,
  emailPlaceholder = 'exemplo@empresa.com',
  accentTextClass = 'text-amber-400',
}) => {
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Endereço de E-mail
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={emailPlaceholder}
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all`}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Senha de Acesso
          </label>
          <button
            type="button"
            onClick={onForgotPassword}
            className={`text-[11px] font-bold ${accentTextClass} hover:underline cursor-pointer`}
          >
            Esqueci minha senha
          </button>
        </div>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-all`}
          />
        </div>
      </div>
    </div>
  );
};
