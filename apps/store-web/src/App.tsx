import React, { Suspense, lazy } from 'react';
import { PillarErrorBoundary } from '@/src/components/common/PillarErrorBoundary.tsx';
import { StandaloneShellFrame, ShellSuspenseFallback } from '@/src/apps/StandaloneShellFrame.tsx';

const StoreOsPillar = lazy(() =>
  import('@/src/components/pillars/StoreOsPillar.tsx').then((m) => ({ default: m.StoreOsPillar }))
);

export default function App() {
  return (
    <StandaloneShellFrame appId="store-os" section="store-os" includeConsumerProvider={false}>
      <PillarErrorBoundary pillarId="store-os" pillarName="Store OS">
        <Suspense fallback={<ShellSuspenseFallback label="Store OS" />}>
          <StoreOsPillar />
        </Suspense>
      </PillarErrorBoundary>
    </StandaloneShellFrame>
  );
}
