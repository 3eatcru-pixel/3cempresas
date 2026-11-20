import express from 'express';
import crypto from 'crypto';
import { db } from '../config.ts';
import { resolveOptionalUser, verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../middleware/auth.ts';
import { sseClients, clusterState, broadcastSseEvent } from '../state.ts';

const router = express.Router();

const SSE_TICKET_TTL_MS = 30_000;
const MAX_SSE_TICKETS = 5_000;
const MAX_SSE_CLIENTS = Number(process.env.MAX_SSE_CLIENTS || 2_000);
const sseTicketStore = new Map<
  string,
  {
    uid: string;
    role: string;
    tenantId: string;
    storeId?: string;
    allowedStoreIds?: string[];
    expiresAt: number;
  }
>();

function pruneExpiredSseTickets(now = Date.now()) {
  if (sseTicketStore.size === 0) return;
  for (const [key, entry] of sseTicketStore.entries()) {
    if (entry.expiresAt <= now) {
      sseTicketStore.delete(key);
    }
  }
}

router.post('/ticket', verifyAutonomousToken, (req, res) => {
  const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
  const now = Date.now();
  pruneExpiredSseTickets(now);
  while (sseTicketStore.size >= MAX_SSE_TICKETS) {
    const oldestKey = sseTicketStore.keys().next().value;
    if (!oldestKey) break;
    sseTicketStore.delete(oldestKey);
  }
  const ticket = `sse_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = now + SSE_TICKET_TTL_MS;
  sseTicketStore.set(ticket, {
    uid: authenticatedUser.uid,
    role: authenticatedUser.role || 'CUSTOMER',
    tenantId: authenticatedUser.tenantId || 'tenant-1',
    storeId: authenticatedUser.storeId,
    allowedStoreIds: authenticatedUser.allowedStoreIds,
    expiresAt,
  });
  return res.json({
    ticket,
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds: SSE_TICKET_TTL_MS / 1000,
  });
});

router.get('/stream', async (req, res) => {
  const queryTicket = typeof req.query.ticket === 'string' ? req.query.ticket.trim() : '';
  const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  if (queryToken) {
    return res.status(401).json({
      error: 'Não autorizado: Tokens na URL (?token=) foram bloqueados por segurança. Utilize POST /api/v1/sse/ticket.',
    });
  }

  let clientTenantId = 'PUBLIC';
  let clientRole = 'ANONYMOUS';
  let clientUid: string | undefined;
  let clientStoreId: string | undefined;
  let clientAllowedStoreIds: string[] | undefined;
  let isDev = false;

  if (queryTicket) {
    const now = Date.now();
    const ticketEntry = sseTicketStore.get(queryTicket);
    sseTicketStore.delete(queryTicket);
    if (!ticketEntry || ticketEntry.expiresAt <= now) {
      return res.status(401).json({ error: 'Ticket SSE inválido, expirado ou já utilizado.' });
    }
    clientUid = ticketEntry.uid;
    clientRole = ticketEntry.role;
    clientStoreId = ticketEntry.storeId;
    clientAllowedStoreIds = ticketEntry.allowedStoreIds;
    if (ticketEntry.role === 'DEV_OWNER') {
      isDev = true;
    } else {
      clientTenantId = ticketEntry.tenantId || 'tenant-1';
    }
  } else {
    const resolved = await resolveOptionalUser(req);
    if (resolved.tokenProvided && !resolved.user) {
      return res.status(401).json({ error: resolved.error || 'Token SSE inválido ou usuário revogado.' });
    }
    if (resolved.user) {
      clientUid = resolved.user.uid;
      clientRole = resolved.user.role;
      clientStoreId = resolved.user.storeId;
      clientAllowedStoreIds = resolved.user.allowedStoreIds;
      if (resolved.user.role === 'DEV_OWNER') {
        isDev = true;
      } else {
        clientTenantId = resolved.user.tenantId || 'tenant-1';
      }
    }
  }

  const requestedTenantId = req.query.tenantId as string;
  if (requestedTenantId && !isDev && requestedTenantId !== clientTenantId) {
    return res.status(403).json({ error: 'Acesso negado: Isolamento multitenant violado.' });
  }

  const activeTenant = isDev ? (requestedTenantId || 'ALL') : clientTenantId;

  for (let i = sseClients.length - 1; i >= 0; i--) {
    const existing = sseClients[i];
    if (existing.response.writableEnded || existing.response.destroyed) {
      sseClients.splice(i, 1);
    }
  }
  if (sseClients.length >= MAX_SSE_CLIENTS) {
    return res.status(503).json({
      error: 'Limite de conexões SSE simultâneas atingido nesta instância. Tente reconectar em instantes.',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const client = {
    response: res,
    tenantId: activeTenant,
    role: clientRole,
    isDev,
    uid: clientUid,
    storeId: clientStoreId,
    allowedStoreIds: clientAllowedStoreIds,
  };
  sseClients.push(client);

  const safeWrite = (payload: Record<string, any>) => {
    if (res.writableEnded || res.destroyed) return false;
    try {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      return true;
    } catch {
      return false;
    }
  };

  safeWrite({
    type: 'CONNECTED',
    tenantId: activeTenant,
    activeClients: sseClients.length
  });

  const interval = setInterval(() => {
    const ok = safeWrite({
      type: 'HEARTBEAT',
      timestamp: new Date().toISOString(),
      activeOrders: db.getCollectionSize('orders')
    });
    if (!ok) {
      clearInterval(interval);
      const idx = sseClients.findIndex(c => c.response === res);
      if (idx !== -1) sseClients.splice(idx, 1);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    const index = sseClients.findIndex(c => c.response === res);
    if (index !== -1) sseClients.splice(index, 1);
  });
});

// Cluster Control Endpoints (Nível 2 Sandbox)
router.post('/cluster/command', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  const { command } = req.body;

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SANDBOX_IN_PRODUCTION !== 'true') {
    return res.status(501).json({
      error: 'Comandos simulados de cluster (FORCE_FAILOVER / FLUSH_REDIS) desabilitados em produção sem orquestrador real.',
      simulated: true,
    });
  }

  if (command === 'FORCE_FAILOVER') {
    clusterState.systemStatus = 'FAILOVER_RECOVERY';
    broadcastSseEvent('CLUSTER_FAILOVER', { reason: 'Manual sandbox simulation triggered by HQ', simulated: true }, 'ALL', true);
    const timer = setTimeout(() => { clusterState.systemStatus = 'ONLINE_HEALTHY'; }, 5000);
    timer.unref?.();
    return res.json({
      success: true,
      simulated: true,
      mode: 'SANDBOX_SIMULATION',
      message: 'Simulação sandbox de failover iniciada (retorna a ONLINE_HEALTHY em 5s).',
    });
  }

  if (command === 'FLUSH_REDIS') {
    broadcastSseEvent('CLUSTER_CACHE_PURGE', { scope: 'ORDER_STREAM', simulated: true }, 'ALL', true);
    return res.json({
      success: true,
      simulated: true,
      mode: 'SANDBOX_SIMULATION',
      message: 'Evento SSE de invalidação de stream emitido (sem instância Redis externa conectada).',
    });
  }

  res.status(400).json({ error: 'Comando desconhecido.' });
});

export default router;
