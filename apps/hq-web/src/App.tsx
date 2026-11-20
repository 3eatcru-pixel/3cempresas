import React, { Suspense, lazy } from 'react';
import { PillarErrorBoundary } from '@/src/components/common/PillarErrorBoundary.tsx';
import { StandaloneShellFrame, ShellSuspenseFallback } from '@/src/apps/StandaloneShellFrame.tsx';

const HqCentralPillar = lazy(() =>
  import('@/src/components/pillars/HqCentralPillar.tsx').then((m) => ({
    default: m.HqCentralPillar,
  }))
);

export default function App() {
  return (
    <StandaloneShellFrame appId="hq" section="hq-central" includeConsumerProvider={false}>
      <PillarErrorBoundary pillarId="hq" pillarName="HQ Central">
        <Suspense fallback={<ShellSuspenseFallback label="HQ Central" />}>
          <HqCentralPillar />
        </Suspense>
      </PillarErrorBoundary>
    </StandaloneShellFrame>
  );
}
