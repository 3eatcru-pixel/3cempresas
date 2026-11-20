import express from 'express';
import fs from 'fs';
import path from 'path';
import { compareSemver, RELEASE_MANAGER_MANIFEST } from '@3c/contracts';
import { db, getRuntimePersistenceCapabilities } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { HQ_ONLY_ROLES, recordAdminAuditEvent } from './adminHelpersCore.ts';
import {
  ALLOWED_RESTORE_TABLES,
  sanitizeSnapshotForBackup,
} from './backupRestoreCore.ts';
import {
  getHttpGoldenSignalsSnapshot,
  getObservedClientsSnapshot,
} from '../../telemetry.ts';

const router = express.Router();

router.get(
  '/diagnostics/fleet',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (_req, res) => {
    try {
      const [devicesSnap, nodesSnap, storesSnap] = await Promise.all([
        db.collection('device_licenses').get(),
        db.collection('edge_nodes').get(),
        db.collection('stores').get(),
      ]);

      const storeNames = new Map<string, string>(
        storesSnap.docs.map((d) => [d.id, String(d.data()?.name || d.id)])
      );
      const latestStoreOs = RELEASE_MANAGER_MANIFEST.products['store-os'];
      const latestEdge = RELEASE_MANAGER_MANIFEST.products['server-core'];

      const classifyVersion = (current: string | undefined, target: typeof latestStoreOs) => {
        if (!current) return 'UNKNOWN';
        if (compareSemver(current, target.minSupportedVersion) < 0) return 'UNSUPPORTED';
        if (compareSemver(current, target.latestVersion) < 0) return 'OUTDATED';
        return 'UP_TO_DATE';
      };

      const devices = devicesSnap.docs
        .map((d) => d.data())
        .filter((d) => !d?._deleted)
        .map((d) => ({
          id: String(d.id),
          kind: 'DEVICE',
          name: String(d.name || d.id),
          type: String(d.type || 'POS'),
          storeId: String(d.storeId || ''),
          storeName: storeNames.get(String(d.storeId || '')) || String(d.storeId || '--'),
          appVersion: String(d.appVersion || '5.2.1'),
          status: String(d.status || 'OFFLINE'),
          lastPing: d.lastHeartbeatAt || d.lastPing || null,
          compatibility: classifyVersion(d.appVersion || '5.2.1', latestStoreOs),
        }));

      const edgeNodes = nodesSnap.docs
        .map((d) => d.data())
        .filter((n) => !n?._deleted)
        .map((n) => ({
          id: String(n.nodeId || n.id),
          kind: 'EDGE_NODE',
          name: String(n.hostname || n.id),
          type: String(n.platform || 'linux'),
          storeId: String(n.storeId || ''),
          storeName: storeNames.get(String(n.storeId || '')) || String(n.storeId || '--'),
          appVersion: String(n.appVersion || '5.2.1'),
          status: String(n.status || 'ONLINE'),
          lastPing: n.lastHeartbeatAt || null,
          compatibility: classifyVersion(n.appVersion || '5.2.1', latestEdge),
        }));

      const allFleet = [...devices, ...edgeNodes];
      const counts = {
        total: allFleet.length,
        upToDate: allFleet.filter((f) => f.compatibility === 'UP_TO_DATE').length,
        outdated: allFleet.filter((f) => f.compatibility === 'OUTDATED').length,
        unsupported: allFleet.filter((f) => f.compatibility === 'UNSUPPORTED').length,
      };

      res.json({
        generatedAt: new Date().toISOString(),
        latestTargetVersion: latestStoreOs.latestVersion,
        minSupportedVersion: latestStoreOs.minSupportedVersion,
        counts,
        fleet: allFleet,
        observedHttpClients: getObservedClientsSnapshot(),
      });
    } catch {
      res.status(500).json({ error: 'Falha ao consolidar matriz de versões da frota.' });
    }
  }
);

router.get(
  '/diagnostics/sync-conflicts',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const requestedStatus = req.query.status ? String(req.query.status).toUpperCase() : '';
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
      const snap = await db.collection('sync_conflicts').get();
      const all = snap.docs
        .map((d) => d.data())
        .filter((c) => !c?._deleted);
      const totalOpen = all.filter((c) => (c?.status || 'OPEN') === 'OPEN').length;

      let filtered = all;
      if (requestedStatus && requestedStatus !== 'ALL') {
        filtered = filtered.filter((c) => String(c?.status || 'OPEN').toUpperCase() === requestedStatus);
      }

      filtered.sort((a, b) => String(b?.detectedAt || '').localeCompare(String(a?.detectedAt || '')));
      res.json({
        total: all.length,
        totalOpen,
        conflicts: filtered.slice(0, limit),
      });
    } catch {
      res.status(500).json({ error: 'Falha ao listar conflitos e rejeições de sincronização Edge.' });
    }
  }
);

router.post(
  '/diagnostics/sync-conflicts/:id/resolve',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const { id } = req.params;
      const requestedAction = String(req.body?.action || 'RESOLVED').trim().toUpperCase();
      if (requestedAction !== 'RESOLVED' && requestedAction !== 'DISCARDED') {
        return res.status(400).json({ error: 'Ação inválida: use RESOLVED ou DISCARDED.' });
      }
      const resolutionNote = typeof req.body?.resolutionNote === 'string'
        ? req.body.resolutionNote.trim().slice(0, 300)
        : '';

      const docRef = db.collection('sync_conflicts').doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(404).json({ error: 'Registro de conflito Edge não encontrado.' });
      }

      const existing = snap.data() || {};
      const nowIso = new Date().toISOString();
      const updated = {
        ...existing,
        status: requestedAction,
        resolvedAt: nowIso,
        resolvedByUid: authenticatedUser.uid,
        resolvedByEmail: authenticatedUser.email || null,
        resolutionNote:
          resolutionNote ||
          (requestedAction === 'DISCARDED'
            ? 'Descartado na triagem DEV_OWNER'
            : 'Marcado como resolvido na triagem DEV_OWNER'),
      };

      await docRef.update({
        status: updated.status,
        resolvedAt: updated.resolvedAt,
        resolvedByUid: updated.resolvedByUid,
        resolvedByEmail: updated.resolvedByEmail,
        resolutionNote: updated.resolutionNote,
      });

      await recordAdminAuditEvent(
        'HQ_SYNC_CONFLICT_RESOLVED',
        `Conflito Edge '${id}' (${existing.entity}/${existing.entityId} — ${existing.reason}) marcado como ${requestedAction}`,
        'hq/diagnostics',
        existing.tenantId || authenticatedUser.tenantId || 'tenant-1',
        {
          req,
          actor: authenticatedUser,
          resourceType: 'sync_conflicts',
          resourceId: id,
          before: { status: existing.status || 'OPEN' },
          after: { status: requestedAction, resolutionNote: updated.resolutionNote },
        }
      );

      res.json({ success: true, conflict: updated });
    } catch {
      res.status(500).json({ error: 'Falha ao atualizar status do conflito Edge.' });
    }
  }
);

const ECOSYSTEM_TABLE_CATALOG: {
  name: string;
  category: 'GOVERNANCE' | 'COMMERCE' | 'FINANCE_STOCK' | 'HARDWARE_SYNC';
  description: string;
}[] = [
  { name: 'governance', category: 'GOVERNANCE', description: 'Parâmetros globais, comissões, feature flags e preços SaaS' },
  { name: 'tenants', category: 'GOVERNANCE', description: 'Empresas multi-tenant, status contratual e cotas' },
  { name: 'stores', category: 'GOVERNANCE', description: 'Lojas matrizes e filiais, configurações operacionais e planos' },
  { name: 'users', category: 'GOVERNANCE', description: 'Contas unificadas RBAC (HQ, Lojistas, Equipe, Entregadores, Consumidores)' },
  { name: 'integrations', category: 'GOVERNANCE', description: 'Provedores externos, gateways e webhooks assinados' },
  { name: 'events', category: 'GOVERNANCE', description: 'Trilha de auditoria administrativa e eventos do cluster' },
  { name: 'audit_logs', category: 'GOVERNANCE', description: 'Trilha de auditoria operacional de lojas e ações críticas' },
  { name: 'orders', category: 'COMMERCE', description: 'Pedidos transacionais (Marketplace, PDV, Garçom/Mesa, Kiosk)' },
  { name: 'menu_items', category: 'COMMERCE', description: 'Catálogo de produtos, preços, fichas técnicas e disponibilidade' },
  { name: 'tables', category: 'COMMERCE', description: 'Mapa de mesas, comandas e ocupação de salão' },
  { name: 'reservations', category: 'COMMERCE', description: 'Reservas de mesas e agendamentos de clientes' },
  { name: 'coupons', category: 'COMMERCE', description: 'Campanhas de cupons B2C (Consumidor) e B2B (Lojista SaaS)' },
  { name: 'consumers', category: 'COMMERCE', description: 'Perfis de consumidores do Marketplace, endereços e fidelidade' },
  { name: 'drivers', category: 'COMMERCE', description: 'Frota de entregadores (Plataforma HQ e Frota Própria)' },
  { name: 'inventory_batches', category: 'FINANCE_STOCK', description: 'Lotes de estoque PEPS/FEFO, validade e custo unitário' },
  { name: 'stock_ledger', category: 'FINANCE_STOCK', description: 'Livro-razão imutável de movimentações de estoque' },
  { name: 'suppliers', category: 'FINANCE_STOCK', description: 'Fornecedores homologados e contatos por loja/tenant' },
  { name: 'financial_records', category: 'FINANCE_STOCK', description: 'Lançamentos financeiros DRE, receitas, despesas e taxas' },
  { name: 'cash_sessions', category: 'FINANCE_STOCK', description: 'Sessões de caixa PDV, sangrias, suprimentos e fechamentos' },
  { name: 'payment_configs', category: 'FINANCE_STOCK', description: 'Configurações de chave PIX e recebedor por loja' },
  { name: 'device_licenses', category: 'HARDWARE_SYNC', description: 'Licenças de terminais (PDV, KDS, Garçom, Totem) e pareamento CSPRNG' },
  { name: 'peripherals', category: 'HARDWARE_SYNC', description: 'Impressoras térmicas ESC/POS e balanças seriais por estação' },
  { name: 'print_jobs', category: 'HARDWARE_SYNC', description: 'Fila de impressão de cupons e comandas de produção' },
  { name: 'edge_nodes', category: 'HARDWARE_SYNC', description: 'Nós Edge LAN SQLite WAL registrados nas lojas' },
  { name: 'sync_outbox', category: 'HARDWARE_SYNC', description: 'Fila Outbox HLC de replicação Cloud <-> Edge' },
  { name: 'sync_conflicts', category: 'HARDWARE_SYNC', description: 'Fila DLQ de conflitos e mutações rejeitadas no Sync' },
  { name: 'storage_objects', category: 'GOVERNANCE', description: 'Metadados de arquivos armazenados (Cofre Pessoal do Consumidor e Lojas)' },
  { name: 'city_maps_data', category: 'GOVERNANCE', description: 'Índice territorial City Maps Data (Brasil, Estado, Cidade, Região, Bairro, Rua, Número, CEP)' },
];

const ALLOWED_INSPECT_TABLES = new Set([
  ...Array.from(ALLOWED_RESTORE_TABLES),
  ...ECOSYSTEM_TABLE_CATALOG.map((t) => t.name),
]);

router.get(
  '/diagnostics/tables',
  verifyAutonomousToken,
  requireRoles(HQ_ONLY_ROLES),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const isDevOwner = authenticatedUser.role === 'DEV_OWNER';
      const requestedTable = req.query.table ? String(req.query.table).trim() : 'stores';
      if (!ALLOWED_INSPECT_TABLES.has(requestedTable)) {
        return res.status(400).json({
          error: `Tabela '${requestedTable}' não permitida no inspetor do ecossistema.`,
        });
      }
      if (!isDevOwner && (requestedTable === 'integrations' || requestedTable === 'governance')) {
        return res.status(403).json({
          error: `Inspeção direta da tabela '${requestedTable}' é restrita ao DEV_OWNER.`,
        });
      }

      const includeDeleted = req.query.includeDeleted === 'true';
      const filterTenantId = req.query.tenantId ? String(req.query.tenantId).trim() : '';
      const filterStoreId = req.query.storeId ? String(req.query.storeId).trim() : '';
      const searchQuery = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
      const limit = Math.min(250, Math.max(1, Number(req.query.limit) || 100));
      const offset = Math.max(0, Number(req.query.offset) || 0);

      const rawSnapshot = await db.exportSnapshotAsync();
      const sanitizedSnapshot = sanitizeSnapshotForBackup(rawSnapshot);

      const tablesCatalog = ECOSYSTEM_TABLE_CATALOG.map((meta) => {
        const rawList = Array.isArray(sanitizedSnapshot[meta.name]) ? sanitizedSnapshot[meta.name] : [];
        const activeList = includeDeleted ? rawList : rawList.filter((r: any) => !r?._deleted);
        return {
          ...meta,
          count: activeList.length,
        };
      });

      const rawRows = Array.isArray(sanitizedSnapshot[requestedTable])
        ? sanitizedSnapshot[requestedTable]
        : [];
      let filteredRows = includeDeleted ? rawRows : rawRows.filter((r: any) => !r?._deleted);

      if (!isDevOwner && requestedTable === 'users') {
        filteredRows = filteredRows.filter(
          (u: any) => String(u?.role || '').toUpperCase() !== 'DEV_OWNER'
        );
      }

      filteredRows = filteredRows.map((row: any) => {
        if (!row || typeof row !== 'object') return row;
        const copy = { ...row };
        delete copy.waiterPairingPin;
        delete copy.webhookSecret;
        delete copy.secretKey;
        delete copy.encryptedSecret;
        delete copy.apiKey;
        delete copy.token;
        delete copy.passwordHash;
        delete copy.passwordResetCodeHash;
        delete copy.tokenHash;
        delete copy.pairPinHash;
        return copy;
      });

      if (filterTenantId && filterTenantId !== 'ALL') {
        filteredRows = filteredRows.filter(
          (r: any) => String(r?.tenantId || r?.id || '') === filterTenantId
        );
      }
      if (filterStoreId && filterStoreId !== 'ALL') {
        filteredRows = filteredRows.filter(
          (r: any) => String(r?.storeId || r?.id || '') === filterStoreId
        );
      }
      if (searchQuery) {
        filteredRows = filteredRows.filter((r: any) =>
          JSON.stringify(r || {}).toLowerCase().includes(searchQuery)
        );
      }

      filteredRows.sort((a: any, b: any) => {
        const ta = String(a?.updatedAt || a?.createdAt || a?.timestamp || a?.id || '');
        const tb = String(b?.updatedAt || b?.createdAt || b?.timestamp || b?.id || '');
        return tb.localeCompare(ta);
      });

      const caps = getRuntimePersistenceCapabilities();
      const mem = process.memoryUsage();
      const goldenSignals = isDevOwner ? getHttpGoldenSignalsSnapshot() : null;

      res.json({
        inspectedAt: new Date().toISOString(),
        selectedTable: requestedTable,
        totalRows: filteredRows.length,
        offset,
        limit,
        rows: filteredRows.slice(offset, offset + limit),
        tablesCatalog,
        telemetrySummary: isDevOwner && goldenSignals
          ? {
              uptimeSeconds: Math.floor(process.uptime()),
              memoryRssMb: Math.round(mem.rss / (1024 * 1024)),
              heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
              persistenceDriver: caps.persistenceDriver,
              persistenceMode: caps.persistenceMode,
              productionDatabaseReady: caps.productionDatabaseReady,
              summary: goldenSignals.summary,
              domains: goldenSignals.domains,
              rateLimits: goldenSignals.rateLimits,
              sseSessionsCount: goldenSignals.sseSessions.length,
            }
          : {
              persistenceDriver: caps.persistenceDriver,
              persistenceMode: caps.persistenceMode,
              productionDatabaseReady: caps.productionDatabaseReady,
            },
      });
    } catch {
      res.status(500).json({ error: 'Falha ao inspecionar tabelas do ecossistema.' });
    }
  }
);

router.get(
  '/diagnostics/account-security',
  verifyAutonomousToken,
  requireRoles(HQ_ONLY_ROLES),
  async (_req, res) => {
    try {
      const [usersSnap, resetsSnap] = await Promise.all([
        db.collection('users').get(),
        db.collection('password_resets').get().catch(() => ({ docs: [] as any[] })),
      ]);

      const nowMs = Date.now();
      const activeUsers = usersSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u: any) => !u?._deleted);

      const roleBreakdown: Record<string, number> = {};
      let activeCount = 0;
      let disabledCount = 0;
      let mustChangePasswordCount = 0;
      let customBlockedAppsCount = 0;
      let multiBranchAccountsCount = 0;

      for (const u of activeUsers as any[]) {
        const role = String(u.role || 'CUSTOMER').toUpperCase();
        roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
        if (u.status === 'DISABLED' || u.disabled === true) {
          disabledCount++;
        } else {
          activeCount++;
        }
        if (u.mustChangePassword === true) mustChangePasswordCount++;
        if (Array.isArray(u.blockedApps) && u.blockedApps.length > 0) customBlockedAppsCount++;
        if (Array.isArray(u.allowedStoreIds) && u.allowedStoreIds.length > 1) multiBranchAccountsCount++;
      }

      const resetDocsByUid = new Map<string, any>();
      for (const d of resetsSnap.docs) {
        const data = d.data() || {};
        const uid = String(data.uid || data.userId || d.id);
        resetDocsByUid.set(uid, data);
      }

      const passwordRecoveryQueue = activeUsers
        .filter((u: any) => {
          const uid = String(u.uid || u.id);
          const resetDoc = resetDocsByUid.get(uid);
          const expRaw = u.resetCodeExpiresAt || resetDoc?.expiresAt;
          const hasActiveReset = expRaw && Date.parse(String(expRaw)) > nowMs && !resetDoc?.usedAt;
          return Boolean(hasActiveReset || u.mustChangePassword === true);
        })
        .map((u: any) => {
          const uid = String(u.uid || u.id);
          const resetDoc = resetDocsByUid.get(uid);
          const expRaw = u.resetCodeExpiresAt || resetDoc?.expiresAt || null;
          return {
            uid,
            name: u.name || u.email || uid,
            email: u.email || '',
            role: u.role || 'CUSTOMER',
            tenantId: u.tenantId || 'tenant-1',
            storeId: u.storeId || null,
            mustChangePassword: Boolean(u.mustChangePassword),
            hasPendingSupportCode: Boolean(expRaw && Date.parse(String(expRaw)) > nowMs),
            expiresAt: expRaw,
            requestedAt: resetDoc?.createdAt || u.updatedAt || null,
          };
        });

      res.json({
        checkedAt: new Date().toISOString(),
        summary: {
          totalAccounts: activeUsers.length,
          activeCount,
          disabledCount,
          mustChangePasswordCount,
          customBlockedAppsCount,
          multiBranchAccountsCount,
          roleBreakdown,
        },
        totalAccounts: activeUsers.length,
        activeCount,
        disabledCount,
        mustChangePasswordCount,
        customBlockedAppsCount,
        multiBranchAccountsCount,
        roleBreakdown,
        passwordRecoveryQueue,
      });
    } catch {
      res.status(500).json({ error: 'Falha ao consolidar telemetria de segurança de contas.' });
    }
  }
);

router.get(
  '/diagnostics/sentinel-logs',
  verifyAutonomousToken,
  requireRoles(HQ_ONLY_ROLES),
  (_req, res) => {
    try {
      const sentinelDir = path.join(process.cwd(), '.sentinel');
      const readJsonSafe = (fileName: string) => {
        const p = path.join(sentinelDir, fileName);
        if (!fs.existsSync(p)) return null;
        try {
          return JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch {
          return null;
        }
      };

      const latestReport = readJsonSafe('report-latest.json');
      const deficiencies = readJsonSafe('deficiencies-log.json');
      const improvements = readJsonSafe('improvements-log.json');

      let history: any[] = [];
      const historyPath = path.join(sentinelDir, 'audit-history.ndjson');
      if (fs.existsSync(historyPath)) {
        history = fs
          .readFileSync(historyPath, 'utf8')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(-20)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(Boolean)
          .reverse();
      }

      res.json({
        available: Boolean(latestReport || deficiencies || improvements),
        executedAt: latestReport?.executedAt || deficiencies?.generatedAt || null,
        summary: latestReport?.summary || null,
        deficiencies: deficiencies || { counts: { open: 0, advisory: 0, total: 0 }, entries: [] },
        improvements: improvements || { counts: { verified: 0, recommended: 0 }, monolithCandidates: [], entries: [] },
        history,
      });
    } catch {
      res.status(500).json({ error: 'Falha ao ler logs do 3C Sentinel.' });
    }
  }
);

export default router;
