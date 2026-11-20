import { CouponCampaign, SubscriptionPlanTier } from '../../../types';

export interface CouponEvaluationResult {
  matchedCoupon: CouponCampaign | undefined;
  discount: number;
  isInvalid: boolean;
  errorReason?: string;
}

function isCouponExpired(cp: CouponCampaign, nowMs: number): boolean {
  const rawExpiry = cp.validUntil || (cp as any).expiresAt;
  if (!rawExpiry) return false;
  const expTs = new Date(rawExpiry).getTime();
  return !Number.isFinite(expTs) || expTs < nowMs;
}

function computeCouponDiscount(cp: CouponCampaign, baseAmount: number): number {
  const rawDiscount =
    cp.discountType === 'PERCENT'
      ? (baseAmount * cp.discountValue) / 100
      : cp.discountValue;
  const cappedDiscount =
    cp.maxDiscount && rawDiscount > cp.maxDiscount
      ? cp.maxDiscount
      : rawDiscount;
  return Math.round(Math.min(baseAmount, Math.max(0, cappedDiscount)) * 100) / 100;
}

export function evaluateCheckoutCoupon(params: {
  coupons: CouponCampaign[];
  couponCode: string;
  storeId?: string;
  cartTotal: number;
  nowMs?: number;
}): CouponEvaluationResult {
  const { coupons, couponCode, storeId, cartTotal, nowMs = Date.now() } = params;
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: false };
  }

  const matchedCoupon = coupons.find((cp) => {
    if (cp.code?.toUpperCase() !== normalizedCode) return false;
    if (cp.audience === 'MERCHANT') return false;
    if (cp.isActive === false || (cp as any)._deleted) return false;
    if (cp.storeId && storeId && cp.storeId !== storeId) return false;
    if (cartTotal < (cp.minOrderValue || 0)) return false;
    if (cp.usageLimit && (cp.usageCount || 0) >= cp.usageLimit) return false;
    if (isCouponExpired(cp, nowMs)) return false;
    return true;
  });

  if (!matchedCoupon) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: true };
  }

  return {
    matchedCoupon,
    discount: computeCouponDiscount(matchedCoupon, cartTotal),
    isInvalid: false,
  };
}

export function evaluateMerchantCoupon(params: {
  coupons: CouponCampaign[];
  couponCode: string;
  selectedPlan: SubscriptionPlanTier;
  subscriptionAmount: number;
  nowMs?: number;
}): CouponEvaluationResult {
  const { coupons, couponCode, selectedPlan, subscriptionAmount, nowMs = Date.now() } = params;
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!normalizedCode) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: false };
  }

  const byCode = coupons.find(
    (cp) => cp.code?.toUpperCase() === normalizedCode && !(cp as any)._deleted
  );
  if (!byCode) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: true, errorReason: 'Cupom não encontrado.' };
  }
  if (byCode.audience !== 'MERCHANT' || byCode.storeId) {
    return {
      matchedCoupon: undefined,
      discount: 0,
      isInvalid: true,
      errorReason: 'Cupom exclusivo para consumidores (não válido para assinaturas de lojista).',
    };
  }
  if (byCode.isActive === false) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: true, errorReason: 'Cupom temporariamente indisponível.' };
  }
  if (isCouponExpired(byCode, nowMs)) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: true, errorReason: 'Cupom expirado.' };
  }
  if (byCode.usageLimit && (byCode.usageCount || 0) >= byCode.usageLimit) {
    return { matchedCoupon: undefined, discount: 0, isInvalid: true, errorReason: 'Limite de usos atingido.' };
  }
  if (
    Array.isArray(byCode.applicablePlans) &&
    byCode.applicablePlans.length > 0 &&
    !byCode.applicablePlans.includes(selectedPlan)
  ) {
    return {
      matchedCoupon: undefined,
      discount: 0,
      isInvalid: true,
      errorReason: `Cupom válido apenas para: ${byCode.applicablePlans.join(', ')}.`,
    };
  }
  if (subscriptionAmount < (byCode.minOrderValue || 0)) {
    return {
      matchedCoupon: undefined,
      discount: 0,
      isInvalid: true,
      errorReason: `Fatura mínima de R$ ${Number(byCode.minOrderValue || 0).toFixed(2)}.`,
    };
  }

  return {
    matchedCoupon: byCode,
    discount: computeCouponDiscount(byCode, subscriptionAmount),
    isInvalid: false,
  };
}
