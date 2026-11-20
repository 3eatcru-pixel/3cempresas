import crypto from 'crypto';
import express from 'express';
import {
  db,
  decryptIntegrationSecret,
  runWithSystemDbContext,
} from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import {
  HQ_ONLY_ROLES,
  recordAdminAuditEvent,
} from './adminHelpersCore.ts';

const router = express.Router();

// ==========================================
// SAAS BILLING RECONCILIATION & PSP WEBHOOKS
// ==========================================

router.post('/billing/reconcile', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const now = Date.now();
    const govSnap = await db.collection('governance').doc('governance').get();
    const billingCfg = govSnap.exists ? govSnap.data()?.billingConfig || {} : {};
    const gracePeriodDays = Math.max(0, Number(billingCfg.gracePeriodDays ?? 5));
    const gracePeriodMs = gracePeriodDays * 86400000;
    const autoSuspendOverdue = Boolean(billingCfg.autoSuspendOverdue);

    const storesSnap = await db.collection('stores').get();
    let reconciledCount = 0;
    let overdueCount = 0;
    let suspendedCount = 0;

    for (const docSnap of storesSnap.docs) {
      const store = docSnap.data();
      if (!store || store._deleted) continue;

      let nextStatus = store.saasPaymentStatus;
      const isExpiredTrial =
        store.subscriptionPlan === 'FREE' &&
        store.trialExpiresAt &&
        new Date(store.trialExpiresAt).getTime() < now;

      const dueTs =
        store.subscriptionPlan !== 'FREE' && store.saasNextDueDate
          ? new Date(store.saasNextDueDate).getTime()
          : NaN;
      const isExpiredDueDate =
        Number.isFinite(dueTs) &&
        store.saasPaymentStatus === 'PENDING' &&
        dueTs < now;
      const isPastGraceWindow =
        Number.isFinite(dueTs) && dueTs + gracePeriodMs < now;

      if (autoSuspendOverdue && (isPastGraceWindow || (isExpiredTrial && gracePeriodDays === 0)) && store.saasPaymentStatus !== 'PAID' && store.saasPaymentStatus !== 'SUSPENDED') {
        nextStatus = 'SUSPENDED';
        const nowIso = new Date().toISOString();
        await db.collection('stores').doc(docSnap.id).update({
          saasPaymentStatus: 'SUSPENDED',
          tenantStatus: 'SUSPENDED',
          updatedAt: nowIso,
        });
        if (store.tenantId) {
          await db.collection('tenants').doc(String(store.tenantId)).set({
            saasPaymentStatus: 'SUSPENDED',
            status: 'SUSPENDED',
            updatedAt: nowIso,
          }, { merge: true });
        }
        reconciledCount++;
        suspendedCount++;
      } else if ((isExpiredTrial || isExpiredDueDate) && store.saasPaymentStatus !== 'OVERDUE' && store.saasPaymentStatus !== 'SUSPENDED') {
        nextStatus = 'OVERDUE';
        const nowIso = new Date().toISOString();
        await db.collection('stores').doc(docSnap.id).update({
          saasPaymentStatus: 'OVERDUE',
          updatedAt: nowIso,
        });
        if (store.tenantId) {
          await db.collection('tenants').doc(String(store.tenantId)).set({
            saasPaymentStatus: 'OVERDUE',
            updatedAt: nowIso,
          }, { merge: true });
        }
        reconciledCount++;
      }

      if (nextStatus === 'OVERDUE' || nextStatus === 'SUSPENDED') {
        overdueCount++;
      }
    }

    const refreshedSnap = await db.collection('stores').get();
    const updatedStores = refreshedSnap.docs.map(d => d.data()).filter(s => s && !s._deleted);

    await recordAdminAuditEvent(
      'BILLING_DELINQUENCY_CHECK',
      `Verificação de adimplência SaaS concluída (carência ${gracePeriodDays}d, auto-suspensão ${autoSuspendOverdue ? 'ON' : 'OFF'}): ${updatedStores.length} lojas verificadas, ${reconciledCount} atualizada(s), ${overdueCount} vencida(s), ${suspendedCount} suspensa(s).`,
      'hq/billing',
      authenticatedUser.tenantId || 'tenant-1',
      { req, actor: authenticatedUser, resourceType: 'billing', resourceId: 'delinquency-check' }
    );

    res.json({
      success: true,
      operationType: 'DELINQUENCY_STATUS_CHECK',
      gatewaySettlementVerified: false,
      gracePeriodDays,
      autoSuspendOverdue,
      checkedStores: updatedStores.length,
      reconciledCount,
      overdueCount,
      suspendedCount,
      stores: updatedStores,
      reconciledAt: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({ error: 'Falha ao verificar inadimplência de assinaturas SaaS.' });
  }
});

router.post('/stores/:id/billing-status', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const { saasPaymentStatus } = req.body || {};
    const validStatuses = ['TRIAL', 'PENDING', 'PAID', 'OVERDUE', 'SUSPENDED'];
    if (!saasPaymentStatus || !validStatuses.includes(String(saasPaymentStatus).toUpperCase())) {
      return res.status(400).json({ error: `Status de pagamento inválido. Utilize: [${validStatuses.join(', ')}].` });
    }
    const normalizedStatus = String(saasPaymentStatus).toUpperCase();
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const storeRef = db.collection('stores').doc(id);
    const snap = await storeRef.get();
    if (!snap.exists || snap.data()?._deleted) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }
    const currentStore = snap.data() || {};
    const nowIso = new Date().toISOString();
    const storeUpdate: Record<string, any> = {
      saasPaymentStatus: normalizedStatus,
      updatedAt: nowIso,
    };
    if (normalizedStatus === 'PAID') {
      storeUpdate.saasLastPaidAt = nowIso;
      storeUpdate.saasSettlementType = 'MANUAL_HQ';
      storeUpdate.tenantStatus = 'ACTIVE';
      if (!currentStore.saasNextDueDate) {
        storeUpdate.saasNextDueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      }
    }
    await storeRef.update(storeUpdate);
    if (currentStore.tenantId) {
      await db.collection('tenants').doc(String(currentStore.tenantId)).set({
        saasPaymentStatus: normalizedStatus,
        ...(normalizedStatus === 'PAID' ? { status: 'ACTIVE' } : {}),
        updatedAt: nowIso,
      }, { merge: true });
    }
    await recordAdminAuditEvent(
      'STORE_BILLING_STATUS_UPDATED',
      `Status financeiro da loja '${currentStore.name || id}' alterado para ${normalizedStatus} pelo HQ`,
      'hq/billing',
      currentStore.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'stores',
        resourceId: id,
        before: { saasPaymentStatus: currentStore.saasPaymentStatus },
        after: { saasPaymentStatus: normalizedStatus },
      }
    );
    res.json({ success: true, id, saasPaymentStatus: normalizedStatus });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao atualizar status financeiro da loja.' });
  }
});

/**
 * Signed PSP Webhook for SaaS Subscription Billing (automated settlement separated from manual HQ billing-status)
 */
router.post('/billing/webhook', async (req, res) => {
  try {
    let secret = (process.env.SAAS_PSP_WEBHOOK_SECRET || process.env.PSP_WEBHOOK_SECRET || '').trim();
    if (!secret) {
      const integSnap = await runWithSystemDbContext('SAAS_BILLING_WEBHOOK_VAULT', () =>
        db.collection('integrations').get()
      );
      const matchingInteg = integSnap.docs
        .map((d) => d.data())
        .find(
          (integ) =>
            integ &&
            !integ._deleted &&
            integ.status !== 'SUSPENDED' &&
            integ.category === 'PAYMENT' &&
            (!integ.tenantId || integ.tenantId === 'tenant-1')
        );
      const decrypted = matchingInteg ? decryptIntegrationSecret(matchingInteg.encryptedSecret) : null;
      if (decrypted) {
        secret = decrypted.trim();
      }
    }
    if (!secret) {
      return res.status(501).json({
        error:
          'Webhook PSP de cobrança SaaS não configurado (defina SAAS_PSP_WEBHOOK_SECRET / PSP_WEBHOOK_SECRET no Server Core ou credencial PAYMENT no cofre de integrações).',
        configured: false,
      });
    }

    const rawSigHeader = String(req.headers['x-psp-signature'] || req.headers['x-webhook-signature'] || '').trim();
    const submittedHex = rawSigHeader.startsWith('sha256=') ? rawSigHeader.slice('sha256='.length) : rawSigHeader;
    if (!submittedHex) {
      return res.status(401).json({ error: 'Assinatura HMAC do PSP ausente.' });
    }

    const canonicalPayload = JSON.stringify(req.body || {});
    const expectedHex = crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex');
    const a = Buffer.from(submittedHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Assinatura HMAC do PSP inválida.' });
    }

    const { storeId, providerTransactionId, provider, status, paidAmount, nextDueDate } = req.body || {};
    if (!storeId || !providerTransactionId) {
      return res.status(400).json({ error: 'storeId e providerTransactionId são obrigatórios no webhook SaaS.' });
    }

    const normalizedStatus = String(status || '').toUpperCase();
    if (!['PAID', 'CONFIRMED', 'APPROVED', 'SETTLED'].includes(normalizedStatus)) {
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: `Status '${normalizedStatus || 'UNKNOWN'}' não representa liquidação de assinatura.`,
      });
    }

    const idempotencyKey = `${String(provider || 'PSP').toUpperCase()}:${String(providerTransactionId)}`;
    const storePreviewSnap = await runWithSystemDbContext('SAAS_BILLING_WEBHOOK_STORE', () =>
      db.collection('stores').doc(String(storeId)).get()
    );
    if (!storePreviewSnap.exists || storePreviewSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Loja não encontrada para liquidação SaaS.' });
    }
    const storeTenantId = String(storePreviewSnap.data()?.tenantId || 'tenant-1');
    const eventRef = db.collection('saas_billing_webhook_events').doc(idempotencyKey);
    const storeRef = db.collection('stores').doc(String(storeId));

    const outcome = await db.runTransaction(async (tx) => {
      const existingEvent = await tx.get(eventRef);
      if (existingEvent.exists) {
        return { deduplicated: true as const, event: existingEvent.data() };
      }

      const storeSnap = await tx.get(storeRef);
      if (!storeSnap.exists || storeSnap.data()?._deleted) {
        const err: any = new Error('Loja não encontrada para liquidação SaaS.');
        err.statusCode = 404;
        throw err;
      }

      const storeData = storeSnap.data() || {};
      const expectedFee = Number(storeData.saasMonthlyFee || 0);
      if (paidAmount !== undefined && expectedFee > 0 && Number(paidAmount) + 0.01 < expectedFee) {
        const err: any = new Error(
          `Divergência de valor SaaS: esperado ${expectedFee.toFixed(2)}, recebido ${Number(paidAmount).toFixed(2)}.`
        );
        err.statusCode = 400;
        throw err;
      }

      const nowIso = new Date().toISOString();
      const computedNextDue =
        typeof nextDueDate === 'string' && nextDueDate.trim()
          ? nextDueDate.trim().slice(0, 10)
          : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      tx.update(storeRef, {
        saasPaymentStatus: 'PAID',
        saasLastPaidAt: nowIso,
        saasNextDueDate: computedNextDue,
        saasSettlementType: 'AUTOMATED_PSP',
        saasProviderTransactionId: String(providerTransactionId),
        saasProvider: String(provider || 'PSP_WEBHOOK'),
        updatedAt: nowIso,
      });

      if (storeData.tenantId) {
        const tenantRef = db.collection('tenants').doc(String(storeData.tenantId));
        tx.set(
          tenantRef,
          {
            saasPaymentStatus: 'PAID',
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      const evtRecord = {
        id: idempotencyKey,
        storeId: String(storeId),
        tenantId: storeData.tenantId || 'tenant-1',
        provider: String(provider || 'PSP_WEBHOOK'),
        providerTransactionId: String(providerTransactionId),
        paidAmount: paidAmount !== undefined ? Number(paidAmount) : expectedFee,
        paymentConfirmationType: 'AUTOMATED_PSP',
        processedAt: nowIso,
      };
      tx.set(eventRef, evtRecord);

      return { deduplicated: false as const, event: evtRecord, storeData };
    }, { tenantId: storeTenantId, bypassRls: false, reason: 'SAAS_BILLING_WEBHOOK_TX' });

    if (outcome.deduplicated) {
      return res.json({
        success: true,
        deduplicated: true,
        paymentConfirmationType: 'AUTOMATED_PSP',
        event: outcome.event,
      });
    }

    await recordAdminAuditEvent(
      'SAAS_BILLING_PSP_SETTLED',
      `Assinatura SaaS da loja '${outcome.storeData?.name || storeId}' liquidada via PSP (${outcome.event.provider} • tx=${providerTransactionId})`,
      'hq/billing',
      outcome.event.tenantId,
      {
        req,
        resourceType: 'stores',
        resourceId: String(storeId),
        after: {
          saasPaymentStatus: 'PAID',
          paymentConfirmationType: 'AUTOMATED_PSP',
          providerTransactionId: String(providerTransactionId),
        },
      }
    );

    res.json({
      success: true,
      deduplicated: false,
      paymentConfirmationType: 'AUTOMATED_PSP',
      storeId: String(storeId),
      providerTransactionId: String(providerTransactionId),
    });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Falha ao processar webhook PSP SaaS.' });
  }
});

export default router;
