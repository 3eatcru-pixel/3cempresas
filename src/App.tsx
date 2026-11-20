import React, { Suspense } from 'react';
import { EcosystemProvider, useEcosystem } from './context/EcosystemContext';
import { ConsumerProvider } from './context/ConsumerContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PortalWelcome } from './components/common/PortalWelcome';
import { GlobalToast } from './components/common/GlobalToast';
import { AuthModal } from './components/common/AuthModal';
import { MustChangePasswordModal } from './components/common/MustChangePasswordModal';
import { getActiveClientAppId } from './core/platform/PlatformAdapter';
import {
  DriverAppShell,
  HqWebAppShell,
  MarketplaceAppShell,
  ServerCoreAppShell,
  StoreOsAppShell,
  WaiterAppShell,
} from './apps/ProductShell';
import { PillarErrorBoundary } from './components/common/PillarErrorBoundary';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Loader2 } from 'lucide-react';

const HqCentralPillar = lazyWithRetry(() =>
  import('./components/pillars/HqCentralPillar').then((m) => ({ default: m.HqCentralPillar }))
);
const StoreOsPillar = lazyWithRetry(() =>
  import('./components/pillars/StoreOsPillar').then((m) => ({ default: m.StoreOsPillar }))
);
const MarketplacePillar = lazyWithRetry(() =>
  import('./components/pillars/MarketplacePillar').then((m) => ({ default: m.MarketplacePillar }))
);
const ServerCorePillar = lazyWithRetry(() =>
  import('./components/pillars/ServerCorePillar').then((m) => ({ default: m.ServerCorePillar }))
);
const DriverPillar = lazyWithRetry(() =>
  import('./components/pillars/DriverPillar').then((m) => ({ default: m.DriverPillar }))
);
const WaiterPillar = lazyWithRetry(() =>
  import('./components/pillars/WaiterPillar').then((m) => ({ default: m.WaiterPillar }))
);

const PillarLoadingFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="min-h-[70vh] bg-slate-950 flex items-center justify-center">
    <div className="text-center space-y-3">
      <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
      <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">
        Carregando {label}...
      </p>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const { activeSection, setActiveSection } = useEcosystem();
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
          <p className="text-slate-400 font-mono text-xs uppercase tracking-widest">Sincronizando Ecossistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between">
      <main className="flex-1 w-full">
        {activeSection === 'portal' && <PortalWelcome />}
        {activeSection === 'hq-central' && (
          <PillarErrorBoundary pillarId="hq" pillarName="HQ Central" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="HQ Central" />}>
              <HqCentralPillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
        {activeSection === 'store-os' && (
          <PillarErrorBoundary pillarId="store-os" pillarName="Store OS" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="Store OS" />}>
              <StoreOsPillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
        {activeSection === 'marketplace' && (
          <PillarErrorBoundary pillarId="marketplace" pillarName="Marketplace" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="3C Marketplace" />}>
              <MarketplacePillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
        {activeSection === 'server-core' && (
          <PillarErrorBoundary pillarId="server-core" pillarName="Server Core" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="Server Core" />}>
              <ServerCorePillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
        {activeSection === 'driver' && (
          <PillarErrorBoundary pillarId="driver" pillarName="3C Driver" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="3C Driver" />}>
              <DriverPillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
        {activeSection === 'waiter' && (
          <PillarErrorBoundary pillarId="waiter" pillarName="3C Waiter" onNavigateSection={setActiveSection}>
            <Suspense fallback={<PillarLoadingFallback label="3C Waiter" />}>
              <WaiterPillar />
            </Suspense>
          </PillarErrorBoundary>
        )}
      </main>
      <GlobalToast />
      <AuthModal />
      <MustChangePasswordModal />
    </div>
  );
};

export default function App() {
  const targetApp = getActiveClientAppId();

  if (targetApp === 'marketplace') return <MarketplaceAppShell />;
  if (targetApp === 'store-os') return <StoreOsAppShell />;
  if (targetApp === 'driver') return <DriverAppShell />;
  if (targetApp === 'waiter') return <WaiterAppShell />;
  if (targetApp === 'hq') return <HqWebAppShell />;
  if (targetApp === 'server-core') return <ServerCoreAppShell />;

  return (
    <AuthProvider>
      <EcosystemProvider>
        <ConsumerProvider>
          <AppContent />
        </ConsumerProvider>
      </EcosystemProvider>
    </AuthProvider>
  );
}
