import express from 'express';
import crypto from 'crypto';
import { db, decryptIntegrationSecret, encryptIntegrationSecret } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import {
  HQ_ONLY_ROLES,
  recordAdminAuditEvent,
  stripPrototypePollution,
  validateSafeExternalUrl,
} from './adminHelpersCore.ts';

const router = express.Router();

// ==========================================
// SYSTEM INTEGRATIONS ENDPOINTS (HQ ONLY)
// ==========================================

export function sanitizeIntegrationForResponse(integ: any) {
  if (!integ || typeof integ !== 'object') return integ;
  const copy = { ...integ };
  delete copy.encryptedSecret;
  delete copy.apiKey;
  delete copy.token;
  return {
    ...copy,
    hasStoredSecret: Boolean(integ?.encryptedSecret?.data || integ?.hasStoredSecret),
  };
}

router.get('/integrations', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const isDevOwner = authenticatedUser.role === 'DEV_OWNER';
    const snap = await db.collection('integrations').get();
    let integrations = snap.docs.map(d => sanitizeIntegrationForResponse(d.data()));
    if (!isDevOwner) {
      integrations = integrations.filter(i => i.tenantId === authenticatedUser.tenantId);
    } else if (req.query.tenantId) {
      const targetTenant = String(req.query.tenantId);
      integrations = integrations.filter(i => i.tenantId === targetTenant || !i.tenantId);
    }
    res.json(integrations);
  } catch {
    res.status(500).json({ error: 'Erro ao listar integrações.' });
  }
});

router.post('/integrations', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const integration = stripPrototypePollution(req.body || {});
    const id = integration.id || `int-${Date.now()}`;

    const existingSnap = await db.collection('integrations').doc(id).get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    if (existingData && authenticatedUser.role !== 'DEV_OWNER') {
      const existingTenant = existingData?.tenantId;
      if (!existingTenant || existingTenant !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Integração global ou de outra empresa/tenant.' });
      }
    }

    const tenantId = authenticatedUser.role === 'DEV_OWNER'
      ? (integration.tenantId || existingData?.tenantId)
      : authenticatedUser.tenantId;

    const rawToken = typeof (integration.apiKey || integration.token) === 'string'
      ? String(integration.apiKey || integration.token).trim()
      : '';
    const masked = rawToken
      ? `${rawToken.slice(0, 4)}••••••••`
      : (integration.apiKeyMasked || existingData?.apiKeyMasked || 'NÃO CONFIGURADO');
    const encryptedSecret = rawToken
      ? encryptIntegrationSecret(rawToken)
      : existingData?.encryptedSecret;
    const nowIso = new Date().toISOString();

    const saved = {
      ...(existingData || {}),
      ...integration,
      id,
      apiKeyMasked: masked,
      ...(encryptedSecret ? { encryptedSecret, hasStoredSecret: true } : {}),
      status: rawToken ? 'CONFIGURED' : (integration.status || existingData?.status || 'ABSENT'),
      lastSync: integration.lastSync || 'Pendente de validação',
      ...(tenantId ? { tenantId } : {}),
      updatedAt: nowIso,
    };
    delete (saved as any).apiKey;
    delete (saved as any).token;

    await db.collection('integrations').doc(id).set(saved, { merge: true });
    await recordAdminAuditEvent(
      'INTEGRATION_SAVED',
      `Integração '${saved.name || id}' atualizada pelo HQ (status: ${saved.status})`,
      'hq/integrations',
      tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'integrations',
        resourceId: id,
        before: existingData ? sanitizeIntegrationForResponse(existingData) : null,
        after: sanitizeIntegrationForResponse(saved),
      }
    );
    res.json({ success: true, integration: sanitizeIntegrationForResponse(saved) });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar integração.' });
  }
});

router.post('/integrations/:id/test', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const docRef = db.collection('integrations').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    const integ = snap.data() || {};
    if (authenticatedUser.role !== 'DEV_OWNER' && (!integ?.tenantId || integ.tenantId !== authenticatedUser.tenantId)) {
      return res.status(403).json({ error: 'Acesso negado: Integração global ou de outra empresa/tenant.' });
    }

    if (integ?.status === 'SUSPENDED') {
      return res.status(400).json({ error: 'Integração suspensa. Reative antes de testar a conexão.' });
    }

    const hasEncryptedVaultSecret = Boolean(integ?.encryptedSecret?.data && integ?.encryptedSecret?.alg === 'aes-256-gcm');
    const hasConfiguredKey = Boolean(
      hasEncryptedVaultSecret ||
      (integ?.apiKeyMasked &&
        integ.apiKeyMasked !== 'NÃO CONFIGURADO' &&
        integ.apiKeyMasked !== 'N/A' &&
        !String(integ.apiKeyMasked).toUpperCase().includes('DEMO'))
    );
    const endpointUrl = typeof integ?.endpointUrl === 'string' ? integ.endpointUrl.trim() : '';

    let nextStatus: 'ABSENT' | 'CONFIGURED' | 'REACHABLE' | 'CONNECTED' | 'AUTH_FAILED' | 'OPERATIONAL' | 'ERROR' = 'ERROR';
    let isHealthy = false;
    let liveVerified = false;
    let ssrfBlocked = false;
    let lastHttpStatus: number | null = null;
    let diagnosticMessage = 'Credenciais ou endpoint não validados.';
    const probeStartedAt = Date.now();

    if (endpointUrl) {
      const ssrfCheck = await validateSafeExternalUrl(endpointUrl);
      if (ssrfCheck.ok === false) {
        ssrfBlocked = true;
        nextStatus = 'ERROR';
        diagnosticMessage = `Bloqueio de segurança: ${ssrfCheck.reason}`;
      } else {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const probe = await fetch(ssrfCheck.url.toString(), {
            method: integ?.category === 'MAPS' ? 'HEAD' : 'GET',
            redirect: 'error',
            signal: controller.signal,
          });
          clearTimeout(timer);
          lastHttpStatus = probe.status;
          if (probe.status === 401 || probe.status === 403) {
            nextStatus = 'AUTH_FAILED';
            diagnosticMessage = `Endpoint externo retornou falha de autenticação (HTTP ${probe.status}).`;
          } else if (probe.ok) {
            nextStatus = hasConfiguredKey ? 'OPERATIONAL' : 'REACHABLE';
            isHealthy = true;
            liveVerified = true;
            diagnosticMessage = `Probe externo respondido (HTTP ${probe.status}); estado ${nextStatus}.`;
          } else {
            nextStatus = 'ERROR';
            diagnosticMessage = `Endpoint externo retornou HTTP ${probe.status}.`;
          }
        } catch (err: any) {
          nextStatus = 'ERROR';
          diagnosticMessage = `Falha ao contatar endpoint externo: ${err?.message || 'timeout'}.`;
        }
      }
    } else if (integ?.category === 'AI') {
      const hasRuntimeKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
      if (hasRuntimeKey) {
        nextStatus = 'CONFIGURED';
        isHealthy = true;
        diagnosticMessage = 'Chave GEMINI_API_KEY configurada no runtime (sem chamada paga executada no probe).';
      } else {
        nextStatus = 'ABSENT';
        diagnosticMessage = 'Ausente: GEMINI_API_KEY não configurada no runtime do Server Core.';
      }
    } else if (integ?.category === 'MAPS') {
      nextStatus = 'CONFIGURED';
      isHealthy = true;
      diagnosticMessage = 'OpenFreeMaps / Leaflet configurado (tiles públicos sem chave proprietária; defina endpointUrl para probe ativo).';
    } else if (integ?.category === 'PAYMENT') {
      const storesSnap = await db.collection('stores').get();
      const hasAnyPixKey = storesSnap.docs.some((d) => Boolean(d.data()?.pixKey));
      if (hasConfiguredKey || hasAnyPixKey) {
        nextStatus = 'CONFIGURED';
        isHealthy = true;
        diagnosticMessage = hasConfiguredKey
          ? 'Credencial criptografada no cofre; informe endpointUrl externo para teste de conectividade.'
          : 'Chave PIX direta cadastrada nas lojas; webhook bancário aguardando credencial de adquirente.';
      } else {
        nextStatus = 'ABSENT';
        diagnosticMessage = 'Ausente: Nenhuma chave de API do gateway ou chave PIX configurada.';
      }
    } else if (integ?.category === 'FISCAL_NFE') {
      nextStatus = 'ABSENT';
      diagnosticMessage = 'Ausente: Certificado A1 / Token SEFAZ ou endpoint WebService externo não configurado.';
    } else if (integ?.category === 'WHATSAPP') {
      if (hasConfiguredKey) {
        nextStatus = 'CONFIGURED';
        isHealthy = true;
        diagnosticMessage = 'Credencial Meta WhatsApp Cloud API armazenada; webhook e entrega ativa não testados (informe endpointUrl para verificação live).';
      } else {
        nextStatus = 'ABSENT';
        diagnosticMessage = 'Ausente: Token Meta Cloud API não configurado (modo deeplink wa.me local).';
      }
    } else if (hasConfiguredKey) {
      nextStatus = 'CONFIGURED';
      isHealthy = true;
      diagnosticMessage = 'Chave de integração presente no cofre (CONFIGURED); informe endpointUrl para probe HTTP ativo.';
    } else {
      nextStatus = 'ABSENT';
      diagnosticMessage = 'Ausente: Integração sem chave de API ou endpoint configurado.';
    }

    const latencyMs = Math.max(0, Date.now() - probeStartedAt);
    const nowIso = new Date().toISOString();
    const prevHistory = Array.isArray(integ?.probeHistory) ? integ.probeHistory : [];
    const probeHistory = [
      {
        timestamp: nowIso,
        kind: 'HEALTH_PROBE',
        status: nextStatus,
        httpStatus: lastHttpStatus,
        latencyMs,
        message: diagnosticMessage,
      },
      ...prevHistory.slice(0, 9),
    ];

    const patch = {
      status: nextStatus,
      liveVerified,
      lastSync: nowIso,
      diagnosticMessage,
      latencyMs,
      lastHttpStatus,
      probeHistory,
      updatedAt: nowIso
    };

    await docRef.update(patch);
    await recordAdminAuditEvent(
      'INTEGRATION_TESTED',
      `Diagnóstico da integração '${integ?.name || id}': ${nextStatus} (${latencyMs}ms) — ${diagnosticMessage}`,
      'hq/integrations',
      integ?.tenantId || authenticatedUser.tenantId || 'tenant-1',
      { req, actor: authenticatedUser, resourceType: 'integrations', resourceId: id, after: { ...patch, probeHistory: undefined } }
    );

    if (ssrfBlocked) {
      return res.status(400).json({
        success: false,
        status: nextStatus,
        liveVerified: false,
        error: diagnosticMessage,
        diagnosticMessage,
        latencyMs,
        lastHttpStatus,
        probeHistory,
        lastSync: nowIso,
      });
    }

    res.json({
      success: isHealthy,
      status: nextStatus,
      liveVerified,
      diagnosticMessage,
      latencyMs,
      lastHttpStatus,
      probeHistory,
      lastSync: nowIso,
    });
  } catch {
    res.status(500).json({ error: 'Falha ao testar conexão da integração.' });
  }
});

const ALLOWED_WEBHOOK_TEST_EVENTS = new Set(['PING', 'ORDER_COMMITTED', 'PAYMENT_CONFIRMED']);

router.post('/integrations/:id/webhook-test', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const requestedEvent = String(req.body?.eventType || 'PING').trim().toUpperCase();
    const eventType = ALLOWED_WEBHOOK_TEST_EVENTS.has(requestedEvent) ? requestedEvent : 'PING';

    const docRef = db.collection('integrations').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    const integ = snap.data() || {};
    if (integ?.status === 'SUSPENDED') {
      return res.status(400).json({ error: 'Integração suspensa. Reative antes de disparar webhook.' });
    }

    const rawTargetUrl = typeof req.body?.targetUrl === 'string' && req.body.targetUrl.trim()
      ? req.body.targetUrl.trim()
      : (typeof integ?.endpointUrl === 'string' ? integ.endpointUrl.trim() : '');

    if (!rawTargetUrl) {
      return res.status(400).json({
        error: 'Defina um endpointUrl HTTPS na integração para disparar webhook assinado.',
      });
    }

    const ssrfCheck = await validateSafeExternalUrl(rawTargetUrl);
    if (ssrfCheck.ok === false) {
      return res.status(400).json({
        success: false,
        error: `Bloqueio anti-SSRF no webhook test: ${ssrfCheck.reason}`,
      });
    }

    const nowIso = new Date().toISOString();
    const deliveryId = `whk_${crypto.randomBytes(6).toString('hex')}`;
    const payloadObj = {
      event: eventType,
      deliveryId,
      integrationId: id,
      integrationName: integ.name || id,
      tenantId: integ.tenantId || authenticatedUser.tenantId || 'tenant-1',
      timestamp: nowIso,
      dryRun: true,
      data: {
        source: '3c-hq-webhook-dispatcher',
        sampleTotal: eventType === 'PING' ? 0 : 49.9,
      },
    };
    const bodyString = JSON.stringify(payloadObj);

    const decryptedVaultSecret = decryptIntegrationSecret(integ?.encryptedSecret);
    const hmacKey = decryptedVaultSecret || crypto.randomBytes(32).toString('hex');
    const signatureMode = decryptedVaultSecret ? 'VAULT_SECRET_HMAC_SHA256' : 'EPHEMERAL_HMAC_SHA256';
    const signatureHex = crypto.createHmac('sha256', hmacKey).update(bodyString).digest('hex');

    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let delivered = false;
    let dispatchMessage = '';

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(ssrfCheck.url.toString(), {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-3C-Event': eventType,
          'X-3C-Delivery': deliveryId,
          'X-3C-Signature': `sha256=${signatureHex}`,
        },
        body: bodyString,
      });
      clearTimeout(timer);
      httpStatus = response.status;
      delivered = response.ok;
      dispatchMessage = response.ok
        ? `Webhook ${eventType} entregue com assinatura HMAC-SHA256 (HTTP ${response.status}).`
        : `Destino respondeu HTTP ${response.status} ao webhook ${eventType}.`;
    } catch (err: any) {
      dispatchMessage = `Falha de entrega do webhook ${eventType}: ${err?.message || 'timeout'}.`;
    }

    const latencyMs = Math.max(0, Date.now() - startedAt);
    const prevHistory = Array.isArray(integ?.probeHistory) ? integ.probeHistory : [];
    const probeHistory = [
      {
        timestamp: nowIso,
        kind: 'WEBHOOK_TEST',
        status: delivered ? 'DELIVERED' : 'ERROR',
        httpStatus,
        latencyMs,
        message: dispatchMessage,
        eventType,
      },
      ...prevHistory.slice(0, 9),
    ];

    await docRef.update({
      lastSync: nowIso,
      latencyMs,
      lastHttpStatus: httpStatus,
      diagnosticMessage: dispatchMessage,
      probeHistory,
      updatedAt: nowIso,
    });

    await recordAdminAuditEvent(
      'INTEGRATION_WEBHOOK_TESTED',
      `Webhook test (${eventType}) em '${integ?.name || id}': ${delivered ? 'OK' : 'FALHA'} (${latencyMs}ms, HTTP ${httpStatus ?? 'ERR'})`,
      'hq/integrations',
      integ?.tenantId || authenticatedUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'integrations',
        resourceId: id,
        after: { eventType, deliveryId, signatureMode, httpStatus, latencyMs, delivered },
      }
    );

    res.json({
      success: delivered,
      deliveryId,
      eventType,
      httpStatus,
      latencyMs,
      signatureHeader: 'X-3C-Signature',
      signaturePreview: `sha256=${signatureHex.slice(0, 12)}...`,
      signatureMode,
      diagnosticMessage: dispatchMessage,
      lastSync: nowIso,
      probeHistory,
    });
  } catch {
    res.status(500).json({ error: 'Falha ao disparar teste de webhook da integração.' });
  }
});

router.post('/integrations/:id/suspend', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const { id } = req.params;
    const docRef = db.collection('integrations').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }

    const integ = snap.data();
    if (authenticatedUser.role !== 'DEV_OWNER' && (!integ?.tenantId || integ.tenantId !== authenticatedUser.tenantId)) {
      return res.status(403).json({ error: 'Acesso negado: Integração global ou de outra empresa/tenant.' });
    }

    const nextStatus = integ?.status === 'SUSPENDED' ? 'CONFIGURED' : 'SUSPENDED';
    const nowIso = new Date().toISOString();
    await docRef.update({ status: nextStatus, updatedAt: nowIso });

    await recordAdminAuditEvent(
      'INTEGRATION_SUSPENDED',
      `Integração '${integ?.name || id}' alterada para ${nextStatus}`,
      'hq/integrations',
      integ?.tenantId || authenticatedUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'integrations',
        resourceId: id,
        before: { status: integ?.status },
        after: { status: nextStatus },
      }
    );

    res.json({ success: true, status: nextStatus });
  } catch {
    res.status(500).json({ error: 'Falha ao alterar status da integração.' });
  }
});

router.delete('/integrations/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const docRef = db.collection('integrations').doc(req.params.id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Integração não encontrada.' });
    }
    const existing = snap.data();
    if (authenticatedUser.role !== 'DEV_OWNER' && (!existing?.tenantId || existing.tenantId !== authenticatedUser.tenantId)) {
      return res.status(403).json({ error: 'Acesso negado: Integração global ou de outra empresa/tenant.' });
    }
    await docRef.delete();
    await recordAdminAuditEvent(
      'INTEGRATION_DELETED',
      `Integração '${existing?.name || req.params.id}' removida`,
      'hq/integrations',
      existing?.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'integrations',
        resourceId: req.params.id,
        before: sanitizeIntegrationForResponse(existing),
        after: null,
      }
    );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Erro ao deletar integração.' });
  }
});

export default router;
