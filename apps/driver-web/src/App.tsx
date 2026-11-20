import React, { Suspense, lazy } from 'react';
import { PillarErrorBoundary } from '@/src/components/common/PillarErrorBoundary.tsx';
import { StandaloneShellFrame, ShellSuspenseFallback } from '@/src/apps/StandaloneShellFrame.tsx';

const DriverPillar = lazy(() =>
  import('@/src/components/pillars/DriverPillar.tsx').then((m) => ({ default: m.DriverPillar }))
);

export default function App() {
  return (
    <StandaloneShellFrame appId="driver" section="driver" includeConsumerProvider={false}>
      <PillarErrorBoundary pillarId="driver" pillarName="3C Driver">
        <Suspense fallback={<ShellSuspenseFallback label="3C Driver" />}>
          <DriverPillar />
        </Suspense>
      </PillarErrorBoundary>
    </StandaloneShellFrame>
  );
}
