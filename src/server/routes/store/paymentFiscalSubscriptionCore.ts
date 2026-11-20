import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  requireModuleAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { clusterState, broadcastSseEvent } from '../../state.ts';
import {
  generateAuditLogId,
  generateEventId,
  generateHlcTimestamp,
  generateRequestId,
} from '../../../utils/idGenerator.ts';
import { stageSyncOutboxInTransaction } from '../../persistence/PersistenceDriver.ts';
import {
  DEFAULT_PLATFORM_BILLING_CONFIG,
  DEFAULT_PLATFORM_GOVERNANCE,
} from '../../../constants/platformDefaults.ts';
import { verifyStoreTenantAccess } from './storeAccessHelpers.ts';

const router = express.Router();

// ==========================================
// PAYMENT GATEWAY, FISCAL & SUBSCRIPTION REQUESTS
// ==========================================

const ALL_STORE_PAYMENT_METHODS = [
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BOLETO',
  'BANK_TRANSFER',
  'PAYMENT_LINK',
] as const;

router.post('/payment-gateway-config', verifyAutonomousToken, requireRoles(['STORE_OWNER']), async (req, res) => {
  const { storeId, pixKey, pixKeyType, gatewayProvider, autoTransfer, acceptedPaymentMethods } = req.body;
  const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

  if (!storeId) {
    return res.status(400).json({ error: 'storeId é obrigatório.' });
  }

  const check = await verifyStoreTenantAccess(String(storeId), authenticatedUser);
  if (check.ok === false) {
    return res.status(check.status).json({ error: check.error });
  }

  const normalizedAcceptedMethods = Array.isArray(acceptedPaymentMethods)
    ? acceptedPaymentMethods
        .map((m) => String(m || '').toUpperCase())
        .filter((m) => (ALL_STORE_PAYMENT_METHODS as readonly string[]).includes(m))
    : undefined;

  const tenantId = check.store?.tenantId || authenticatedUser.tenantId || 'tenant-1';
  const config = {
    storeId,
    tenantId,
    pixKey: pixKey || '',
    pixKeyType: pixKeyType || 'EMAIL',
    gatewayProvider: gatewayProvider || 'PIX_DIRECT_MERCHANT',
    autoTransfer: autoTransfer ?? true,
    ...(normalizedAcceptedMethods && normalizedAcceptedMethods.length > 0
      ? { acceptedPaymentMethods: normalizedAcceptedMethods }
      : {}),
    commissionPolicy: '0%_COMMISSION_DIRECT_SALES',
    updatedAt: new Date().toISOString(),
  };

  try {
    await db.collection('payment_configs').doc(storeId).set(config, { merge: true });
    if (typeof pixKey === 'string' || normalizedAcceptedMethods) {
      const existingOps = check.store?.operationalSettings || {};
      await db.collection('stores').doc(storeId).set(
        {
          operationalSettings: {
            ...existingOps,
            ...(typeof pixKey === 'string' ? { pixKey } : {}),
            ...(normalizedAcceptedMethods && normalizedAcceptedMethods.length > 0
              ? { acceptedPaymentMethods: normalizedAcceptedMethods }
              : {}),
          },
          updatedAt: config.updatedAt,
        },
        { merge: true }
      );
    }
    clusterState.merchantPaymentConfigs.set(storeId, config);
    broadcastSseEvent('PAYMENT_CONFIG_UPDATED', { storeId, provider: config.gatewayProvider }, tenantId, true, {
      storeId,
      allowedRoles: ['STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER'],
    });
    res.json({ success: true, config });
  } catch {
    res.status(500).json({ error: 'Falha ao salvar configuração.' });
  }
});

router.get('/payment-gateway-config/:storeId', verifyAutonomousToken, requireRoles(['STORE_OWNER']), async (req, res) => {
  const { storeId } = req.params;
  const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

  const check = await verifyStoreTenantAccess(storeId, authenticatedUser);
  if (check.ok === false) {
    return res.status(check.status).json({ error: check.error });
  }

  let config = clusterState.merchantPaymentConfigs.get(storeId);
  if (!config) {
    try {
      const docSnap = await db.collection('payment_configs').doc(storeId).get();
      if (docSnap.exists) {
        config = docSnap.data();
      }
    } catch (err) {
      console.warn('Payment config read error:', err);
    }
  }
  const fallbackPixKey = String(check.store?.operationalSettings?.pixKey || '').trim();
  const resolvedPixKey = config?.pixKey || fallbackPixKey || '';
  const resolvedAcceptedMethods =
    Array.isArray(config?.acceptedPaymentMethods) && config.acceptedPaymentMethods.length > 0
      ? config.acceptedPaymentMethods
      : Array.isArray(check.store?.operationalSettings?.acceptedPaymentMethods) &&
        check.store.operationalSettings.acceptedPaymentMethods.length > 0
      ? check.store.operationalSettings.acceptedPaymentMethods
      : [...ALL_STORE_PAYMENT_METHODS];
  res.json(
    config
      ? { ...config, pixKey: resolvedPixKey, acceptedPaymentMethods: resolvedAcceptedMethods }
      : {
          storeId,
          tenantId: check.store?.tenantId,
          pixKey: resolvedPixKey,
          pixKeyType: 'EMAIL',
          gatewayProvider: 'PIX_DIRECT_MERCHANT',
          acceptedPaymentMethods: resolvedAcceptedMethods,
          configured: Boolean(resolvedPixKey),
        }
  );
});

router.get('/payment-public-info/:storeId', async (req, res) => {
  const { storeId } = req.params;
  const info = await runWithSystemDbContext('PUBLIC_PAYMENT_INFO', async () => {
    const storeSnap = await db.collection('stores').doc(storeId).get();
    if (!storeSnap.exists) {
      return { status: 404 as const, body: { error: 'Loja não encontrada.' } };
    }
    const storeData = storeSnap.data() || {};
    const tenantSnap = storeData.tenantId ? await db.collection('tenants').doc(String(storeData.tenantId)).get() : null;
    if (
      (tenantSnap?.exists && String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase() === 'SUSPENDED') ||
      String(storeData.status || 'ACTIVE').toUpperCase() === 'SUSPENDED'
    ) {
      return { status: 403 as const, body: { error: 'Estabelecimento indisponível: empresa suspensa.' } };
    }
    const docSnap = await db.collection('payment_configs').doc(storeId).get();
    const cfg = docSnap.exists ? docSnap.data() : null;
    const fallbackOpsPixKey =
      typeof storeData.operationalSettings?.pixKey === 'string' && storeData.operationalSettings.pixKey.trim()
        ? storeData.operationalSettings.pixKey.trim()
        : null;
    const effectivePixKey = cfg?.pixKey || fallbackOpsPixKey || null;
    const acceptedPaymentMethods: string[] =
      Array.isArray(storeData.operationalSettings?.acceptedPaymentMethods) &&
      storeData.operationalSettings.acceptedPaymentMethods.length > 0
        ? storeData.operationalSettings.acceptedPaymentMethods
        : Array.isArray(cfg?.acceptedPaymentMethods) && cfg.acceptedPaymentMethods.length > 0
        ? cfg.acceptedPaymentMethods
        : [...ALL_STORE_PAYMENT_METHODS];
    return {
      status: 200 as const,
      body: {
        storeId,
        pixKey: effectivePixKey,
        pixKeyType: cfg?.pixKeyType || (effectivePixKey ? 'EVP' : null),
        acceptsPix: Boolean(effectivePixKey) && acceptedPaymentMethods.includes('PIX'),
        acceptsCard: acceptedPaymentMethods.includes('CREDIT_CARD') || acceptedPaymentMethods.includes('DEBIT_CARD'),
        acceptsCash: acceptedPaymentMethods.includes('CASH'),
        acceptedPaymentMethods,
      },
    };
  });
  return res.status(info.status).json(info.body);
});

// Simulated Fiscal Emission (explicit storeId required — no silent store-1 fallback)
router.post('/fiscal/emit', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER']), requireModuleAccess('fiscal', 'pos'), async (req, res) => {
  const { storeId, amount, itemsCount } = req.body || {};
  const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
  const targetStoreId = String(storeId || authenticatedUser.storeId || '').trim();
  if (!targetStoreId) {
    return res.status(400).json({ error: 'storeId é obrigatório para emissão fiscal.' });
  }

  const check = await verifyStoreTenantAccess(targetStoreId, authenticatedUser);
  if (check.ok === false) {
    return res.status(check.status).json({ error: check.error });
  }

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Valor fiscal (amount) inválido: deve ser maior que zero.' });
  }
  const parsedItemsCount = itemsCount === undefined ? 1 : Number(itemsCount);
  if (!Number.isInteger(parsedItemsCount) || parsedItemsCount < 1) {
    return res.status(400).json({ error: 'Quantidade de itens (itemsCount) inválida: deve ser inteiro >= 1.' });
  }

  const protocolNum = `3526${Math.floor(1000000000 + Math.random() * 9000000000)}`;
  const chNFe = `352611${Math.floor(100000000000000 + Math.random() * 900000000000000)}550010000044211${Math.floor(10000000 + Math.random() * 90000000)}`;

  const emission = {
    id: chNFe,
    success: true,
    isSimulatedSandbox: true,
    taxEnvironment: 'SANDBOX_HOMOLOGACAO',
    status: 'SIMULATED_SANDBOX_AUTHORIZED',
    cStat: 100,
    protocol: protocolNum,
    chNFe,
    storeId: targetStoreId,
    tenantId: check.store?.tenantId || authenticatedUser.tenantId || 'tenant-1',
    amount: Math.round(parsedAmount * 100) / 100,
    itemsCount: parsedItemsCount,
    timestamp: new Date().toISOString(),
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(db.collection('fiscal_notes').doc(chNFe), emission);
    stageSyncOutboxInTransaction(transaction, {
      entity: 'fiscal_notes',
      entityId: chNFe,
      operation: 'UPSERT',
      tenantId: check.store?.tenantId || authenticatedUser.tenantId || 'tenant-1',
      storeId: targetStoreId,
      hlc: generateHlcTimestamp('cloud_core'),
      payload: emission,
    });
  });

  broadcastSseEvent('NFE_EMITTED', { storeId: targetStoreId, chNFe, protocol: protocolNum, isSimulatedSandbox: true }, check.store?.tenantId, true, {
    storeId: targetStoreId,
    allowedRoles: ['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER', 'CASHIER'],
  });
  res.json(emission);
});

// Store-scoped SPED Fiscal Export (explicit storeId required — no silent store-1 fallback)
router.get('/export/sped', verifyAutonomousToken, requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER', 'STORE_MANAGER']), requireModuleAccess('finance', 'fiscal'), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const requestedStoreId = String(req.query.storeId || authenticatedUser.storeId || '').trim();
    if (!requestedStoreId) {
      return res.status(400).json({ error: 'storeId é obrigatório para exportação SPED.' });
    }
    const check = await verifyStoreTenantAccess(requestedStoreId, authenticatedUser);
    if (check.ok === false) {
      return res.status(check.status).json({ error: check.error });
    }

    const snap = await db.collection('financial_records').get();
    const records = snap.docs
      .map((d) => d.data())
      .filter((r) => r.storeId === requestedStoreId && r.tenantId === (check.store?.tenantId || r.tenantId));

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const storeCity = String(check.store?.city || 'NAO_INFORMADO').slice(0, 40);
    const storeState = String(check.store?.state || 'BR').slice(0, 2).toUpperCase();
    let spedContent = `|0000|015|${String(check.store?.name || requestedStoreId).slice(0, 40)}|${requestedStoreId}|${date}|${date}|${storeCity}|${storeState}||\r\n`;
    spedContent += `|0001|0|\r\n`;

    records.forEach((r) => {
      const type = r.type === 'RECEIVABLE' ? 'E' : 'S';
      const amount = (Number(r.amount) || 0).toFixed(2).replace('.', ',');
      const due = String(r.dueDate || date).replace(/-/g, '');
      const desc = String(r.description || 'Lancamento').slice(0, 30);
      spedContent += `|F100|${type}|01|${r.id}|${due}|${amount}|01|0,00|0,00|${desc}|\r\n`;
    });

    spedContent += `|9999|${records.length + 3}|\r\n`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=SPED_${requestedStoreId}_${date}.txt`);
    res.send(spedContent);
  } catch {
    res.status(500).json({ error: 'Erro ao gerar SPED da loja.' });
  }
});

// Merchant-safe SaaS Billing Configuration read (exposes ONLY commercial pricing & HQ payment methods — zero admin internals)
router.get(
  '/billing-config',
  verifyAutonomousToken,
  requireRoles(['STORE_OWNER', 'REGIONAL_MANAGER', 'DEV_OWNER', 'SUPER_ADMIN']),
  async (_req, res) => {
    try {
      const govSnap = await runWithSystemDbContext('STORE_BILLING_CONFIG_READ', () =>
        db.collection('governance').doc('governance').get()
      );
      const govData = govSnap.exists ? govSnap.data() || {} : {};
      res.json({
        planPricing: {
          ...DEFAULT_PLATFORM_GOVERNANCE.planPricing,
          ...(govData.planPricing || {}),
        },
        billingConfig: {
          ...DEFAULT_PLATFORM_BILLING_CONFIG,
          ...(govData.billingConfig || {}),
        },
        defaultTrialDays: Number(govData.defaultTrialDays ?? DEFAULT_PLATFORM_GOVERNANCE.defaultTrialDays ?? 7),
        customPlatformName: govData.customPlatformName || DEFAULT_PLATFORM_GOVERNANCE.customPlatformName,
      });
    } catch {
      res.json({
        planPricing: DEFAULT_PLATFORM_GOVERNANCE.planPricing,
        billingConfig: DEFAULT_PLATFORM_BILLING_CONFIG,
        defaultTrialDays: DEFAULT_PLATFORM_GOVERNANCE.defaultTrialDays ?? 7,
        customPlatformName: DEFAULT_PLATFORM_GOVERNANCE.customPlatformName,
      });
    }
  }
);

// Merchant Subscription Upgrade Request (Cannot self-unlock quotas without HQ/Billing confirmation)
router.post(
  '/:id/subscription-request',
  verifyAutonomousToken,
  requireRoles(['REGIONAL_MANAGER', 'STORE_OWNER']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { requestedPlan, billingCycle = 'MONTHLY', paymentMethod = 'PIX', couponCode } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;

      const check = await verifyStoreTenantAccess(id, authenticatedUser);
      if (check.ok === false) {
        return res.status(check.status).json({ error: check.error });
      }
      if (check.store?._deleted) {
        return res.status(404).json({ error: 'Loja não encontrada ou removida.' });
      }

      const VALID_PLANS = ['FREE', 'PROMO', 'BASIC', 'PRO', 'ENTERPRISE'];
      const VALID_CYCLES = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];
      const VALID_PAYMENT_METHODS = [
        'PIX',
        'CREDIT_CARD',
        'DEBIT_CARD',
        'BOLETO',
        'BANK_TRANSFER',
        'PAYMENT_LINK',
      ];
      const normalizedPlan = String(requestedPlan || '').toUpperCase();
      const normalizedCycle = String(billingCycle || 'MONTHLY').toUpperCase();
      const normalizedPaymentMethod = String(paymentMethod || 'PIX').toUpperCase();

      if (!VALID_PLANS.includes(normalizedPlan)) {
        return res.status(400).json({ error: 'Plano solicitado inválido.' });
      }
      if (!VALID_CYCLES.includes(normalizedCycle)) {
        return res.status(400).json({ error: 'Ciclo de faturamento inválido.' });
      }
      if (!VALID_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
        return res.status(400).json({
          error:
            'Meio de pagamento inválido. Utilize PIX, CREDIT_CARD, DEBIT_CARD, BOLETO, BANK_TRANSFER ou PAYMENT_LINK.',
        });
      }

      const SERVER_PLAN_PRICING: Record<string, { MONTHLY: number; QUARTERLY: number; ANNUAL: number }> = {
        FREE: { MONTHLY: 0, QUARTERLY: 0, ANNUAL: 0 },
        PROMO: { MONTHLY: 49.9, QUARTERLY: 44.9, ANNUAL: 39.9 },
        BASIC: { MONTHLY: 149.0, QUARTERLY: 134.1, ANNUAL: 111.75 },
        PRO: { MONTHLY: 299.0, QUARTERLY: 269.1, ANNUAL: 224.25 },
        ENTERPRISE: { MONTHLY: 499.0, QUARTERLY: 449.1, ANNUAL: 374.25 },
      };

      const govSnap = await runWithSystemDbContext('SUBSCRIPTION_REQUEST_GOVERNANCE_READ', () =>
        db.collection('governance').doc('governance').get()
      );
      const govData = govSnap.exists ? govSnap.data() || {} : {};
      const billingConfig = {
        ...DEFAULT_PLATFORM_BILLING_CONFIG,
        ...(govData.billingConfig || {}),
      };

      const methodAvailability: Record<string, { enabled: boolean; label: string }> = {
        PIX: { enabled: Boolean(billingConfig.pixEnabled), label: 'PIX' },
        CREDIT_CARD: { enabled: Boolean(billingConfig.creditCardEnabled), label: 'Cartão de Crédito' },
        DEBIT_CARD: { enabled: Boolean(billingConfig.debitCardEnabled), label: 'Cartão de Débito' },
        BOLETO: { enabled: Boolean(billingConfig.boletoEnabled), label: 'Boleto Bancário' },
        BANK_TRANSFER: { enabled: Boolean(billingConfig.bankTransferEnabled), label: 'Transferência Bancária (TED/DOC)' },
        PAYMENT_LINK: { enabled: Boolean(billingConfig.paymentLinkEnabled), label: 'Link de Pagamento / Carteira' },
      };
      const chosenMeta = methodAvailability[normalizedPaymentMethod];
      if (!chosenMeta?.enabled) {
        return res.status(400).json({
          error: `Pagamento via ${chosenMeta?.label || normalizedPaymentMethod} está desativado nas configurações de faturamento da plataforma.`,
        });
      }

      const govTier = govData?.planPricing?.[normalizedPlan];
      const cycleMultiplier = normalizedCycle === 'ANNUAL' ? 12 : normalizedCycle === 'QUARTERLY' ? 3 : 1;
      const unitMonthlyPrice =
        govTier?.monthlyPrice !== undefined
          ? normalizedCycle === 'ANNUAL' && govTier.annualPrice !== undefined
            ? Number(govTier.annualPrice)
            : normalizedCycle === 'QUARTERLY' && govTier.quarterlyPrice !== undefined
            ? Number(govTier.quarterlyPrice)
            : Number(govTier.monthlyPrice)
          : SERVER_PLAN_PRICING[normalizedPlan][normalizedCycle as 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'];

      const baseAmount = Math.round(unitMonthlyPrice * cycleMultiplier * 100) / 100;
      const normalizedCouponCode = typeof couponCode === 'string' ? couponCode.trim().toUpperCase() : '';

      let candidateCouponId: string | null = null;
      if (normalizedCouponCode) {
        const couponsSnap = await db.collection('coupons').get();
        const candidateDoc = couponsSnap.docs.find((d) => {
          const c = d.data();
          return c && !c._deleted && (c.code?.toUpperCase() === normalizedCouponCode || d.id.toUpperCase() === normalizedCouponCode);
        });
        if (!candidateDoc) {
          return res.status(400).json({ error: `Cupom SaaS '${normalizedCouponCode}' não encontrado.` });
        }
        candidateCouponId = candidateDoc.id;
      }

      const {
        appliedCouponCode,
        couponDiscount,
        nowIso,
        pendingUpgradeRequest,
        requestRecord,
      } = await db.runTransaction(async (tx) => {
        const storeRef = db.collection('stores').doc(id);
        const txStoreSnap = await tx.get(storeRef);
        if (!txStoreSnap.exists || txStoreSnap.data()?._deleted) {
          const err: any = new Error('Loja não encontrada.');
          err.statusCode = 404;
          throw err;
        }
        const txStore = txStoreSnap.data() || {};

        let resolvedCouponCode: string | undefined;
        let resolvedDiscount = 0;

        if (candidateCouponId) {
          const couponRef = db.collection('coupons').doc(candidateCouponId);
          const txCouponSnap = await tx.get(couponRef);
          if (!txCouponSnap.exists) {
            const err: any = new Error('Cupom SaaS não encontrado.');
            err.statusCode = 400;
            throw err;
          }
          const cData = txCouponSnap.data() || {};
          if (cData.audience !== 'MERCHANT' || cData.storeId) {
            const err: any = new Error('Cupom inválido para assinaturas: este código é exclusivo para consumidores finais.');
            err.statusCode = 400;
            throw err;
          }
          if (cData.isActive === false || cData._deleted) {
            const err: any = new Error('Este cupom SaaS está pausado ou inativo.');
            err.statusCode = 400;
            throw err;
          }
          const valDate = cData.validUntil || cData.expiresAt;
          if (valDate) {
            const expTs = new Date(valDate).getTime();
            if (!Number.isFinite(expTs) || expTs < Date.now()) {
              const err: any = new Error('Este cupom SaaS está expirado.');
              err.statusCode = 400;
              throw err;
            }
          }
          const usageCount = Number(cData.usageCount) || 0;
          const usageLimit = Number(cData.usageLimit) || 999999;
          if (usageCount >= usageLimit) {
            const err: any = new Error('Limite de usos deste cupom SaaS foi atingido.');
            err.statusCode = 400;
            throw err;
          }
          if (
            Array.isArray(cData.applicablePlans) &&
            cData.applicablePlans.length > 0 &&
            !cData.applicablePlans.map((p: any) => String(p).toUpperCase()).includes(normalizedPlan)
          ) {
            const err: any = new Error(`Cupom '${normalizedCouponCode}' é válido apenas para os planos: ${cData.applicablePlans.join(', ')}.`);
            err.statusCode = 400;
            throw err;
          }
          if (baseAmount < (Number(cData.minOrderValue) || 0)) {
            const err: any = new Error(`Valor mínimo de assinatura para este cupom: R$ ${Number(cData.minOrderValue || 0).toFixed(2)}.`);
            err.statusCode = 400;
            throw err;
          }

          const rawDiscount =
            cData.discountType === 'PERCENT'
              ? (baseAmount * Number(cData.discountValue || 0)) / 100
              : Math.max(0, Number(cData.discountValue) || 0);
          const cappedDiscount =
            cData.maxDiscount && rawDiscount > Number(cData.maxDiscount)
              ? Number(cData.maxDiscount)
              : rawDiscount;
          resolvedDiscount = Math.round(Math.min(baseAmount, Math.max(0, cappedDiscount)) * 100) / 100;
          resolvedCouponCode = cData.code || normalizedCouponCode;

          tx.update(couponRef, {
            usageCount: usageCount + 1,
            updatedAt: new Date().toISOString(),
          });
        }

        const estimatedAmount = Math.round(Math.max(0, baseAmount - resolvedDiscount) * 100) / 100;
        const txNowIso = new Date().toISOString();
        const txPendingUpgradeRequest = {
          requestedPlan: normalizedPlan,
          billingCycle: normalizedCycle,
          paymentMethod: normalizedPaymentMethod,
          originalAmount: baseAmount,
          estimatedAmount,
          ...(resolvedCouponCode ? { couponCode: resolvedCouponCode, couponDiscount: resolvedDiscount } : {}),
          requestedAt: txNowIso,
          status: 'PENDING_PAYMENT_CONFIRMATION' as const,
        };

        const requestId = generateRequestId();
        const txRequestRecord = {
          id: requestId,
          storeId: id,
          tenantId: txStore.tenantId || authenticatedUser.tenantId || 'tenant-1',
          requestedBy: authenticatedUser.uid,
          requestedByEmail: authenticatedUser.email,
          currentPlan: txStore.subscriptionPlan || 'FREE',
          ...txPendingUpgradeRequest,
        };

        tx.set(db.collection('subscription_requests').doc(requestId), txRequestRecord);
        tx.update(storeRef, {
          pendingUpgradeRequest: txPendingUpgradeRequest,
          updatedAt: txNowIso,
        });

        return {
          appliedCouponCode: resolvedCouponCode,
          couponDiscount: resolvedDiscount,
          nowIso: txNowIso,
          pendingUpgradeRequest: txPendingUpgradeRequest,
          requestRecord: txRequestRecord,
        };
      });

      const auditLogId = generateAuditLogId();
      await db.collection('audit_logs').doc(auditLogId).set({
        id: auditLogId,
        timestamp: nowIso,
        user: authenticatedUser.email || authenticatedUser.uid,
        actorId: authenticatedUser.uid,
        tenantId: requestRecord.tenantId,
        storeId: id,
        action: 'STORE_SUBSCRIPTION_UPGRADE_REQUESTED',
        target: `${id} -> ${normalizedPlan} (${normalizedCycle})${appliedCouponCode ? ` [Cupom: ${appliedCouponCode}]` : ''}`,
        status: 'PENDING_PAYMENT_CONFIRMATION',
      });

      const evtId = generateEventId();
      await db.collection('events').doc(evtId).set({
        id: evtId,
        type: 'STORE_SUBSCRIPTION_UPGRADE_REQUESTED',
        payload: `Loja ${id} solicitou upgrade para ${normalizedPlan} (${normalizedCycle}) por ${authenticatedUser.email || authenticatedUser.uid}${appliedCouponCode ? ` com cupom B2B ${appliedCouponCode} (-R$ ${couponDiscount.toFixed(2)})` : ''}`,
        channel: 'hq/billing',
        tenantId: requestRecord.tenantId,
        timestamp: nowIso,
        timeStr: new Date(nowIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      broadcastSseEvent(
        'SUBSCRIPTION_UPGRADE_REQUESTED',
        { storeId: id, requestedPlan: normalizedPlan, billingCycle: normalizedCycle, couponCode: appliedCouponCode },
        requestRecord.tenantId,
        true,
        {
          storeId: id,
          allowedRoles: ['REGIONAL_MANAGER', 'STORE_OWNER', 'DEV_OWNER', 'SUPER_ADMIN'],
        }
      );

      res.json({
        success: true,
        pendingUpgradeRequest,
        requestRecord,
      });
    } catch (err: any) {
      if (err?.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      res.status(500).json({ error: 'Erro ao registrar solicitação de upgrade.' });
    }
  }
);

export default router;
