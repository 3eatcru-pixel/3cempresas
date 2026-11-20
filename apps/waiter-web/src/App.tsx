import React, { Suspense, lazy } from 'react';
import { PillarErrorBoundary } from '@/src/components/common/PillarErrorBoundary.tsx';
import { StandaloneShellFrame, ShellSuspenseFallback } from '@/src/apps/StandaloneShellFrame.tsx';

const WaiterPillar = lazy(() =>
  import('@/src/components/pillars/WaiterPillar.tsx').then((m) => ({ default: m.WaiterPillar }))
);

export default function App() {
  return (
    <StandaloneShellFrame appId="waiter" section="waiter" includeConsumerProvider={false}>
      <PillarErrorBoundary pillarId="waiter" pillarName="3C Waiter">
        <Suspense fallback={<ShellSuspenseFallback label="3C Waiter" />}>
          <WaiterPillar />
        </Suspense>
      </PillarErrorBoundary>
    </StandaloneShellFrame>
  );
}
