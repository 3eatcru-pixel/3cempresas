import express from 'express';
import fs from 'fs';
import path from 'path';
import { computeSnapshotChecksum, db, verifySnapshotChecksum } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { recordAdminAuditEvent, stripPrototypePollution } from './adminHelpersCore.ts';

const router = express.Router();

export const SUPPORTED_BACKUP_SCHEMA_VERSIONS = new Set(['1.0.3']);
export const MANDATORY_RESTORE_COLLECTIONS = ['governance', 'tenants', 'stores', 'users'];

export const ALLOWED_RESTORE_TABLES = new Set([
  'tenants',
  'stores',
  'users',
  'admins',
  'consumers',
  'device_licenses',
  'menu_items',
  'coupons',
  'orders',
  'order_idempotency_keys',
  'drivers',
  'tables',
  'integrations',
  'inventory_batches',
  'financial_records',
  'suppliers',
  'customers_crm',
  'automated_messages',
  'governance',
  'payment_configs',
  'reservations',
  'subscription_requests',
  'cash_sessions',
  'cash_movements',
  'events',
  'audit_logs',
  'edge_nodes',
  'sync_outbox',
  'sync_processed_keys',
  'sync_conflicts',
  'stock_ledger',
  'reviews',
  'loyalty_accounts',
  'peripherals',
  'print_jobs',
  'storage_objects',
  'payment_webhook_events',
  'saas_billing_webhook_events',
  'city_maps_data',
]);

export interface RestoreCollectionDiff {
  collection: string;
  currentCount: number;
  snapshotCount: number;
  added: number;
  updated: number;
  removed: number;
}

export interface RestorePreviewResult {
  valid: boolean;
  schemaValid: boolean;
  checksumValid: boolean;
  hasActiveDevOwner: boolean;
  errors: string[];
  warnings: string[];
  lockoutRisks: {
    usersMissingPasswordHash: number;
    devicesMissingTokenHash: number;
    integrationsMissingSecret: number;
  };
  diffs: RestoreCollectionDiff[];
}

export function evaluateRestoreSnapshot(
  params: {
    tables: any;
    schemaVersion?: string;
    version?: string;
    checksum?: string;
  },
  currentSnapshot: Record<string, any[]>
): RestorePreviewResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { tables, schemaVersion, version, checksum } = params;

  if (!tables || typeof tables !== 'object' || Array.isArray(tables)) {
    return {
      valid: false,
      schemaValid: false,
      checksumValid: false,
      hasActiveDevOwner: false,
      errors: ['Payload inválido: objeto tables obrigatório para restauração.'],
      warnings: [],
      lockoutRisks: { usersMissingPasswordHash: 0, devicesMissingTokenHash: 0, integrationsMissingSecret: 0 },
      diffs: [],
    };
  }

  const effectiveSchema = String(schemaVersion || '');
  const schemaValid = Boolean(effectiveSchema && SUPPORTED_BACKUP_SCHEMA_VERSIONS.has(effectiveSchema));
  if (!schemaValid) {
    errors.push(
      `Versão de esquema '${effectiveSchema || version || 'AUSENTE'}' não suportada para restauração. Suportadas: [${Array.from(SUPPORTED_BACKUP_SCHEMA_VERSIONS).join(', ')}].`
    );
  }

  const checksumValid = verifySnapshotChecksum(tables, checksum);
  if (!checksumValid) {
    errors.push('Assinatura/checksum HMAC do snapshot ausente ou inválido.');
  }

  for (const mandatoryCol of MANDATORY_RESTORE_COLLECTIONS) {
    if (!Array.isArray(tables[mandatoryCol])) {
      errors.push(`Snapshot incompleto: coleção obrigatória '${mandatoryCol}' ausente.`);
    } else if (mandatoryCol !== 'governance' && tables[mandatoryCol].length === 0) {
      errors.push(`Snapshot inválido: coleção obrigatória '${mandatoryCol}' não pode estar vazia.`);
    }
  }

  for (const [key, items] of Object.entries(tables)) {
    if (!ALLOWED_RESTORE_TABLES.has(key)) {
      errors.push(`Coleção não permitida ou inválida para restauração: ${key}`);
      continue;
    }
    if (!Array.isArray(items)) {
      errors.push(`Coleção '${key}' deve ser um array de registros.`);
      continue;
    }
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.id !== 'string' || !item.id.trim()) {
        errors.push(`Registro inválido em '${key}': cada item deve possuir 'id' string não vazio.`);
        break;
      }
    }
  }

  const tenantIds = new Set((Array.isArray(tables.tenants) ? tables.tenants : []).map((t: any) => String(t?.id)));
  const storeIds = new Set((Array.isArray(tables.stores) ? tables.stores : []).map((s: any) => String(s?.id)));

  for (const st of Array.isArray(tables.stores) ? tables.stores : []) {
    if (st?.tenantId && !tenantIds.has(String(st.tenantId))) {
      errors.push(`Integridade referencial violada: loja '${st.id}' aponta para tenant inexistente '${st.tenantId}'.`);
      break;
    }
  }
  for (const dev of Array.isArray(tables.device_licenses) ? tables.device_licenses : []) {
    if (dev?.storeId && !storeIds.has(String(dev.storeId))) {
      errors.push(`Integridade referencial violada: dispositivo '${dev.id}' aponta para loja inexistente '${dev.storeId}'.`);
      break;
    }
  }
  for (const usr of Array.isArray(tables.users) ? tables.users : []) {
    const isGlobalRole =
      usr?.role === 'DEV_OWNER' ||
      usr?.role === 'SUPER_ADMIN' ||
      usr?.role === 'CUSTOMER' ||
      usr?.role === 'CONSUMER';
    if (!isGlobalRole && usr?.tenantId && !tenantIds.has(String(usr.tenantId))) {
      errors.push(`Integridade referencial violada: usuário '${usr.id}' aponta para tenant inexistente '${usr.tenantId}'.`);
      break;
    }
    if (usr?.storeId && !storeIds.has(String(usr.storeId))) {
      errors.push(`Integridade referencial violada: usuário '${usr.id}' aponta para loja inexistente '${usr.storeId}'.`);
      break;
    }
  }
  const hasActiveDevOwner = (Array.isArray(tables.users) ? tables.users : []).some(
    (u: any) =>
      String(u?.role || '').toUpperCase() === 'DEV_OWNER' &&
      u?.status !== 'DISABLED' &&
      u?.disabled !== true
  );
  if (!hasActiveDevOwner) {
    errors.push(
      'Snapshot rejeitado: a coleção users deve conter pelo menos um DEV_OWNER ativo para evitar bloqueio permanente da plataforma.'
    );
  }
  for (const ord of Array.isArray(tables.orders) ? tables.orders : []) {
    if (ord?.tenantId && !tenantIds.has(String(ord.tenantId))) {
      errors.push(`Integridade referencial violada: pedido '${ord.id}' aponta para tenant inexistente '${ord.tenantId}'.`);
      break;
    }
    if (ord?.storeId && !storeIds.has(String(ord.storeId))) {
      errors.push(`Integridade referencial violada: pedido '${ord.id}' aponta para loja inexistente '${ord.storeId}'.`);
      break;
    }
  }
  for (const fin of Array.isArray(tables.financial_records) ? tables.financial_records : []) {
    if (fin?.tenantId && !tenantIds.has(String(fin.tenantId))) {
      errors.push(`Integridade referencial violada: lançamento '${fin.id}' aponta para tenant inexistente '${fin.tenantId}'.`);
      break;
    }
  }
  for (const bat of Array.isArray(tables.inventory_batches) ? tables.inventory_batches : []) {
    if (bat?.tenantId && !tenantIds.has(String(bat.tenantId))) {
      errors.push(`Integridade referencial violada: lote '${bat.id}' aponta para tenant inexistente '${bat.tenantId}'.`);
      break;
    }
  }

  const existingUsersById = new Map<string, any>(
    (currentSnapshot.users || []).filter((u: any) => u?.id).map((u: any) => [String(u.id), u])
  );
  const existingDevicesById = new Map<string, any>(
    (currentSnapshot.device_licenses || []).filter((d: any) => d?.id).map((d: any) => [String(d.id), d])
  );
  const existingIntegrationsById = new Map<string, any>(
    (currentSnapshot.integrations || []).filter((i: any) => i?.id).map((i: any) => [String(i.id), i])
  );

  let usersMissingPasswordHash = 0;
  for (const u of Array.isArray(tables.users) ? tables.users : []) {
    const existing = existingUsersById.get(String(u?.id));
    if (u?.passwordHash === undefined && existing?.passwordHash === undefined) {
      usersMissingPasswordHash += 1;
    }
  }

  let devicesMissingTokenHash = 0;
  for (const d of Array.isArray(tables.device_licenses) ? tables.device_licenses : []) {
    const existing = existingDevicesById.get(String(d?.id));
    if (d?.deviceTokenHash === undefined && existing?.deviceTokenHash === undefined && d?.status === 'ONLINE') {
      devicesMissingTokenHash += 1;
    }
  }

  let integrationsMissingSecret = 0;
  for (const integ of Array.isArray(tables.integrations) ? tables.integrations : []) {
    const existing = existingIntegrationsById.get(String(integ?.id));
    if (integ?.encryptedSecret === undefined && existing?.encryptedSecret === undefined && integ?.hasStoredSecret) {
      integrationsMissingSecret += 1;
    }
  }

  if (usersMissingPasswordHash > 0) {
    warnings.push(
      `${usersMissingPasswordHash} usuário(s) no snapshot não possuem passwordHash e não existem no banco atual (exigirão reset de senha após restore).`
    );
  }
  if (devicesMissingTokenHash > 0) {
    warnings.push(
      `${devicesMissingTokenHash} dispositivo(s) ONLINE perderão deviceTokenHash por não existir registro prévio local (exigirão re-pareamento).`
    );
  }
  if (integrationsMissingSecret > 0) {
    warnings.push(
      `${integrationsMissingSecret} integração(ões) perderão segredo criptografado AES-256-GCM em banco limpo.`
    );
  }

  const diffs: RestoreCollectionDiff[] = [];
  const allCollectionNames = new Set([
    ...Object.keys(currentSnapshot || {}),
    ...Object.keys(tables || {}).filter((k) => ALLOWED_RESTORE_TABLES.has(k)),
  ]);
  for (const col of Array.from(allCollectionNames).sort()) {
    const curRows = Array.isArray(currentSnapshot[col]) ? currentSnapshot[col] : [];
    const nextRows = Array.isArray(tables[col]) ? tables[col] : [];
    const curMap = new Map(curRows.map((r: any) => [String(r?.id), r]));
    const nextMap = new Map(nextRows.map((r: any) => [String(r?.id), r]));
    let added = 0;
    let updated = 0;
    let removed = 0;
    for (const [id, nextDoc] of nextMap.entries()) {
      const prevDoc = curMap.get(id);
      if (!prevDoc) added += 1;
      else if (JSON.stringify(prevDoc) !== JSON.stringify(nextDoc)) updated += 1;
    }
    for (const id of curMap.keys()) {
      if (!nextMap.has(id)) removed += 1;
    }
    if (curRows.length > 0 || nextRows.length > 0) {
      diffs.push({
        collection: col,
        currentCount: curRows.length,
        snapshotCount: nextRows.length,
        added,
        updated,
        removed,
      });
    }
  }

  return {
    valid: errors.length === 0,
    schemaValid,
    checksumValid,
    hasActiveDevOwner,
    errors,
    warnings,
    lockoutRisks: {
      usersMissingPasswordHash,
      devicesMissingTokenHash,
      integrationsMissingSecret,
    },
    diffs,
  };
}

export function resolveDurableBackupDir(): string {
  if (process.env.SERVER_BACKUP_DIR) {
    return path.resolve(process.env.SERVER_BACKUP_DIR);
  }
  const dbPath = process.env.SERVER_DB_PATH
    ? path.resolve(process.env.SERVER_DB_PATH)
    : path.join(process.cwd(), 'server-db.json');
  return path.join(path.dirname(dbPath), 'backups');
}

export function sanitizeSnapshotForBackup(rawTables: Record<string, any[]>): Record<string, any[]> {
  const sanitized: Record<string, any[]> = {};
  for (const [tableName, rows] of Object.entries(rawTables || {})) {
    if (!Array.isArray(rows)) continue;
    sanitized[tableName] = rows.map((row) => {
      if (!row || typeof row !== 'object') return row;
      const copy = { ...row };
      if (tableName === 'users') {
        delete copy.passwordHash;
        delete copy.resetCodeHash;
        delete copy.resetCodeExpiresAt;
      }
      if (tableName === 'device_licenses') {
        delete copy.deviceToken;
        delete copy.deviceTokenHash;
        delete copy.pairingCodeHash;
      }
      if (tableName === 'integrations') {
        delete copy.encryptedSecret;
        delete copy.apiKey;
        delete copy.token;
      }
      return copy;
    });
  }
  return sanitized;
}

router.get('/backup', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const rawSnapshot = await db.exportSnapshotAsync();
    const sanitizedTables = sanitizeSnapshotForBackup(rawSnapshot);
    const checksum = computeSnapshotChecksum(sanitizedTables);
    res.json({
      exportedAt: new Date().toISOString(),
      exportedBy: authenticatedUser.uid,
      schemaVersion: '1.0.3',
      version: '5.2.1',
      redactedSensitiveFields: [
        'passwordHash',
        'resetCodeHash',
        'resetCodeExpiresAt',
        'deviceTokenHash',
        'pairingCodeHash',
        'encryptedSecret',
      ],
      checksum,
      tables: sanitizedTables,
    });
  } catch {
    res.status(500).json({ error: 'Falha ao exportar snapshot de backup.' });
  }
});

router.post('/restore', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { tables, schemaVersion, version, checksum } = req.body || {};
    const effectiveSchema = String(schemaVersion || '');
    const preRestoreSnapshot = await db.exportSnapshotAsync();
    const evaluation = evaluateRestoreSnapshot(
      { tables, schemaVersion, version, checksum },
      preRestoreSnapshot
    );
    if (!evaluation.valid) {
      return res.status(400).json({ error: evaluation.errors[0] });
    }
    const safetyBackupId = `pre-restore-${Date.now()}`;
    const backupDir = resolveDurableBackupDir();
    fs.mkdirSync(backupDir, { recursive: true });
    const safetyFilePath = path.join(backupDir, `${safetyBackupId}.json`);
    const safetyPayload = {
      id: safetyBackupId,
      createdAt: new Date().toISOString(),
      createdBy: authenticatedUser.uid,
      schemaVersion: '1.0.3',
      version: '5.2.1',
      checksum: computeSnapshotChecksum(preRestoreSnapshot),
      tables: preRestoreSnapshot,
    };
    fs.writeFileSync(safetyFilePath, JSON.stringify(safetyPayload), 'utf-8');

    const existingUsersById = new Map<string, any>(
      (preRestoreSnapshot.users || []).filter((u: any) => u?.id).map((u: any) => [String(u.id), u])
    );
    const existingDevicesById = new Map<string, any>(
      (preRestoreSnapshot.device_licenses || []).filter((d: any) => d?.id).map((d: any) => [String(d.id), d])
    );
    const existingIntegrationsById = new Map<string, any>(
      (preRestoreSnapshot.integrations || []).filter((i: any) => i?.id).map((i: any) => [String(i.id), i])
    );
    const cleanTables = stripPrototypePollution(tables);
    const hydratedTables: Record<string, any[]> = { ...cleanTables };
    if (Array.isArray(cleanTables.users)) {
      hydratedTables.users = cleanTables.users.map((u: any) => {
        const existing = existingUsersById.get(String(u.id));
        if (!existing) return u;
        return {
          ...u,
          ...(u.passwordHash === undefined && existing.passwordHash !== undefined
            ? { passwordHash: existing.passwordHash }
            : {}),
          ...(u.resetCodeHash === undefined && existing.resetCodeHash !== undefined
            ? { resetCodeHash: existing.resetCodeHash, resetCodeExpiresAt: existing.resetCodeExpiresAt }
            : {}),
        };
      });
    }
    if (Array.isArray(cleanTables.device_licenses)) {
      hydratedTables.device_licenses = cleanTables.device_licenses.map((d: any) => {
        const existing = existingDevicesById.get(String(d.id));
        if (!existing) return d;
        return {
          ...d,
          ...(d.deviceTokenHash === undefined && existing.deviceTokenHash !== undefined
            ? { deviceTokenHash: existing.deviceTokenHash }
            : {}),
          ...(d.pairingCodeHash === undefined && existing.pairingCodeHash !== undefined
            ? { pairingCodeHash: existing.pairingCodeHash }
            : {}),
        };
      });
    }
    if (Array.isArray(cleanTables.integrations)) {
      hydratedTables.integrations = cleanTables.integrations.map((integ: any) => {
        const existing = existingIntegrationsById.get(String(integ.id));
        if (!existing) return integ;
        return {
          ...integ,
          ...(integ.encryptedSecret === undefined && existing.encryptedSecret !== undefined
            ? { encryptedSecret: existing.encryptedSecret, hasStoredSecret: true }
            : {}),
        };
      });
    }

    const restoredDocs = await db.restoreSnapshot(hydratedTables);
    await recordAdminAuditEvent(
      'PLATFORM_SNAPSHOT_RESTORED',
      `Snapshot v${effectiveSchema} restaurado por ${authenticatedUser.email || authenticatedUser.uid} (${restoredDocs} documentos; backup pré-restauração gravado em disco: ${safetyBackupId})`,
      'hq/governance',
      authenticatedUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'platform',
        resourceId: safetyBackupId,
        before: { collectionCounts: Object.fromEntries(Object.entries(preRestoreSnapshot).map(([k, v]) => [k, v.length])) },
        after: { restoredDocs, schemaVersion: effectiveSchema, safetyBackupId },
      }
    );
    res.json({
      success: true,
      restoredDocs,
      safetyBackupId,
      preRestoreBackupId: safetyBackupId,
      safetyBackupPersisted: fs.existsSync(safetyFilePath),
      restoredAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao restaurar snapshot.' });
  }
});

export default router;
