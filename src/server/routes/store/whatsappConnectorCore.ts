import express from 'express';
import { db } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from '../../security/cryptoVaultAndHashing.ts';
import {
  isSingleBranchLocked,
  stripPrototypePollution,
  verifyStoreTenantAccess,
} from './storeAccessHelpers.ts';

const router = express.Router();

const WA_ALLOWED_ROLES = [
  'DEV_OWNER',
  'SUPER_ADMIN',
  'REGIONAL_MANAGER',
  'STORE_OWNER',
  'STORE_MANAGER',
] as const;

type WhatsAppMode = 'WA_ME' | 'CLOUD_API' | 'WEBHOOK';

const DEFAULT_TRIGGERS = [
  {
    trigger: 'ORDER_PLACED',
    content:
      'Olá {{name}}! Recebemos seu pedido #{{orderCode}} no {{storeName}}. Já estamos preparando tudo com carinho!',
    isActive: true,
  },
  {
    trigger: 'ORDER_READY',
    content:
      'Boa notícia, {{name}}! Seu pedido #{{orderCode}} do {{storeName}} acabou de ficar pronto!',
    isActive: true,
  },
  {
    trigger: 'ORDER_OUT_FOR_DELIVERY',
    content:
      'Oba, {{name}}! Seu pedido #{{orderCode}} saiu para entrega com {{driverName}}. Fique atento ao celular!',
    isActive: true,
  },
  {
    trigger: 'ORDER_COMPLETED',
    content:
      'Pedido #{{orderCode}} entregue! Obrigado por escolher o {{storeName}}, {{name}}. Bom apetite e até a próxima!',
    isActive: false,
  },
];

function isPublicHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function maskToken(token: string): string {
  const clean = token.trim();
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}

function sanitizeConfig(doc: Record<string, any> | null, storeId: string) {
  if (!doc) {
    return {
      storeId,
      mode: 'WA_ME' as WhatsAppMode,
      phoneNumberId: '',
      wabaId: '',
      webhookUrl: '',
      coexistence: true,
      hasToken: false,
      tokenMasked: '',
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
      updatedAt: null,
    };
  }
  return {
    storeId: doc.storeId || storeId,
    mode: (doc.mode || 'WA_ME') as WhatsAppMode,
    phoneNumberId: doc.phoneNumberId || '',
    wabaId: doc.wabaId || '',
    webhookUrl: doc.webhookUrl || '',
    coexistence: doc.coexistence !== false,
    hasToken: Boolean(doc.encryptedToken?.data),
    tokenMasked: doc.tokenMasked || '',
    lastTestedAt: doc.lastTestedAt || null,
    lastTestStatus: doc.lastTestStatus || null,
    lastTestMessage: doc.lastTestMessage || null,
    updatedAt: doc.updatedAt || null,
  };
}

function resolveTargetStoreId(req: express.Request, user: AuthenticatedRequestUser): string {
  const requested = String(req.query.storeId || req.body?.storeId || '').trim();
  if (user.role !== 'DEV_OWNER' && isSingleBranchLocked(user)) {
    return String(user.storeId);
  }
  return requested || String(user.storeId || '');
}

router.get(
  '/whatsapp/config',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES]),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = resolveTargetStoreId(req, user);
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const snap = await db.collection('store_whatsapp_configs').doc(`wa-${storeId}`).get();
      res.json(sanitizeConfig(snap.exists ? (snap.data() as Record<string, any>) : null, storeId));
    } catch {
      res.status(500).json({ error: 'Erro ao carregar configuração WhatsApp da loja.' });
    }
  }
);

router.post(
  '/whatsapp/config',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES]),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const body = stripPrototypePollution(req.body || {});
      const storeId = resolveTargetStoreId(req, user);
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const mode = String(body.mode || 'WA_ME').toUpperCase() as WhatsAppMode;
      if (!['WA_ME', 'CLOUD_API', 'WEBHOOK'].includes(mode)) {
        return res.status(400).json({ error: 'Modo inválido. Utilize WA_ME, CLOUD_API ou WEBHOOK.' });
      }

      const phoneNumberId = String(body.phoneNumberId || '').trim();
      const wabaId = String(body.wabaId || '').trim();
      const webhookUrl = String(body.webhookUrl || '').trim();
      const rawToken = typeof body.token === 'string' ? body.token.trim() : '';

      if (mode === 'CLOUD_API' && !phoneNumberId) {
        return res.status(400).json({ error: 'Informe o Phone Number ID da Meta Cloud API.' });
      }
      if (mode === 'WEBHOOK' && !isPublicHttpsUrl(webhookUrl)) {
        return res.status(400).json({
          error: 'Informe uma URL HTTPS pública válida para o conector Webhook.',
        });
      }

      const docRef = db.collection('store_whatsapp_configs').doc(`wa-${storeId}`);
      const existingSnap = await docRef.get();
      const existing = existingSnap.exists ? (existingSnap.data() as Record<string, any>) : null;

      let encryptedToken = existing?.encryptedToken || null;
      let tokenMasked = existing?.tokenMasked || '';
      if (body.clearToken === true || mode === 'WA_ME') {
        encryptedToken = null;
        tokenMasked = '';
      } else if (rawToken) {
        encryptedToken = encryptIntegrationSecret(rawToken);
        tokenMasked = maskToken(rawToken);
      }

      if (mode === 'CLOUD_API' && !encryptedToken) {
        return res.status(400).json({
          error: 'Informe o Token de Acesso Permanente (Bearer) da Meta Cloud API.',
        });
      }

      const nextDoc = {
        id: `wa-${storeId}`,
        storeId,
        tenantId: access.store?.tenantId || user.tenantId || 'tenant-1',
        mode,
        phoneNumberId,
        wabaId,
        webhookUrl,
        coexistence: body.coexistence !== false,
        encryptedToken,
        tokenMasked,
        lastTestedAt: existing?.lastTestedAt || null,
        lastTestStatus: mode === 'WA_ME' ? 'WA_ME_READY' : existing?.lastTestStatus || null,
        lastTestMessage:
          mode === 'WA_ME'
            ? 'Modo links diretos wa.me zero-custo ativo.'
            : existing?.lastTestMessage || null,
        updatedAt: new Date().toISOString(),
        updatedBy: user.email || user.uid,
      };

      await docRef.set(nextDoc, { merge: true });
      res.json({ success: true, config: sanitizeConfig(nextDoc, storeId) });
    } catch {
      res.status(500).json({ error: 'Erro ao salvar configuração WhatsApp da loja.' });
    }
  }
);

router.post(
  '/whatsapp/test',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES]),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = resolveTargetStoreId(req, user);
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const docRef = db.collection('store_whatsapp_configs').doc(`wa-${storeId}`);
      const snap = await docRef.get();
      const cfg = snap.exists ? (snap.data() as Record<string, any>) : null;
      if (!cfg || cfg.mode === 'WA_ME') {
        return res.json({
          ok: true,
          status: 'WA_ME_READY',
          latencyMs: 0,
          message: 'Modo wa.me zero-custo ativo e pronto para disparos diretos sem servidor externo.',
        });
      }

      const token = decryptIntegrationSecret(cfg.encryptedToken);
      const started = Date.now();
      let ok = false;
      let statusLabel = 'ERROR';
      let message = 'Falha ao validar conector.';

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        try {
          if (cfg.mode === 'CLOUD_API') {
            if (!cfg.phoneNumberId || !token) {
              throw new Error('Phone Number ID ou Token não configurados.');
            }
            const metaRes = await fetch(
              `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}?fields=display_phone_number,verified_name`,
              {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
              }
            );
            const data: any = await metaRes.json().catch(() => ({}));
            if (metaRes.ok) {
              ok = true;
              statusLabel = 'CONNECTED';
              message = `Meta Cloud API conectada (${data.verified_name || data.display_phone_number || cfg.phoneNumberId}).`;
            } else {
              statusLabel = `HTTP_${metaRes.status}`;
              message = data?.error?.message || `Meta API retornou HTTP ${metaRes.status}.`;
            }
          } else if (cfg.mode === 'WEBHOOK') {
            if (!isPublicHttpsUrl(cfg.webhookUrl)) {
              throw new Error('URL do Webhook inválida ou bloqueada.');
            }
            const hookRes = await fetch(cfg.webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                event: 'WHATSAPP_HEALTH_PING',
                storeId,
                timestamp: new Date().toISOString(),
              }),
              signal: controller.signal,
            });
            ok = hookRes.ok;
            statusLabel = hookRes.ok ? 'CONNECTED' : `HTTP_${hookRes.status}`;
            message = hookRes.ok
              ? `Webhook respondeu HTTP ${hookRes.status} com sucesso.`
              : `Webhook retornou HTTP ${hookRes.status}.`;
          }
        } finally {
          clearTimeout(timer);
        }
      } catch (err: any) {
        statusLabel = 'UNREACHABLE';
        message =
          err?.name === 'AbortError'
            ? 'Tempo limite excedido (5s) ao contatar o provedor WhatsApp.'
            : err?.message || 'Não foi possível alcançar o provedor WhatsApp.';
      }

      const latencyMs = Date.now() - started;
      const nowIso = new Date().toISOString();
      await docRef.set(
        {
          lastTestedAt: nowIso,
          lastTestStatus: statusLabel,
          lastTestMessage: message,
        },
        { merge: true }
      );

      return res.json({ ok, status: statusLabel, latencyMs, message, testedAt: nowIso });
    } catch {
      return res.status(500).json({ error: 'Erro ao testar conector WhatsApp.' });
    }
  }
);

router.post(
  '/whatsapp/send',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES]),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const body = stripPrototypePollution(req.body || {});
      const storeId = resolveTargetStoreId(req, user);
      const phone = String(body.phone || '').replace(/\D/g, '');
      const text = String(body.message || '').trim();

      if (!storeId || !phone || !text) {
        return res.status(400).json({ error: 'storeId, phone e message são obrigatórios.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const snap = await db.collection('store_whatsapp_configs').doc(`wa-${storeId}`).get();
      const cfg = snap.exists ? (snap.data() as Record<string, any>) : null;
      if (!cfg || cfg.mode === 'WA_ME') {
        return res.status(400).json({
          error: 'Conector API não ativo. Utilize o envio direto via wa.me.',
          fallbackMode: 'WA_ME',
        });
      }

      const token = decryptIntegrationSecret(cfg.encryptedToken);
      const e164Phone = phone.startsWith('55') ? phone : `55${phone}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      try {
        if (cfg.mode === 'CLOUD_API') {
          if (!cfg.phoneNumberId || !token) {
            return res.status(400).json({ error: 'Credenciais Meta Cloud API incompletas.' });
          }
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: e164Phone,
                type: 'text',
                text: { body: text },
              }),
              signal: controller.signal,
            }
          );
          const metaData: any = await metaRes.json().catch(() => ({}));
          if (!metaRes.ok) {
            return res.status(502).json({
              error: metaData?.error?.message || `Meta Cloud API retornou HTTP ${metaRes.status}.`,
            });
          }
          return res.json({
            success: true,
            provider: 'CLOUD_API',
            messageId: metaData?.messages?.[0]?.id || null,
          });
        }

        if (!isPublicHttpsUrl(cfg.webhookUrl)) {
          return res.status(400).json({ error: 'URL do Webhook inválida.' });
        }
        const hookRes = await fetch(cfg.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            event: 'WHATSAPP_SEND_MESSAGE',
            storeId,
            to: e164Phone,
            message: text,
            customerName: body.customerName || '',
            orderCode: body.orderCode || null,
          }),
          signal: controller.signal,
        });
        if (!hookRes.ok) {
          return res.status(502).json({
            error: `Webhook retornou HTTP ${hookRes.status} ao tentar enviar mensagem.`,
          });
        }
        return res.json({ success: true, provider: 'WEBHOOK' });
      } finally {
        clearTimeout(timer);
      }
    } catch (err: any) {
      return res.status(502).json({
        error:
          err?.name === 'AbortError'
            ? 'Tempo limite excedido ao enviar via conector WhatsApp.'
            : err?.message || 'Erro ao enviar mensagem via conector WhatsApp.',
      });
    }
  }
);

router.get(
  '/whatsapp/triggers',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES, 'CASHIER']),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const storeId = resolveTargetStoreId(req, user);
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }

      const snap = await db.collection('automated_messages').get();
      const existing = snap.docs
        .map((d) => d.data())
        .filter((m) => m && !m._deleted && m.storeId === storeId);

      const merged = DEFAULT_TRIGGERS.map((def) => {
        const match = existing.find((m) => m.trigger === def.trigger);
        if (match) return match;
        return {
          id: `auto-${storeId}-${def.trigger.toLowerCase()}`,
          storeId,
          trigger: def.trigger,
          content: def.content,
          isActive: def.isActive,
        };
      });

      res.json(merged);
    } catch {
      res.status(500).json({ error: 'Erro ao listar gatilhos automáticos de WhatsApp.' });
    }
  }
);

router.put(
  '/whatsapp/triggers/:trigger',
  verifyAutonomousToken,
  requireRoles([...WA_ALLOWED_ROLES]),
  async (req, res) => {
    try {
      const user = (req as any).user as AuthenticatedRequestUser;
      const body = stripPrototypePollution(req.body || {});
      const storeId = resolveTargetStoreId(req, user);
      const trigger = String(req.params.trigger || '').toUpperCase();
      if (!storeId) {
        return res.status(400).json({ error: 'storeId é obrigatório.' });
      }
      if (
        !['ORDER_PLACED', 'ORDER_READY', 'ORDER_OUT_FOR_DELIVERY', 'ORDER_COMPLETED'].includes(trigger)
      ) {
        return res.status(400).json({ error: 'Gatilho inválido.' });
      }
      if (user.role !== 'DEV_OWNER' && !hasUserStoreAccess(user, storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }
      const access = await verifyStoreTenantAccess(storeId, user);
      if (access.ok === false) {
        return res.status(access.status).json({ error: access.error });
      }

      const id = `auto-${storeId}-${trigger.toLowerCase()}`;
      const docRef = db.collection('automated_messages').doc(id);
      const existingSnap = await docRef.get();
      const def = DEFAULT_TRIGGERS.find((d) => d.trigger === trigger)!;
      const existing = existingSnap.exists ? (existingSnap.data() as Record<string, any>) : null;

      const nextDoc = {
        id,
        storeId,
        tenantId: access.store?.tenantId || user.tenantId || 'tenant-1',
        trigger,
        content:
          typeof body.content === 'string' && body.content.trim()
            ? body.content.trim()
            : existing?.content || def.content,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : existing?.isActive ?? def.isActive,
        updatedAt: new Date().toISOString(),
      };

      await docRef.set(nextDoc, { merge: true });
      res.json({ success: true, trigger: nextDoc });
    } catch {
      res.status(500).json({ error: 'Erro ao atualizar gatilho automático.' });
    }
  }
);

export default router;
