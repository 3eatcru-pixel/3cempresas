import React, { Suspense } from 'react';
import { PillarErrorBoundary } from '../components/common/PillarErrorBoundary';
import { StandaloneShellFrame, ShellSuspenseFallback } from './StandaloneShellFrame';
import { lazyWithRetry } from '../utils/lazyWithRetry';

export { StandaloneShellFrame };

const MarketplacePillar = lazyWithRetry(() =>
  import('../components/pillars/MarketplacePillar').then((m) => ({ default: m.MarketplacePillar }))
);
const StoreOsPillar = lazyWithRetry(() =>
  import('../components/pillars/StoreOsPillar').then((m) => ({ default: m.StoreOsPillar }))
);
const DriverPillar = lazyWithRetry(() =>
  import('../components/pillars/DriverPillar').then((m) => ({ default: m.DriverPillar }))
);
const WaiterPillar = lazyWithRetry(() =>
  import('../components/pillars/WaiterPillar').then((m) => ({ default: m.WaiterPillar }))
);
const HqCentralPillar = lazyWithRetry(() =>
  import('../components/pillars/HqCentralPillar').then((m) => ({ default: m.HqCentralPillar }))
);
const ServerCorePillar = lazyWithRetry(() =>
  import('../components/pillars/ServerCorePillar').then((m) => ({ default: m.ServerCorePillar }))
);

export const MarketplaceAppShell: React.FC = () => (
  <StandaloneShellFrame appId="marketplace" section="marketplace" includeConsumerProvider={true}>
    <PillarErrorBoundary pillarId="marketplace" pillarName="Marketplace">
      <Suspense fallback={<ShellSuspenseFallback label="3C Marketplace" />}>
        <MarketplacePillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);

export const StoreOsAppShell: React.FC = () => (
  <StandaloneShellFrame appId="store-os" section="store-os" includeConsumerProvider={false}>
    <PillarErrorBoundary pillarId="store-os" pillarName="Store OS">
      <Suspense fallback={<ShellSuspenseFallback label="Store OS" />}>
        <StoreOsPillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);

export const DriverAppShell: React.FC = () => (
  <StandaloneShellFrame appId="driver" section="driver" includeConsumerProvider={false}>
    <PillarErrorBoundary pillarId="driver" pillarName="3C Driver">
      <Suspense fallback={<ShellSuspenseFallback label="3C Driver" />}>
        <DriverPillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);

export const WaiterAppShell: React.FC = () => (
  <StandaloneShellFrame appId="waiter" section="waiter" includeConsumerProvider={false}>
    <PillarErrorBoundary pillarId="waiter" pillarName="3C Waiter">
      <Suspense fallback={<ShellSuspenseFallback label="3C Waiter" />}>
        <WaiterPillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);

export const HqWebAppShell: React.FC = () => (
  <StandaloneShellFrame appId="hq" section="hq-central" includeConsumerProvider={false}>
    <PillarErrorBoundary pillarId="hq" pillarName="HQ Central">
      <Suspense fallback={<ShellSuspenseFallback label="HQ Central" />}>
        <HqCentralPillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);

export const ServerCoreAppShell: React.FC = () => (
  <StandaloneShellFrame appId="server-core" section="server-core" includeConsumerProvider={false}>
    <PillarErrorBoundary pillarId="server-core" pillarName="Server Core">
      <Suspense fallback={<ShellSuspenseFallback label="Server Core" />}>
        <ServerCorePillar />
      </Suspense>
    </PillarErrorBoundary>
  </StandaloneShellFrame>
);
