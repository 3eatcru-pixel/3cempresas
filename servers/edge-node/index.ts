import express from 'express';
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import { attachContractContext } from '../../src/server/middleware/contracts.ts';
import { SqliteWalDriver } from '../../src/server/persistence/SqliteWalDriver.ts';
import { generateEdgeNodeId } from '@3c/commerce-engine';
import { assertSecureCloudUrl, EdgeNodeConfig, resolveEdgeCorsAllowlist } from './helpers.ts';
import { createEdgeAuthGuards } from './auth.ts';
import { EdgeCloudSnapshot, EdgeSyncClient, EdgeSyncReport, EdgeSyncState } from './syncClient.ts';
import { EdgeRouteContext, registerEdgeStoreRoutes } from './routes/storeRoutes.ts';
import { registerEdgeCommerceRoutes } from './routes/commerceRoutes.ts';
import { registerEdgePmtilesRoutes } from './routes/pmtilesRoutes.ts';

export { assertSecureCloudUrl };
export type { EdgeNodeConfig };

export class EdgeNodeRuntime {
  public readonly nodeId: string;
  public readonly storeId: string;
  public readonly tenantId: string;
  public readonly driver: SqliteWalDriver;
  public readonly app: express.Express;
  private server: http.Server | null = null;
  private readonly syncClient: EdgeSyncClient;

  constructor(private readonly config: EdgeNodeConfig) {
    this.storeId = config.storeId;
    this.tenantId = config.tenantId;
    const resolvedDbPath =
      config.dbPath || path.join(process.cwd(), 'data', `edge-${config.storeId}.sqlite`);
    this.driver = new SqliteWalDriver(resolvedDbPath);
    const storedIdentity = this.driver.getDocSync<{ id: string; nodeId?: string }>('sync_metadata', 'node_identity');
    this.nodeId = config.nodeId || storedIdentity?.nodeId || generateEdgeNodeId();
    if (!storedIdentity || storedIdentity.nodeId !== this.nodeId) {
      this.driver.setDocSync('sync_metadata', 'node_identity', {
        id: 'node_identity',
        nodeId: this.nodeId,
        storeId: this.storeId,
        tenantId: this.tenantId,
        updatedAt: new Date().toISOString(),
      });
    }
    this.syncClient = new EdgeSyncClient(this.driver, this.nodeId, this.storeId);
    this.app = this.buildExpressApp();
  }

  private buildExpressApp(): express.Express {
    const app = express();
    app.disable('x-powered-by');
    app.use((_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      next();
    });
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowlist = resolveEdgeCorsAllowlist(this.config.allowedOrigins);
      if (origin && allowlist.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Range, If-None-Match, X-3C-App-Id, X-3C-Platform, X-3C-Contract-Version, X-Request-Id, Idempotency-Key, X-Device-Token'
      );
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, ETag');
      if (req.method === 'OPTIONS') {
        if (origin && !allowlist.has(origin)) {
          return res.status(403).end();
        }
        return res.sendStatus(204);
      }
      next();
    });
    app.use(express.json({ limit: '1mb' }));
    app.use(attachContractContext);

    const { authenticateEdge, requireEdgeRoles } = createEdgeAuthGuards(
      this.driver,
      this.storeId,
      this.tenantId
    );

    const routeCtx: EdgeRouteContext = {
      nodeId: this.nodeId,
      storeId: this.storeId,
      tenantId: this.tenantId,
      config: this.config,
      driver: this.driver,
      syncClient: this.syncClient,
      authenticateEdge,
      requireEdgeRoles,
    };

    registerEdgeStoreRoutes(app, routeCtx);
    registerEdgeCommerceRoutes(app, routeCtx);
    registerEdgePmtilesRoutes(app, routeCtx);

    return app;
  }

  async seedFromCloudSnapshot(snapshot: EdgeCloudSnapshot): Promise<void> {
    return this.syncClient.seedFromCloudSnapshot(snapshot);
  }

  async registerWithCloud(
    cloudBaseUrl: string,
    adminToken: string,
    hostname?: string
  ): Promise<{ edgeToken: string; edgeTokenExpiresAt: string }> {
    return this.syncClient.registerWithCloud(cloudBaseUrl, adminToken, hostname);
  }

  async bootstrapFromCloud(cloudBaseUrl: string, bearerToken: string): Promise<void> {
    return this.syncClient.bootstrapFromCloud(cloudBaseUrl, bearerToken);
  }

  async syncWithCloud(cloudBaseUrl: string, bearerToken: string): Promise<EdgeSyncReport> {
    return this.syncClient.syncWithCloud(cloudBaseUrl, bearerToken);
  }

  startAutoSync(
    cloudBaseUrl: string,
    bearerToken: string,
    intervalMs = Number(process.env.EDGE_AUTO_SYNC_MS || 15000)
  ): void {
    this.syncClient.startAutoSync(cloudBaseUrl, bearerToken, intervalMs);
  }

  stopAutoSync(): void {
    this.syncClient.stopAutoSync();
  }

  getSyncState(): EdgeSyncState {
    return this.syncClient.syncState;
  }

  async listen(port = this.config.port ?? 3300): Promise<number> {
    await this.syncClient.ensureCursorLoaded();
    await new Promise<void>((resolve) => {
      this.server = this.app.listen(port, '0.0.0.0', () => resolve());
    });
    const addr = this.server!.address() as { port: number };
    return addr.port;
  }

  async close(): Promise<void> {
    this.syncClient.markClosed();
    if (this.server) {
      (this.server as any).closeAllConnections?.();
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
    this.driver.close();
  }
}

const isDirectEntry =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectEntry) {
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.EDGE_PORT || 3300);
  const storeId = (process.env.EDGE_STORE_ID || '').trim() || (isProd ? '' : 'store-1');
  const tenantId = (process.env.EDGE_TENANT_ID || '').trim() || (isProd ? '' : 'tenant-1');
  const rawCloudBaseUrl = process.env.CLOUD_BASE_URL || 'http://127.0.0.1:3000';
  let cloudBaseUrl = rawCloudBaseUrl;
  try {
    cloudBaseUrl = assertSecureCloudUrl(rawCloudBaseUrl);
  } catch (urlErr: any) {
    console.error(`[3C Edge Node Standard] ERRO FATAL CLOUD_BASE_URL: ${urlErr?.message || urlErr}`);
    process.exit(1);
  }
  const cloudToken = (process.env.EDGE_CLOUD_TOKEN || '').trim();

  if (!storeId || !tenantId) {
    console.error(
      '[3C Edge Node Standard] ERRO FATAL: EDGE_STORE_ID e EDGE_TENANT_ID são obrigatórios em NODE_ENV=production.'
    );
    process.exit(1);
  }

  if (!cloudToken) {
    console.warn(
      `[3C Edge Node Standard] AVISO: EDGE_CLOUD_TOKEN ausente para ${storeId}. Operando sem vínculo automático de sincronização Cloud (cloudLinkStatus=UNCONFIGURED).`
    );
  }

  const runtime = new EdgeNodeRuntime({
    port,
    storeId,
    tenantId,
    cloudBaseUrl,
  });

  runtime.listen(port).then(async (boundPort) => {
    console.log(
      `[3C Edge Node Standard] Running SQLite WAL (${runtime.driver.getWalMode()}) on http://0.0.0.0:${boundPort} (storeId=${storeId}, tenantId=${tenantId})`
    );
    if (cloudToken) {
      try {
        await runtime.bootstrapFromCloud(cloudBaseUrl, cloudToken);
        console.log(`[3C Edge Node Standard] Initial Cloud bootstrap completed for ${storeId}`);
      } catch (err: any) {
        console.warn(`[3C Edge Node Standard] Cloud bootstrap deferred (offline fallback): ${err?.message}`);
      }
      runtime.startAutoSync(cloudBaseUrl, cloudToken);
    }
  });

  let shuttingDown = false;
  const handleShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[3C Edge Node Standard] Recebido ${signal}. Encerrando HTTP e SQLite WAL...`);
    const forceTimer = setTimeout(() => process.exit(1), 8000);
    forceTimer.unref();
    try {
      await runtime.close();
    } finally {
      clearTimeout(forceTimer);
      process.exit(0);
    }
  };
  process.once('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.once('SIGINT', () => void handleShutdown('SIGINT'));
}
