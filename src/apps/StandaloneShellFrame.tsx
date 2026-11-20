import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { EcosystemProvider } from '../context/EcosystemContext';
import { ConsumerProvider } from '../context/ConsumerContext';
import { MainSectionId } from '../types';
import { ClientAppId, setActiveClientAppId } from '../core/platform/PlatformAdapter';
import { GlobalToast } from '../components/common/GlobalToast';
import { AuthModal } from '../components/common/AuthModal';
import { MustChangePasswordModal } from '../components/common/MustChangePasswordModal';

export const ShellSuspenseFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-[70vh] bg-slate-950 flex items-center justify-center">
    <div className="text-center space-y-3">
      <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
      <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">
        Carregando {label}...
      </p>
    </div>
  </div>
);

export interface StandaloneShellFrameProps {
  appId: Exclude<ClientAppId, 'unified-portal'>;
  section: Exclude<MainSectionId, 'portal'>;
  includeConsumerProvider?: boolean;
  children: React.ReactNode;
}

const ShellAuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
          <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">
            Sincronizando Produto 3C...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between">
      <main className="flex-1 w-full">{children}</main>
      <GlobalToast />
      <AuthModal />
      <MustChangePasswordModal />
    </div>
  );
};

export const StandaloneShellFrame: React.FC<StandaloneShellFrameProps> = ({
  appId,
  section,
  includeConsumerProvider = true,
  children,
}) => {
  useEffect(() => {
    setActiveClientAppId(appId);
  }, [appId]);

  const inner = <ShellAuthGate>{children}</ShellAuthGate>;

  return (
    <AuthProvider>
      <EcosystemProvider initialSection={section} lockedSection>
        {includeConsumerProvider ? <ConsumerProvider>{inner}</ConsumerProvider> : inner}
      </EcosystemProvider>
    </AuthProvider>
  );
};
