import express from 'express';
import crypto from 'crypto';
import {
  auth,
  db,
  hashPasswordAsync,
  runWithSystemDbContext,
  verifyPasswordAsync,
} from '../config.ts';
import {
  resolveWaiterDevicePrincipal,
  extractSessionToken,
  isRoleAllowedForAppId,
  isProductBlockedForUser,
} from '../middleware/auth.ts';
import { clearSessionCookie, setSessionCookie } from './auth/sessionCookie.ts';
import accountRecoveryAndLgpdRoutes from './auth/accountRecoveryAndLgpdRoutes.ts';
import { getConfiguredFirebaseProjectId } from './auth/firebaseTokenVerifier.ts';
import firebaseExchangeRoute, { getFirebaseGovernanceState } from './auth/firebaseExchangeRoute.ts';
import {
  buildRoleAppForbiddenPayload,
  resolveStrictProductAppId,
  validateCorporateTenantStatus,
} from './auth/authSessionHelpers.ts';
import { resolveSupabaseServerRuntime } from '../services/supabaseProvider.ts';
import supabaseExchangeRoute, { getSupabaseGovernanceState } from './auth/supabaseExchangeRoute.ts';

const router = express.Router();

function isStrictProductionMode(): boolean {
  return process.env.NODE_ENV === 'production' && process.env.ALLOW_SANDBOX_IN_PRODUCTION !== 'true';
}

function isSafeProdInitialPassword(value?: string): boolean {
  return Boolean(value) && value!.length >= 8 && value !== 'SetPassword2026';
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Autonomous Sign-Up Route (P0-01 & P0-02 Hardened)
 * Native account creation for Merchants (STORE_OWNER) and Consumers (CUSTOMER) only.
 * Self-service registration NEVER grants DEV_OWNER automatically.
 */
router.post('/signup', async (req, res) => {
  const { name, email, password, role = 'CUSTOMER', storeName, storeCity, storeState } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'E-mail válido é obrigatório para o cadastro.' });
  }

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Nome completo é obrigatório.' });
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Senha deve possuir no mínimo 8 caracteres.' });
  }

  try {
    const userEmail = email.toLowerCase().trim();

    let assignedRole = 'CUSTOMER';
    let tenantId: string = `tenant-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    let storeId: string | undefined = undefined;
    let newStoreData: Record<string, any> | null = null;
    const nowIso = new Date().toISOString();

    if (role === 'STORE_OWNER') {
      assignedRole = 'STORE_OWNER';
      storeId = `store-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const trialExpiresAt = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
      const resolvedStoreName =
        typeof storeName === 'string' && storeName.trim().length >= 2
          ? storeName.trim()
          : `Estabelecimento de ${name.trim()}`;
      const resolvedCity =
        typeof storeCity === 'string' && storeCity.trim().length >= 2
          ? storeCity.trim()
          : '';
      const resolvedState =
        typeof storeState === 'string' && /^[A-Za-z]{2}$/.test(storeState.trim())
          ? storeState.trim().toUpperCase()
          : '';
      const resolvedAddress =
        resolvedCity && resolvedState
          ? `${resolvedCity} - ${resolvedState}`
          : resolvedCity || 'Endereço a configurar';
      newStoreData = {
        id: storeId,
        tenantId,
        name: resolvedStoreName,
        slug: `loja-${Date.now()}`,
        category: 'RESTAURANT',
        address: resolvedAddress,
        ...(resolvedCity ? { city: resolvedCity } : {}),
        ...(resolvedState ? { state: resolvedState } : {}),
        phone: '',
        rating: 5.0,
        isOpen: true,
        deliveryFee: 5.0,
        deliveryTimeMin: 30,
        minOrder: 15.0,
        minOrderValue: 15.0,
        logo: '',
        banner: '',
        commissionRate: 0,
        subscriptionPlan: 'FREE',
        billingCycle: 'MONTHLY',
        maxAllowedDevices: 2,
        maxAllowedBranches: 1,
        saasMonthlyFee: 0,
        saasPaymentStatus: 'TRIAL',
        trialExpiresAt,
        totalOrders: 0,
        monthlyRevenue: 0,
        createdAt: nowIso,
      };
    } else {
      assignedRole = 'CUSTOMER';
      tenantId = 'tenant-1';
    }

    const uid = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const passwordHashStr = await hashPasswordAsync(password);

    const newUserProfile = {
      uid,
      id: uid,
      email: userEmail,
      name: name.trim(),
      role: assignedRole,
      tenantId,
      storeId,
      ...(storeId ? { allowedStoreIds: [storeId] } : {}),
      emailVerified: false,
      status: 'ACTIVE',
      passwordHash: passwordHashStr,
      createdAt: nowIso,
    };

    await runWithSystemDbContext('AUTH_SIGNUP', () =>
      db.runTransaction(async (transaction) => {
        const usersTable = await db.collection('users').get();
        const existingUser = usersTable.docs.find((d) => d.data()?.email?.toLowerCase() === userEmail);
        if (existingUser) {
          const err: any = new Error('E-mail já cadastrado na plataforma. Por favor, faça login.');
          err.statusCode = 400;
          throw err;
        }

        if (newStoreData) {
          transaction.set(
            db.collection('tenants').doc(tenantId),
            {
              id: tenantId,
              name: newStoreData.name,
              status: 'ACTIVE',
              subscriptionPlan: 'FREE',
              billingCycle: 'MONTHLY',
              maxAllowedDevices: 2,
              maxAllowedBranches: 1,
              saasPaymentStatus: 'TRIAL',
              trialExpiresAt: newStoreData.trialExpiresAt,
              createdAt: nowIso,
              updatedAt: nowIso,
            },
            { merge: true }
          );
          transaction.set(db.collection('stores').doc(storeId!), newStoreData);
        }

        transaction.set(db.collection('users').doc(uid), newUserProfile);

        if (assignedRole === 'CUSTOMER') {
          transaction.set(
            db.collection('consumers').doc(uid),
            {
              id: uid,
              uid,
              name: name.trim(),
              email: userEmail,
              phone: '',
              tenantId: 'tenant-1',
              savedAddresses: [],
              favoriteStoreIds: [],
              loyaltyRewards: [],
              preferences: {
                dietaryRestrictions: [],
                favoriteCategories: [],
                defaultPaymentMethod: 'PIX',
                emailNotifications: true,
                whatsappNotifications: true,
              },
              createdAt: newUserProfile.createdAt,
            },
            { merge: true }
          );
        }
      })
    );

    const token = auth.generateDevToken({
      uid,
      email: userEmail,
      email_verified: false,
      name: newUserProfile.name,
      role: assignedRole,
      tenantId,
      storeId,
    });
    setSessionCookie(res, token);

    res.status(201).json({
      token,
      user: {
        uid,
        email: userEmail,
        name: newUserProfile.name,
        role: assignedRole,
        tenantId,
        storeId,
        emailVerified: false,
      },
    });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.warn('[Auth Route] Sign-up notice:', error);
    res.status(500).json({ error: 'Erro interno ao realizar cadastro.' });
  }
});

/**
 * Autonomous Login Route (P0-02 Hardened)
 * Strictly verifies email & salted PBKDF2 password against stored credentials.
 */
router.post('/login', async (req, res) => {
  const { email, password, contextId } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'E-mail válido é obrigatório para o login.' });
  }

  if (!password || typeof password !== 'string' || password.length < 3) {
    return res.status(400).json({ error: 'Senha é obrigatória para autenticação.' });
  }

  try {
    return await runWithSystemDbContext('AUTH_LOGIN', async () => {
      const userEmail = email.toLowerCase().trim();

      const usersTable = await db.collection('users').get();
      let userDoc = usersTable.docs.find((d) => d.data().email?.toLowerCase() === userEmail);

      if (!userDoc && userEmail === '3eatcru@gmail.com') {
        const envDevPassword = process.env.INITIAL_DEV_PASSWORD?.trim();
        if (isStrictProductionMode() && !isSafeProdInitialPassword(envDevPassword)) {
          return res.status(503).json({
            error:
              'Bootstrap Master HQ bloqueado em produção: configure INITIAL_DEV_PASSWORD segura (>= 8 caracteres, diferente da senha padrão) via Secret Manager antes do primeiro acesso.',
          });
        }
        const defaultPassword = envDevPassword || 'SetPassword2026';
        const nowIso = new Date().toISOString();
        const baseTenantSnap = await db.collection('tenants').doc('tenant-1').get();
        if (!baseTenantSnap.exists) {
          await db.collection('tenants').doc('tenant-1').set({
            id: 'tenant-1',
            name: '3C Corp Matriz (HQ)',
            status: 'ACTIVE',
            subscriptionPlan: 'PRO',
            billingCycle: 'MONTHLY',
            maxAllowedBranches: 1,
            maxAllowedDevices: 2,
            saasPaymentStatus: 'ACTIVE',
            createdAt: nowIso,
          });
        }
        const masterProfile = {
          id: 'usr-dev-master',
          uid: 'usr-dev-master',
          name: 'Dono da Plataforma (Master HQ)',
          email: '3eatcru@gmail.com',
          role: 'DEV_OWNER',
          tenantId: 'tenant-1',
          status: 'ACTIVE',
          emailVerified: true,
          passwordSealed: false,
          mustChangePassword: true,
          passwordHash: await hashPasswordAsync(defaultPassword),
          createdAt: nowIso,
        };
        await db.collection('users').doc('usr-dev-master').set(masterProfile);
        userDoc = (await db.collection('users').doc('usr-dev-master').get()) as any;
      }

      if (!userDoc) {
        return res
          .status(401)
          .json({ error: 'Conta não encontrada. Clique em "Criar Conta" para registrar-se.' });
      }

      const profile = userDoc.data();

      if (
        profile.status === 'DISABLED' ||
        profile.status === 'PENDING_ACTIVATION' ||
        profile.disabled === true
      ) {
        return res.status(403).json({
          error:
            'Conta de usuário desativada ou pendente de ativação. Entre em contato com o suporte.',
        });
      }

      let isPasswordValid =
        profile.passwordSealed === true
          ? false
          : await verifyPasswordAsync(password, profile.passwordHash);
      if (
        !isPasswordValid &&
        userEmail === '3eatcru@gmail.com' &&
        (!profile.passwordHash || profile.passwordSealed === true)
      ) {
        const envInitial = process.env.INITIAL_DEV_PASSWORD?.trim();
        const safeProdInitial = isSafeProdInitialPassword(envInitial);
        if (isStrictProductionMode() && !safeProdInitial) {
          return res.status(503).json({
            error:
              'Conta Master HQ selada em produção: configure INITIAL_DEV_PASSWORD segura (>= 8 caracteres, diferente da senha padrão) no Secret Manager para desbloquear o primeiro acesso.',
          });
        }
        const expectedInitial = isStrictProductionMode()
          ? envInitial!
          : (envInitial || 'SetPassword2026');
        if (timingSafeStringEqual(password, expectedInitial)) {
          isPasswordValid = true;
          profile.passwordHash = await hashPasswordAsync(expectedInitial);
          profile.passwordSealed = false;
          profile.mustChangePassword = true;
          await db.collection('users').doc(userDoc.id).update({
            passwordHash: profile.passwordHash,
            passwordSealed: false,
            mustChangePassword: true,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      const tenantCheck = await validateCorporateTenantStatus(profile);
      if (tenantCheck.ok === false) {
        return res.status(tenantCheck.status).json({ error: tenantCheck.error });
      }

      const normalizedRole = String(profile.role || '').toUpperCase();
      const requestAppId = resolveStrictProductAppId(req, contextId);
      const canonicalRole = normalizedRole === 'DRIVER' ? 'COURIER' : profile.role;
      if (requestAppId && !isRoleAllowedForAppId(canonicalRole, requestAppId)) {
        return res
          .status(403)
          .json(buildRoleAppForbiddenPayload(canonicalRole, requestAppId, 'login'));
      }
      if (requestAppId && isProductBlockedForUser(profile.blockedApps, requestAppId)) {
        return res.status(403).json({
          error: `Acesso bloqueado: O aplicativo '${requestAppId}' está bloqueado para sua conta.`,
        });
      }

      const token = auth.generateDevToken({
        uid: profile.uid,
        email: profile.email,
        email_verified: profile.emailVerified === true,
        name: profile.name,
        role: canonicalRole,
        tenantId: profile.tenantId || 'tenant-1',
        storeId: profile.storeId,
        tokenVersion: typeof profile.tokenVersion === 'number' ? profile.tokenVersion : 1,
        ...(requestAppId ? { appId: requestAppId } : {}),
      });
      setSessionCookie(res, token);

      res.json({
        token,
        user: {
          uid: profile.uid,
          email: profile.email,
          name: profile.name,
          role: canonicalRole,
          tenantId: profile.tenantId,
          storeId: profile.storeId,
          ...(Array.isArray(profile.allowedStoreIds)
            ? { allowedStoreIds: profile.allowedStoreIds }
            : {}),
          emailVerified: profile.emailVerified,
          mustChangePassword: profile.mustChangePassword === true,
          permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
          blockedApps: Array.isArray(profile.blockedApps) ? profile.blockedApps : [],
        },
      });
    });
  } catch (error: any) {
    console.warn('[Auth Route] Login notice:', error);
    res.status(500).json({ error: 'Erro interno ao processar login.' });
  }
});

router.get('/providers', async (_req, res) => {
  const [state, sbState] = await Promise.all([
    getFirebaseGovernanceState(),
    getSupabaseGovernanceState(),
  ]);
  const firebaseProjectId = getConfiguredFirebaseProjectId(state.projectIdOverride);
  const configured = Boolean(firebaseProjectId);
  const sbRuntime = resolveSupabaseServerRuntime(sbState.govData);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    autonomousEmailPassword: true,
    firebaseEnabled: Boolean(state.authEnabled && configured),
    firebaseMasterEnabled: Boolean(state.masterEnabled && configured),
    firebaseAuthEnabled: Boolean(state.authEnabled && configured),
    firebaseFirestoreEnabled: Boolean(state.firestoreEnabled && configured),
    firebaseConfigured: configured,
    firebaseProjectId: firebaseProjectId || null,
    googlePopupSupported: Boolean(state.authEnabled && configured),
    supabaseEnabled: Boolean(sbState.authEnabled && sbRuntime.configured),
    supabaseMasterEnabled: Boolean(sbState.masterEnabled && sbRuntime.configured),
    supabaseAuthEnabled: Boolean(sbState.authEnabled && sbRuntime.configured),
    supabaseDbEnabled: Boolean(sbState.dbEnabled && sbRuntime.configured),
    supabaseConfigured: sbRuntime.configured,
    supabaseUrl: sbRuntime.url || null,
    supabasePublishableKey: sbRuntime.publishableKey || null,
    supabaseJwksUrl: sbRuntime.jwksUrl || null,
  });
});

router.use(firebaseExchangeRoute);

router.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

/**
 * Verify current session token and return authenticated profile
 */
router.get('/me', async (req, res) => {
  const token = extractSessionToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Token ausente.' });
  }
  try {
    return await runWithSystemDbContext('AUTH_ME', async () => {
      const decoded = await auth.verifyIdToken(token);
      if (decoded?.typ === 'waiter_device') {
        const resolved = await resolveWaiterDevicePrincipal(decoded);
        if (!resolved.ok) {
          return res.status(resolved.status).json({ error: resolved.error });
        }
        return res.json({
          ...resolved.user,
          emailVerified: false,
          mustChangePassword: false,
          permissions: [],
          blockedApps: [],
        });
      }
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      if (!userDoc.exists) {
        return res.status(401).json({ error: 'Usuário não encontrado ou revogado.' });
      }
      const u = userDoc.data();
      if (!u || u.status === 'DISABLED' || u.status === 'PENDING_ACTIVATION' || u.disabled === true) {
        return res.status(403).json({ error: 'Conta desativada ou pendente de ativação.' });
      }
      if (
        typeof u.tokenVersion === 'number' &&
        typeof decoded.tokenVersion === 'number' &&
        decoded.tokenVersion !== u.tokenVersion
      ) {
        return res.status(401).json({ error: 'Sessão revogada pelo HQ. Faça login novamente.' });
      }
      if (
        typeof u.tokenRevokedAtSec === 'number' &&
        typeof decoded.iat === 'number' &&
        decoded.iat < u.tokenRevokedAtSec
      ) {
        return res.status(401).json({ error: 'Sessão revogada. Faça login novamente.' });
      }
      const tenantCheck = await validateCorporateTenantStatus(u);
      if (tenantCheck.ok === false) {
        return res.status(tenantCheck.status).json({ error: tenantCheck.error });
      }
      const normalizedRole = String(u.role || '').toUpperCase();
      const requestAppId = (req as any).clientContext?.appId || req.headers['x-3c-app-id'];
      const effectiveRole = normalizedRole === 'DRIVER' ? 'COURIER' : u.role;
      if (!isRoleAllowedForAppId(effectiveRole, requestAppId)) {
        return res.status(403).json({
          error: `Acesso negado: Perfil '${effectiveRole}' não é autorizado para '${requestAppId}'.`,
        });
      }
      if (isProductBlockedForUser(u.blockedApps, requestAppId)) {
        return res.status(403).json({
          error: `Acesso bloqueado: Produto '${requestAppId}' está bloqueado para sua conta.`,
        });
      }

      delete u.passwordHash;
      delete u.resetCodeHash;
      res.json({
        ...u,
        role: normalizedRole === 'DRIVER' ? 'COURIER' : u.role,
        ...(Array.isArray(u.allowedStoreIds) ? { allowedStoreIds: u.allowedStoreIds } : {}),
        permissions: Array.isArray(u.permissions) ? u.permissions : [],
        blockedApps: Array.isArray(u.blockedApps) ? u.blockedApps : [],
      });
    });
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Token inválido.' });
  }
});

router.use(supabaseExchangeRoute);
router.use(accountRecoveryAndLgpdRoutes);

export default router;
