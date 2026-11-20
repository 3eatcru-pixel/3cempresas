import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, runWithSystemDbContext } from '../config.ts';
import {
  DEFAULT_PLATFORM_RUNTIME_POLICY,
} from '../../constants/platformDefaults.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  resolveOptionalUser,
  verifyAutonomousToken,
} from '../middleware/auth.ts';

const router = express.Router();

const STORAGE_WRITER_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER', 'CUSTOMER', 'CONSUMER'];
const STORAGE_ADMIN_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'];

const ALLOWED_APP_IDS = new Set(['marketplace', 'store-os', 'driver', 'waiter', 'hq', 'unified-portal']);
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/csv',
  'text/plain',
  'application/json',
]);

async function resolveStorageLimits(): Promise<{
  maxObjectBytes: number;
  tenantQuotaBytes: number;
  consumerQuotaBytes: number;
}> {
  const envMaxObj = Number(process.env.STORAGE_MAX_OBJECT_BYTES || DEFAULT_PLATFORM_RUNTIME_POLICY.storageMaxObjectBytes);
  const envTenantQuota = Number(process.env.STORAGE_TENANT_QUOTA_BYTES || DEFAULT_PLATFORM_RUNTIME_POLICY.storageTenantQuotaBytes);
  const envConsumerQuota = Number(process.env.STORAGE_CONSUMER_QUOTA_BYTES || DEFAULT_PLATFORM_RUNTIME_POLICY.storageConsumerQuotaBytes);
  try {
    const govSnap = await runWithSystemDbContext('STORAGE_RUNTIME_POLICY', () =>
      db.collection('governance').doc('governance').get()
    );
    const policy = govSnap.exists ? govSnap.data()?.runtimePolicy : undefined;
    return {
      maxObjectBytes:
        typeof policy?.storageMaxObjectBytes === 'number' && Number.isFinite(policy.storageMaxObjectBytes)
          ? policy.storageMaxObjectBytes
          : envMaxObj,
      tenantQuotaBytes:
        typeof policy?.storageTenantQuotaBytes === 'number' && Number.isFinite(policy.storageTenantQuotaBytes)
          ? policy.storageTenantQuotaBytes
          : envTenantQuota,
      consumerQuotaBytes:
        typeof policy?.storageConsumerQuotaBytes === 'number' && Number.isFinite(policy.storageConsumerQuotaBytes)
          ? policy.storageConsumerQuotaBytes
          : envConsumerQuota,
    };
  } catch {
    return {
      maxObjectBytes: envMaxObj,
      tenantQuotaBytes: envTenantQuota,
      consumerQuotaBytes: envConsumerQuota,
    };
  }
}
const DEFAULT_CONSUMER_FOLDERS = [
  'comprovantes',
  'notas-fiscais',
  'documentos',
  'receitas',
  'geral',
];

export function resolveStorageRootDir(): string {
  if (process.env.SERVER_STORAGE_DIR) {
    return path.resolve(process.env.SERVER_STORAGE_DIR);
  }
  const dbPath = process.env.SERVER_DB_PATH
    ? path.resolve(process.env.SERVER_DB_PATH)
    : path.join(process.cwd(), 'server-db.json');
  return path.join(path.dirname(dbPath), 'storage-objects');
}

function sanitizeSegment(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_');
  return cleaned || fallback;
}

function resolveSafeBlobPath(
  tenantId: string,
  appId: string,
  objectId: string,
  ownerUid?: string | null
): string {
  const rootDir = resolveStorageRootDir();
  const safeTenant = sanitizeSegment(tenantId, 'tenant-1');
  const safeApp = sanitizeSegment(appId, 'unified-portal');
  const safeId = sanitizeSegment(objectId, 'obj');
  const candidate = ownerUid
    ? path.resolve(rootDir, safeTenant, safeApp, sanitizeSegment(ownerUid, 'usr'), `${safeId}.bin`)
    : path.resolve(rootDir, safeTenant, safeApp, `${safeId}.bin`);
  const normalizedRoot = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
  if (!candidate.startsWith(normalizedRoot)) {
    throw new Error('Caminho de armazenamento inválido (violação de contenção).');
  }
  return candidate;
}

function isPersonalConsumerRole(role: string | undefined): boolean {
  const upper = String(role || '').toUpperCase();
  return upper === 'CUSTOMER' || upper === 'CONSUMER';
}

router.get('/objects', verifyAutonomousToken, async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    const isConsumer = isPersonalConsumerRole(user.role);
    const requestedTenantId = req.query.tenantId ? String(req.query.tenantId) : '';
    const requestedAppId = req.query.appId ? String(req.query.appId) : '';
    const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
    const requestedFolder = req.query.folder ? String(req.query.folder) : '';

    const targetTenantId = isHq && requestedTenantId ? requestedTenantId : user.tenantId || 'tenant-1';
    if (!isHq && !isConsumer && requestedStoreId && !hasUserStoreAccess(user, requestedStoreId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const limits = await resolveStorageLimits();
    const snap = await db.collection('storage_objects').get();
    const allActive = snap.docs.map((d) => d.data()).filter((o) => o && !o._deleted);

    if (isConsumer) {
      const ownObjects = allActive.filter((o) => o.uploadedByUid === user.uid);
      const usedBytes = ownObjects.reduce((acc, item) => acc + (Number(item.sizeBytes) || 0), 0);
      const folderSet = new Set<string>(DEFAULT_CONSUMER_FOLDERS);
      for (const item of ownObjects) {
        if (item.folder) folderSet.add(String(item.folder));
      }

      let filtered = ownObjects;
      if (requestedAppId) filtered = filtered.filter((o) => o.appId === requestedAppId);
      if (requestedFolder && requestedFolder !== 'ALL') {
        filtered = filtered.filter((o) => o.folder === requestedFolder);
      }
      filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

      return res.json({
        driver: 'LOCAL_VOLUME',
        quotaScope: 'USER_PERSONAL',
        ownerUid: user.uid,
        tenantId: targetTenantId,
        quotaBytes: limits.consumerQuotaBytes,
        usedBytes,
        folders: Array.from(folderSet),
        objectCount: filtered.length,
        objects: filtered,
      });
    }

    // Non-consumer (Merchant / Staff / HQ): exclude private personal consumer files unless HQ
    const tenantObjects = allActive.filter(
      (o) =>
        o.tenantId === targetTenantId &&
        (isHq || o.quotaScope !== 'USER_PERSONAL' || o.visibility === 'PUBLIC_READ')
    );
    const usedBytes = tenantObjects.reduce((acc, item) => acc + (Number(item.sizeBytes) || 0), 0);

    let filtered = tenantObjects;
    if (!isHq) {
      filtered = filtered.filter((o) => !o.storeId || hasUserStoreAccess(user, o.storeId));
    }
    if (requestedAppId) filtered = filtered.filter((o) => o.appId === requestedAppId);
    if (requestedStoreId) filtered = filtered.filter((o) => o.storeId === requestedStoreId);
    if (requestedFolder && requestedFolder !== 'ALL') {
      filtered = filtered.filter((o) => o.folder === requestedFolder);
    }

    const folderSet = new Set<string>(['general', 'fiscal-exports', 'comprovantes']);
    for (const item of filtered) {
      if (item.folder) folderSet.add(String(item.folder));
    }

    filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    res.json({
      driver: 'LOCAL_VOLUME',
      quotaScope: 'TENANT',
      ownerUid: null,
      tenantId: targetTenantId,
      quotaBytes: limits.tenantQuotaBytes,
      usedBytes,
      folders: Array.from(folderSet),
      objectCount: filtered.length,
      objects: filtered,
    });
  } catch {
    res.status(500).json({ error: 'Erro ao listar arquivos armazenados.' });
  }
});

router.post('/objects', verifyAutonomousToken, requireRoles(STORAGE_WRITER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    const isConsumer = isPersonalConsumerRole(user.role);
    const {
      appId: rawAppId,
      storeId: rawStoreId,
      tenantId: rawTenantId,
      folder: rawFolder,
      filename: rawFilename,
      mimeType: rawMimeType,
      visibility: rawVisibility,
      contentBase64,
      contentUtf8,
    } = req.body || {};

    const defaultAppId = isConsumer ? 'marketplace' : 'store-os';
    const appId = String(rawAppId || req.headers['x-3c-app-id'] || defaultAppId).trim().toLowerCase();
    if (!ALLOWED_APP_IDS.has(appId)) {
      return res.status(400).json({ error: `appId inválido. Permitidos: [${Array.from(ALLOWED_APP_IDS).join(', ')}].` });
    }

    const mimeType = String(rawMimeType || '').trim().toLowerCase().split(';')[0];
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(415).json({
        error: `Tipo MIME '${mimeType || 'ausente'}' não permitido. Use PNG, JPEG, WEBP, PDF, CSV, TXT ou JSON.`,
      });
    }

    let buffer: Buffer;
    if (typeof contentBase64 === 'string' && contentBase64.length > 0) {
      const cleanedB64 = contentBase64.includes(',') ? contentBase64.split(',').pop() || '' : contentBase64;
      buffer = Buffer.from(cleanedB64, 'base64');
    } else if (typeof contentUtf8 === 'string') {
      buffer = Buffer.from(contentUtf8, 'utf8');
    } else {
      return res.status(400).json({ error: 'Informe contentBase64 ou contentUtf8 para envio de arquivo.' });
    }

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'Arquivo vazio não permitido.' });
    }
    const limits = await resolveStorageLimits();
    if (buffer.length > limits.maxObjectBytes) {
      return res.status(413).json({ error: `Arquivo excede o limite máximo de ${limits.maxObjectBytes} bytes.` });
    }

    const tenantId = isHq && rawTenantId ? String(rawTenantId).trim() : user.tenantId || 'tenant-1';
    const storeId = isConsumer
      ? null
      : rawStoreId
      ? String(rawStoreId).trim()
      : user.storeId
      ? String(user.storeId)
      : null;
    if (!isHq && !isConsumer && storeId && !hasUserStoreAccess(user, storeId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const visibility =
      !isConsumer &&
      String(rawVisibility || 'PRIVATE').toUpperCase() === 'PUBLIC_READ' &&
      STORAGE_ADMIN_ROLES.includes(user.role)
        ? 'PUBLIC_READ'
        : 'PRIVATE';

    const snap = await db.collection('storage_objects').get();
    const activeDocs = snap.docs.map((d) => d.data()).filter((o) => o && !o._deleted);

    if (isConsumer) {
      const userUsed = activeDocs
        .filter((o) => o.uploadedByUid === user.uid)
        .reduce((acc, o) => acc + (Number(o.sizeBytes) || 0), 0);
      if (userUsed + buffer.length > limits.consumerQuotaBytes) {
        return res.status(413).json({
          error: `Cota pessoal de armazenamento excedida (${userUsed + buffer.length}/${limits.consumerQuotaBytes} bytes).`,
        });
      }
    } else {
      const tenantUsed = activeDocs
        .filter((o) => o.tenantId === tenantId && o.quotaScope !== 'USER_PERSONAL')
        .reduce((acc, o) => acc + (Number(o.sizeBytes) || 0), 0);

      if (tenantUsed + buffer.length > limits.tenantQuotaBytes) {
        return res.status(413).json({
          error: `Cota de armazenamento do tenant excedida (${tenantUsed + buffer.length}/${limits.tenantQuotaBytes} bytes).`,
        });
      }
    }

    const objectId = `obj-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const safeFilename = sanitizeSegment(path.basename(String(rawFilename || 'arquivo.bin')), 'arquivo.bin');
    const safeFolder = sanitizeSegment(
      String(rawFolder || (isConsumer ? 'comprovantes' : 'general')),
      isConsumer ? 'comprovantes' : 'general'
    );
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ownerUid = isConsumer ? user.uid : null;

    const blobPath = resolveSafeBlobPath(tenantId, appId, objectId, ownerUid);
    await fs.promises.mkdir(path.dirname(blobPath), { recursive: true });
    await fs.promises.writeFile(blobPath, buffer);

    const nowIso = new Date().toISOString();
    const record = {
      id: objectId,
      tenantId,
      storeId,
      appId,
      folder: safeFolder,
      filename: safeFilename,
      mimeType,
      sizeBytes: buffer.length,
      sha256,
      visibility,
      quotaScope: isConsumer ? 'USER_PERSONAL' : 'TENANT',
      ownerUid,
      storageDriver: 'LOCAL_VOLUME',
      uploadedByUid: user.uid,
      uploadedByRole: user.role,
      contentUrl: `/api/v1/storage/objects/${objectId}/content`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('storage_objects').doc(objectId).set(record);
    res.status(201).json({ success: true, object: record });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Erro ao armazenar arquivo.' });
  }
});

const handleUpdateStorageObjectMetadata = async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const ref = db.collection('storage_objects').doc(id);
    const docSnap = await ref.get();
    if (!docSnap.exists || docSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    const obj = docSnap.data() || {};
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    const isConsumer = isPersonalConsumerRole(user.role);

    if (!isHq) {
      if (obj.quotaScope === 'USER_PERSONAL' || isConsumer) {
        if (obj.uploadedByUid !== user.uid) {
          return res.status(403).json({
            error: 'Acesso negado: Apenas o proprietário pode organizar ou renomear este arquivo pessoal.',
          });
        }
      } else if (obj.tenantId !== user.tenantId || (obj.storeId && !hasUserStoreAccess(user, obj.storeId))) {
        return res.status(403).json({ error: 'Acesso negado: Arquivo pertence a outro tenant ou filial.' });
      }
    }

    const { folder, filename } = req.body || {};
    const patch: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (typeof folder === 'string' && folder.trim()) {
      patch.folder = sanitizeSegment(folder.trim(), obj.folder || 'general');
    }
    if (typeof filename === 'string' && filename.trim()) {
      patch.filename = sanitizeSegment(path.basename(filename.trim()), obj.filename || 'arquivo.bin');
    }

    await ref.update(patch);
    res.json({ success: true, object: { ...obj, ...patch, id } });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar metadados do arquivo.' });
  }
};

router.patch('/objects/:id', verifyAutonomousToken, requireRoles(STORAGE_WRITER_ROLES), handleUpdateStorageObjectMetadata);
router.put('/objects/:id', verifyAutonomousToken, requireRoles(STORAGE_WRITER_ROLES), handleUpdateStorageObjectMetadata);

router.get('/objects/:id/content', async (req, res) => {
  try {
    const { id } = req.params;
    const docSnap = await runWithSystemDbContext('STORAGE_OBJECT_CONTENT_READ', () =>
      db.collection('storage_objects').doc(id).get()
    );
    if (!docSnap.exists || docSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    const obj = docSnap.data() || {};

    if (obj.visibility !== 'PUBLIC_READ') {
      const { user, error } = await resolveOptionalUser(req);
      if (!user) {
        return res.status(401).json({ error: error || 'Autenticação obrigatória para acessar arquivo privado.' });
      }
      const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
      if (!isHq) {
        if (obj.quotaScope === 'USER_PERSONAL' || isPersonalConsumerRole(user.role)) {
          if (obj.uploadedByUid !== user.uid) {
            return res.status(403).json({ error: 'Acesso negado: Arquivo privado de outro usuário.' });
          }
        } else if (obj.tenantId !== user.tenantId || (obj.storeId && !hasUserStoreAccess(user, obj.storeId))) {
          return res.status(403).json({ error: 'Acesso negado: Arquivo pertence a outro tenant ou filial.' });
        }
      }
    }

    const primaryBlobPath = resolveSafeBlobPath(obj.tenantId, obj.appId, id, obj.ownerUid);
    const fallbackBlobPath = obj.ownerUid ? resolveSafeBlobPath(obj.tenantId, obj.appId, id, null) : primaryBlobPath;

    let blobPath: string | null = null;
    let blobStat: fs.Stats | null = null;
    try {
      blobStat = await fs.promises.stat(primaryBlobPath);
      if (blobStat.isFile()) blobPath = primaryBlobPath;
    } catch {
      if (fallbackBlobPath !== primaryBlobPath) {
        try {
          blobStat = await fs.promises.stat(fallbackBlobPath);
          if (blobStat.isFile()) blobPath = fallbackBlobPath;
        } catch {
          blobPath = null;
        }
      }
    }

    if (!blobPath || !blobStat) {
      return res.status(404).json({ error: 'Conteúdo físico do arquivo não localizado no volume de armazenamento.' });
    }

    const etag = `"${obj.sha256}"`;
    res.setHeader('ETag', etag);
    res.setHeader(
      'Cache-Control',
      obj.visibility === 'PUBLIC_READ' ? 'public, max-age=86400' : 'private, max-age=300'
    );
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    const isSafeInlineImage = ['image/png', 'image/jpeg', 'image/webp'].includes(String(obj.mimeType || ''));
    res.setHeader('Content-Type', obj.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(blobStat.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `${isSafeInlineImage ? 'inline' : 'attachment'}; filename="${sanitizeSegment(obj.filename, 'download.bin')}"`
    );
    const readStream = fs.createReadStream(blobPath);
    readStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao transmitir conteúdo do arquivo.' });
      } else {
        res.end();
      }
    });
    readStream.pipe(res);
  } catch {
    res.status(500).json({ error: 'Erro ao ler conteúdo do arquivo.' });
  }
});

router.delete('/objects/:id', verifyAutonomousToken, requireRoles(STORAGE_WRITER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const ref = db.collection('storage_objects').doc(id);
    const docSnap = await ref.get();
    if (!docSnap.exists || docSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Arquivo não encontrado.' });
    }
    const obj = docSnap.data() || {};
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    if (!isHq) {
      if (obj.quotaScope === 'USER_PERSONAL' || isPersonalConsumerRole(user.role)) {
        if (obj.uploadedByUid !== user.uid) {
          return res.status(403).json({ error: 'Acesso negado: Não é possível remover arquivo de outro usuário.' });
        }
      } else if (obj.tenantId !== user.tenantId || (obj.storeId && !hasUserStoreAccess(user, obj.storeId))) {
        return res.status(403).json({ error: 'Acesso negado: Arquivo pertence a outro tenant ou filial.' });
      }
    }

    const primaryBlobPath = resolveSafeBlobPath(obj.tenantId, obj.appId, id, obj.ownerUid);
    const fallbackBlobPath = obj.ownerUid ? resolveSafeBlobPath(obj.tenantId, obj.appId, id, null) : primaryBlobPath;
    try {
      await fs.promises.unlink(primaryBlobPath);
    } catch {
      if (fallbackBlobPath !== primaryBlobPath) {
        await fs.promises.unlink(fallbackBlobPath).catch(() => {});
      }
    }
    await ref.update({
      _deleted: true,
      deletedAt: new Date().toISOString(),
      deletedByUid: user.uid,
    });
    res.json({ success: true, deletedId: id });
  } catch {
    res.status(500).json({ error: 'Erro ao remover arquivo.' });
  }
});

export default router;
