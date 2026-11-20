import React, { useState } from 'react';
import { ShieldCheck, Download, AlertTriangle, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConsumer } from '../../context/ConsumerContext';
import { useEcosystem } from '../../context/EcosystemContext';

export const ConsumerSecurityTab: React.FC = () => {
  const { profile, changePassword, deleteOwnAccount } = useAuth();
  const { consumer } = useConsumer();
  const { orders, reservations, showNotification } = useEcosystem();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleExportData = () => {
    const uid = profile?.uid;
    const emailLower = profile?.email?.toLowerCase();
    const myOrders = orders.filter(
      o =>
        Boolean(uid && o.customerId === uid) ||
        Boolean(emailLower && o.customerEmail?.toLowerCase() === emailLower) ||
        Boolean(consumer?.phone && o.customerPhone === consumer.phone)
    );
    const myReservations = reservations.filter(
      r =>
        Boolean(consumer?.phone && r.clientPhone === consumer.phone) ||
        Boolean(profile?.name && r.clientName === profile.name)
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      lgpdCompliance: '3C Marketplace — Portabilidade de Dados Pessoais',
      profile: profile || null,
      consumer: consumer || null,
      orders: myOrders,
      reservations: myReservations,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meus-dados-lgpd-${profile?.uid || 'visitante'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Arquivo JSON com seus dados exportado com sucesso.');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'err', text: 'A nova senha deve possuir no mínimo 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'err', text: 'A confirmação da nova senha não confere.' });
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ type: 'ok', text: 'Senha alterada com sucesso! Outras sessões antigas foram encerradas.' });
      showNotification('Senha alterada com sucesso!');
    } catch (err: any) {
      setPasswordFeedback({ type: 'err', text: err?.message || 'Erro ao alterar senha.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setDeletingAccount(true);
    try {
      await deleteOwnAccount();
      setConfirmingDelete(false);
      showNotification('Sua conta foi excluída permanentemente conforme LGPD.');
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao excluir conta.');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-8 shadow-xl animate-fadeIn">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-amber-400" /> Privacidade e Gestão de Dados
        </h3>
        <p className="text-xs text-slate-400">
          Gerencie sua senha, exportação LGPD e exclusão definitiva de sua conta no Marketplace
        </p>
      </div>

      {profile?.mustChangePassword && (
        <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-xs text-amber-200 font-semibold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Sua senha atual é temporária. Defina uma nova senha pessoal abaixo para continuar.
          </span>
        </div>
      )}

      {/* Self-service password change */}
      <form onSubmit={handleChangePasswordSubmit} className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" /> Alterar Senha de Acesso
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <input
            type="password"
            required
            placeholder="Senha atual (ou temporária)"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Nova senha (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Confirmar nova senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>
        {passwordFeedback && (
          <div
            className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              passwordFeedback.type === 'ok'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
            }`}
          >
            {passwordFeedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{passwordFeedback.text}</span>
          </div>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={passwordSaving}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50"
          >
            {passwordSaving ? 'Atualizando...' : 'Atualizar Senha'}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Seus Dados no 3C Marketplace
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Cumprimos integralmente a LGPD. Seus dados de localização são usados apenas para
            cálculo de frete e sugestão de lojas próximas. Nunca vendemos seus dados para terceiros.
          </p>
          <button
            type="button"
            onClick={handleExportData}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-500 hover:text-amber-400 uppercase tracking-widest border-b border-amber-500/30 pb-0.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar meus dados (JSON)</span>
          </button>
        </div>

        <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="text-sm font-bold text-rose-500 uppercase tracking-wider">
            Área de Perigo
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ao excluir sua conta, seus dados pessoais serão removidos imediatamente e seus pedidos históricos serão anonimizados conforme LGPD. Esta ação é irreversível.
          </p>

          {confirmingDelete ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-3">
              <div className="flex items-start gap-2 text-xs text-rose-300 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  Confirmar exclusão permanente da conta? Sua sessão será encerrada imediatamente.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={handleConfirmDelete}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {deletingAccount ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
            >
              Excluir Minha Conta Permanentemente
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
