import express from 'express';
import { auth, db, runWithSystemDbContext } from '../../config.ts';
import { isRoleAllowedForAppId, isProductBlockedForUser } from '../../middleware/auth.ts';
import { setSessionCookie } from './sessionCookie.ts';
import { verifyFirebaseIdToken } from './firebaseTokenVerifier.ts';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../../constants/platformDefaults.ts';
import {
  buildRoleAppForbiddenPayload,
  resolveStrictProductAppId,
  validateCorporateTenantStatus,
} from './authSessionHelpers.ts';

const router = express.Router();

export async function getFirebaseGovernanceState(): Promise<{
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

      const tenantCheck = await validateCorporateTenantStatus(profile);
      if (tenantCheck.ok === false) {
        return res.status(tenantCheck.status).json({ error: tenantCheck.error });
      }

      const normalizedRole = String(profile.role || '').toUpperCase();
      const canonicalRole = normalizedRole === 'DRIVER' ? 'COURIER' : profile.role;
      if (!isRoleAllowedForAppId(canonicalRole, effectiveAppId)) {
        return res
          .status(403)
          .json(buildRoleAppForbiddenPayload(canonicalRole, effectiveAppId, 'firebase-exchange'));
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

export default router;
