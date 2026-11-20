import { useEffect, useState } from 'react';
import { syncEngine, SyncSnapshot, SyncTransport } from '../core/sync/SyncEngine';

export type { SyncTransport };

export function useSyncStatus(): SyncSnapshot {
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(() => syncEngine.getSnapshot());

  useEffect(() => {
    return syncEngine.subscribe(setSnapshot);
  }, []);

  return snapshot;
}
