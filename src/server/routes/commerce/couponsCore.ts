import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, requireRoles, hasUserStoreAccess, resolveOptionalUser } from '../../middleware/auth.ts';
import { generateHlcTimestamp } from '../../../utils/idGenerator.ts';
import { recordSyncOutbox } from '../../persistence/PersistenceDriver.ts';
import { stripPrototypePollution } from '../../utils/requestSanitizer.ts';

const router = express.Router();
const VALID_COUPON_AUDIENCES = ['CONSUMER', 'MERCHANT'] as const;
const VALID_SAAS_PLANS = ['FREE', 'PROMO', 'BASIC', 'PRO', 'ENTERPRISE'];

export function validateCouponPayload(payload: Record<string, any>, isPartialUpdate = false): string | null {
  if (!isPartialUpdate || payload.code !== undefined) {
    if (typeof payload.code !== 'string' || payload.code.trim().length < 2) {
      return 'Código de cupom inválido: informe ao menos 2 caracteres.';
    }
  }
  if (payload.audience !== undefined && payload.audience !== null) {
    const normalizedAudience = String(payload.audience).toUpperCase();
    if (!VALID_COUPON_AUDIENCES.includes(normalizedAudience as any)) {
      return 'Público-alvo (audience) inválido: utilize CONSUMER ou MERCHANT.';
    }
  }
  if (payload.applicablePlans !== undefined && payload.applicablePlans !== null) {
    if (
      !Array.isArray(payload.applicablePlans) ||
      !payload.applicablePlans.every((p: any) => VALID_SAAS_PLANS.includes(String(p).toUpperCase()))
    ) {
      return 'Lista de planos elegíveis (applicablePlans) inválida.';
    }
  }
  if (!isPartialUpdate || payload.discountType !== undefined) {
    if (!['PERCENT', 'FIXED'].includes(String(payload.discountType || ''))) {
      return 'Tipo de desconto inválido: utilize PERCENT ou FIXED.';
    }
  }
  const effectiveType = payload.discountType;
  if (!isPartialUpdate || payload.discountValue !== undefined) {
    const val = Number(payload.discountValue);
    if (!Number.isFinite(val) || val < 0) {
      return 'Valor de desconto (discountValue) inválido: deve ser >= 0.';
    }
    if (effectiveType === 'PERCENT' && val > 100) {
      return 'Desconto percentual não pode exceder 100%.';
    }
  }
  if (payload.maxDiscount !== undefined && payload.maxDiscount !== null && payload.maxDiscount !== '') {
    const maxD = Number(payload.maxDiscount);
    if (!Number.isFinite(maxD) || maxD < 0) {
      return 'Teto máximo de desconto (maxDiscount) inválido: deve ser >= 0.';
    }
  }
  if (payload.minOrderValue !== undefined && payload.minOrderValue !== null) {
    const minVal = Number(payload.minOrderValue);
    if (!Number.isFinite(minVal) || minVal < 0) {
      return 'Valor mínimo (minOrderValue) inválido: deve ser >= 0.';
    }
  }
  if (payload.usageLimit !== undefined && payload.usageLimit !== null) {
    const lim = Number(payload.usageLimit);
    if (!Number.isInteger(lim) || lim < 1) {
      return 'Limite de uso (usageLimit) inválido: deve ser inteiro >= 1.';
    }
  }
  return null;
}

router.get('/coupons', async (req, res) => {
  try {
    const { storeId, audience, includeInactive } = req.query;
    const { user: callerUser } = await resolveOptionalUser(req);
    const isHqAdmin = Boolean(callerUser && ['DEV_OWNER', 'SUPER_ADMIN'].includes(callerUser.role));
    const isMerchantAdmin = Boolean(
      callerUser && ['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER'].includes(callerUser.role)
    );

    const requestedAudience = audience ? String(audience).toUpperCase() : null;
    if (requestedAudience === 'MERCHANT' && !isMerchantAdmin) {
      return res.status(403).json({
        error: 'Acesso negado: Cupons SaaS exclusivos de lojistas exigem autenticação comercial ou HQ.',
      });
    }

    const allowInactive = includeInactive === 'true' && isMerchantAdmin;
    const snap = await runWithSystemDbContext('PUBLIC_COUPONS_LIST', () => db.collection('coupons').get());
    const nowMs = Date.now();

    let coupons = snap.docs
      .map(d => d.data())
      .filter(c => {
        if (!c || c._deleted) return false;
        if (!allowInactive) {
          if (c.isActive === false) return false;
          const valDate = c.validUntil || c.expiresAt;
          if (valDate && new Date(valDate).getTime() < nowMs) return false;
        }
        return true;
      });

    if (requestedAudience === 'MERCHANT') {
      coupons = coupons.filter(c => c.audience === 'MERCHANT' && !c.storeId);
    } else if (requestedAudience === 'CONSUMER') {
      coupons = coupons.filter(c => c.audience !== 'MERCHANT');
    } else if (!isMerchantAdmin) {
      // Public / Consumer callers NEVER receive B2B Merchant SaaS coupons
      coupons = coupons.filter(c => c.audience !== 'MERCHANT');
    } else if (!isHqAdmin && callerUser) {
      // Store/Regional managers: see their tenant/store consumer coupons + active HQ global consumer/merchant coupons
      coupons = coupons.filter(c => {
        if (c.audience === 'MERCHANT') {
          return !c.storeId && c.isActive !== false;
        }
        if (c.storeId) {
          return c.tenantId === callerUser.tenantId && hasUserStoreAccess(callerUser, c.storeId);
        }
        return !c.tenantId || c.tenantId === 'tenant-1' || c.tenantId === callerUser.tenantId;
      });
    }

    if (storeId) {
      const storeSnap = await runWithSystemDbContext('PUBLIC_COUPONS_STORE_LOOKUP', () =>
        db.collection('stores').doc(String(storeId)).get()
      );
      const storeTenantId = storeSnap.exists ? storeSnap.data()?.tenantId : null;
      coupons = coupons.filter(c => {
        if (c.audience === 'MERCHANT') return false;
        if (c.storeId) return c.storeId === storeId;
        return storeTenantId ? c.tenantId === storeTenantId : false;
      });
    }
    res.json(coupons);
  } catch {
    res.status(500).json({ error: 'Erro ao listar cupons.' });
  }
});

router.post('/coupons', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']), async (req, res) => {
  try {
    const rawCoupon = stripPrototypePollution(req.body || {});
    const authenticatedUser = (req as any).user;
    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const id = rawCoupon.id || `cup-${Date.now()}`;

    const existingSnap = await db.collection('coupons').doc(id).get();
    const existingData = existingSnap.exists ? existingSnap.data() : null;
    if (existingData && authenticatedUser.role !== 'DEV_OWNER') {
      if (!isHqAdmin && (!existingData.storeId || existingData.audience === 'MERCHANT')) {
        return res.status(403).json({ error: 'Acesso negado: Apenas o HQ Central pode alterar cupons globais ou de lojistas.' });
      }
      if (existingData.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Cupom pertence a outra empresa/tenant.' });
      }
      if (existingData.storeId && !hasUserStoreAccess(authenticatedUser, existingData.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Cupom pertence a outra filial.' });
      }
    }

    if (
      !isHqAdmin &&
      rawCoupon.storeId &&
      !hasUserStoreAccess(authenticatedUser, String(rawCoupon.storeId))
    ) {
      return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
    }

    const candidateForValidation = {
      ...(existingData || {}),
      ...rawCoupon,
    };
    const couponErr = validateCouponPayload(candidateForValidation, Boolean(existingData));
    if (couponErr) {
      return res.status(400).json({ error: couponErr });
    }

    const resolvedAudience = String(
      rawCoupon.audience || existingData?.audience || 'CONSUMER'
    ).toUpperCase() as 'CONSUMER' | 'MERCHANT';

    if (resolvedAudience === 'MERCHANT' && !isHqAdmin) {
      return res.status(403).json({
        error: 'Acesso negado: Apenas o HQ Central pode criar ou gerenciar cupons SaaS para lojistas.',
      });
    }

    const isCouponSingleLocked = Boolean(
      authenticatedUser.role !== 'DEV_OWNER' &&
      authenticatedUser.storeId &&
      !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
    );
    const targetStoreId = resolvedAudience === 'MERCHANT'
      ? null
      : (isCouponSingleLocked
          ? authenticatedUser.storeId
          : (rawCoupon.storeId ?? existingData?.storeId ?? null));

    if (resolvedAudience === 'MERCHANT' && rawCoupon.storeId) {
      return res.status(400).json({
        error: 'Cupons para lojistas (MERCHANT) são globais de assinatura SaaS e não podem ser vinculados a storeId.',
      });
    }
    if (!isHqAdmin && !targetStoreId) {
      return res.status(403).json({
        error: 'Acesso negado: Lojistas só podem criar cupons vinculados a uma filial (storeId).',
      });
    }

    const tenantId = resolvedAudience === 'MERCHANT'
      ? (rawCoupon.tenantId || existingData?.tenantId || 'PLATFORM_HQ')
      : (authenticatedUser.role === 'DEV_OWNER'
          ? (rawCoupon.tenantId || existingData?.tenantId || authenticatedUser.tenantId)
          : authenticatedUser.tenantId);

    const { id: _ignoredId, tenantId: _ignoredTenant, ...cleanCoupon } = rawCoupon;
    const normalizedApplicablePlans =
      resolvedAudience === 'MERCHANT' && Array.isArray(cleanCoupon.applicablePlans)
        ? cleanCoupon.applicablePlans.map((p: any) => String(p).toUpperCase())
        : undefined;

    const couponHlc = generateHlcTimestamp('cloud_core');
    const savedCoupon: Record<string, any> = {
      ...(existingData || {}),
      ...cleanCoupon,
      ...(cleanCoupon.code ? { code: String(cleanCoupon.code).trim().toUpperCase() } : {}),
      audience: resolvedAudience,
      id,
      tenantId,
      ...(targetStoreId ? { storeId: targetStoreId } : {}),
      ...(normalizedApplicablePlans ? { applicablePlans: normalizedApplicablePlans } : {}),
      hlc: couponHlc,
      updatedAt: new Date().toISOString(),
    };
    if (resolvedAudience === 'MERCHANT') {
      delete savedCoupon.storeId;
    }

    await db.collection('coupons').doc(id).set(savedCoupon, { merge: true });
    await recordSyncOutbox({
      entity: 'coupons',
      entityId: id,
      operation: 'UPSERT',
      tenantId: tenantId || 'tenant-1',
      storeId: targetStoreId || null,
      hlc: couponHlc,
      payload: savedCoupon,
    });
    res.json({ success: true, coupon: savedCoupon });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar cupom.' });
  }
});

router.put('/coupons/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'REGIONAL_MANAGER', 'STORE_OWNER']), async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as any).user;
    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const docRef = db.collection('coupons').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Cupom não encontrado.' });
    }
    const existing = snap.data() || {};
    if (!isHqAdmin) {
      if (!existing.storeId || existing.audience === 'MERCHANT' || existing.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Cupom pertence ao HQ Global ou a outro tenant.' });
      }
      if (!hasUserStoreAccess(authenticatedUser, existing.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Cupom pertence a outra filial.' });
      }
    }

    const { id: _ignoredId, tenantId: _ignoredTenant, ...updates } = stripPrototypePollution(req.body || {});
    if (!isHqAdmin && updates.audience && String(updates.audience).toUpperCase() === 'MERCHANT') {
      return res.status(403).json({ error: 'Acesso negado: Apenas o HQ Central pode definir cupons de lojista (MERCHANT).' });
    }
    const mergedCandidate = { ...existing, ...updates };
    const couponErr = validateCouponPayload(mergedCandidate, true);
    if (couponErr) {
      return res.status(400).json({ error: couponErr });
    }

    const nextAudience = String(mergedCandidate.audience || 'CONSUMER').toUpperCase();
    if (nextAudience === 'MERCHANT' && mergedCandidate.storeId) {
      return res.status(400).json({
        error: 'Cupons para lojistas (MERCHANT) não podem possuir storeId.',
      });
    }

    const couponHlc = generateHlcTimestamp('cloud_core');
    const nextCoupon = {
      ...mergedCandidate,
      ...(mergedCandidate.code ? { code: String(mergedCandidate.code).trim().toUpperCase() } : {}),
      audience: nextAudience,
      id,
      hlc: couponHlc,
      updatedAt: new Date().toISOString(),
    };
    await docRef.set(nextCoupon, { merge: true });
    await recordSyncOutbox({
      entity: 'coupons',
      entityId: id,
      operation: 'UPSERT',
      tenantId: existing.tenantId || authenticatedUser.tenantId || 'tenant-1',
      storeId: nextCoupon.storeId || null,
      hlc: couponHlc,
      payload: nextCoupon,
    });
    res.json({ success: true, coupon: nextCoupon });
  } catch {
    res.status(500).json({ error: 'Erro ao atualizar cupom.' });
  }
});

router.delete('/coupons/:id', verifyAutonomousToken, requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER']), async (req, res) => {
  try {
    const { id } = req.params;
    const authenticatedUser = (req as any).user;
    const docRef = db.collection('coupons').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Cupom não encontrado.' });
    }
    const existing = snap.data() || {};
    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    if (!isHqAdmin) {
      if (!existing.storeId || existing.audience === 'MERCHANT' || existing.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Apenas HQ pode remover cupons globais, SaaS ou de outros tenants.' });
      }
      if (!hasUserStoreAccess(authenticatedUser, existing.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Cupom pertence a outra filial.' });
      }
    }
    await docRef.delete();
    await recordSyncOutbox({
      entity: 'coupons',
      entityId: id,
      operation: 'DELETE',
      tenantId: existing.tenantId || authenticatedUser.tenantId || 'tenant-1',
      storeId: existing.storeId || null,
      hlc: generateHlcTimestamp('cloud_core'),
      payload: { id },
    });
    res.json({ success: true, deletedId: id });
  } catch {
    res.status(500).json({ error: 'Erro ao remover cupom.' });
  }
});

export default router;
