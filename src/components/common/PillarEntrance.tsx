import React from 'react';
import { AuthModalContextId, useAuth } from '../../context/AuthContext';
import { useEcosystem } from '../../context/EcosystemContext';
import {
  LogIn,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  UserPlus,
  Info,
} from 'lucide-react';
import { PILLAR_THEMES, PillarId, STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import { getActiveClientAppId } from '../../core/platform/PlatformAdapter';
import { BrandLogo, BrandMark } from './BrandLogo';
import { AppDownloadButtons } from './AppDownloadButtons';

interface PillarEntranceProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  requiredRole: 'DEV_OWNER' | 'STORE_OWNER' | 'CUSTOMER' | 'COURIER' | 'WAITER';
  colorClass: string;
  features: string[];
  pillarId?: PillarId;
  secondaryAction?: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  DEV_OWNER: 'Dev Owner (Master HQ)',
  SUPER_ADMIN: 'Super Admin (HQ)',
  REGIONAL_MANAGER: 'Gerente Regional',
  STORE_OWNER: 'Lojista',
  STORE_MANAGER: 'Gerente de Loja',
  CASHIER: 'Operador de Caixa',
  KITCHEN_STAFF: 'Cozinha (KDS)',
  COURIER: 'Entregador',
  DRIVER: 'Entregador',
  WAITER: 'Garçom',
  CUSTOMER: 'Consumidor',
};

const PILLAR_TO_AUTH_CONTEXT: Record<PillarId, AuthModalContextId> = {
  hq: 'hq',
  'server-core': 'server-core',
  'store-os': 'store-os',
  marketplace: 'marketplace',
  driver: 'driver',
  waiter: 'waiter',
};

export const PillarEntrance: React.FC<PillarEntranceProps> = ({
  title,
  subtitle,
  requiredRole,
  colorClass,
  features,
  pillarId,
  secondaryAction,
}) => {
  const { logout, user, profile, isAuthenticated, openAuthModal } = useAuth();
  const { setActiveSection } = useEcosystem();

  const handleBackToPortal = () => {
    setActiveSection('portal');
  };

  const isPublicPillar = requiredRole === 'CUSTOMER';
  const resolvedBrandId: PillarId =
    pillarId ||
    (requiredRole === 'DEV_OWNER'
      ? 'hq'
      : requiredRole === 'STORE_OWNER'
      ? 'store-os'
      : requiredRole === 'COURIER'
      ? 'driver'
      : requiredRole === 'WAITER'
      ? 'waiter'
      : 'marketplace');
  const resolvedTheme = PILLAR_THEMES[resolvedBrandId];
  const effectiveColorClass = resolvedTheme?.accentTextClass || colorClass;
  const buttonBgClass = resolvedTheme?.accentBgClass || 'bg-amber-500';
  const modalContext: AuthModalContextId = PILLAR_TO_AUTH_CONTEXT[resolvedBrandId];

  const canSelfSignup = modalContext === 'store-os' || modalContext === 'marketplace';
  const signupCtaLabel =
    modalContext === 'store-os'
      ? 'Criar Conta de Lojista (7 dias grátis)'
      : 'Criar Conta de Consumidor';

  const loginCtaLabel =
    modalContext === 'store-os'
      ? 'Entrar no Store OS'
      : modalContext === 'driver'
      ? 'Entrar como Entregador'
      : modalContext === 'waiter'
      ? 'Entrar como Garçom'
      : modalContext === 'hq' || modalContext === 'server-core'
      ? 'Entrar no Painel Administrativo'
      : 'Entrar na Minha Conta';

  const provisioningHint =
    modalContext === 'driver'
      ? 'Contas de entregador são cadastradas pelo Lojista ou pela plataforma logística 3C.'
      : modalContext === 'waiter'
      ? 'Entre com o e-mail liberado na lista da loja (Store OS → Equipe) ou pareie um PDQ / dispositivo da própria loja.'
      : modalContext === 'hq' || modalContext === 'server-core'
      ? 'Acesso administrativo exclusivo para contas autorizadas do HQ Central.'
      : null;

  const currentRoleLabel = ROLE_LABELS[String(profile?.role || '').toUpperCase()] || profile?.role || 'Visitante';
  const requiredRoleLabel = ROLE_LABELS[requiredRole] || requiredRole;

  return (
    <div className={`min-h-screen ${SURFACE_TOKENS.dark.canvasBg} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
        {/* Left Side: Brand & Value */}
        <div className="space-y-6">
          {getActiveClientAppId() === 'unified-portal' && (
            <button
              type="button"
              onClick={handleBackToPortal}
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-xs font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Portal
            </button>
          )}

          <div className="space-y-3">
            <BrandLogo id={resolvedBrandId} size="lg" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight text-balance">
              {title}
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-md">{subtitle}</p>
          </div>

          <ul className="space-y-2.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${STATUS_COLORS.SUCCESS.textClass}`} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Side: Specialized Access Gate */}
        <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="text-center space-y-3.5">
            <BrandMark id={resolvedBrandId} size="lg" className="mx-auto" />

            <h3 className="text-lg font-bold text-white">
              {isPublicPillar ? 'Área de Consumidor' : `Acesso · ${title}`}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {isPublicPillar
                ? 'Entre ou crie sua conta de consumidor para pedir e acompanhar entregas.'
                : `Este aplicativo é exclusivo para ${requiredRoleLabel}. Acesse com sua conta dedicada.`}
            </p>
          </div>

          {isAuthenticated && user && (
            <div className="mt-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left space-y-1">
              <div className="text-[11px] font-black text-amber-300 uppercase tracking-wide">
                Sessão Atual: {currentRoleLabel}
              </div>
              <div className="text-xs text-slate-300 break-all">
                Conectado como <span className="font-bold text-white">{profile?.email || profile?.name}</span>, que não possui permissão para <span className="font-bold">{title}</span>.
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => openAuthModal('login', requiredRole, modalContext)}
              className={`w-full py-3.5 ${buttonBgClass} hover:brightness-110 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer`}
            >
              <LogIn className="w-4 h-4" /> {isAuthenticated ? 'Entrar com Outra Conta' : loginCtaLabel}
            </button>

            {secondaryAction}

            {!isAuthenticated && canSelfSignup && (
              <button
                type="button"
                onClick={() => openAuthModal('signup', requiredRole, modalContext)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                {signupCtaLabel}
              </button>
            )}

            {isAuthenticated && (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sair desta Conta
                </button>
              </div>
            )}

            {provisioningHint && !canSelfSignup && (
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2 text-[11px] text-slate-400">
                <Info className={`w-4 h-4 shrink-0 mt-0.5 ${effectiveColorClass}`} />
                <span>{provisioningHint}</span>
              </div>
            )}

            {modalContext !== 'hq' && modalContext !== 'server-core' && (
              <div className="pt-4 border-t border-slate-800/80">
                <AppDownloadButtons variant="panel" contextId={modalContext} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
