import { db } from '../../config.ts';
import { isMarketplaceConsumerRole } from './adminHelpersCore.ts';

const VALID_FLEET_MODES = new Set(['PLATFORM_FLEET', 'STORE_FLEET']);
const VALID_VEHICLES = new Set(['SCOOTER', 'BIKE', 'CAR']);

export function resolveCourierFleetConfig(params: {
  storeId?: string | null;
  requestedFleetType?: unknown;
  requestedAllowedModes?: unknown;
  requestedVehicle?: unknown;
  requestedVehiclePlate?: unknown;
  existingUser?: Record<string, any> | null;
}) {
  const hasStore = Boolean(params.storeId);
  const rawFleet =
    typeof params.requestedFleetType === 'string' ? params.requestedFleetType.trim().toUpperCase() : '';
  const fallbackFleet =
    (typeof params.existingUser?.fleetType === 'string' &&
    VALID_FLEET_MODES.has(params.existingUser.fleetType.toUpperCase())
      ? params.existingUser.fleetType.toUpperCase()
      : '') || (hasStore ? 'STORE_FLEET' : 'PLATFORM_FLEET');
  const resolvedFleetType: 'PLATFORM_FLEET' | 'STORE_FLEET' = (
    VALID_FLEET_MODES.has(rawFleet) ? rawFleet : fallbackFleet
  ) as 'PLATFORM_FLEET' | 'STORE_FLEET';

  let allowedFleetModes: ('PLATFORM_FLEET' | 'STORE_FLEET')[] = [];
  if (Array.isArray(params.requestedAllowedModes)) {
    allowedFleetModes = Array.from(
      new Set(
        params.requestedAllowedModes
          .map((m) => String(m || '').trim().toUpperCase())
          .filter((m): m is 'PLATFORM_FLEET' | 'STORE_FLEET' => VALID_FLEET_MODES.has(m))
      )
    );
  } else if (
    Array.isArray(params.existingUser?.allowedFleetModes) &&
    params.existingUser.allowedFleetModes.length > 0 &&
    params.requestedFleetType === undefined
  ) {
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

  const finalFleetType: 'PLATFORM_FLEET' | 'STORE_FLEET' = !hasStore
    ? 'PLATFORM_FLEET'
    : allowedFleetModes.includes(resolvedFleetType)
    ? resolvedFleetType
    : allowedFleetModes[0];

  const rawVehicle =
    typeof params.requestedVehicle === 'string' ? params.requestedVehicle.trim().toUpperCase() : '';
  const existingVehicle =
    typeof params.existingUser?.vehicle === 'string' ? params.existingUser.vehicle.toUpperCase() : '';
  const vehicle = (
    VALID_VEHICLES.has(rawVehicle) ? rawVehicle : VALID_VEHICLES.has(existingVehicle) ? existingVehicle : 'SCOOTER'
  ) as 'SCOOTER' | 'BIKE' | 'CAR';

  const vehiclePlate =
    typeof params.requestedVehiclePlate === 'string'
      ? params.requestedVehiclePlate.trim().toUpperCase()
      : typeof params.existingUser?.vehiclePlate === 'string'
      ? params.existingUser.vehiclePlate
      : '';

  return {
    fleetType: finalFleetType,
    allowedFleetModes,
    vehicle,
    vehiclePlate,
  };
}

export async function attachConsumerStatsToUserPage(items: any[]): Promise<any[]> {
  if (items.length === 0) return items;
  const pageUids = new Set(items.map((u: any) => String(u.uid)));
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
        orderDate && (!prev.lastOrderAt || orderDate > prev.lastOrderAt) ? orderDate : prev.lastOrderAt;
      consumerStatsByUid.set(cid, {
        count: prev.count + 1,
        totalSpent: Number(nextTotal.toFixed(2)),
        lastOrderAt: nextLast,
      });
    }
  }

  return items.map((u: any) => {
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

export async function syncUpdatedUserSideCollectionsTx(params: {
  transaction: any;
  uid: string;
  userRef: any;
  patch: Record<string, any>;
  targetUser: Record<string, any> | undefined;
  targetCurrentRole: string;
  nextRole: string;
  nextStatus: string;
  resolvedTenantId: string;
  resolvedStoreId: string | null;
  courierConfig: ReturnType<typeof resolveCourierFleetConfig> | null;
  name?: unknown;
  phone?: unknown;
}) {
  const {
    transaction,
    uid,
    userRef,
    patch,
    targetUser,
    targetCurrentRole,
    nextRole,
    nextStatus,
    resolvedTenantId,
    resolvedStoreId,
    courierConfig,
    name,
    phone,
  } = params;

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
    const nextDrvStatus = nextStatus === 'DISABLED' ? 'OFFLINE' : existingDrv.status || 'AVAILABLE';
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
}
