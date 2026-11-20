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
import {
  getConfiguredFirebaseProjectId,
  verifyFirebaseIdToken,
} from './auth/firebaseTokenVerifier.ts';
import { resolveSupabaseServerRuntime } from '../services/supabaseProvider.ts';
import supabaseExchangeRoute, { getSupabaseGovernanceState } from './auth/supabaseExchangeRoute.ts';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults.ts';

const router = express.Router();

const DEDICATED_PRODUCT_IDS = new Set([
  'marketplace',
  'store-os',
  'driver',
  'waiter',
  'hq',
  'server-core',
]);

async function getFirebaseGovernanceState(): Promise<{
  masterEnabled: boolean;
  authEnabled: boolean;
  firestoreEnabled: boolean;
  projectIdOverride: string;
}> {
  const defaultMaster = Boolean(DEFAULT_PLATFORM_GOVERNANCE.featureFlags.firebaseEnabled);
  const defaultAuth = Boolean(DEFAULT_PLATFORM_GOVERNANCE.featureFlags.firebaseAuthEnabled ?? true);
  const defaultFirestore = Boolean(
    DEFAULT_PLATFORM_GOVERNANCE.featureFlags.firebaseFirestoreEnabled ?? true
  );
  try {
    const govSnap = await runWithSystemDbContext('AUTH_PROVIDERS_CHECK', () =>
      db.collection('governance').doc('governance').get()
    );
    const govData = govSnap.exists ? govSnap.data() : undefined;
    const flags = govData?.featureFlags;
    const projectIdOverride =
      typeof govData?.runtimePolicy?.firebaseProjectIdOverride === 'string'
        ? govData.runtimePolicy.firebaseProjectIdOverride.trim()
        : '';
    if (flags && typeof flags === 'object') {
      const masterEnabled =
        typeof flags.firebaseEnabled === 'boolean' ? flags.firebaseEnabled : defaultMaster;
      const authEnabled =
        typeof flags.firebaseAuthEnabled === 'boolean'
          ? flags.firebaseAuthEnabled
          : defaultAuth;
      const firestoreEnabled =
        typeof flags.firebaseFirestoreEnabled === 'boolean'
          ? flags.firebaseFirestoreEnabled
          : defaultFirestore;
      return {
        masterEnabled,
        authEnabled: masterEnabled && authEnabled,
        firestoreEnabled: masterEnabled && firestoreEnabled,
        projectIdOverride,
      };
    }
    return {
      masterEnabled: defaultMaster,
      authEnabled: defaultMaster && defaultAuth,
      firestoreEnabled: defaultMaster && defaultFirestore,
      projectIdOverride,
    };
  } catch {
    // Fallback to default governance flag
  }
  return {
    masterEnabled: defaultMaster,
    authEnabled: defaultMaster && defaultAuth,
    firestoreEnabled: defaultMaster && defaultFirestore,
    projectIdOverride: '',
  };
}

function resolveStrictProductAppId(req: express.Request, bodyContextId?: unknown): string | null {
  const rawHeader = String(
    req.headers['x-3c-app-id'] || (req as any).clientContext?.appId || ''
  )
    .trim()
    .toLowerCase();
  const headerAppId = rawHeader === 'hq-central' ? 'hq' : rawHeader;
  if (DEDICATED_PRODUCT_IDS.has(headerAppId)) {
    return headerAppId;
  }
  const rawBody = String(bodyContextId || '')
    .trim()
    .toLowerCase();
  const requestedContext = rawBody === 'hq-central' ? 'hq' : rawBody;
  if (DEDICATED_PRODUCT_IDS.has(requestedContext)) {
    return requestedContext;
  }
  return null;
}

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

      const normalizedRole = String(profile.role || '').toUpperCase();
      if (
        normalizedRole !== 'DEV_OWNER' &&
        normalizedRole !== 'CUSTOMER' &&
        normalizedRole !== 'CONSUMER'
      ) {
        const userTenant = typeof profile.tenantId === 'string' ? profile.tenantId.trim() : '';
        if (!userTenant) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Conta corporativa sem tenantId válido.' });
        }
        const tenantSnap = await db.collection('tenants').doc(userTenant).get();
        if (!tenantSnap.exists) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa/Tenant não encontrada.' });
        }
        const tenantStatus = String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase();
        if (tenantStatus === 'SUSPENDED') {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa temporariamente suspensa na plataforma.' });
        }
        if (tenantStatus !== 'ACTIVE') {
          return res
            .status(403)
            .json({ error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).` });
        }
      }

      const requestAppId = resolveStrictProductAppId(req, contextId);
      const canonicalRole = normalizedRole === 'DRIVER' ? 'COURIER' : profile.role;
      if (requestAppId && !isRoleAllowedForAppId(canonicalRole, requestAppId)) {
        const isInternalGovernanceRole =
          canonicalRole === 'DEV_OWNER' || canonicalRole === 'SUPER_ADMIN';
        if (isInternalGovernanceRole) {
          return res.status(403).json({
            code: 'APP_ROLE_FORBIDDEN',
            error: `Acesso negado: esta conta não é autorizada para o aplicativo '${requestAppId}'.`,
          });
        }
        const suggestedAppId =
          canonicalRole === 'STORE_OWNER' ||
          canonicalRole === 'STORE_MANAGER' ||
          canonicalRole === 'REGIONAL_MANAGER' ||
          canonicalRole === 'CASHIER' ||
          canonicalRole === 'KITCHEN_STAFF'
            ? 'store-os'
            : canonicalRole === 'COURIER' || canonicalRole === 'DRIVER'
            ? 'driver'
            : canonicalRole === 'WAITER'
            ? 'waiter'
            : 'marketplace';
        return res.status(403).json({
          code: 'APP_ROLE_FORBIDDEN',
          suggestedAppId,
          error: `Acesso negado: Perfil '${canonicalRole}' não é autorizado para o produto '${requestAppId}'. Utilize o aplicativo correspondente.`,
        });
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

/**
 * Optional Firebase Google Sign-In Token Exchange (Server Core Backbone)
 * - Governed in 1 click by HQ featureFlags.firebaseEnabled / firebaseAuthEnabled
 * - Cryptographically verifies Firebase ID token (RS256)
 * - Strictly enforces separated product & role isolation (marketplace / store-os / driver / waiter / hq / server-core)
 * - Never auto-promotes privileges or bypasses tenant suspension
 */
router.post('/firebase-exchange', async (req, res) => {
  const { idToken, contextId } = req.body || {};

  try {
    const govState = await getFirebaseGovernanceState();
    if (!govState.authEnabled) {
      return res.status(403).json({
        error:
          'Autenticação via Firebase está desativada na governança do HQ Central. Utilize login por e-mail e senha.',
      });
    }

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({ error: 'Token de autenticação Firebase ausente.' });
    }

    const verified = await verifyFirebaseIdToken(idToken, govState.projectIdOverride);
    const effectiveAppId = resolveStrictProductAppId(req, contextId) || 'marketplace';

    return await runWithSystemDbContext('AUTH_FIREBASE_EXCHANGE', async () => {
      const usersTable = await db.collection('users').get();
      const existingDoc = usersTable.docs.find(
        (d) => d.data()?.email?.toLowerCase() === verified.email
      );

      if (!existingDoc) {
        if (effectiveAppId === 'marketplace') {
          const nowIso = new Date().toISOString();
          const uid = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newConsumerProfile = {
            uid,
            id: uid,
            email: verified.email,
            name: verified.name,
            role: 'CUSTOMER',
            tenantId: 'tenant-1',
            emailVerified: true,
            status: 'ACTIVE',
            authProvider: 'firebase-google',
            firebaseUid: verified.uid,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          await db.runTransaction(async (transaction) => {
            transaction.set(db.collection('users').doc(uid), newConsumerProfile);
            transaction.set(
              db.collection('consumers').doc(uid),
              {
                id: uid,
                uid,
                name: verified.name,
                email: verified.email,
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
                createdAt: nowIso,
              },
              { merge: true }
            );
          });

          const token = auth.generateDevToken({
            uid,
            email: verified.email,
            email_verified: true,
            name: verified.name,
            role: 'CUSTOMER',
            tenantId: 'tenant-1',
            tokenVersion: 1,
            ...(effectiveAppId ? { appId: effectiveAppId } : {}),
          });
          setSessionCookie(res, token);

          return res.status(201).json({
            token,
            user: {
              uid,
              email: verified.email,
              name: verified.name,
              role: 'CUSTOMER',
              tenantId: 'tenant-1',
              emailVerified: true,
              authProvider: 'firebase-google',
              mustChangePassword: false,
              permissions: [],
              blockedApps: [],
            },
          });
        }

        if (effectiveAppId === 'store-os') {
          return res.status(404).json({
            error:
              'Nenhuma conta de lojista vinculada a este e-mail Google. Clique em "Criar Conta" no Store OS para registrar sua loja com cidade e UF.',
          });
        }

        if (effectiveAppId === 'hq' || effectiveAppId === 'server-core') {
          return res.status(403).json({
            error:
              'Acesso restrito ao HQ Central: este e-mail Google não possui conta administrativa autorizada.',
          });
        }

        return res.status(403).json({
          error:
            'Nenhuma conta operacional provisionada para este e-mail Google. Solicite cadastro ao administrador responsável.',
        });
      }

      const profile = existingDoc.data();
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

      const normalizedRole = String(profile.role || '').toUpperCase();
      if (
        normalizedRole !== 'DEV_OWNER' &&
        normalizedRole !== 'CUSTOMER' &&
        normalizedRole !== 'CONSUMER'
      ) {
        const userTenant = typeof profile.tenantId === 'string' ? profile.tenantId.trim() : '';
        if (!userTenant) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Conta corporativa sem tenantId válido.' });
        }
        const tenantSnap = await db.collection('tenants').doc(userTenant).get();
        if (!tenantSnap.exists) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa/Tenant não encontrada.' });
        }
        const tenantStatus = String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase();
        if (tenantStatus === 'SUSPENDED') {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa temporariamente suspensa na plataforma.' });
        }
        if (tenantStatus !== 'ACTIVE') {
          return res
            .status(403)
            .json({ error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).` });
        }
      }

      const canonicalRole = normalizedRole === 'DRIVER' ? 'COURIER' : profile.role;
      if (!isRoleAllowedForAppId(canonicalRole, effectiveAppId)) {
        const isInternalGovernanceRole =
          canonicalRole === 'DEV_OWNER' || canonicalRole === 'SUPER_ADMIN';
        if (isInternalGovernanceRole) {
          return res.status(403).json({
            code: 'APP_ROLE_FORBIDDEN',
            error: `Acesso negado: esta conta não é autorizada para o aplicativo '${effectiveAppId}'.`,
          });
        }
        const suggestedAppId =
          canonicalRole === 'STORE_OWNER' ||
          canonicalRole === 'STORE_MANAGER' ||
          canonicalRole === 'REGIONAL_MANAGER' ||
          canonicalRole === 'CASHIER' ||
          canonicalRole === 'KITCHEN_STAFF'
            ? 'store-os'
            : canonicalRole === 'COURIER' || canonicalRole === 'DRIVER'
            ? 'driver'
            : canonicalRole === 'WAITER'
            ? 'waiter'
            : 'marketplace';
        return res.status(403).json({
          code: 'APP_ROLE_FORBIDDEN',
          canonicalRole,
          suggestedAppId,
          error: `Acesso negado: Sua conta Google pertence ao perfil '${canonicalRole}' e deve entrar pelo aplicativo '${suggestedAppId}'.`,
        });
      }
      if (isProductBlockedForUser(profile.blockedApps, effectiveAppId)) {
        return res.status(403).json({
          error: `Acesso bloqueado: O aplicativo '${effectiveAppId}' está bloqueado para sua conta.`,
        });
      }

      if (profile.firebaseUid !== verified.uid || profile.emailVerified !== true) {
        await db
          .collection('users')
          .doc(existingDoc.id)
          .update({
            firebaseUid: verified.uid,
            emailVerified: true,
            updatedAt: new Date().toISOString(),
          });
      }

      const token = auth.generateDevToken({
        uid: profile.uid,
        email: profile.email,
        email_verified: true,
        name: profile.name,
        role: canonicalRole,
        tenantId: profile.tenantId || 'tenant-1',
        storeId: profile.storeId,
        tokenVersion: typeof profile.tokenVersion === 'number' ? profile.tokenVersion : 1,
        ...(effectiveAppId ? { appId: effectiveAppId } : {}),
      });
      setSessionCookie(res, token);

      return res.json({
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
          emailVerified: true,
          authProvider: 'firebase-google',
          mustChangePassword: profile.mustChangePassword === true,
          permissions: Array.isArray(profile.permissions) ? profile.permissions : [],
          blockedApps: Array.isArray(profile.blockedApps) ? profile.blockedApps : [],
        },
      });
    });
  } catch (error: any) {
    console.warn('[Auth Route] Firebase exchange rejected:', error?.message || error);
    return res.status(401).json({
      error: error?.message || 'Não foi possível validar sua autenticação Google/Firebase.',
    });
  }
});

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
      const normalizedRole = String(u.role || '').toUpperCase();
      if (
        normalizedRole !== 'DEV_OWNER' &&
        normalizedRole !== 'CUSTOMER' &&
        normalizedRole !== 'CONSUMER'
      ) {
        const userTenant = typeof u.tenantId === 'string' ? u.tenantId.trim() : '';
        if (!userTenant) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Conta corporativa sem tenantId válido.' });
        }
        const tenantSnap = await db.collection('tenants').doc(userTenant).get();
        if (!tenantSnap.exists) {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa/Tenant não encontrada.' });
        }
        const tenantStatus = String(tenantSnap.data()?.status || 'ACTIVE').toUpperCase();
        if (tenantStatus === 'SUSPENDED') {
          return res
            .status(403)
            .json({ error: 'Acesso bloqueado: Empresa temporariamente suspensa na plataforma.' });
        }
        if (tenantStatus !== 'ACTIVE') {
          return res
            .status(403)
            .json({ error: `Acesso bloqueado: Empresa em estado inválido (${tenantStatus}).` });
        }
      }
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
