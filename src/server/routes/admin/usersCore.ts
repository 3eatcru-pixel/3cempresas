import express from 'express';
import {
  db,
  hashPasswordAsync,
  revokeAuthSessionEverywhere,
} from '../../config.ts';
import {
  applyPaginationAndHeaders,
  parsePaginationParams,
} from '../../utils/pagination.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { broadcastUserSseEvent } from '../../state.ts';
import { generateUserId } from '../../../utils/idGenerator.ts';
import {
  HQ_ONLY_ROLES,
  ROLE_LEVELS,
  STORE_SCOPED_ROLE_SET,
  isMarketplaceConsumerRole,
  normalizeUserRole,
  recordAdminAuditEvent,
  sanitizeStringArray,
} from './adminHelpersCore.ts';
import userSecurityLifecycleCore from './userSecurityLifecycleCore.ts';

const router = express.Router();

const VALID_FLEET_MODES = new Set(['PLATFORM_FLEET', 'STORE_FLEET']);
const VALID_VEHICLES = new Set(['SCOOTER', 'BIKE', 'CAR']);

function resolveCourierFleetConfig(params: {
  storeId?: string | null;
  requestedFleetType?: unknown;
  requestedAllowedModes?: unknown;
  requestedVehicle?: unknown;
  requestedVehiclePlate?: unknown;
  existingUser?: Record<string, any> | null;
}) {
  const hasStore = Boolean(params.storeId);
  const rawFleet = typeof params.requestedFleetType === 'string'
    ? params.requestedFleetType.trim().toUpperCase()
    : '';
  const fallbackFleet =
    (typeof params.existingUser?.fleetType === 'string' && VALID_FLEET_MODES.has(params.existingUser.fleetType.toUpperCase())
      ? params.existingUser.fleetType.toUpperCase()
      : '') || (hasStore ? 'STORE_FLEET' : 'PLATFORM_FLEET');
  const resolvedFleetType: 'PLATFORM_FLEET' | 'STORE_FLEET' =
    (VALID_FLEET_MODES.has(rawFleet) ? rawFleet : fallbackFleet) as 'PLATFORM_FLEET' | 'STORE_FLEET';

  let allowedFleetModes: ('PLATFORM_FLEET' | 'STORE_FLEET')[] = [];
  if (Array.isArray(params.requestedAllowedModes)) {
    allowedFleetModes = Array.from(
      new Set(
        params.requestedAllowedModes
          .map((m) => String(m || '').trim().toUpperCase())
          .filter((m): m is 'PLATFORM_FLEET' | 'STORE_FLEET' => VALID_FLEET_MODES.has(m))
      )
    );
  } else if (Array.isArray(params.existingUser?.allowedFleetModes) && params.existingUser.allowedFleetModes.length > 0 && params.requestedFleetType === undefined) {
    allowedFleetModes = Array.from(
      new Set(
        params.existingUser.allowedFleetModes
          .map((m: any) => String(m || '').trim().toUpperCase())
          .filter((m: string): m is 'PLATFORM_FLEET' | 'STORE_FLEET' => VALID_FLEET_MODES.has(m))
      )
    );
  }

  if (!hasStore) {
    allowedFleetModes = ['PLATFORM_FLEET'];
  } else if (allowedFleetModes.length === 0) {
    allowedFleetModes = [resolvedFleetType];
  }

  const finalFleetType: 'PLATFORM_FLEET' | 'STORE_FLEET' =
    !hasStore
      ? 'PLATFORM_FLEET'
      : allowedFleetModes.includes(resolvedFleetType)
      ? resolvedFleetType
      : allowedFleetModes[0];

  const rawVehicle = typeof params.requestedVehicle === 'string' ? params.requestedVehicle.trim().toUpperCase() : '';
  const existingVehicle = typeof params.existingUser?.vehicle === 'string' ? params.existingUser.vehicle.toUpperCase() : '';
  const vehicle = (VALID_VEHICLES.has(rawVehicle) ? rawVehicle : (VALID_VEHICLES.has(existingVehicle) ? existingVehicle : 'SCOOTER')) as 'SCOOTER' | 'BIKE' | 'CAR';

  const vehiclePlate =
    typeof params.requestedVehiclePlate === 'string'
      ? params.requestedVehiclePlate.trim().toUpperCase()
      : (typeof params.existingUser?.vehiclePlate === 'string' ? params.existingUser.vehiclePlate : '');

  return {
    fleetType: finalFleetType,
    allowedFleetModes,
    vehicle,
    vehiclePlate,
  };
}

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

router.get('/users', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const includeStats = String(req.query.includeStats ?? 'true').toLowerCase() !== 'false';
    const pagination = parsePaginationParams(req.query as Record<string, any>, { maxLimit: 500 });
    const search = typeof (req.query.search ?? req.query.q) === 'string'
      ? String(req.query.search ?? req.query.q).trim().toLowerCase()
      : '';

    const [usersSnap, consumersSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('consumers').get(),
    ]);

    const consumerPhoneByUid = new Map<string, string>();
    if (consumersSnap) {
      for (const doc of consumersSnap.docs) {
        const cData = doc.data();
        if (cData?.phone) {
          consumerPhoneByUid.set(doc.id, String(cData.phone));
        }
      }
    }

    let list = usersSnap.docs
      .filter(d => !d.data()?._deleted)
      .map(d => {
        const raw = d.data() || {};
        const { passwordHash: _omitted, resetCodeHash: _omittedReset, ...safeUser } = raw;
        const uid = String(safeUser.uid || safeUser.id || d.id);
        const normalizedRole = normalizeUserRole(safeUser.role);
        return {
          ...safeUser,
          uid,
          role: normalizedRole,
          status: safeUser.disabled === true ? 'DISABLED' : (safeUser.status || 'ACTIVE'),
          ...(consumerPhoneByUid.has(uid) && !safeUser.phone ? { phone: consumerPhoneByUid.get(uid) } : {}),
        };
      });

    if (req.query.storeId) {
      const targetStoreId = String(req.query.storeId);
      list = list.filter((u: any) => u.storeId === targetStoreId);
    }

    if (req.query.role) {
      const targetRole = normalizeUserRole(String(req.query.role));
      list = list.filter((u: any) => normalizeUserRole(u.role) === targetRole);
    }

    if (req.query.status) {
      const targetStatus = String(req.query.status).toUpperCase();
      list = list.filter((u: any) => String(u.status || 'ACTIVE').toUpperCase() === targetStatus);
    }

    if (search) {
      list = list.filter((u: any) =>
        String(u.name || '').toLowerCase().includes(search) ||
        String(u.email || '').toLowerCase().includes(search) ||
        String(u.uid || '').toLowerCase().includes(search) ||
        String(u.phone || '').toLowerCase().includes(search)
      );
    }

    const pageResult = applyPaginationAndHeaders(res, list, pagination, (u: any) => String(u.uid || u.id || ''));

    if (includeStats && pageResult.items.length > 0) {
      const pageUids = new Set(pageResult.items.map((u: any) => String(u.uid)));
      const ordersSnap = await db.collection('orders').get();
      const consumerStatsByUid = new Map<string, { count: number; totalSpent: number; lastOrderAt?: string }>();
      if (ordersSnap) {
        for (const doc of ordersSnap.docs) {
          const order = doc.data();
          const cid = order?.customerId ? String(order.customerId) : '';
          if (!cid || !pageUids.has(cid) || order?._deleted) continue;
          const prev = consumerStatsByUid.get(cid) || { count: 0, totalSpent: 0 };
          const isCancelled = order?.status === 'CANCELLED';
          const nextTotal = isCancelled ? prev.totalSpent : prev.totalSpent + (Number(order?.total) || 0);
          const orderDate = order?.createdAt ? String(order.createdAt) : undefined;
          const nextLast =
            orderDate && (!prev.lastOrderAt || orderDate > prev.lastOrderAt)
              ? orderDate
              : prev.lastOrderAt;
          consumerStatsByUid.set(cid, {
            count: prev.count + 1,
            totalSpent: Number(nextTotal.toFixed(2)),
            lastOrderAt: nextLast,
          });
        }
      }

      pageResult.items = pageResult.items.map((u: any) => {
        const stats = consumerStatsByUid.get(String(u.uid));
        return stats
          ? {
              ...u,
              marketplaceOrdersCount: stats.count,
              marketplaceTotalSpent: stats.totalSpent,
              lastOrderAt: stats.lastOrderAt,
            }
          : { ...u, marketplaceOrdersCount: 0, marketplaceTotalSpent: 0 };
      });
    }

    res.json(pagination.envelope ? pageResult : pageResult.items);
  } catch {
    res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
});

router.post('/users/create', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { name, email, password, role, storeId, phone, blockedApps, permissions, fleetType, allowedFleetModes, vehicle, vehiclePlate } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail válido é obrigatório.' });
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Senha explícita de no mínimo 8 caracteres é obrigatória.' });
    }

    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const creatorRole = authenticatedUser?.role || 'GUEST';

    const targetRole = normalizeUserRole(role || 'CUSTOMER');
    if (!Object.prototype.hasOwnProperty.call(ROLE_LEVELS, targetRole) || targetRole === 'GUEST') {
      return res.status(400).json({ error: `Perfil '${role}' inválido.` });
    }
    if (ROLE_LEVELS[targetRole] >= ROLE_LEVELS[creatorRole] && creatorRole !== 'DEV_OWNER') {
      return res.status(403).json({ error: `Acesso negado: Perfil '${creatorRole}' não pode criar usuários com nível '${targetRole}'.` });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const effectiveStoreId = STORE_SCOPED_ROLE_SET.has(targetRole) && storeId ? String(storeId) : null;
    let resolvedStoreTenantId: string | undefined;
    if (effectiveStoreId) {
      const storeSnap = await db.collection('stores').doc(effectiveStoreId).get();
      if (!storeSnap.exists || storeSnap.data()?._deleted) {
        return res.status(400).json({ error: `Loja '${effectiveStoreId}' especificada não foi encontrada.` });
      }
      resolvedStoreTenantId = storeSnap.data()?.tenantId;
    }

    const tenantId = isMarketplaceConsumerRole(targetRole)
      ? 'tenant-1'
      : (req.body.tenantId || resolvedStoreTenantId || authenticatedUser.tenantId || 'tenant-1');

    const passwordHashStr = await hashPasswordAsync(password);

    const uid = generateUserId();
    const nowIso = new Date().toISOString();
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const sanitizedBlockedApps = sanitizeStringArray(blockedApps);
    const sanitizedPermissions = sanitizeStringArray(permissions);
    const courierConfig = targetRole === 'COURIER'
      ? resolveCourierFleetConfig({
          storeId: effectiveStoreId,
          requestedFleetType: fleetType,
          requestedAllowedModes: allowedFleetModes,
          requestedVehicle: vehicle,
          requestedVehiclePlate: vehiclePlate,
        })
      : null;

    const userDoc: Record<string, any> = {
      uid,
      id: uid,
      name: name || 'Novo Usuário',
      email: normalizedEmail,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      role: targetRole,
      tenantId,
      storeId: effectiveStoreId,
      ...(courierConfig ? {
        fleetType: courierConfig.fleetType,
        allowedFleetModes: courierConfig.allowedFleetModes,
        vehicle: courierConfig.vehicle,
        ...(courierConfig.vehiclePlate ? { vehiclePlate: courierConfig.vehiclePlate } : {}),
      } : {}),
      ...(sanitizedPermissions ? { permissions: sanitizedPermissions } : {}),
      ...(sanitizedBlockedApps ? { blockedApps: sanitizedBlockedApps } : {}),
      passwordHash: passwordHashStr,
      emailVerified: false,
      createdAt: nowIso,
      status: 'ACTIVE'
    };

    await db.runTransaction(async (transaction) => {
      const existingUsers = await db.collection('users').get();
      if (existingUsers.docs.some(d => !d.data()?._deleted && d.data()?.email?.toLowerCase() === normalizedEmail)) {
        const err: any = new Error('E-mail já cadastrado na plataforma.');
        err.statusCode = 409;
        throw err;
      }

      transaction.set(db.collection('users').doc(uid), userDoc, { merge: true });
      if (targetRole === 'DEV_OWNER') {
        transaction.set(db.collection('admins').doc(uid), { uid, role: 'DEV_OWNER', email: normalizedEmail }, { merge: true });
      } else if (targetRole === 'COURIER' && courierConfig) {
        transaction.set(
          db.collection('drivers').doc(uid),
          {
            id: uid,
            uid,
            name: userDoc.name,
            phone: cleanPhone,
            vehicle: courierConfig.vehicle,
            ...(courierConfig.vehiclePlate ? { vehiclePlate: courierConfig.vehiclePlate } : {}),
            rating: 5.0,
            status: 'AVAILABLE',
            fleetType: courierConfig.fleetType,
            allowedFleetModes: courierConfig.allowedFleetModes,
            activeOperationMode: courierConfig.fleetType === 'STORE_FLEET' && effectiveStoreId ? 'STORE' : 'PLATFORM',
            accountStatus: 'ACTIVE',
            hqManaged: true,
            storeId: effectiveStoreId,
            totalDeliveries: 0,
            walletBalance: 0,
            avatar: '',
            tenantId,
            createdAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } else if (isMarketplaceConsumerRole(targetRole)) {
        transaction.set(
          db.collection('consumers').doc(uid),
          {
            id: uid,
            uid,
            name: userDoc.name,
            email: normalizedEmail,
            phone: cleanPhone,
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
      }
    });

    const { passwordHash: _omitted, ...safeUser } = userDoc;
    await recordAdminAuditEvent(
      'USER_CREATED_BY_HQ',
      `Conta ${normalizedEmail} criada como ${targetRole} (${isMarketplaceConsumerRole(targetRole) ? 'Marketplace Público' : `tenant ${tenantId}`})`,
      'hq/security',
      tenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'users',
        resourceId: uid,
        before: null,
        after: safeUser,
      }
    );

    res.status(201).json({ uid, user: safeUser });
  } catch (error: any) {
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.warn('Notice creating user:', error?.message || error);
    res.status(500).json({ error: 'Falha ao criar conta de usuário no sistema.' });
  }
});

router.put('/users/:uid', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { uid } = req.params;
    const { role, tenantId: reqTenantId, storeId, allowedStoreIds, status, name, phone, blockedApps, permissions, fleetType, allowedFleetModes, vehicle, vehiclePlate } = req.body || {};
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const callerRole = authenticatedUser.role || 'GUEST';

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const targetUser = userSnap.data();
    const targetCurrentRole = normalizeUserRole(targetUser?.role || 'CUSTOMER');

    if (callerRole === 'SUPER_ADMIN' && (targetCurrentRole === 'DEV_OWNER' || targetCurrentRole === 'SUPER_ADMIN') && uid !== authenticatedUser.uid) {
      return res.status(403).json({ error: 'Acesso negado: SUPER_ADMIN não pode alterar contas DEV_OWNER ou outro SUPER_ADMIN.' });
    }

    let normalizedNextRoleInput: string | undefined;
    if (role !== undefined) {
      normalizedNextRoleInput = normalizeUserRole(role);
      if (!Object.prototype.hasOwnProperty.call(ROLE_LEVELS, normalizedNextRoleInput) || normalizedNextRoleInput === 'GUEST') {
        return res.status(400).json({ error: `Perfil '${role}' inválido.` });
      }
      if (callerRole !== 'DEV_OWNER' && ROLE_LEVELS[normalizedNextRoleInput] >= ROLE_LEVELS[callerRole]) {
        return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode promover usuário para '${normalizedNextRoleInput}'.` });
      }
    }

    if (status !== undefined && !['ACTIVE', 'DISABLED', 'PENDING_ACTIVATION'].includes(status)) {
      return res.status(400).json({ error: `Status '${status}' inválido.` });
    }

    if (uid === authenticatedUser.uid && status === 'DISABLED') {
      return res.status(400).json({ error: 'Operação bloqueada: Você não pode suspender a própria conta em uso.' });
    }

    const nextRole = normalizedNextRoleInput ?? targetCurrentRole;
    const currentStatus = targetUser?.disabled === true ? 'DISABLED' : (targetUser?.status || 'ACTIVE');
    const nextStatus = status ?? currentStatus;
    const sanitizedBlockedApps = sanitizeStringArray(blockedApps);
    const sanitizedPermissions = sanitizeStringArray(permissions);
    const existingBlocked = Array.isArray(targetUser?.blockedApps) ? [...targetUser.blockedApps].sort() : [];
    const existingPerms = Array.isArray(targetUser?.permissions) ? [...targetUser.permissions].sort() : [];
    const blockedAppsChanged =
      sanitizedBlockedApps !== undefined &&
      JSON.stringify([...sanitizedBlockedApps].sort()) !== JSON.stringify(existingBlocked);
    const permissionsChanged =
      sanitizedPermissions !== undefined &&
      JSON.stringify([...sanitizedPermissions].sort()) !== JSON.stringify(existingPerms);

    const isSecurityStateChanged =
      nextRole !== targetCurrentRole ||
      nextStatus !== currentStatus ||
      (storeId !== undefined && storeId !== targetUser?.storeId) ||
      blockedAppsChanged ||
      permissionsChanged ||
      fleetType !== undefined ||
      allowedFleetModes !== undefined;

    const nextTokenVersion = isSecurityStateChanged
      ? (Number(targetUser?.tokenVersion) || 1) + 1
      : (targetUser?.tokenVersion || 1);
    const nowSec = Math.floor(Date.now() / 1000);

    if (targetCurrentRole === 'DEV_OWNER' && (nextRole !== 'DEV_OWNER' || nextStatus !== 'ACTIVE')) {
      const allUsersSnap = await db.collection('users').get();
      const activeDevOwners = allUsersSnap.docs
        .map(d => d.data())
        .filter(u => !u?._deleted && u?.role === 'DEV_OWNER' && u?.status !== 'DISABLED' && u?.disabled !== true);
      if (activeDevOwners.length <= 1 && activeDevOwners.some(u => u.uid === uid || u.id === uid)) {
        return res.status(400).json({ error: 'Operação bloqueada: Não é permitido rebaixar ou desativar o último DEV_OWNER ativo da plataforma.' });
      }
    }

    let resolvedTenantId = targetUser?.tenantId || 'tenant-1';
    let resolvedStoreId = STORE_SCOPED_ROLE_SET.has(nextRole)
      ? (storeId !== undefined ? (storeId || null) : targetUser?.storeId)
      : null;

    if (isMarketplaceConsumerRole(nextRole)) {
      resolvedTenantId = 'tenant-1';
      resolvedStoreId = null;
    } else if (resolvedStoreId) {
      const storeSnap = await db.collection('stores').doc(String(resolvedStoreId)).get();
      if (!storeSnap.exists || storeSnap.data()?._deleted) {
        return res.status(400).json({ error: `Loja '${resolvedStoreId}' não encontrada.` });
      }
      const storeTenantId = storeSnap.data()?.tenantId;
      if (storeTenantId) {
        resolvedTenantId = storeTenantId;
      }
    } else if (reqTenantId) {
      resolvedTenantId = String(reqTenantId);
    }

    const sanitizedAllowedStores = sanitizeStringArray(allowedStoreIds);
    const nextAllowedStoreIds =
      sanitizedAllowedStores !== undefined
        ? sanitizedAllowedStores
        : storeId !== undefined && !resolvedStoreId
        ? []
        : undefined;

    const courierConfig = nextRole === 'COURIER'
      ? resolveCourierFleetConfig({
          storeId: resolvedStoreId,
          requestedFleetType: fleetType,
          requestedAllowedModes: allowedFleetModes,
          requestedVehicle: vehicle,
          requestedVehiclePlate: vehiclePlate,
          existingUser: targetUser,
        })
      : null;

    const patch: Record<string, any> = {
      role: nextRole,
      tenantId: resolvedTenantId,
      storeId: resolvedStoreId ?? null,
      ...(nextAllowedStoreIds !== undefined ? { allowedStoreIds: nextAllowedStoreIds } : {}),
      ...(courierConfig ? {
        fleetType: courierConfig.fleetType,
        allowedFleetModes: courierConfig.allowedFleetModes,
        vehicle: courierConfig.vehicle,
        vehiclePlate: courierConfig.vehiclePlate,
      } : {}),
      status: nextStatus,
      disabled: nextStatus === 'DISABLED',
      tokenVersion: nextTokenVersion,
      ...(typeof name === 'string' && name.trim().length >= 2 ? { name: name.trim() } : {}),
      ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
      ...(sanitizedBlockedApps !== undefined ? { blockedApps: sanitizedBlockedApps } : {}),
      ...(sanitizedPermissions !== undefined ? { permissions: sanitizedPermissions } : {}),
      ...(isSecurityStateChanged ? { tokenRevokedAtSec: nowSec } : {}),
      updatedAt: new Date().toISOString(),
    };

    await db.runTransaction(async (transaction) => {
      const adminRef = db.collection('admins').doc(uid);
      const consumerRef = db.collection('consumers').doc(uid);
      const driverRef = db.collection('drivers').doc(uid);
      const [adminSnap, consumerSnap, driverSnap] = await Promise.all([
        transaction.get(adminRef),
        transaction.get(consumerRef),
        transaction.get(driverRef),
      ]);

      transaction.update(userRef, patch);

      if (nextRole === 'DEV_OWNER') {
        transaction.set(adminRef, { uid, role: 'DEV_OWNER', email: targetUser?.email || '' }, { merge: true });
      } else if (targetCurrentRole === 'DEV_OWNER' && adminSnap.exists) {
        transaction.delete(adminRef);
      }

      if (nextRole === 'COURIER' && courierConfig) {
        const existingDrv = driverSnap.exists ? driverSnap.data() || {} : {};
        const nextDrvStatus = nextStatus === 'DISABLED'
          ? 'OFFLINE'
          : (existingDrv.status || 'AVAILABLE');
        const preferredMode =
          courierConfig.allowedFleetModes.includes('STORE_FLEET') &&
          existingDrv.activeOperationMode === 'STORE' &&
          resolvedStoreId
            ? 'STORE'
            : courierConfig.allowedFleetModes.includes('PLATFORM_FLEET') &&
              existingDrv.activeOperationMode === 'PLATFORM'
            ? 'PLATFORM'
            : courierConfig.fleetType === 'STORE_FLEET' && resolvedStoreId
            ? 'STORE'
            : 'PLATFORM';
        transaction.set(
          driverRef,
          {
            id: uid,
            uid,
            name: patch.name || targetUser?.name || existingDrv.name || 'Entregador Parceiro',
            phone: patch.phone ?? targetUser?.phone ?? existingDrv.phone ?? '',
            vehicle: courierConfig.vehicle || existingDrv.vehicle || 'SCOOTER',
            vehiclePlate: courierConfig.vehiclePlate || existingDrv.vehiclePlate || '',
            rating: typeof existingDrv.rating === 'number' ? existingDrv.rating : 5.0,
            status: nextDrvStatus,
            fleetType: courierConfig.fleetType,
            allowedFleetModes: courierConfig.allowedFleetModes,
            activeOperationMode: preferredMode,
            accountStatus: nextStatus,
            hqManaged: true,
            storeId: resolvedStoreId ?? null,
            totalDeliveries: Number(existingDrv.totalDeliveries) || 0,
            walletBalance: Number(existingDrv.walletBalance) || 0,
            avatar: existingDrv.avatar && !String(existingDrv.avatar).startsWith('/src/assets/') ? existingDrv.avatar : '',
            tenantId: resolvedTenantId,
            createdAt: existingDrv.createdAt || patch.updatedAt,
            updatedAt: patch.updatedAt,
          },
          { merge: true }
        );
      } else if (targetCurrentRole === 'COURIER' && nextRole !== 'COURIER' && driverSnap.exists) {
        transaction.update(driverRef, {
          status: 'OFFLINE',
          accountStatus: 'DISABLED',
          updatedAt: patch.updatedAt,
        });
      }

      if (
        isMarketplaceConsumerRole(nextRole) &&
        consumerSnap.exists &&
        (typeof name === 'string' || typeof phone === 'string')
      ) {
        transaction.set(
          consumerRef,
          {
            ...(typeof name === 'string' && name.trim().length >= 2 ? { name: name.trim() } : {}),
            ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
            updatedAt: patch.updatedAt,
          },
          { merge: true }
        );
      }
    });

    if (isSecurityStateChanged) {
      await revokeAuthSessionEverywhere(uid, { disabled: nextStatus === 'DISABLED' });
      if (nextStatus === 'DISABLED') {
        broadcastUserSseEvent(uid, 'USER_SUSPENDED', { status: 'DISABLED' });
      } else {
        broadcastUserSseEvent(uid, 'USER_ROLE_UPDATED', {
          role: nextRole,
          tenantId: resolvedTenantId,
          storeId: resolvedStoreId ?? null,
          status: nextStatus,
          blockedApps: sanitizedBlockedApps ?? existingBlocked,
        });
      }
    }

    const auditEventType =
      nextStatus !== currentStatus
        ? nextStatus === 'DISABLED'
          ? 'USER_SUSPENDED_BY_HQ'
          : 'USER_REACTIVATED_BY_HQ'
        : 'USER_ROLE_UPDATE';

    const auditSummary =
      nextStatus !== currentStatus
        ? `Conta ${targetUser?.email || uid} (${nextRole}) teve status alterado para ${nextStatus} pelo HQ`
        : `Usuário ${targetUser?.email || uid} atualizado para ${nextRole} (${isMarketplaceConsumerRole(nextRole) ? 'Marketplace Público' : `tenant ${resolvedTenantId}`})`;

    const { passwordHash: _omitted, ...safeUser } = { ...targetUser, ...patch };
    await recordAdminAuditEvent(
      auditEventType,
      auditSummary,
      'hq/security',
      resolvedTenantId,
      {
        req,
        actor: authenticatedUser,
        resourceType: 'users',
        resourceId: uid,
        before: {
          role: targetCurrentRole,
          status: currentStatus,
          tenantId: targetUser?.tenantId,
          storeId: targetUser?.storeId ?? null,
        },
        after: {
          role: nextRole,
          status: nextStatus,
          tenantId: resolvedTenantId,
          storeId: resolvedStoreId ?? null,
        },
      }
    );

    res.json({ success: true, user: safeUser });
  } catch {
    res.status(500).json({ error: 'Falha ao atualizar usuário.' });
  }
});

router.use(userSecurityLifecycleCore);

export default router;
