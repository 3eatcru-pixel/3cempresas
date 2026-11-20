import express from 'express';
import { db } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { isSingleBranchLocked, stripPrototypePollution } from './storeAccessHelpers.ts';

const router = express.Router();

const PERIPHERAL_MANAGER_ROLES = ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER'];
const PERIPHERAL_READER_ROLES = [...PERIPHERAL_MANAGER_ROLES, 'CASHIER', 'WAITER', 'KITCHEN_STAFF'];
const PRINT_OPERATOR_ROLES = [...PERIPHERAL_MANAGER_ROLES, 'CASHIER', 'WAITER', 'KITCHEN_STAFF'];

const VALID_PERIPHERAL_KINDS = new Set(['PRINTER', 'SCALE', 'CUSTOMER_DISPLAY', 'KDS_SCREEN']);
const VALID_CONNECTIONS = new Set(['LAN_RAW_9100', 'USB_DEVICE', 'BLUETOOTH', 'SERIAL_COM', 'BROWSER']);
const VALID_STATIONS = new Set(['CASHIER', 'KITCHEN', 'BAR', 'EXPEDITION', 'COUNTER', 'ALL']);
const VALID_HEARTBEAT_STATUSES = new Set(['ONLINE', 'OFFLINE', 'PAPER_OUT', 'ERROR']);

function resolveCallerScope(user: AuthenticatedRequestUser, requestedStoreId?: string) {
  const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
  const isBranchRestricted = !isHq && isSingleBranchLocked(user);
  if (!isHq && requestedStoreId && !hasUserStoreAccess(user, requestedStoreId)) {
    return { forbidden: true as const, isHq, effectiveStoreId: '' };
  }
  const effectiveStoreId = isBranchRestricted ? String(user.storeId || '') : String(requestedStoreId || '');
  return { forbidden: false as const, isHq, effectiveStoreId };
}

router.get('/peripherals', verifyAutonomousToken, requireRoles(PERIPHERAL_READER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
    const requestedKind = req.query.kind ? String(req.query.kind).toUpperCase() : '';
    const requestedStation = req.query.station ? String(req.query.station).toUpperCase() : '';

    const scope = resolveCallerScope(user, requestedStoreId);
    if (scope.forbidden) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const snap = await db.collection('peripherals').get();
    let list = snap.docs.map((d) => d.data()).filter((p) => p && !p._deleted);

    if (!scope.isHq) {
      const userTenant = user.tenantId || 'tenant-1';
      list = list.filter((p) => p.tenantId === userTenant && (!p.storeId || hasUserStoreAccess(user, p.storeId)));
    }
    if (scope.effectiveStoreId) {
      list = list.filter((p) => p.storeId === scope.effectiveStoreId);
    }
    if (requestedKind) {
      list = list.filter((p) => String(p.kind || '').toUpperCase() === requestedKind);
    }
    if (requestedStation) {
      list = list.filter((p) => String(p.station || '').toUpperCase() === requestedStation);
    }

    res.json(list);
  } catch {
    res.status(500).json({ error: 'Erro ao listar periféricos e impressoras da loja.' });
  }
});

router.post('/peripherals', verifyAutonomousToken, requireRoles(PERIPHERAL_MANAGER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const body = stripPrototypePollution(req.body || {});
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';

    const storeId = String(body.storeId || user.storeId || '').trim();
    if (!storeId) {
      return res.status(400).json({ error: 'storeId é obrigatório para cadastrar periférico.' });
    }
    if (!isHq && !hasUserStoreAccess(user, storeId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists || storeSnap.data()?._deleted) {
      return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
    }
    const storeData = storeSnap.data() || {};
    const tenantId = String(storeData.tenantId || user.tenantId || 'tenant-1');
    if (!isHq && tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: Loja pertence a outro tenant.' });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) {
      return res.status(400).json({ error: 'Nome do periférico (mínimo 2 caracteres) é obrigatório.' });
    }

    const kind = String(body.kind || 'PRINTER').toUpperCase();
    if (!VALID_PERIPHERAL_KINDS.has(kind)) {
      return res.status(400).json({ error: `Tipo inválido. Permitidos: [${Array.from(VALID_PERIPHERAL_KINDS).join(', ')}].` });
    }

    const connectionType = String(body.connectionType || (kind === 'SCALE' ? 'SERIAL_COM' : 'LAN_RAW_9100')).toUpperCase();
    if (!VALID_CONNECTIONS.has(connectionType)) {
      return res.status(400).json({ error: `Conexão inválida. Permitidas: [${Array.from(VALID_CONNECTIONS).join(', ')}].` });
    }

    const station = String(body.station || 'CASHIER').toUpperCase();
    if (!VALID_STATIONS.has(station)) {
      return res.status(400).json({ error: `Estação inválida. Permitidas: [${Array.from(VALID_STATIONS).join(', ')}].` });
    }

    const id = typeof body.id === 'string' && body.id.trim()
      ? body.id.trim()
      : `periph-${kind.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const port = body.port !== undefined ? Number(body.port) : connectionType === 'LAN_RAW_9100' ? 9100 : null;
    if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535)) {
      return res.status(400).json({ error: 'Porta TCP inválida (1-65535).' });
    }

    const paperWidthMm = body.paperWidthMm !== undefined ? Number(body.paperWidthMm) : 80;
    if (kind === 'PRINTER' && paperWidthMm !== 58 && paperWidthMm !== 80) {
      return res.status(400).json({ error: 'Largura de papel inválida (use 58 ou 80 mm).' });
    }

    const host = typeof body.host === 'string' ? body.host.trim() : undefined;
    const devicePath = typeof body.devicePath === 'string' ? body.devicePath.trim() : undefined;
    if (connectionType === 'LAN_RAW_9100' && !host) {
      return res.status(400).json({ error: 'Endereço IP/host é obrigatório para periférico LAN_RAW_9100.' });
    }

    const isDefault = body.isDefault === true;
    const active = body.active !== false;
    const nowIso = new Date().toISOString();

    const saved = await db.runTransaction(async (tx) => {
      const ref = db.collection('peripherals').doc(id);
      const existingSnap = await tx.get(ref);
      const existing = existingSnap.exists ? existingSnap.data() : null;

      if (existing && !isHq && existing.tenantId !== user.tenantId) {
        const err: any = new Error('Acesso negado: Periférico pertence a outro tenant.');
        err.statusCode = 403;
        throw err;
      }

      if (isDefault) {
        const allSnap = await db.collection('peripherals').get();
        for (const docSnap of allSnap.docs) {
          const p = docSnap.data();
          if (
            p &&
            !p._deleted &&
            docSnap.id !== id &&
            p.storeId === storeId &&
            p.kind === kind &&
            p.station === station &&
            p.isDefault === true
          ) {
            tx.update(db.collection('peripherals').doc(docSnap.id), { isDefault: false, updatedAt: nowIso });
          }
        }
      }

      const record = {
        id,
        tenantId,
        storeId,
        name,
        kind,
        connectionType,
        station,
        host: host || existing?.host || null,
        port,
        devicePath: devicePath || existing?.devicePath || null,
        baudRate: body.baudRate !== undefined ? Number(body.baudRate) || 9600 : existing?.baudRate || null,
        paperWidthMm: kind === 'PRINTER' ? paperWidthMm : null,
        autoCut: kind === 'PRINTER' ? body.autoCut !== false : false,
        isDefault,
        active,
        status: existing?.status || 'CONFIGURED_OFFLINE',
        lastHeartbeatAt: existing?.lastHeartbeatAt || null,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        updatedByUid: user.uid,
      };

      tx.set(ref, record, { merge: true });
      return record;
    }, { tenantId });

    res.status(200).json({ success: true, peripheral: saved });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar periférico.' });
  }
});

router.post('/peripherals/:id/heartbeat', verifyAutonomousToken, requireRoles(PRINT_OPERATOR_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const status = String(req.body?.status || 'ONLINE').toUpperCase();
    if (!VALID_HEARTBEAT_STATUSES.has(status)) {
      return res.status(400).json({ error: `Status inválido. Permitidos: [${Array.from(VALID_HEARTBEAT_STATUSES).join(', ')}].` });
    }

    const ref = db.collection('peripherals').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?._deleted) {
      return res.status(404).json({ error: 'Periférico não encontrado.' });
    }
    const periph = snap.data() || {};
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    if (!isHq && (periph.tenantId !== user.tenantId || !hasUserStoreAccess(user, periph.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Periférico pertence a outro tenant ou filial.' });
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, any> = {
      status,
      lastHeartbeatAt: nowIso,
      updatedAt: nowIso,
    };
    if (typeof req.body?.lastError === 'string') {
      patch.lastError = req.body.lastError.slice(0, 200);
    }
    if (typeof req.body?.lastWeightKg === 'number' && Number.isFinite(req.body.lastWeightKg)) {
      patch.lastWeightKg = Number(req.body.lastWeightKg);
    }

    await ref.update(patch);
    res.json({ success: true, id, status, lastHeartbeatAt: nowIso });
  } catch {
    res.status(500).json({ error: 'Falha ao registrar heartbeat do periférico.' });
  }
});

router.delete('/peripherals/:id', verifyAutonomousToken, requireRoles(PERIPHERAL_MANAGER_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const ref = db.collection('peripherals').doc(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?._deleted) {
      return res.status(404).json({ error: 'Periférico não encontrado.' });
    }
    const periph = snap.data() || {};
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    if (!isHq && (periph.tenantId !== user.tenantId || !hasUserStoreAccess(user, periph.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Periférico pertence a outro tenant ou filial.' });
    }

    await ref.update({
      _deleted: true,
      active: false,
      deletedAt: new Date().toISOString(),
      deletedByUid: user.uid,
    });
    res.json({ success: true, deletedId: id });
  } catch {
    res.status(500).json({ error: 'Falha ao remover periférico.' });
  }
});

router.get('/print-jobs', verifyAutonomousToken, requireRoles(PRINT_OPERATOR_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
    const requestedStatus = req.query.status ? String(req.query.status).toUpperCase() : '';
    const requestedPeripheralId = req.query.peripheralId ? String(req.query.peripheralId) : '';

    const scope = resolveCallerScope(user, requestedStoreId);
    if (scope.forbidden) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const snap = await db.collection('print_jobs').get();
    let jobs = snap.docs.map((d) => d.data()).filter((j) => j && !j._deleted);

    if (!scope.isHq) {
      const userTenant = user.tenantId || 'tenant-1';
      jobs = jobs.filter((j) => j.tenantId === userTenant && (!j.storeId || hasUserStoreAccess(user, j.storeId)));
    }
    if (scope.effectiveStoreId) {
      jobs = jobs.filter((j) => j.storeId === scope.effectiveStoreId);
    }
    if (requestedStatus) {
      jobs = jobs.filter((j) => String(j.status || '').toUpperCase() === requestedStatus);
    }
    if (requestedPeripheralId) {
      jobs = jobs.filter((j) => j.peripheralId === requestedPeripheralId);
    }

    jobs.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json(jobs.slice(0, 100));
  } catch {
    res.status(500).json({ error: 'Erro ao listar fila de impressão.' });
  }
});

router.post('/print-jobs', verifyAutonomousToken, requireRoles(PRINT_OPERATOR_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const body = stripPrototypePollution(req.body || {});
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';

    const storeId = String(body.storeId || user.storeId || '').trim();
    if (!storeId) {
      return res.status(400).json({ error: 'storeId é obrigatório para enfileirar impressão.' });
    }
    if (!isHq && !hasUserStoreAccess(user, storeId)) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return res.status(400).json({ error: 'Conteúdo de impressão (content) não pode estar vazio.' });
    }

    const station = String(body.station || 'CASHIER').toUpperCase();
    const requestedPeripheralId = typeof body.peripheralId === 'string' ? body.peripheralId.trim() : '';

    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists || storeSnap.data()?._deleted) {
      return res.status(404).json({ error: `Loja '${storeId}' não encontrada.` });
    }
    const tenantId = String(storeSnap.data()?.tenantId || user.tenantId || 'tenant-1');
    if (!isHq && tenantId !== user.tenantId) {
      return res.status(403).json({ error: 'Acesso negado: Loja pertence a outro tenant.' });
    }

    const periphSnap = await db.collection('peripherals').get();
    const storePrinters = periphSnap.docs
      .map((d) => d.data())
      .filter((p) => p && !p._deleted && p.storeId === storeId && p.kind === 'PRINTER' && p.active !== false);

    let targetPrinter: any = null;
    if (requestedPeripheralId) {
      targetPrinter = storePrinters.find((p) => p.id === requestedPeripheralId) || null;
      if (!targetPrinter) {
        return res.status(404).json({ error: `Impressora '${requestedPeripheralId}' não encontrada ou inativa nesta loja.` });
      }
    } else {
      targetPrinter =
        storePrinters.find((p) => p.station === station && p.isDefault) ||
        storePrinters.find((p) => p.station === station) ||
        storePrinters.find((p) => p.station === 'ALL' && p.isDefault) ||
        storePrinters.find((p) => p.isDefault) ||
        storePrinters[0] ||
        null;
    }

    if (!targetPrinter && body.requireRegisteredPrinter === true) {
      return res.status(409).json({ error: `Nenhuma impressora ativa configurada para a estação '${station}'.` });
    }

    const nowIso = new Date().toISOString();
    const jobId = `pj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const job = {
      id: jobId,
      tenantId,
      storeId,
      orderId: typeof body.orderId === 'string' ? body.orderId : null,
      station,
      peripheralId: targetPrinter?.id || null,
      peripheralName: targetPrinter?.name || null,
      connectionType: targetPrinter?.connectionType || 'UNASSIGNED',
      routingMode: requestedPeripheralId ? 'EXPLICIT_PERIPHERAL' : targetPrinter ? 'STATION_DEFAULT' : 'UNASSIGNED_FALLBACK',
      content,
      bytes: Buffer.byteLength(content, 'utf8'),
      status: 'QUEUED',
      attempts: 0,
      createdByUid: user.uid,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await db.collection('print_jobs').doc(jobId).set(job);
    res.status(201).json({ success: true, job });
  } catch {
    res.status(500).json({ error: 'Erro ao enfileirar trabalho de impressão.' });
  }
});

router.post('/print-jobs/:jobId/ack', verifyAutonomousToken, requireRoles(PRINT_OPERATOR_ROLES), async (req, res) => {
  try {
    const user = (req as any).user as AuthenticatedRequestUser;
    const { jobId } = req.params;
    const nextStatus = String(req.body?.status || '').toUpperCase();
    if (!['DISPATCHED', 'PRINTED', 'FAILED', 'QUEUED'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Status de ACK inválido. Use DISPATCHED, PRINTED, FAILED ou QUEUED.' });
    }

    const ref = db.collection('print_jobs').doc(jobId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?._deleted) {
      return res.status(404).json({ error: 'Trabalho de impressão não encontrado.' });
    }
    const existing = snap.data() || {};
    const isHq = user.role === 'DEV_OWNER' || user.role === 'SUPER_ADMIN';
    if (!isHq && (existing.tenantId !== user.tenantId || !hasUserStoreAccess(user, existing.storeId))) {
      return res.status(403).json({ error: 'Acesso negado: Trabalho de impressão pertence a outro tenant ou filial.' });
    }

    const nowIso = new Date().toISOString();
    const patch: Record<string, any> = {
      status: nextStatus,
      attempts: Number(existing.attempts || 0) + (nextStatus === 'PRINTED' || nextStatus === 'FAILED' ? 1 : 0),
      updatedAt: nowIso,
      ackedByUid: user.uid,
    };
    if (nextStatus === 'PRINTED') {
      patch.printedAt = nowIso;
      patch.lastError = null;
    } else if (nextStatus === 'FAILED') {
      patch.lastError = typeof req.body?.error === 'string' ? req.body.error.slice(0, 250) : 'Falha reportada pelo agente de impressão';
    }

    await ref.update(patch);
    res.json({ success: true, job: { ...existing, ...patch } });
  } catch {
    res.status(500).json({ error: 'Falha ao confirmar status do trabalho de impressão.' });
  }
});

export default router;
