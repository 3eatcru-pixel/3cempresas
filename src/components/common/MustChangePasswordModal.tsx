import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOptionalEcosystem } from '../../context/EcosystemContext';
import { Lock, KeyRound, AlertCircle, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { BrandMark } from './BrandLogo';

export const MustChangePasswordModal: React.FC = () => {
  const { profile, changePassword, logout } = useAuth();
  const eco = useOptionalEcosystem();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!profile?.mustChangePassword || !profile?.uid) {
    return null;
  }

  const isDevOwner = profile.email?.toLowerCase() === '3eatcru@gmail.com' || profile.role === 'DEV_OWNER';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!currentPassword) {
      setErrorMsg('Informe sua senha atual de primeiro acesso.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setErrorMsg('A nova senha deve possuir no mínimo 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('A confirmação da nova senha não confere.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMsg('A nova senha deve ser diferente da senha temporária inicial.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      eco?.showNotification?.('Senha definitiva configurada com sucesso! Acesso liberado.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao alterar senha. Verifique a senha atual digitada.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10 space-y-6 text-slate-100">
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <BrandMark
              id={
                isDevOwner
                  ? 'hq'
                  : profile.role === 'CUSTOMER'
                  ? 'marketplace'
                  : profile.role === 'COURIER' || profile.role === 'DRIVER'
                  ? 'driver'
                  : profile.role === 'WAITER'
                  ? 'waiter'
                  : 'store-os'
              }
              size="lg"
              className="mx-auto"
            />
            <div className="absolute -bottom-1 -right-1 p-1 bg-amber-500 text-slate-950 rounded-full shadow">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] font-black uppercase tracking-wider text-amber-400">
            <KeyRound className="w-3.5 h-3.5" /> Primeiro Acesso • Troca Obrigatória
          </div>

          <h3 className="text-xl font-black text-white tracking-tight">
            Defina sua Senha Definitiva
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
            {isDevOwner ? (
              <>
                Olá, <strong className="text-white">{profile.email}</strong>! Você acessou a conta master do HQ com a credencial inicial de primeiro acesso. Por exigência de segurança, defina uma senha definitiva antes de operar a plataforma.
              </>
            ) : (
              <>
                Olá, <strong className="text-white">{profile.name || profile.email}</strong>! Sua conta exige a troca de senha no primeiro acesso para liberar o ambiente operacional.
              </>
            )}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-xs text-rose-300 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1 text-left">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Senha Atual / Temporária
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Digite a senha usada neste acesso"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Nova Senha Definitiva
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="space-y-1 text-left">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Confirmar Nova Senha
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Digite novamente a nova senha"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Salvar Nova Senha &amp; Entrar
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Cancelar e Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};
