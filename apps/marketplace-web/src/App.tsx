import React, { Suspense, lazy } from 'react';
import { PillarErrorBoundary } from '@/src/components/common/PillarErrorBoundary.tsx';
import { StandaloneShellFrame, ShellSuspenseFallback } from '@/src/apps/StandaloneShellFrame.tsx';

const MarketplacePillar = lazy(() =>
  import('@/src/components/pillars/MarketplacePillar.tsx').then((m) => ({
    default: m.MarketplacePillar,
  }))
);

export default function App() {
  return (
    <StandaloneShellFrame appId="marketplace" section="marketplace" includeConsumerProvider>
      <PillarErrorBoundary pillarId="marketplace" pillarName="Marketplace">
        <Suspense fallback={<ShellSuspenseFallback label="3C Marketplace" />}>
          <MarketplacePillar />
        </Suspense>
      </PillarErrorBoundary>
    </StandaloneShellFrame>
  );
}
