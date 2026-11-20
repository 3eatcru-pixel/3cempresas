import dotenv from 'dotenv';
import { generateStandardId } from '../utils/idGenerator.ts';
import { PostgresCloudDriver, resolvePostgresConnectionTarget } from './persistence/PostgresCloudDriver.ts';
import {
  DbExecutionContext,
  runWithDbContext,
  runWithSystemDbContext,
  runWithTenantDbContext,
  getActiveDbContext,
  resolveEffectiveDbContext,
} from './persistence/dbExecutionContext.ts';
import { ServerInMemoryStore } from './persistence/ServerInMemoryStore.ts';
import {
  UnifiedDocRef,
  UnifiedTransaction,
  CloudSyncDriverHandle,
  createServerDbFacade,
} from './persistence/serverDbClient.ts';
import {
  assertProductionSecretConfigured,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
  computeSnapshotChecksum,
  verifySnapshotChecksum,
  EncryptedSecretEnvelope,
  encryptIntegrationSecret,
  decryptIntegrationSecret,
} from './security/cryptoVaultAndHashing.ts';
import { createServerAuthProvider, revokeAuthSessionEverywhere } from './security/serverAuthProvider.ts';

dotenv.config();

export type { DbExecutionContext, EncryptedSecretEnvelope, UnifiedDocRef, UnifiedTransaction };
export {
  runWithDbContext,
  runWithSystemDbContext,
  runWithTenantDbContext,
  getActiveDbContext,
  resolveEffectiveDbContext,
  assertProductionSecretConfigured,
  hashPassword,
  hashPasswordAsync,
  verifyPassword,
  verifyPasswordAsync,
  computeSnapshotChecksum,
  verifySnapshotChecksum,
  encryptIntegrationSecret,
  decryptIntegrationSecret,
  revokeAuthSessionEverywhere,
};

export interface CloudProbeResult {
  verified: boolean;
  driver: 'json-memory' | 'postgres-cloud';
  mode: 'SANDBOX_LOCAL' | 'CLOUD_PRIMARY';
  checkedAt: string;
  error: string | null;
}

let cloudSyncDriver: CloudSyncDriverHandle | null = null;

export function __setCloudSyncDriverForTests(driver: typeof cloudSyncDriver): void {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_DRIVER_INJECTION !== 'true') {
    throw new Error('[Security] __setCloudSyncDriverForTests é bloqueado em ambiente de produção.');
  }
  cloudSyncDriver = driver;
  cloudProbeState.verified = Boolean(driver);
  cloudProbeState.lastCheckedAt = driver ? new Date().toISOString() : null;
  cloudProbeState.lastError = null;
}

const cloudProbeState: {
  verified: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
} = {
  verified: false,
  lastCheckedAt: null,
  lastError: null,
};

const memoryStore = new ServerInMemoryStore({
  isCloudActiveGetter: () => Boolean(cloudSyncDriver),
  onRestoreCloudSync: async (cleanSnapshot) => {
    if (cloudSyncDriver) {
      await cloudSyncDriver.syncSnapshot(cleanSnapshot, { replaceAll: true, reason: 'HQ_RESTORE' });
    }
  },
});

export async function probeCloudDatabase(): Promise<CloudProbeResult> {
  const checkedAt = new Date().toISOString();
  const target = resolvePostgresConnectionTarget(process.env);
  const pgOptedIn =
    process.env.ENABLE_POSTGRES_CLOUD === 'true' ||
    process.env.ALLOW_INCOMPLETE_POSTGRES_DRIVER === 'true';

  if (!target.configured || !pgOptedIn) {
    cloudSyncDriver = null;
    cloudProbeState.verified = false;
    cloudProbeState.lastCheckedAt = checkedAt;
    cloudProbeState.lastError = !target.configured
      ? target.missingReason || 'DATABASE_URL não configurada.'
      : 'ENABLE_POSTGRES_CLOUD != true.';
    return {
      verified: false,
      driver: 'json-memory',
      mode: 'SANDBOX_LOCAL',
      checkedAt,
      error: cloudProbeState.lastError,
    };
  }

  try {
    if (cloudSyncDriver) {
      await cloudSyncDriver.close().catch(() => {});
    }
    const candidateTarget = target.connectionString || target.poolConfig!;
    const candidate = new PostgresCloudDriver(candidateTarget, process.env);
    const reachable = await candidate.ping();
    if (!reachable) {
      await candidate.close().catch(() => {});
      cloudSyncDriver = null;
      cloudProbeState.verified = false;
      cloudProbeState.lastCheckedAt = checkedAt;
      cloudProbeState.lastError = 'PostgreSQL Cloud não respondeu ao SELECT 1.';
      return {
        verified: false,
        driver: 'json-memory',
        mode: 'SANDBOX_LOCAL',
        checkedAt,
        error: cloudProbeState.lastError,
      };
    }

    await candidate.runSchemaMigrations();
    const existingCloudDocs = await candidate.loadAllDocuments({ reason: 'SYSTEM_BOOTSTRAP' });
    const totalCloudRows = Object.values(existingCloudDocs).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
      0
    );

    if (totalCloudRows > 0) {
      await memoryStore.restoreSnapshot(existingCloudDocs, { skipCloudSync: true });
    } else {
      await candidate.syncSnapshot(memoryStore.exportSnapshot(), { replaceAll: false, reason: 'SYSTEM_BOOTSTRAP' });
    }

    cloudSyncDriver = candidate;
    cloudProbeState.verified = true;
    cloudProbeState.lastCheckedAt = checkedAt;
    cloudProbeState.lastError = null;
    return {
      verified: true,
      driver: 'postgres-cloud',
      mode: 'CLOUD_PRIMARY',
      checkedAt,
      error: null,
    };
  } catch (err: any) {
    cloudSyncDriver = null;
    cloudProbeState.verified = false;
    cloudProbeState.lastCheckedAt = checkedAt;
    cloudProbeState.lastError = err?.message || 'Erro ao conectar no PostgreSQL Cloud.';
    return {
      verified: false,
      driver: 'json-memory',
      mode: 'SANDBOX_LOCAL',
      checkedAt,
      error: cloudProbeState.lastError,
    };
  }
}

export async function verifyCloudPersistenceReadiness(): Promise<boolean> {
  const result = await probeCloudDatabase();
  return result.verified;
}

export async function shutdownPersistence(): Promise<void> {
  try {
    memoryStore.saveImmediately();
  } catch {
    // ignore disk save failure during shutdown in ephemeral/cloud environments
  }
  if (cloudSyncDriver) {
    await cloudSyncDriver.close().catch(() => {});
    cloudSyncDriver = null;
  }
}

export const db = createServerDbFacade({
  getCloudSyncDriver: () => cloudSyncDriver,
  memoryStore,
});

export function getRuntimePersistenceCapabilities() {
  const target = resolvePostgresConnectionTarget(process.env);
  const pgOptedIn =
    process.env.ENABLE_POSTGRES_CLOUD === 'true' ||
    process.env.ALLOW_INCOMPLETE_POSTGRES_DRIVER === 'true';
  const productionDatabaseReady = Boolean(target.configured && pgOptedIn && cloudProbeState.verified && cloudSyncDriver);
  const sandboxModeBlockedInProduction =
    process.env.NODE_ENV === 'production' &&
    !productionDatabaseReady &&
    process.env.ALLOW_SANDBOX_IN_PRODUCTION !== 'true';

  return {
    cloudProbeVerified: productionDatabaseReady,
    cloudProbeLastCheckedAt: cloudProbeState.lastCheckedAt,
    cloudProbeError: cloudProbeState.lastError,
    persistenceDriver: productionDatabaseReady ? ('postgres-cloud' as const) : ('json-memory' as const),
    persistenceMode: productionDatabaseReady ? ('CLOUD_PRIMARY' as const) : ('SANDBOX_LOCAL' as const),
    dbConnectionMode: target.mode,
    databaseProvider: target.provider || 'none',
    databaseUrlSource: target.sourceEnvKey || null,
    productionDatabaseReady,
    sandboxModeBlockedInProduction,
  };
}

export const auth = createServerAuthProvider(async (uid, userDoc) => {
  await db.collection('users').doc(uid).set(userDoc);
});
