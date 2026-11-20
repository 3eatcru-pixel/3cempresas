import {
  DEFAULT_PLATFORM_BILLING_CONFIG,
  DEFAULT_PLATFORM_GOVERNANCE,
  DEFAULT_PLATFORM_RUNTIME_POLICY,
  DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
} from '../../../constants/platformDefaults.ts';

const VALID_PIX_KEY_TYPES = ['CNPJ', 'CPF', 'EMAIL', 'PHONE', 'EVP'] as const;
const VALID_PSP_PROVIDERS = [
  'DIRECT_PIX',
  'ASAAS',
  'MERCADO_PAGO',
  'STRIPE',
  'PAGARME',
  'CUSTOM',
] as const;

export type SanitizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string };

export function sanitizeScalarGovernancePatch(
  cleanBody: Record<string, any>,
  current: Record<string, any>
): SanitizeResult<Record<string, any>> {
  const normalizedPatch: Record<string, any> = { ...cleanBody };
  delete normalizedPatch.pspWebhookConfigured;

  if (cleanBody.globalCommissionRate !== undefined) {
    const rate = Number(cleanBody.globalCommissionRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
      return {
        ok: false,
        status: 400,
        error: 'Taxa de comissão global inválida (permitido: 0% a 50%).',
      };
    }
    normalizedPatch.globalCommissionRate = Number(rate.toFixed(2));
  }
  if (cleanBody.defaultTrialDays !== undefined) {
    const days = Number(cleanBody.defaultTrialDays);
    if (!Number.isFinite(days) || days < 1 || days > 365) {
      return {
        ok: false,
        status: 400,
        error: 'Dias de degustação padrão inválidos (permitido: 1 a 365).',
      };
    }
    normalizedPatch.defaultTrialDays = Math.floor(days);
  }
  if (cleanBody.defaultPlatformDeliveryFee !== undefined) {
    const fee = Number(cleanBody.defaultPlatformDeliveryFee);
    if (!Number.isFinite(fee) || fee < 0 || fee > 500) {
      return {
        ok: false,
        status: 400,
        error: 'Taxa base de entrega inválida (permitido: R$ 0 a R$ 500).',
      };
    }
    normalizedPatch.defaultPlatformDeliveryFee = Number(fee.toFixed(2));
  }
  if (cleanBody.maxConcurrentOrdersPerStore !== undefined) {
    const maxOrders = Number(cleanBody.maxConcurrentOrdersPerStore);
    if (!Number.isFinite(maxOrders) || maxOrders < 1 || maxOrders > 5000) {
      return {
        ok: false,
        status: 400,
        error: 'Limite de pedidos simultâneos inválido (permitido: 1 a 5000).',
      };
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

  return { ok: true, value: normalizedPatch };
}

export function sanitizeBillingConfigPatch(
  incoming: Record<string, any>,
  currentBilling?: Record<string, any>
): SanitizeResult<Record<string, any>> {
  const existingBilling = {
    ...DEFAULT_PLATFORM_BILLING_CONFIG,
    ...(currentBilling || {}),
  };

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
    return {
      ok: false,
      status: 400,
      error: 'Ative pelo menos um meio de pagamento para cobrança dos lojistas.',
    };
  }

  const rawPixKeyType =
    incoming.pixKeyType !== undefined ? String(incoming.pixKeyType).toUpperCase() : existingBilling.pixKeyType;
  if (!VALID_PIX_KEY_TYPES.includes(rawPixKeyType as any)) {
    return { ok: false, status: 400, error: 'Tipo de chave PIX inválido.' };
  }

  const rawPspProvider =
    incoming.pspProvider !== undefined ? String(incoming.pspProvider).toUpperCase() : existingBilling.pspProvider;
  if (!VALID_PSP_PROVIDERS.includes(rawPspProvider as any)) {
    return { ok: false, status: 400, error: 'Provedor PSP de cobrança SaaS inválido.' };
  }

  const rawBankAccountType =
    incoming.bankAccountType !== undefined
      ? String(incoming.bankAccountType).toUpperCase()
      : existingBilling.bankAccountType || 'CORRENTE';
  if (!['CORRENTE', 'POUPANCA', 'PAGAMENTO'].includes(rawBankAccountType)) {
    return { ok: false, status: 400, error: 'Tipo de conta bancária inválido.' };
  }

  const maxCreditInstallments =
    incoming.maxCreditInstallments !== undefined
      ? Number(incoming.maxCreditInstallments)
      : Number(existingBilling.maxCreditInstallments ?? 12);
  if (!Number.isFinite(maxCreditInstallments) || maxCreditInstallments < 1 || maxCreditInstallments > 12) {
    return {
      ok: false,
      status: 400,
      error: 'Parcelamento máximo no cartão inválido (permitido: 1x a 12x).',
    };
  }

  const checkoutBaseUrl =
    incoming.checkoutBaseUrl !== undefined
      ? String(incoming.checkoutBaseUrl || '').trim().slice(0, 300)
      : existingBilling.checkoutBaseUrl || '';
  if (checkoutBaseUrl && !/^https:\/\/.+/i.test(checkoutBaseUrl)) {
    return {
      ok: false,
      status: 400,
      error: 'A URL base de checkout/fatura deve iniciar com https:// para segurança dos lojistas.',
    };
  }

  const gracePeriodDays =
    incoming.gracePeriodDays !== undefined ? Number(incoming.gracePeriodDays) : existingBilling.gracePeriodDays;
  if (!Number.isFinite(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 90) {
    return { ok: false, status: 400, error: 'Carência pós-vencimento inválida (permitido: 0 a 90 dias).' };
  }

  const sendDueReminderDaysBefore =
    incoming.sendDueReminderDaysBefore !== undefined
      ? Number(incoming.sendDueReminderDaysBefore)
      : existingBilling.sendDueReminderDaysBefore;
  if (
    !Number.isFinite(sendDueReminderDaysBefore) ||
    sendDueReminderDaysBefore < 0 ||
    sendDueReminderDaysBefore > 30
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Dias para lembrete de vencimento inválidos (permitido: 0 a 30 dias).',
    };
  }

  const lateFeePercent =
    incoming.lateFeePercent !== undefined ? Number(incoming.lateFeePercent) : existingBilling.lateFeePercent;
  if (!Number.isFinite(lateFeePercent) || lateFeePercent < 0 || lateFeePercent > 20) {
    return { ok: false, status: 400, error: 'Multa por atraso inválida (permitido: 0% a 20%).' };
  }

  const monthlyInterestPercent =
    incoming.monthlyInterestPercent !== undefined
      ? Number(incoming.monthlyInterestPercent)
      : existingBilling.monthlyInterestPercent;
  if (!Number.isFinite(monthlyInterestPercent) || monthlyInterestPercent < 0 || monthlyInterestPercent > 20) {
    return { ok: false, status: 400, error: 'Juros mensais inválidos (permitido: 0% a 20%).' };
  }

  return {
    ok: true,
    value: {
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
    },
  };
}

export function sanitizeReleaseConfigPatch(
  incoming: Record<string, any>,
  currentRelease?: Record<string, any>
): SanitizeResult<Record<string, any>> {
  const existingRelease = {
    ...DEFAULT_RELEASE_DISTRIBUTION_CONFIG,
    ...(currentRelease || {}),
  };
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
      return {
        ok: false,
        status: 400,
        error: 'A URL base de releases deve iniciar com https:// (ou http://localhost em desenvolvimento).',
      };
    }
  }

  const rawChannel =
    incoming.channel !== undefined ? String(incoming.channel).toLowerCase() : existingRelease.channel;
  if (!['stable', 'beta', 'canary'].includes(rawChannel)) {
    return {
      ok: false,
      status: 400,
      error: 'Canal de distribuição inválido (permitido: stable, beta ou canary).',
    };
  }

  const rawMinVer =
    incoming.minSupportedVersionOverride !== undefined
      ? String(incoming.minSupportedVersionOverride || '').trim().slice(0, 24)
      : existingRelease.minSupportedVersionOverride || '';
  if (rawMinVer && !/^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$/.test(rawMinVer)) {
    return {
      ok: false,
      status: 400,
      error: 'Versão mínima suportada deve seguir o formato SemVer (ex.: 5.0.0).',
    };
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

  return {
    ok: true,
    value: {
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
    },
  };
}

export function sanitizeRuntimePolicyPatch(
  incoming: Record<string, any>,
  currentPolicy?: Record<string, any>
): SanitizeResult<Record<string, any>> {
  const existingPolicy = {
    ...DEFAULT_PLATFORM_RUNTIME_POLICY,
    ...(currentPolicy || {}),
  };

  const clampInt = (val: unknown, fallback: number, min: number, max: number, label: string) => {
    if (val === undefined) return { ok: true as const, value: fallback };
    const n = Number(val);
    if (!Number.isFinite(n) || n < min || n > max) {
      return {
        ok: false as const,
        status: 400,
        error: `${label} inválido (permitido: ${min} a ${max}).`,
      };
    }
    return { ok: true as const, value: Math.floor(n) };
  };

  const storageMaxRes = clampInt(
    incoming.storageMaxObjectBytes,
    existingPolicy.storageMaxObjectBytes,
    65_536,
    52_428_800,
    'Limite de objeto Storage'
  );
  if (!storageMaxRes.ok) return storageMaxRes;

  const tenantQuotaRes = clampInt(
    incoming.storageTenantQuotaBytes,
    existingPolicy.storageTenantQuotaBytes,
    1_048_576,
    10_737_418_240,
    'Cota Storage por Tenant'
  );
  if (!tenantQuotaRes.ok) return tenantQuotaRes;

  const consumerQuotaRes = clampInt(
    incoming.storageConsumerQuotaBytes,
    existingPolicy.storageConsumerQuotaBytes,
    1_048_576,
    2_147_483_648,
    'Cota Storage por Consumidor'
  );
  if (!consumerQuotaRes.ok) return consumerQuotaRes;

  const edgeSyncRes = clampInt(
    incoming.edgeAutoSyncMs,
    existingPolicy.edgeAutoSyncMs,
    5_000,
    300_000,
    'Intervalo Edge Auto-Sync (ms)'
  );
  if (!edgeSyncRes.ok) return edgeSyncRes;

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
        return { ok: false, status: 400, error: `Origem CORS inválida: ${candidate}` };
      }
      const isLocalHttp =
        parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
      if (parsed.protocol !== 'https:' && !isLocalHttp) {
        return { ok: false, status: 400, error: `Origem CORS '${candidate}' deve usar https://.` };
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
    return { ok: false, status: 400, error: 'ID do projeto Firebase contém caracteres inválidos.' };
  }

  const emailWebhookUrl =
    incoming.emailWebhookUrl !== undefined
      ? String(incoming.emailWebhookUrl || '').trim().slice(0, 300)
      : existingPolicy.emailWebhookUrl || '';
  if (emailWebhookUrl && !/^https:\/\/.+/i.test(emailWebhookUrl)) {
    return { ok: false, status: 400, error: 'emailWebhookUrl deve iniciar com https://.' };
  }

  const supabaseUrl =
    incoming.supabaseUrl !== undefined
      ? String(incoming.supabaseUrl || '').trim().replace(/\/+$/, '').slice(0, 300)
      : existingPolicy.supabaseUrl || '';
  if (supabaseUrl) {
    let parsedSb: URL;
    try {
      parsedSb = new URL(supabaseUrl);
    } catch {
      return { ok: false, status: 400, error: 'supabaseUrl inválida.' };
    }
    const isLocalSb =
      parsedSb.protocol === 'http:' &&
      (parsedSb.hostname === 'localhost' || parsedSb.hostname === '127.0.0.1');
    if (parsedSb.protocol !== 'https:' && !isLocalSb) {
      return { ok: false, status: 400, error: 'supabaseUrl deve iniciar com https://.' };
    }
  }

  const supabaseJwksUrl =
    incoming.supabaseJwksUrl !== undefined
      ? String(incoming.supabaseJwksUrl || '').trim().slice(0, 320)
      : existingPolicy.supabaseJwksUrl || '';
  if (supabaseJwksUrl && !/^https?:\/\/.+/i.test(supabaseJwksUrl)) {
    return { ok: false, status: 400, error: 'supabaseJwksUrl inválida.' };
  }

  const supabasePublishableKey =
    incoming.supabasePublishableKey !== undefined
      ? String(incoming.supabasePublishableKey || '').trim().slice(0, 400)
      : existingPolicy.supabasePublishableKey || '';
  if (
    supabasePublishableKey &&
    (/^sb_secret_/i.test(supabasePublishableKey) || /service_role/i.test(supabasePublishableKey))
  ) {
    return {
      ok: false,
      status: 400,
      error:
        'Chaves secretas (SUPABASE_SECRET_KEY / service_role) nunca podem ser gravadas em runtimePolicy; mantenha-as apenas no Secret Manager do Server Core.',
    };
  }

  return {
    ok: true,
    value: {
      storageMaxObjectBytes: storageMaxRes.value,
      storageTenantQuotaBytes: tenantQuotaRes.value,
      storageConsumerQuotaBytes: consumerQuotaRes.value,
      edgeAutoSyncMs: edgeSyncRes.value,
      extraAllowedOrigins: nextOrigins,
      firebaseProjectIdOverride,
      emailWebhookUrl,
      supabaseUrl,
      supabasePublishableKey,
      supabaseJwksUrl,
      updatedAt: new Date().toISOString(),
    },
  };
}

export { sanitizeMarketplaceConfigPatch } from './marketplaceConfigValidator.ts';
