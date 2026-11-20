import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import {
  DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
  DEFAULT_PLATFORM_BILLING_CONFIG,
  DEFAULT_PLATFORM_GOVERNANCE,
  DEFAULT_PLATFORM_RUNTIME_POLICY,
  DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
} from '../../../constants/platformDefaults.ts';
import { recordAdminAuditEvent, stripPrototypePollution } from './adminHelpersCore.ts';
import { broadcastSseEvent } from '../../state.ts';

const router = express.Router();

const VALID_PIX_KEY_TYPES = ['CNPJ', 'CPF', 'EMAIL', 'PHONE', 'EVP'] as const;
const VALID_PSP_PROVIDERS = ['DIRECT_PIX', 'ASAAS', 'MERCADO_PAGO', 'STRIPE', 'PAGARME', 'CUSTOM'] as const;

const isEnvPspWebhookConfigured = () =>
  Boolean((process.env.SAAS_PSP_WEBHOOK_SECRET || process.env.PSP_WEBHOOK_SECRET || '').trim());

async function checkPspWebhookConfigured(): Promise<boolean> {
  if (isEnvPspWebhookConfigured()) return true;
  try {
    const snap = await runWithSystemDbContext('GOV_PSP_VAULT_CHECK', () =>
      db.collection('integrations').get()
    );
    return snap.docs.some((d) => {
      const integ = d.data();
      return (
        integ &&
        !integ._deleted &&
        integ.status !== 'SUSPENDED' &&
        integ.category === 'PAYMENT' &&
        Boolean(integ.encryptedSecret) &&
        (!integ.tenantId || integ.tenantId === 'tenant-1')
      );
    });
  } catch {
    return false;
  }
}

const buildHydratedGovernance = (raw: any, pspConfigured = isEnvPspWebhookConfigured()) => ({
  ...DEFAULT_PLATFORM_GOVERNANCE,
  ...(raw || {}),
  featureFlags: {
    ...DEFAULT_PLATFORM_GOVERNANCE.featureFlags,
    ...(raw?.featureFlags || {}),
  },
  planPricing: {
    ...DEFAULT_PLATFORM_GOVERNANCE.planPricing,
    ...(raw?.planPricing || {}),
  },
  billingConfig: {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(raw?.billingConfig || {}),
  },
  releaseConfig: {
    ...DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
    ...(raw?.releaseConfig || {}),
    artifactSignatures:
      raw?.releaseConfig?.artifactSignatures && typeof raw.releaseConfig.artifactSignatures === 'object'
        ? raw.releaseConfig.artifactSignatures
        : DEFAULT_RELEASE_DISTRIBUTION_CONFIG.artifactSignatures || {},
  },
  runtimePolicy: {
    ...DEFAULT_PLATFORM_RUNTIME_POLICY,
    ...(raw?.runtimePolicy || {}),
    extraAllowedOrigins: Array.isArray(raw?.runtimePolicy?.extraAllowedOrigins)
      ? raw.runtimePolicy.extraAllowedOrigins
      : DEFAULT_PLATFORM_RUNTIME_POLICY.extraAllowedOrigins,
  },
  marketplaceConfig: {
    ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
    ...(raw?.marketplaceConfig || {}),
    featuredStoreIds: Array.isArray(raw?.marketplaceConfig?.featuredStoreIds)
      ? raw?.marketplaceConfig?.featuredStoreIds
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.featuredStoreIds,
    hiddenStoreIds: Array.isArray(raw?.marketplaceConfig?.hiddenStoreIds)
      ? raw?.marketplaceConfig?.hiddenStoreIds
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.hiddenStoreIds,
    enabledVerticals: Array.isArray(raw?.marketplaceConfig?.enabledVerticals)
      ? raw?.marketplaceConfig?.enabledVerticals
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.enabledVerticals,
    spotlightPricing: {
      ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
      ...(raw?.marketplaceConfig?.spotlightPricing || {}),
    },
    sponsoredPlacements: Array.isArray(raw?.marketplaceConfig?.sponsoredPlacements)
      ? raw?.marketplaceConfig?.sponsoredPlacements
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.sponsoredPlacements,
    externalChannelConnectors: Array.isArray(raw?.marketplaceConfig?.externalChannelConnectors)
      ? raw?.marketplaceConfig?.externalChannelConnectors
      : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors,
  },
  pspWebhookConfigured: pspConfigured,
});

router.get('/governance', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  const pspConfigured = await checkPspWebhookConfigured();
  try {
    const doc = await db.collection('governance').doc('governance').get();
    if (doc.exists) {
      res.json(buildHydratedGovernance(doc.data(), pspConfigured));
    } else {
      res.json(buildHydratedGovernance(DEFAULT_PLATFORM_GOVERNANCE, pspConfigured));
    }
  } catch {
    res.json(buildHydratedGovernance(DEFAULT_PLATFORM_GOVERNANCE, pspConfigured));
  }
});

router.put('/governance', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const cleanBody = stripPrototypePollution(req.body || {});
    const currentSnap = await db.collection('governance').doc('governance').get();
    const current = currentSnap.exists ? currentSnap.data() : DEFAULT_PLATFORM_GOVERNANCE;

    const normalizedPatch: Record<string, any> = { ...cleanBody };
    delete normalizedPatch.pspWebhookConfigured;

    if (cleanBody.globalCommissionRate !== undefined) {
      const rate = Number(cleanBody.globalCommissionRate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
        return res.status(400).json({ error: 'Taxa de comissão global inválida (permitido: 0% a 50%).' });
      }
      normalizedPatch.globalCommissionRate = Number(rate.toFixed(2));
    }
    if (cleanBody.defaultTrialDays !== undefined) {
      const days = Number(cleanBody.defaultTrialDays);
      if (!Number.isFinite(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: 'Dias de degustação padrão inválidos (permitido: 1 a 365).' });
      }
      normalizedPatch.defaultTrialDays = Math.floor(days);
    }
    if (cleanBody.defaultPlatformDeliveryFee !== undefined) {
      const fee = Number(cleanBody.defaultPlatformDeliveryFee);
      if (!Number.isFinite(fee) || fee < 0 || fee > 500) {
        return res.status(400).json({ error: 'Taxa base de entrega inválida (permitido: R$ 0 a R$ 500).' });
      }
      normalizedPatch.defaultPlatformDeliveryFee = Number(fee.toFixed(2));
    }
    if (cleanBody.maxConcurrentOrdersPerStore !== undefined) {
      const maxOrders = Number(cleanBody.maxConcurrentOrdersPerStore);
      if (!Number.isFinite(maxOrders) || maxOrders < 1 || maxOrders > 5000) {
        return res.status(400).json({ error: 'Limite de pedidos simultâneos inválido (permitido: 1 a 5000).' });
      }
      normalizedPatch.maxConcurrentOrdersPerStore = Math.floor(maxOrders);
    }
    if (typeof cleanBody.globalAnnouncementBanner === 'string') {
      normalizedPatch.globalAnnouncementBanner = cleanBody.globalAnnouncementBanner.trim().slice(0, 300);
    }
    if (typeof cleanBody.supportWhatsapp === 'string') {
      normalizedPatch.supportWhatsapp = cleanBody.supportWhatsapp.trim().slice(0, 40);
    }
    if (typeof cleanBody.supportEmail === 'string') {
      normalizedPatch.supportEmail = cleanBody.supportEmail.trim().slice(0, 120);
    }
    if (typeof cleanBody.customPlatformName === 'string') {
      normalizedPatch.customPlatformName = cleanBody.customPlatformName.trim().slice(0, 80);
    }
    if (typeof cleanBody.maintenanceMessage === 'string') {
      normalizedPatch.maintenanceMessage = cleanBody.maintenanceMessage.trim().slice(0, 240);
    }
    if (cleanBody.featureFlags && typeof cleanBody.featureFlags === 'object') {
      const mergedFlags: Record<string, any> = {
        ...(current?.featureFlags || DEFAULT_PLATFORM_GOVERNANCE.featureFlags),
      };
      for (const [flagKey, flagVal] of Object.entries(cleanBody.featureFlags)) {
        if (typeof flagVal === 'boolean') {
          mergedFlags[flagKey] = flagVal;
        }
      }
      normalizedPatch.featureFlags = mergedFlags;
    }
    if (cleanBody.planPricing && typeof cleanBody.planPricing === 'object') {
      normalizedPatch.planPricing = {
        ...(current?.planPricing || {}),
        ...cleanBody.planPricing,
      };
    }

    if (cleanBody.billingConfig && typeof cleanBody.billingConfig === 'object') {
      const existingBilling = {
        ...DEFAULT_PLATFORM_BILLING_CONFIG,
        ...(current?.billingConfig || {}),
      };
      const incoming = cleanBody.billingConfig;

      const nextPixEnabled =
        incoming.pixEnabled !== undefined ? Boolean(incoming.pixEnabled) : existingBilling.pixEnabled;
      const nextCardEnabled =
        incoming.creditCardEnabled !== undefined
          ? Boolean(incoming.creditCardEnabled)
          : existingBilling.creditCardEnabled;
      const nextDebitEnabled =
        incoming.debitCardEnabled !== undefined
          ? Boolean(incoming.debitCardEnabled)
          : existingBilling.debitCardEnabled;
      const nextBoletoEnabled =
        incoming.boletoEnabled !== undefined ? Boolean(incoming.boletoEnabled) : existingBilling.boletoEnabled;
      const nextBankTransferEnabled =
        incoming.bankTransferEnabled !== undefined
          ? Boolean(incoming.bankTransferEnabled)
          : existingBilling.bankTransferEnabled;
      const nextPaymentLinkEnabled =
        incoming.paymentLinkEnabled !== undefined
          ? Boolean(incoming.paymentLinkEnabled)
          : existingBilling.paymentLinkEnabled;

      if (
        !nextPixEnabled &&
        !nextCardEnabled &&
        !nextDebitEnabled &&
        !nextBoletoEnabled &&
        !nextBankTransferEnabled &&
        !nextPaymentLinkEnabled
      ) {
        return res.status(400).json({
          error: 'Ative pelo menos um meio de pagamento para cobrança dos lojistas.',
        });
      }

      const rawPixKeyType =
        incoming.pixKeyType !== undefined ? String(incoming.pixKeyType).toUpperCase() : existingBilling.pixKeyType;
      if (!VALID_PIX_KEY_TYPES.includes(rawPixKeyType as any)) {
        return res.status(400).json({ error: 'Tipo de chave PIX inválido.' });
      }

      const rawPspProvider =
        incoming.pspProvider !== undefined ? String(incoming.pspProvider).toUpperCase() : existingBilling.pspProvider;
      if (!VALID_PSP_PROVIDERS.includes(rawPspProvider as any)) {
        return res.status(400).json({ error: 'Provedor PSP de cobrança SaaS inválido.' });
      }

      const rawBankAccountType =
        incoming.bankAccountType !== undefined
          ? String(incoming.bankAccountType).toUpperCase()
          : existingBilling.bankAccountType || 'CORRENTE';
      if (!['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(rawBankAccountType)) {
        return res.status(400).json({ error: 'Tipo de conta bancária inválido.' });
      }

      const maxCreditInstallments =
        incoming.maxCreditInstallments !== undefined
          ? Number(incoming.maxCreditInstallments)
          : Number(existingBilling.maxCreditInstallments ?? 12);
      if (!Number.isFinite(maxCreditInstallments) || maxCreditInstallments < 1 || maxCreditInstallments > 12) {
        return res.status(400).json({ error: 'Parcelamento máximo no cartão inválido (permitido: 1x a 12x).' });
      }

      const checkoutBaseUrl =
        incoming.checkoutBaseUrl !== undefined
          ? String(incoming.checkoutBaseUrl || '').trim().slice(0, 300)
          : existingBilling.checkoutBaseUrl || '';
      if (checkoutBaseUrl && !/^https:\/\/.+/i.test(checkoutBaseUrl)) {
        return res.status(400).json({
          error: 'A URL base de checkout/fatura deve iniciar com https:// para segurança dos lojistas.',
        });
      }

      const gracePeriodDays =
        incoming.gracePeriodDays !== undefined ? Number(incoming.gracePeriodDays) : existingBilling.gracePeriodDays;
      if (!Number.isFinite(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 90) {
        return res.status(400).json({ error: 'Carência pós-vencimento inválida (permitido: 0 a 90 dias).' });
      }

      const sendDueReminderDaysBefore =
        incoming.sendDueReminderDaysBefore !== undefined
          ? Number(incoming.sendDueReminderDaysBefore)
          : existingBilling.sendDueReminderDaysBefore;
      if (!Number.isFinite(sendDueReminderDaysBefore) || sendDueReminderDaysBefore < 0 || sendDueReminderDaysBefore > 30) {
        return res.status(400).json({ error: 'Dias para lembrete de vencimento inválidos (permitido: 0 a 30 dias).' });
      }

      const lateFeePercent =
        incoming.lateFeePercent !== undefined ? Number(incoming.lateFeePercent) : existingBilling.lateFeePercent;
      if (!Number.isFinite(lateFeePercent) || lateFeePercent < 0 || lateFeePercent > 20) {
        return res.status(400).json({ error: 'Multa por atraso inválida (permitido: 0% a 20%).' });
      }

      const monthlyInterestPercent =
        incoming.monthlyInterestPercent !== undefined
          ? Number(incoming.monthlyInterestPercent)
          : existingBilling.monthlyInterestPercent;
      if (!Number.isFinite(monthlyInterestPercent) || monthlyInterestPercent < 0 || monthlyInterestPercent > 20) {
        return res.status(400).json({ error: 'Juros mensais inválidos (permitido: 0% a 20%).' });
      }

      normalizedPatch.billingConfig = {
        ...existingBilling,
        pixEnabled: nextPixEnabled,
        pixKey:
          incoming.pixKey !== undefined
            ? String(incoming.pixKey || '').trim().slice(0, 120)
            : existingBilling.pixKey,
        pixKeyType: rawPixKeyType,
        beneficiaryName:
          incoming.beneficiaryName !== undefined
            ? String(incoming.beneficiaryName || '').trim().slice(0, 60) || '3C CORP SAAS'
            : existingBilling.beneficiaryName,
        beneficiaryCity:
          incoming.beneficiaryCity !== undefined
            ? String(incoming.beneficiaryCity || '').trim().slice(0, 40) || 'BRASIL'
            : existingBilling.beneficiaryCity,
        beneficiaryDocument:
          incoming.beneficiaryDocument !== undefined
            ? String(incoming.beneficiaryDocument || '').trim().slice(0, 30)
            : existingBilling.beneficiaryDocument || '',
        creditCardEnabled: nextCardEnabled,
        debitCardEnabled: nextDebitEnabled,
        boletoEnabled: nextBoletoEnabled,
        bankTransferEnabled: nextBankTransferEnabled,
        paymentLinkEnabled: nextPaymentLinkEnabled,
        maxCreditInstallments: Math.floor(maxCreditInstallments),
        bankName:
          incoming.bankName !== undefined
            ? String(incoming.bankName || '').trim().slice(0, 80)
            : existingBilling.bankName || '',
        bankAgency:
          incoming.bankAgency !== undefined
            ? String(incoming.bankAgency || '').trim().slice(0, 20)
            : existingBilling.bankAgency || '',
        bankAccount:
          incoming.bankAccount !== undefined
            ? String(incoming.bankAccount || '').trim().slice(0, 30)
            : existingBilling.bankAccount || '',
        bankAccountType: rawBankAccountType,
        pspProvider: rawPspProvider,
        checkoutBaseUrl,
        billingSupportWhatsapp:
          incoming.billingSupportWhatsapp !== undefined
            ? String(incoming.billingSupportWhatsapp || '').trim().slice(0, 40)
            : existingBilling.billingSupportWhatsapp || '',
        billingSupportEmail:
          incoming.billingSupportEmail !== undefined
            ? String(incoming.billingSupportEmail || '').trim().slice(0, 120)
            : existingBilling.billingSupportEmail || '',
        paymentInstructions:
          incoming.paymentInstructions !== undefined
            ? String(incoming.paymentInstructions || '').trim().slice(0, 500)
            : existingBilling.paymentInstructions || '',
        gracePeriodDays: Math.floor(gracePeriodDays),
        autoSuspendOverdue:
          incoming.autoSuspendOverdue !== undefined
            ? Boolean(incoming.autoSuspendOverdue)
            : existingBilling.autoSuspendOverdue,
        lateFeePercent: Number(lateFeePercent.toFixed(2)),
        monthlyInterestPercent: Number(monthlyInterestPercent.toFixed(2)),
        sendDueReminderDaysBefore: Math.floor(sendDueReminderDaysBefore),
      };
    }

    if (cleanBody.releaseConfig && typeof cleanBody.releaseConfig === 'object') {
      const existingRelease = {
        ...DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
        ...(current?.releaseConfig || {}),
      };
      const incoming = cleanBody.releaseConfig;
      const rawUrl =
        incoming.releaseBaseUrl !== undefined
          ? String(incoming.releaseBaseUrl || '').trim().slice(0, 400)
          : existingRelease.releaseBaseUrl || '';
      if (rawUrl) {
        let validUrl = false;
        try {
          const parsed = new URL(rawUrl);
          const isLocalHttp =
            parsed.protocol === 'http:' &&
            (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
          validUrl = parsed.protocol === 'https:' || isLocalHttp;
        } catch {
          validUrl = false;
        }
        if (!validUrl) {
          return res.status(400).json({
            error: 'A URL base de releases deve iniciar com https:// (ou http://localhost em desenvolvimento).',
          });
        }
      }

      const rawChannel =
        incoming.channel !== undefined ? String(incoming.channel).toLowerCase() : existingRelease.channel;
      if (!['stable', 'beta', 'canary'].includes(rawChannel)) {
        return res.status(400).json({ error: 'Canal de distribuição inválido (permitido: stable, beta ou canary).' });
      }

      const rawMinVer =
        incoming.minSupportedVersionOverride !== undefined
          ? String(incoming.minSupportedVersionOverride || '').trim().slice(0, 24)
          : existingRelease.minSupportedVersionOverride || '';
      if (rawMinVer && !/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/.test(rawMinVer)) {
        return res.status(400).json({ error: 'Versão mínima suportada deve seguir o formato SemVer (ex.: 5.0.0).' });
      }

      const validProductIds = new Set(['marketplace', 'store-os', 'driver', 'waiter', 'hq', 'server-core']);
      const rawDisabled = Array.isArray(incoming.disabledProducts)
        ? Array.from(
            new Set(
              incoming.disabledProducts
                .map((p: unknown) => String(p || '').trim().toLowerCase())
                .filter((p: string) => validProductIds.has(p))
            )
          )
        : existingRelease.disabledProducts || [];

      const nextArtifactSignatures: Record<string, string> = {};
      const sigSource =
        incoming.artifactSignatures && typeof incoming.artifactSignatures === 'object'
          ? incoming.artifactSignatures
          : existingRelease.artifactSignatures || {};
      for (const [k, v] of Object.entries(sigSource).slice(0, 20)) {
        const cleanKey = String(k || '').trim().slice(0, 48);
        const cleanVal = String(v || '').trim().slice(0, 2048);
        if (cleanKey && cleanVal) {
          nextArtifactSignatures[cleanKey] = cleanVal;
        }
      }

      normalizedPatch.releaseConfig = {
        releaseBaseUrl: rawUrl.replace(/\/+$/, ''),
        channel: rawChannel as 'stable' | 'beta' | 'canary',
        minSupportedVersionOverride: rawMinVer,
        releaseNotesOverride:
          incoming.releaseNotesOverride !== undefined
            ? String(incoming.releaseNotesOverride || '').trim().slice(0, 500)
            : existingRelease.releaseNotesOverride || '',
        disabledProducts: rawDisabled,
        artifactSignatures: nextArtifactSignatures,
        updatedAt: new Date().toISOString(),
      };
    }

    if (cleanBody.runtimePolicy && typeof cleanBody.runtimePolicy === 'object') {
      const existingPolicy = {
        ...DEFAULT_PLATFORM_RUNTIME_POLICY,
        ...(current?.runtimePolicy || {}),
      };
      const incoming = cleanBody.runtimePolicy;

      const clampInt = (val: unknown, fallback: number, min: number, max: number, label: string) => {
        if (val === undefined) return fallback;
        const n = Number(val);
        if (!Number.isFinite(n) || n < min || n > max) {
          throw Object.assign(new Error(`${label} inválido (permitido: ${min} a ${max}).`), { statusCode: 400 });
        }
        return Math.floor(n);
      };

      const storageMaxObjectBytes = clampInt(
        incoming.storageMaxObjectBytes,
        existingPolicy.storageMaxObjectBytes,
        65_536,
        52_428_800,
        'Limite de objeto Storage'
      );
      const storageTenantQuotaBytes = clampInt(
        incoming.storageTenantQuotaBytes,
        existingPolicy.storageTenantQuotaBytes,
        1_048_576,
        10_737_418_240,
        'Cota Storage por Tenant'
      );
      const storageConsumerQuotaBytes = clampInt(
        incoming.storageConsumerQuotaBytes,
        existingPolicy.storageConsumerQuotaBytes,
        1_048_576,
        2_147_483_648,
        'Cota Storage por Consumidor'
      );
      const edgeAutoSyncMs = clampInt(
        incoming.edgeAutoSyncMs,
        existingPolicy.edgeAutoSyncMs,
        5_000,
        300_000,
        'Intervalo Edge Auto-Sync (ms)'
      );

      let nextOrigins: string[] = Array.isArray(existingPolicy.extraAllowedOrigins)
        ? existingPolicy.extraAllowedOrigins
        : [];
      if (Array.isArray(incoming.extraAllowedOrigins)) {
        const sanitizedOrigins: string[] = [];
        for (const rawOrigin of incoming.extraAllowedOrigins.slice(0, 30)) {
          const candidate = String(rawOrigin || '').trim().replace(/\/+$/, '');
          if (!candidate) continue;
          let parsed: URL;
          try {
            parsed = new URL(candidate);
          } catch {
            return res.status(400).json({ error: `Origem CORS inválida: ${candidate}` });
          }
          const isLocalHttp =
            parsed.protocol === 'http:' &&
            (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
          if (parsed.protocol !== 'https:' && !isLocalHttp) {
            return res.status(400).json({ error: `Origem CORS '${candidate}' deve usar https://.` });
          }
          sanitizedOrigins.push(parsed.origin);
        }
        nextOrigins = Array.from(new Set(sanitizedOrigins));
      }

      const firebaseProjectIdOverride =
        incoming.firebaseProjectIdOverride !== undefined
          ? String(incoming.firebaseProjectIdOverride || '').trim().slice(0, 80)
          : existingPolicy.firebaseProjectIdOverride || '';
      if (firebaseProjectIdOverride && !/^[a-z0-9-]+$/i.test(firebaseProjectIdOverride)) {
        return res.status(400).json({ error: 'ID do projeto Firebase contém caracteres inválidos.' });
      }

      const emailWebhookUrl =
        incoming.emailWebhookUrl !== undefined
          ? String(incoming.emailWebhookUrl || '').trim().slice(0, 300)
          : existingPolicy.emailWebhookUrl || '';
      if (emailWebhookUrl && !/^https:\/\/.+/i.test(emailWebhookUrl)) {
        return res.status(400).json({ error: 'emailWebhookUrl deve iniciar com https://.' });
      }

      normalizedPatch.runtimePolicy = {
        storageMaxObjectBytes,
        storageTenantQuotaBytes,
        storageConsumerQuotaBytes,
        edgeAutoSyncMs,
        extraAllowedOrigins: nextOrigins,
        firebaseProjectIdOverride,
        emailWebhookUrl,
        updatedAt: new Date().toISOString(),
      };
    }

    if (cleanBody.marketplaceConfig && typeof cleanBody.marketplaceConfig === 'object') {
      const existingMkt = {
        ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG,
        ...(current?.marketplaceConfig || {}),
      };
      const incoming = cleanBody.marketplaceConfig;

      const rawRadius =
        incoming.defaultDiscoveryRadiusKm !== undefined
          ? Number(incoming.defaultDiscoveryRadiusKm)
          : existingMkt.defaultDiscoveryRadiusKm;
      if (!Number.isFinite(rawRadius) || rawRadius < 1 || rawRadius > 100) {
        return res.status(400).json({
          error: 'Raio padrão de descoberta do Marketplace inválido (permitido: 1 a 100 km).',
        });
      }

      const sanitizeIdArray = (val: unknown, fallback: string[]) =>
        Array.isArray(val)
          ? Array.from(
              new Set(
                val
                  .map((v) => String(v || '').trim().slice(0, 80))
                  .filter(Boolean)
              )
            ).slice(0, 200)
          : fallback;

      const validVerticals = new Set(['RESTAURANT', 'RETAIL', 'SERVICES', 'MULTI_COMMERCE']);
      const nextVerticals = Array.isArray(incoming.enabledVerticals)
        ? Array.from(
            new Set(
              incoming.enabledVerticals
                .map((v: unknown) => String(v || '').trim().toUpperCase())
                .filter((v: string) => validVerticals.has(v))
            )
          )
        : existingMkt.enabledVerticals;
      if (nextVerticals.length === 0) {
        return res.status(400).json({
          error: 'Mantenha pelo menos uma vertical ativa no Marketplace.',
        });
      }

      const featuredIds = sanitizeIdArray(incoming.featuredStoreIds, existingMkt.featuredStoreIds);
      const hiddenIds = sanitizeIdArray(incoming.hiddenStoreIds, existingMkt.hiddenStoreIds);
      const hiddenSet = new Set(hiddenIds);

      const clampMoney = (val: unknown, fallback: number, max = 100000) => {
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0 || n > max) return fallback;
        return Number(n.toFixed(2));
      };

      const incomingPricing =
        incoming.spotlightPricing && typeof incoming.spotlightPricing === 'object'
          ? incoming.spotlightPricing
          : {};
      const existingPricing = {
        ...DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.spotlightPricing,
        ...(existingMkt.spotlightPricing || {}),
      };
      const nextSpotlightPricing = {
        heroBannerMonthlyFee: clampMoney(
          incomingPricing.heroBannerMonthlyFee,
          existingPricing.heroBannerMonthlyFee
        ),
        recommendedSlotMonthlyFee: clampMoney(
          incomingPricing.recommendedSlotMonthlyFee,
          existingPricing.recommendedSlotMonthlyFee
        ),
        categoryTopMonthlyFee: clampMoney(
          incomingPricing.categoryTopMonthlyFee,
          existingPricing.categoryTopMonthlyFee
        ),
      };

      const validPlacementTypes = new Set(['HERO_BANNER', 'RECOMMENDED_CAROUSEL', 'CATEGORY_TOP']);
      const validStatuses = new Set(['PENDING_APPROVAL', 'ACTIVE', 'PAUSED', 'REJECTED']);
      const nextSponsoredPlacements = Array.isArray(incoming.sponsoredPlacements)
        ? incoming.sponsoredPlacements
            .slice(0, 100)
            .map((p: any, idx: number) => {
              const storeId = String(p?.storeId || '').trim().slice(0, 80);
              const placementType = String(p?.placementType || 'RECOMMENDED_CAROUSEL').toUpperCase();
              if (!storeId || !validPlacementTypes.has(placementType)) return null;
              const isActive = Boolean(p?.active) && !hiddenSet.has(storeId);
              const rawStatus = String(p?.status || '').toUpperCase();
              const resolvedStatus = validStatuses.has(rawStatus)
                ? (rawStatus as 'PENDING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'REJECTED')
                : isActive
                ? 'ACTIVE'
                : 'PAUSED';
              return {
                id: String(p?.id || `mkt-ad-${Date.now()}-${idx}`).trim().slice(0, 80),
                storeId,
                placementType: placementType as 'HERO_BANNER' | 'RECOMMENDED_CAROUSEL' | 'CATEGORY_TOP',
                badgeText: String(p?.badgeText || 'Patrocinado').trim().slice(0, 28) || 'Patrocinado',
                bannerTitle: String(p?.bannerTitle || '').trim().slice(0, 120),
                bannerSubtitle: String(p?.bannerSubtitle || '').trim().slice(0, 220),
                ctaLabel: String(p?.ctaLabel || 'Ver vitrine').trim().slice(0, 32) || 'Ver vitrine',
                monthlyFee: clampMoney(p?.monthlyFee, 0),
                active: isActive,
                status: resolvedStatus,
                requestedByUid: p?.requestedByUid ? String(p.requestedByUid).trim().slice(0, 80) : undefined,
                requestedAt: p?.requestedAt ? String(p.requestedAt).trim().slice(0, 40) : undefined,
                startsAt: p?.startsAt ? String(p.startsAt).trim().slice(0, 40) : undefined,
                endsAt: p?.endsAt ? String(p.endsAt).trim().slice(0, 40) : undefined,
              };
            })
            .filter(Boolean)
        : Array.isArray(existingMkt.sponsoredPlacements)
        ? existingMkt.sponsoredPlacements
        : [];

      const validProviders = new Set(['IFOOD', 'UBER_EATS', 'DELIVEROO', 'RAPPI', 'NINETY_NINE_FOOD']);
      const defaultConnectorsByProvider = new Map(
        DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors.map((c) => [c.provider, c])
      );
      const nextConnectors = Array.isArray(incoming.externalChannelConnectors)
        ? incoming.externalChannelConnectors
            .slice(0, 20)
            .map((c: any) => {
              const provider = String(c?.provider || '').toUpperCase();
              if (!validProviders.has(provider)) return null;
              const fallback = defaultConnectorsByProvider.get(provider as any);
              const share = Number(c?.revenueSharePercent);
              return {
                provider: provider as any,
                label:
                  String(c?.label || fallback?.label || provider).trim().slice(0, 60) ||
                  fallback?.label ||
                  provider,
                enabled: Boolean(c?.enabled),
                monthlyAddonFee: clampMoney(c?.monthlyAddonFee, fallback?.monthlyAddonFee ?? 79),
                revenueSharePercent:
                  Number.isFinite(share) && share >= 0 && share <= 50 ? Number(share.toFixed(2)) : 0,
                syncCatalog: c?.syncCatalog !== false,
                syncOrders: c?.syncOrders !== false,
              };
            })
            .filter(Boolean)
        : Array.isArray(existingMkt.externalChannelConnectors)
        ? existingMkt.externalChannelConnectors
        : DEFAULT_MARKETPLACE_GOVERNANCE_CONFIG.externalChannelConnectors;

      normalizedPatch.marketplaceConfig = {
        marketplaceName:
          incoming.marketplaceName !== undefined
            ? String(incoming.marketplaceName || '').trim().slice(0, 60) || '3C Marketplace'
            : existingMkt.marketplaceName,
        heroHeadline:
          incoming.heroHeadline !== undefined
            ? String(incoming.heroHeadline || '').trim().slice(0, 140)
            : existingMkt.heroHeadline,
        heroSubtitle:
          incoming.heroSubtitle !== undefined
            ? String(incoming.heroSubtitle || '').trim().slice(0, 260)
            : existingMkt.heroSubtitle,
        recommendationsTitle:
          incoming.recommendationsTitle !== undefined
            ? String(incoming.recommendationsTitle || '').trim().slice(0, 80) ||
              'Recomendados para você'
            : existingMkt.recommendationsTitle || 'Recomendados para você',
        featuredStoreIds: featuredIds.filter((id) => !hiddenSet.has(id)),
        hiddenStoreIds: hiddenIds,
        defaultDiscoveryRadiusKm: Math.round(rawRadius),
        allowGuestBrowsing:
          incoming.allowGuestBrowsing !== undefined
            ? Boolean(incoming.allowGuestBrowsing)
            : existingMkt.allowGuestBrowsing,
        enabledVerticals: nextVerticals,
        spotlightPricing: nextSpotlightPricing,
        sponsoredPlacements: nextSponsoredPlacements,
        externalChannelConnectors: nextConnectors,
        updatedAt: new Date().toISOString(),
      };
    }

    const merged = { ...current, ...normalizedPatch, updatedAt: new Date().toISOString() };
    await db.collection('governance').doc('governance').set(merged, { merge: true });
    broadcastSseEvent('GOVERNANCE_UPDATED', { featureFlags: merged.featureFlags }, 'ALL', true);
    await recordAdminAuditEvent(
      'HQ_GOVERNANCE_UPDATE',
      `Governança global atualizada por ${authenticatedUser.email || authenticatedUser.uid}`,
      'hq/governance',
      authenticatedUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'governance',
        resourceId: 'governance',
        before: current,
        after: merged,
      }
    );
    const pspConfigured = await checkPspWebhookConfigured();
    res.json({ success: true, governance: buildHydratedGovernance(merged, pspConfigured) });
  } catch (err: any) {
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao salvar governança.' });
  }
});

router.get('/audit-logs', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const [eventsSnap, auditSnap] = await Promise.all([
      db.collection('events').get(),
      db.collection('audit_logs').get(),
    ]);

    const normalized: any[] = [];
    for (const d of eventsSnap.docs) {
      const ev = d.data() || {};
      normalized.push({
        id: ev.id || d.id,
        source: 'events',
        type: ev.type || 'SYSTEM_EVENT',
        action: ev.action || ev.type || 'SYSTEM_EVENT',
        payload: ev.payload || ev.message || '',
        channel: ev.channel || 'system',
        tenantId: ev.tenantId || 'tenant-1',
        storeId: ev.storeId || null,
        actorUid: ev.actorUid || null,
        actorEmail: ev.actorEmail || null,
        actorRole: ev.actorRole || null,
        sourceIp: ev.sourceIp || null,
        requestId: ev.requestId || null,
        resourceType: ev.resourceType || null,
        resourceId: ev.resourceId || null,
        beforeState: ev.beforeState ?? null,
        afterState: ev.afterState ?? null,
        result: ev.result || 'SUCCESS',
        immutable: ev.immutable !== false,
        timestamp: ev.timestamp || ev.createdAt || new Date(0).toISOString(),
        timeStr: ev.timeStr || '',
      });
    }

    for (const d of auditSnap.docs) {
      const al = d.data() || {};
      normalized.push({
        id: al.id || d.id,
        source: 'audit_logs',
        type: al.action || al.type || 'STORE_AUDIT',
        action: al.action || al.type || 'STORE_AUDIT',
        payload: al.details || al.payload || al.message || JSON.stringify(al.metadata || {}),
        channel: al.channel || 'store/audit',
        tenantId: al.tenantId || 'tenant-1',
        storeId: al.storeId || null,
        actorUid: al.actorUid || al.userId || null,
        actorEmail: al.actorEmail || al.userEmail || null,
        actorRole: al.actorRole || al.role || null,
        sourceIp: al.sourceIp || al.ip || null,
        requestId: al.requestId || null,
        resourceType: al.resourceType || al.entityType || null,
        resourceId: al.resourceId || al.entityId || null,
        beforeState: al.beforeState ?? null,
        afterState: al.afterState ?? null,
        result: al.result || 'SUCCESS',
        immutable: true,
        timestamp: al.timestamp || al.createdAt || new Date(0).toISOString(),
        timeStr: al.timeStr || '',
      });
    }

    const filterType = req.query.type ? String(req.query.type).toUpperCase() : '';
    const filterTenant = req.query.tenantId ? String(req.query.tenantId) : '';
    const filterActor = req.query.actorUid ? String(req.query.actorUid) : '';
    const filterChannel = req.query.channel ? String(req.query.channel).toLowerCase() : '';
    const filterQuery = req.query.q ? String(req.query.q).toLowerCase() : '';
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));

    let filtered = normalized;
    if (filterType && filterType !== 'ALL') {
      filtered = filtered.filter((item) => String(item.type).toUpperCase().includes(filterType));
    }
    if (filterTenant) {
      filtered = filtered.filter((item) => item.tenantId === filterTenant);
    }
    if (filterActor) {
      filtered = filtered.filter((item) => item.actorUid === filterActor);
    }
    if (filterChannel) {
      filtered = filtered.filter((item) => String(item.channel).toLowerCase().includes(filterChannel));
    }
    if (filterQuery) {
      filtered = filtered.filter((item) => {
        const blob = `${item.type} ${item.payload} ${item.channel} ${item.actorEmail || ''} ${item.tenantId || ''} ${item.resourceId || ''}`.toLowerCase();
        return blob.includes(filterQuery);
      });
    }

    filtered.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const logs = filtered.slice(0, limit);
    res.json({ logs, total: filtered.length });
  } catch {
    res.status(500).json({ error: 'Falha ao consultar trilha unificada de auditoria.' });
  }
});

router.post('/reset-sandbox', verifyAutonomousToken, requireRoles(['DEV_OWNER']), async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Operação proibida em ambiente de produção (NODE_ENV=production).' });
    }
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    await db.resetToSeeds();
    await recordAdminAuditEvent(
      'PLATFORM_SANDBOX_RESET',
      `Plataforma restaurada para o estado inicial por ${authenticatedUser.email || authenticatedUser.uid}`,
      'hq/governance',
      authenticatedUser.tenantId || 'tenant-1',
      { req, actor: authenticatedUser, resourceType: 'platform', resourceId: 'sandbox' }
    );
    res.json({ success: true, resetAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Falha ao resetar sandbox da plataforma.' });
  }
});

router.get('/baseline', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN']), async (_req, res) => {
  try {
    const baselinePath = path.join(process.cwd(), 'docs', 'architecture', 'README.md');
    if (!fs.existsSync(baselinePath)) {
      return res.status(404).json({ error: 'Documento docs/architecture/README.md não encontrado.' });
    }
    const content = fs.readFileSync(baselinePath, 'utf-8');
    res.json({ filename: 'docs/architecture/README.md', content });
  } catch {
    res.status(500).json({ error: 'Erro ao carregar baseline técnica.' });
  }
});

export default router;
