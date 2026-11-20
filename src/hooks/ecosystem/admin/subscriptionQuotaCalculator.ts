import {
  PlatformGovernance,
  SubscriptionPlanTier,
  BillingCycle,
} from '../../../types';
import {
  getDefaultBranchesForPlan,
  getDefaultDevicesForPlan,
} from '../../../utils/storeDomain';

export function computeBaseTierMonthlyFee(plan: SubscriptionPlanTier): number {
  if (plan === 'FREE') return 0;
  if (plan === 'PROMO') return 49.9;
  if (plan === 'BASIC') return 149;
  if (plan === 'PRO') return 299;
  return 499;
}

export function computePlanQuotasAndMonthlyFee(params: {
  plan: SubscriptionPlanTier;
  cycle: BillingCycle;
  governance: PlatformGovernance;
  maxBranchesOverride?: number;
  maxDevicesOverride?: number;
  monthlyFeeOverride?: number;
  applyCycleDiscountFallback?: boolean;
}): {
  branchesQuota: number;
  devicesQuota: number;
  monthlyFee: number;
} {
  const {
    plan,
    cycle,
    governance,
    maxBranchesOverride,
    maxDevicesOverride,
    monthlyFeeOverride,
    applyCycleDiscountFallback = true,
  } = params;

  const customTierData = governance.planPricing?.[plan];
  const defaultBranches = getDefaultBranchesForPlan(plan);
  const branchesQuota = maxBranchesOverride ?? (customTierData?.maxBranches ?? defaultBranches);
  const devicesQuota =
    maxDevicesOverride ?? (customTierData?.maxDevices ?? getDefaultDevicesForPlan(plan));

  let fee =
    monthlyFeeOverride !== undefined ? monthlyFeeOverride : computeBaseTierMonthlyFee(plan);

  if (monthlyFeeOverride === undefined) {
    if (customTierData?.monthlyPrice !== undefined && customTierData.monthlyPrice !== null) {
      if (cycle === 'ANNUAL' && customTierData.annualPrice !== undefined) {
        fee = customTierData.annualPrice;
      } else if (cycle === 'QUARTERLY' && customTierData.quarterlyPrice !== undefined) {
        fee = customTierData.quarterlyPrice;
      } else {
        fee = customTierData.monthlyPrice;
      }
    } else if (applyCycleDiscountFallback) {
      if (cycle === 'QUARTERLY') fee = fee * 0.9;
      if (cycle === 'ANNUAL') fee = fee * 0.75;
    }
  }

  return {
    branchesQuota,
    devicesQuota,
    monthlyFee: Number(fee.toFixed(2)),
  };
}
