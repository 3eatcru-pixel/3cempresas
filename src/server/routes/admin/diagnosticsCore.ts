import express from 'express';
import { db, getRuntimePersistenceCapabilities } from '../../config.ts';
import { resolvePostgresConnectionTarget } from '../../persistence/PostgresCloudDriver.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { recordAdminAuditEvent } from './adminHelpersCore.ts';
import { evaluateRestoreSnapshot } from './backupRestoreCore.ts';
import {
  disconnectSseSessions,
  getHttpGoldenSignalsSnapshot,
  unlockRateLimiterKey,
} from '../../telemetry.ts';
import diagnosticsFleetTablesSecurityCore from './diagnosticsFleetTablesSecurityCore.ts';

const router = express.Router();

export interface IntegrityAnomaly {
  id: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  collection: string;
  recordId: string;
  code: string;
  message: string;
}

const EDGE_STALE_MS = 15 * 60 * 1000;
const STALE_ORDER_MS = 24 * 60 * 60 * 1000;
const TERMINAL_ORDER_STATES = new Set(['COMPLETED', 'DELIVERED', 'CANCELLED', 'RETURNED']);

router.get(
  '/diagnostics/metrics',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  (_req, res) => {
    res.json(getHttpGoldenSignalsSnapshot());
  }
);

router.get(
  '/diagnostics/env-readiness',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (_req, res) => {
    const caps = getRuntimePersistenceCapabilities();
    const pgTarget = resolvePostgresConnectionTarget(process.env);
    const hasSecretFile = Boolean(process.env.SERVER_SECRET_PATH?.trim());
    const hasServerSecret = Boolean(process.env.SERVER_SECRET?.trim()) || hasSecretFile;
    const trustProxyConfigured =
      process.env.TRUST_PROXY === 'true' ||
      (process.env.TRUST_PROXY !== 'false' && (Boolean(process.env.K_SERVICE) || process.env.NODE_ENV === 'production'));

    let hqRuntimePolicy: any = {};
    let hasPaymentVault = false;
    try {
      const [govSnap, integSnap] = await Promise.all([
        db.collection('governance').doc('governance').get(),
        db.collection('integrations').get(),
      ]);
      hqRuntimePolicy = govSnap.exists ? govSnap.data()?.runtimePolicy || {} : {};
      hasPaymentVault = integSnap.docs.some((d) => {
        const i = d.data();
        return i && !i._deleted && i.status !== 'SUSPENDED' && i.category === 'PAYMENT' && Boolean(i.encryptedSecret);
      });
    } catch {
      // ignore diagnostic vault fallback error
    }

    const effectiveOriginsConfigured = Boolean(
      process.env.APP_URL?.trim() ||
        process.env.ALLOWED_ORIGINS?.trim() ||
        (Array.isArray(hqRuntimePolicy.extraAllowedOrigins) && hqRuntimePolicy.extraAllowedOrigins.length > 0)
    );
    const effectiveEmailUrl = Boolean(
      process.env.EMAIL_WEBHOOK_URL?.trim() || String(hqRuntimePolicy.emailWebhookUrl || '').trim()
    );

    const variables = [
      {
        key: 'SERVER_SECRET',
        scope: 'Segredo Server Core',
        configured: hasServerSecret,
        requiredInProduction: true,
        note: 'Segredo criptográfico aleatório do Server Core / Secret Manager (HMAC/AES).',
      },
      {
        key: 'DATABASE_URL / SQL_*',
        scope: 'PostgreSQL (Secret Manager)',
        configured: pgTarget.configured,
        requiredInProduction: true,
        note: pgTarget.configured
          ? `Conexão configurada via ${pgTarget.mode === 'url' ? 'DATABASE_URL' : 'variáveis Cloud SQL'}.`
          : pgTarget.missingReason || 'String/credencial real do PostgreSQL no Server Core.',
      },
      {
        key: 'ENABLE_POSTGRES_CLOUD',
        scope: 'PostgreSQL (Runtime)',
        configured: process.env.ENABLE_POSTGRES_CLOUD === 'true',
        requiredInProduction: true,
        note: 'Definir como true somente após provisionar o PostgreSQL Cloud.',
      },
      {
        key: 'PG_SSL_REJECT_UNAUTHORIZED',
        scope: 'PostgreSQL (Runtime)',
        configured: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false',
        requiredInProduction: false,
        note: 'true em produção com TLS confiável (desabilitado automaticamente em socket /cloudsql/).',
      },
      {
        key: 'TRUST_PROXY',
        scope: 'Server Core Runtime',
        configured: trustProxyConfigured,
        requiredInProduction: true,
        note: 'true atrás do balanceador HTTPS.',
      },
      {
        key: 'CLOUD_REGION',
        scope: 'Server Core Runtime',
        configured: Boolean(process.env.CLOUD_REGION?.trim()),
        requiredInProduction: false,
        note: 'Região do nó Cloud (ex.: us-west1 ou southamerica-east1).',
      },
      {
        key: 'APP_URL / ALLOWED_ORIGINS',
        scope: 'HQ + Server CORS',
        configured: effectiveOriginsConfigured,
        requiredInProduction: true,
        note: 'URLs oficiais autorizadas via env do Server Core ou runtimePolicy no HQ.',
      },
      {
        key: 'GEMINI_API_KEY',
        scope: 'Segredo Server Core',
        configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
        requiredInProduction: false,
        note: 'Chave server-side (Secret Manager) para busca inteligente no Marketplace.',
      },
      {
        key: 'PSP_WEBHOOK_SECRET',
        scope: 'Cofre HQ / Segredo Server',
        configured: Boolean(process.env.PSP_WEBHOOK_SECRET?.trim()) || hasPaymentVault,
        requiredInProduction: false,
        note: 'Segredo HMAC do webhook de pedidos (env ou cofre criptografado PAYMENT no HQ).',
      },
      {
        key: 'SAAS_PSP_WEBHOOK_SECRET',
        scope: 'Cofre HQ / Segredo Server',
        configured: Boolean(process.env.SAAS_PSP_WEBHOOK_SECRET?.trim()) || hasPaymentVault,
        requiredInProduction: false,
        note: 'Segredo HMAC de cobranças SaaS (env ou cofre criptografado PAYMENT no HQ).',
      },
      {
        key: 'EMAIL_WEBHOOK_URL / SECRET',
        scope: 'HQ + Segredo Server',
        configured: Boolean(effectiveEmailUrl && process.env.EMAIL_WEBHOOK_SECRET?.trim()),
        requiredInProduction: false,
        note: 'Endpoint via HQ (runtimePolicy) ou Server env + segredo HMAC no Secret Manager.',
      },
      {
        key: 'SERVER_STORAGE_DIR',
        scope: 'Server Core Storage',
        configured: Boolean(process.env.SERVER_STORAGE_DIR?.trim()),
        requiredInProduction: false,
        note: 'Diretório em volume persistente (cotas de upload governadas no HQ).',
      },
    ];

    res.json({
      checkedAt: new Date().toISOString(),
      serviceName: process.env.K_SERVICE || 'local-node',
      region: process.env.CLOUD_REGION || 'local',
      environmentMode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      dbConnectionMode: pgTarget.mode,
      sqlDbName: pgTarget.sqlDbName || null,
      persistenceDriver: caps.persistenceDriver,
      persistenceMode: caps.persistenceMode,
      productionDatabaseReady: caps.productionDatabaseReady,
      cloudProbeVerified: caps.cloudProbeVerified,
      cloudProbeError: caps.cloudProbeError,
      allowSandboxInProduction: process.env.ALLOW_SANDBOX_IN_PRODUCTION === 'true',
      seedDemoData: process.env.SEED_DEMO_DATA === 'true',
      variables,
    });
  }
);

router.post(
  '/diagnostics/rate-limits/unlock',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const limiter = typeof req.body?.limiter === 'string' && req.body.limiter.trim() ? req.body.limiter.trim() : undefined;
      const ip = typeof req.body?.ip === 'string' && req.body.ip.trim() ? req.body.ip.trim() : undefined;
      const cleared = unlockRateLimiterKey(limiter, ip);

      await recordAdminAuditEvent(
        'HQ_RATE_LIMIT_UNLOCK',
        `Desbloqueio de rate limit executado (${limiter || 'ALL'} / ${ip || 'ALL'}, ${cleared} entrada(s) removida(s))`,
        'hq/diagnostics',
        authenticatedUser.tenantId || 'tenant-1',
        {
          req,
          actor: authenticatedUser,
          resourceType: 'rate_limiter',
          resourceId: `${limiter || 'all'}:${ip || 'all'}`,
          after: { limiter: limiter || 'ALL', ip: ip || 'ALL', cleared },
        }
      );

      res.json({ success: true, cleared });
    } catch {
      res.status(500).json({ error: 'Falha ao desbloquear rate limit.' });
    }
  }
);

router.post(
  '/diagnostics/sse/disconnect',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const index = typeof req.body?.index === 'number' ? req.body.index : undefined;
      const uid = typeof req.body?.uid === 'string' ? req.body.uid.trim() : undefined;
      const tenantId = typeof req.body?.tenantId === 'string' ? req.body.tenantId.trim() : undefined;

      if (index === undefined && !uid && !tenantId) {
        return res.status(400).json({ error: 'Informe index, uid ou tenantId da sessão SSE para encerrar.' });
      }

      const disconnected = disconnectSseSessions({ index, uid, tenantId });
      await recordAdminAuditEvent(
        'HQ_SSE_DISCONNECT',
        `Encerramento manual de ${disconnected} conexão(ões) SSE`,
        'hq/diagnostics',
        authenticatedUser.tenantId || 'tenant-1',
        {
          req,
          actor: authenticatedUser,
          resourceType: 'sse_session',
          resourceId: uid || tenantId || String(index),
          after: { disconnected, index, uid, tenantId },
        }
      );

      res.json({ success: true, disconnected });
    } catch {
      res.status(500).json({ error: 'Falha ao encerrar sessão SSE.' });
    }
  }
);

router.get(
  '/diagnostics/integrity',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (_req, res) => {
    try {
      const snapshot = await db.exportSnapshotAsync();
      const nowMs = Date.now();
      const anomalies: IntegrityAnomaly[] = [];

      const tenants = (snapshot.tenants || []).filter((t: any) => !t?._deleted);
      const stores = (snapshot.stores || []).filter((s: any) => !s?._deleted);
      const users = (snapshot.users || []).filter((u: any) => !u?._deleted);
      const devices = (snapshot.device_licenses || []).filter((d: any) => !d?._deleted);
      const edgeNodes = (snapshot.edge_nodes || []).filter((n: any) => !n?._deleted);
      const orders = (snapshot.orders || []).filter((o: any) => !o?._deleted);
      const batches = (snapshot.inventory_batches || []).filter((b: any) => !b?._deleted);
      const menuItems = (snapshot.menu_items || []).filter((m: any) => !m?._deleted);

      const tenantIds = new Set(tenants.map((t: any) => String(t.id)));
      const storeIds = new Set(stores.map((s: any) => String(s.id)));

      const activeDevOwners = users.filter(
        (u: any) =>
          String(u?.role || '').toUpperCase() === 'DEV_OWNER' &&
          u?.status !== 'DISABLED' &&
          u?.disabled !== true
      );
      if (activeDevOwners.length === 0) {
        anomalies.push({
          id: 'anom-no-dev-owner',
          severity: 'CRITICAL',
          collection: 'users',
          recordId: 'global',
          code: 'NO_ACTIVE_DEV_OWNER',
          message: 'Nenhum usuário DEV_OWNER ativo encontrado na coleção users.',
        });
      }

      for (const st of stores) {
        if (st.tenantId && !tenantIds.has(String(st.tenantId))) {
          anomalies.push({
            id: `anom-store-tenant-${st.id}`,
            severity: 'CRITICAL',
            collection: 'stores',
            recordId: String(st.id),
            code: 'ORPHANED_TENANT_REF',
            message: `Loja "${st.name || st.id}" aponta para tenant inexistente (${st.tenantId}).`,
          });
        }
        if (
          st.saasPaymentStatus === 'OVERDUE' &&
          st.isOpen === true &&
          String(st.status || 'ACTIVE').toUpperCase() !== 'SUSPENDED'
        ) {
          anomalies.push({
            id: `anom-store-overdue-${st.id}`,
            severity: 'WARNING',
            collection: 'stores',
            recordId: String(st.id),
            code: 'OVERDUE_STORE_STILL_OPEN',
            message: `Loja "${st.name || st.id}" está OVERDUE no SaaS, mas permanece aberta (isOpen=true).`,
          });
        }
      }

      for (const usr of users) {
        if (!usr.passwordHash) {
          anomalies.push({
            id: `anom-usr-nohash-${usr.id}`,
            severity: 'CRITICAL',
            collection: 'users',
            recordId: String(usr.id),
            code: 'USER_MISSING_PASSWORD_HASH',
            message: `Usuário "${usr.email || usr.id}" está sem passwordHash (login bloqueado).`,
          });
        }
        const role = String(usr.role || '').toUpperCase();
        const isGlobal = ['DEV_OWNER', 'SUPER_ADMIN', 'CUSTOMER', 'CONSUMER'].includes(role);
        if (!isGlobal && usr.tenantId && !tenantIds.has(String(usr.tenantId))) {
          anomalies.push({
            id: `anom-usr-tenant-${usr.id}`,
            severity: 'WARNING',
            collection: 'users',
            recordId: String(usr.id),
            code: 'ORPHANED_TENANT_REF',
            message: `Usuário "${usr.email || usr.id}" (${role}) aponta para tenant inexistente (${usr.tenantId}).`,
          });
        }
        if (usr.storeId && !storeIds.has(String(usr.storeId))) {
          anomalies.push({
            id: `anom-usr-store-${usr.id}`,
            severity: 'WARNING',
            collection: 'users',
            recordId: String(usr.id),
            code: 'ORPHANED_STORE_REF',
            message: `Usuário "${usr.email || usr.id}" aponta para loja inexistente (${usr.storeId}).`,
          });
        }
      }

      for (const dev of devices) {
        if (dev.storeId && !storeIds.has(String(dev.storeId))) {
          anomalies.push({
            id: `anom-dev-store-${dev.id}`,
            severity: 'WARNING',
            collection: 'device_licenses',
            recordId: String(dev.id),
            code: 'ORPHANED_STORE_REF',
            message: `Dispositivo "${dev.name || dev.id}" vinculado a loja inexistente (${dev.storeId}).`,
          });
        }
        if (dev.status === 'PENDING_PAIRING' && dev.pairingCodeExpiresAt) {
          const expMs = Date.parse(String(dev.pairingCodeExpiresAt));
          if (Number.isFinite(expMs) && expMs < nowMs) {
            anomalies.push({
              id: `anom-dev-exp-${dev.id}`,
              severity: 'INFO',
              collection: 'device_licenses',
              recordId: String(dev.id),
              code: 'EXPIRED_PAIRING_CODE',
              message: `Terminal "${dev.name || dev.id}" aguarda pareamento com código expirado.`,
            });
          }
        }
      }

      for (const node of edgeNodes) {
        if (node.storeId && !storeIds.has(String(node.storeId))) {
          anomalies.push({
            id: `anom-edge-store-${node.id}`,
            severity: 'WARNING',
            collection: 'edge_nodes',
            recordId: String(node.id),
            code: 'ORPHANED_STORE_REF',
            message: `Edge Node "${node.id}" aponta para loja inexistente (${node.storeId}).`,
          });
        }
        if (node.status !== 'REVOKED' && node.lastHeartbeatAt) {
          const hbMs = Date.parse(String(node.lastHeartbeatAt));
          if (Number.isFinite(hbMs) && nowMs - hbMs > EDGE_STALE_MS) {
            const mins = Math.round((nowMs - hbMs) / 60000);
            anomalies.push({
              id: `anom-edge-stale-${node.id}`,
              severity: 'WARNING',
              collection: 'edge_nodes',
              recordId: String(node.id),
              code: 'EDGE_HEARTBEAT_STALE',
              message: `Edge Node "${node.id}" (${node.storeId}) sem heartbeat há ${mins} min.`,
            });
          }
        }
      }

      for (const b of batches) {
        if (typeof b.quantity === 'number' && b.quantity < 0) {
          anomalies.push({
            id: `anom-batch-neg-${b.id}`,
            severity: 'CRITICAL',
            collection: 'inventory_batches',
            recordId: String(b.id),
            code: 'NEGATIVE_BATCH_QUANTITY',
            message: `Lote "${b.name || b.id}" com quantidade negativa (${b.quantity}).`,
          });
        }
      }

      for (const m of menuItems) {
        if (typeof m.stock === 'number' && m.stock < 0) {
          anomalies.push({
            id: `anom-item-neg-${m.id}`,
            severity: 'WARNING',
            collection: 'menu_items',
            recordId: String(m.id),
            code: 'NEGATIVE_MENU_STOCK',
            message: `Produto "${m.name || m.id}" com saldo negativo (${m.stock}).`,
          });
        }
      }

      for (const ord of orders) {
        const st = String(ord.status || '').toUpperCase();
        if (!TERMINAL_ORDER_STATES.has(st) && ord.createdAt) {
          const createdMs = Date.parse(String(ord.createdAt));
          if (Number.isFinite(createdMs) && nowMs - createdMs > STALE_ORDER_MS) {
            const hrs = Math.round((nowMs - createdMs) / 3600000);
            anomalies.push({
              id: `anom-order-stale-${ord.id}`,
              severity: 'INFO',
              collection: 'orders',
              recordId: String(ord.id),
              code: 'STALE_OPEN_ORDER',
              message: `Pedido "${ord.code || ord.id}" permanece em "${st}" há ${hrs}h.`,
            });
          }
        }
      }

      const openSyncConflicts = (snapshot.sync_conflicts || []).filter(
        (c: any) => !c?._deleted && (c?.status || 'OPEN') === 'OPEN'
      );
      if (openSyncConflicts.length > 0) {
        anomalies.push({
          id: 'anom-open-sync-conflicts',
          severity: 'WARNING',
          collection: 'sync_conflicts',
          recordId: `${openSyncConflicts.length}`,
          code: 'OPEN_EDGE_SYNC_CONFLICTS',
          message: `${openSyncConflicts.length} conflito(s)/rejeição(ões) de sincronização Edge pendentes na fila DLQ.`,
        });
      }

      const collectionCounts: Record<string, number> = {
        tenants: tenants.length,
        stores: stores.length,
        users: users.length,
        device_licenses: devices.length,
        edge_nodes: edgeNodes.length,
        orders: orders.length,
        menu_items: menuItems.length,
        inventory_batches: batches.length,
        stock_ledger: (snapshot.stock_ledger || []).length,
        sync_outbox: (snapshot.sync_outbox || []).length,
        sync_conflicts_open: openSyncConflicts.length,
        financial_records: (snapshot.financial_records || []).filter((f: any) => !f?._deleted).length,
        integrations: (snapshot.integrations || []).filter((i: any) => !i?._deleted).length,
        peripherals: (snapshot.peripherals || []).filter((p: any) => !p?._deleted).length,
        print_jobs: (snapshot.print_jobs || []).filter((j: any) => !j?._deleted).length,
        suppliers: (snapshot.suppliers || []).filter((s: any) => !s?._deleted).length,
        coupons: (snapshot.coupons || []).filter((c: any) => !c?._deleted).length,
        drivers: (snapshot.drivers || []).filter((d: any) => !d?._deleted).length,
        consumers: (snapshot.consumers || []).filter((c: any) => !c?._deleted).length,
        events: (snapshot.events || []).length,
        audit_logs: (snapshot.audit_logs || []).length,
      };

      const criticalCount = anomalies.filter((a) => a.severity === 'CRITICAL').length;
      const warningCount = anomalies.filter((a) => a.severity === 'WARNING').length;
      const infoCount = anomalies.filter((a) => a.severity === 'INFO').length;

      res.json({
        checkedAt: new Date(nowMs).toISOString(),
        totalAnomalies: anomalies.length,
        criticalCount,
        warningCount,
        infoCount,
        collectionCounts,
        anomalies,
      });
    } catch {
      res.status(500).json({ error: 'Falha ao executar auditoria determinística de integridade.' });
    }
  }
);

router.post(
  '/diagnostics/restore-preview',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const { tables, schemaVersion, version, checksum } = req.body || {};
      const currentSnapshot = await db.exportSnapshotAsync();
      const preview = evaluateRestoreSnapshot(
        { tables, schemaVersion, version, checksum },
        currentSnapshot
      );
      res.json(preview);
    } catch {
      res.status(500).json({ error: 'Falha ao simular dry-run de restauração.' });
    }
  }
);

router.use(diagnosticsFleetTablesSecurityCore);

export default router;
