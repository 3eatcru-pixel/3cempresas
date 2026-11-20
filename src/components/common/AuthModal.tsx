import React, { useEffect, useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { SURFACE_TOKENS } from '@3c/design-system';
import { useAuth } from '../../context/AuthContext';
import { EcosystemSessionRole } from '../../types';
import { apiClient } from '../../core/api/apiClient';
import { AuthLoginForm } from './auth/AuthLoginForm';
import { AuthSignupForm } from './auth/AuthSignupForm';
import { AuthRecoveryForm } from './auth/AuthRecoveryForm';
import { AUTH_CONTEXT_META } from './auth/authContextMeta';
import { AuthModalHeader } from './auth/AuthModalHeader';
import { AuthModalBanners } from './auth/AuthModalBanners';
import { AuthGoogleButton, getAuthFooterLabel } from './auth/AuthGoogleButton';
import { AppDownloadButtons } from './AppDownloadButtons';
import { getActiveClientAppId } from '../../core/platform/PlatformAdapter';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalDefaultTab,
    authModalDefaultRole,
    authModalContext,
    setAuthModalContext,
    loginWithPassword,
    loginWithFirebaseGoogle,
    firebaseEnabled,
    signUpManual,
  } = useAuth();

  const meta = AUTH_CONTEXT_META[authModalContext] || AUTH_CONTEXT_META.portal;
  const activeTheme = meta.theme;
  const surface = SURFACE_TOKENS.dark;
  const canSwitchProductInModal =
    getActiveClientAppId() === 'unified-portal' && authModalContext === 'portal';

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'recover'>(
    meta.allowSignup && authModalDefaultTab === 'signup' ? 'signup' : 'login'
  );
  const [selectedRole, setSelectedRole] = useState<EcosystemSessionRole>(
    meta.lockedSignupRole || authModalDefaultRole || 'CUSTOMER'
  );

  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storeCity, setStoreCity] = useState('');
  const [storeState, setStoreState] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [infoMsg, setInfoMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [suggestedContext, setSuggestedContext] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthModalOpen) {
      const nextMeta = AUTH_CONTEXT_META[authModalContext] || AUTH_CONTEXT_META.portal;
      setActiveTab(nextMeta.allowSignup && authModalDefaultTab === 'signup' ? 'signup' : 'login');
      setSelectedRole(nextMeta.lockedSignupRole || authModalDefaultRole || 'CUSTOMER');
      setErrorMsg('');
      setInfoMsg('');
      setSuggestedContext(null);
      setRecoveryStep('request');
    }
  }, [isAuthModalOpen, authModalDefaultTab, authModalDefaultRole, authModalContext]);

  if (!isAuthModalOpen) return null;

  const handleRequestRecovery = async () => {
    setErrorMsg('');
    setInfoMsg('');
    if (!email || !email.includes('@')) {
      setErrorMsg('Informe o e-mail da conta para solicitar recuperação.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.recoverPasswordRequest(email);
      setInfoMsg(res.message);
      setRecoveryStep('reset');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao solicitar recuperação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (!email || !recoveryCode || recoveryNewPassword.length < 8) {
      setErrorMsg('Informe e-mail, código de recuperação e a nova senha (mínimo 8 caracteres).');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiClient.recoverPasswordReset({
        email,
        code: recoveryCode,
        newPassword: recoveryNewPassword,
      });
      setActiveTab('login');
      setPassword('');
      setRecoveryCode('');
      setRecoveryNewPassword('');
      setRecoveryStep('request');
      setInfoMsg(res.message || 'Senha redefinida com sucesso! Faça login abaixo.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Código inválido ou expirado.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'recover') {
      if (recoveryStep === 'request') {
        await handleRequestRecovery();
      } else {
        await handleConfirmRecovery(e);
      }
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setSuggestedContext(null);
    setIsSubmitting(true);

    try {
      if (activeTab === 'login') {
        if (!email || !password) {
          throw new Error('Preencha o e-mail e a senha para entrar.');
        }
        await loginWithPassword(email, password);
      } else {
        if (!meta.allowSignup) {
          throw new Error('Auto-cadastro não disponível neste aplicativo.');
        }
        const roleToCreate = meta.lockedSignupRole || selectedRole;
        if (roleToCreate === 'STORE_OWNER' && (!storeName || storeName.trim().length < 2)) {
          throw new Error('Informe o nome da sua loja ou estabelecimento.');
        }
        if (roleToCreate === 'STORE_OWNER' && (!storeCity || storeCity.trim().length < 2)) {
          throw new Error('Informe a cidade onde sua loja opera.');
        }
        if (!name || !email || !password) {
          throw new Error('Preencha todos os campos para criar sua conta.');
        }
        if (password.length < 8) {
          throw new Error('A senha deve conter pelo menos 8 caracteres.');
        }
        await signUpManual(
          name,
          email,
          password,
          roleToCreate,
          roleToCreate === 'STORE_OWNER' ? storeName.trim() : undefined,
          roleToCreate === 'STORE_OWNER'
            ? { city: storeCity.trim(), state: storeState.trim().toUpperCase() }
            : undefined
        );
      }
      closeAuthModal();
      setName('');
      setStoreName('');
      setStoreCity('');
      setStoreState('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao autenticar.');
      if (
        err.suggestedAppId &&
        err.suggestedAppId !== 'hq' &&
        err.suggestedAppId !== 'server-core'
      ) {
        setSuggestedContext(err.suggestedAppId);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const showGoogleAuth =
    firebaseEnabled &&
    (activeTab === 'login' || (activeTab === 'signup' && authModalContext === 'marketplace'));

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setSuggestedContext(null);
    setIsSubmitting(true);
    try {
      await loginWithFirebaseGoogle(authModalContext);
      closeAuthModal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao autenticar com Google.');
      if (
        err?.suggestedAppId &&
        err.suggestedAppId !== 'hq' &&
        err.suggestedAppId !== 'server-core'
      ) {
        setSuggestedContext(err.suggestedAppId);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel =
    activeTab === 'login'
      ? 'Acessar Conta'
      : activeTab === 'signup'
      ? authModalContext === 'store-os'
        ? 'Criar Minha Loja no Store OS'
        : authModalContext === 'marketplace'
        ? 'Criar Conta de Consumidor'
        : 'Criar Minha Conta'
      : recoveryStep === 'request'
      ? 'Solicitar Código de Recuperação'
      : 'Redefinir Senha e Entrar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div
        className={`relative w-full max-w-md max-h-[92vh] overflow-y-auto ${surface.elevatedBg} border ${surface.border} rounded-3xl shadow-2xl`}
      >
        <AuthModalHeader
          meta={meta}
          activeTab={activeTab}
          borderClass={surface.border}
          onClose={closeAuthModal}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setErrorMsg('');
            setSuggestedContext(null);
            if (tab === 'signup') setInfoMsg('');
          }}
          onSwitchContext={
            canSwitchProductInModal
              ? (ctx) => {
                  setAuthModalContext(ctx);
                  setErrorMsg('');
                  setSuggestedContext(null);
                }
              : undefined
          }
        />

        <div className="p-6 space-y-5">
          <AuthModalBanners
            errorMsg={errorMsg}
            infoMsg={infoMsg}
            suggestedContext={suggestedContext}
            allowCrossContextSwitch={canSwitchProductInModal}
            onSwitchSuggestedContext={(target) => {
              setSuggestedContext(null);
              setErrorMsg('');
              setAuthModalContext(target);
            }}
          />

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {activeTab === 'signup' && meta.allowSignup && (
              <AuthSignupForm
                contextId={authModalContext}
                selectedRole={selectedRole}
                onSelectRole={setSelectedRole}
                name={name}
                setName={setName}
                storeName={storeName}
                setStoreName={setStoreName}
                storeCity={storeCity}
                setStoreCity={setStoreCity}
                storeState={storeState}
                setStoreState={setStoreState}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
              />
            )}

            {activeTab === 'login' && (
              <AuthLoginForm
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                emailPlaceholder={meta.loginPlaceholder}
                accentTextClass={activeTheme.accentTextClass}
                onForgotPassword={() => {
                  setActiveTab('recover');
                  setErrorMsg('');
                  setInfoMsg('');
                  setRecoveryStep('request');
                }}
              />
            )}

            {activeTab === 'recover' && (
              <AuthRecoveryForm
                recoveryStep={recoveryStep}
                email={email}
                setEmail={setEmail}
                recoveryCode={recoveryCode}
                setRecoveryCode={setRecoveryCode}
                recoveryNewPassword={recoveryNewPassword}
                setRecoveryNewPassword={setRecoveryNewPassword}
                onBackToLogin={() => {
                  setActiveTab('login');
                  setErrorMsg('');
                }}
                onGoToReset={() => setRecoveryStep('reset')}
              />
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-3.5 ${activeTheme.accentBgClass} hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer`}
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {submitLabel}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {showGoogleAuth && (
            <AuthGoogleButton
              contextId={authModalContext}
              activeTab={activeTab}
              isSubmitting={isSubmitting}
              onClick={() => void handleGoogleAuth()}
            />
          )}

          {meta.provisioningNote && activeTab === 'login' && (
            <div
              className={`p-3 rounded-xl bg-slate-950/70 border ${surface.border} flex items-start gap-2.5 text-[11px] text-slate-400`}
            >
              <Info className={`w-4 h-4 shrink-0 mt-0.5 ${activeTheme.accentTextClass}`} />
              <span>{meta.provisioningNote}</span>
            </div>
          )}

          {activeTab === 'login' &&
            authModalContext !== 'hq' &&
            authModalContext !== 'server-core' && (
              <div className={`pt-4 border-t ${surface.border}`}>
                <AppDownloadButtons
                  variant="compact"
                  contextId={authModalContext}
                  onAfterWebLaunch={closeAuthModal}
                />
              </div>
            )}

          <div className={`pt-2 border-t ${surface.border} text-center`}>
            <p className="text-[11px] text-slate-500">{getAuthFooterLabel(authModalContext)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
