import express from 'express';
import { db, runWithSystemDbContext } from '../../config.ts';
import { verifyAutonomousToken, hasUserStoreAccess } from '../../middleware/auth.ts';

const router = express.Router();

function resolveCourierScope(authenticatedUser: any, driverData?: Record<string, any> | null) {
  const storeId = driverData?.storeId ?? authenticatedUser?.storeId ?? null;
  const fallbackFleet = driverData?.fleetType || (storeId ? 'STORE_FLEET' : 'PLATFORM_FLEET');
  const rawAllowed = Array.isArray(driverData?.allowedFleetModes) && driverData.allowedFleetModes.length > 0
    ? driverData.allowedFleetModes
    : [fallbackFleet];
  const allowedModes = new Set<string>(rawAllowed);
  if (storeId && !driverData?.allowedFleetModes) {
    allowedModes.add('STORE_FLEET');
  }
  return {
    storeId: storeId ? String(storeId) : null,
    allowedPlatform: allowedModes.has('PLATFORM_FLEET'),
    allowedStore: allowedModes.has('STORE_FLEET') && Boolean(storeId),
  };
}

function canCourierViewOrder(order: any, authenticatedUser: any, scope: ReturnType<typeof resolveCourierScope>): boolean {
  const userTenant = authenticatedUser.tenantId || 'tenant-1';
  if (order.tenantId !== userTenant) return false;
  if (order.driverId === authenticatedUser.uid) return true;
  if (order.status !== 'READY_FOR_PICKUP' || order.driverId) return false;
  if (scope.allowedPlatform && order.deliveryModality === 'PLATFORM_FLEET') return true;
  if (scope.allowedStore && scope.storeId && order.storeId === scope.storeId) return true;
  return false;
}

router.get('/orders', verifyAutonomousToken, async (req, res) => {
  try {
    const { storeId } = req.query;
    const authenticatedUser = (req as any).user;
    const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const snap = isConsumer
      ? await runWithSystemDbContext('CONSUMER_ORDERS_LIST', () =>
          db.collection('orders').query({
            customerId: authenticatedUser.uid,
            ...(storeId ? { storeId: String(storeId) } : {}),
          })
        )
      : await db.collection('orders').get();
    let orders = snap.docs.map((d) => d.data()).filter((o) => o && !o._deleted);

    if (isConsumer) {
      orders = orders.filter((o) => o.customerId === authenticatedUser.uid);
    } else if (authenticatedUser.role === 'COURIER') {
      const driverSnap = await db.collection('drivers').doc(authenticatedUser.uid).get();
      const scope = resolveCourierScope(authenticatedUser, driverSnap.exists ? driverSnap.data() : null);
      orders = orders.filter((o) => canCourierViewOrder(o, authenticatedUser, scope));
    } else if (authenticatedUser.role !== 'DEV_OWNER') {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      orders = orders.filter((o) => o.tenantId === userTenant && hasUserStoreAccess(authenticatedUser, o.storeId));
    }

    if (storeId) {
      orders = orders.filter((o) => o.storeId === storeId);
    }

    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(orders);
  } catch {
    res.status(500).json({ error: 'Erro ao listar pedidos.' });
  }
});

router.get('/orders/:id', verifyAutonomousToken, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user;
    const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const doc = isConsumer
      ? await runWithSystemDbContext('CONSUMER_ORDER_GET', () => db.collection('orders').doc(req.params.id).get())
      : await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists || doc.data()?._deleted) {
      return res.status(404).json({ error: 'Pedido não encontrado.' });
    }

    const order = doc.data();

    if (isConsumer) {
      if (order.customerId !== authenticatedUser.uid) {
        return res.status(403).json({ error: 'Acesso negado: Pedido pertence a outro consumidor.' });
      }
    } else if (authenticatedUser.role === 'COURIER') {
      const driverSnap = await db.collection('drivers').doc(authenticatedUser.uid).get();
      const scope = resolveCourierScope(authenticatedUser, driverSnap.exists ? driverSnap.data() : null);
      if (!canCourierViewOrder(order, authenticatedUser, scope)) {
        return res.status(403).json({ error: 'Acesso negado: Pedido não atribuído ao entregador.' });
      }
    } else if (authenticatedUser.role !== 'DEV_OWNER') {
      if (!order.tenantId || order.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Pedido pertence a outra empresa/tenant.' });
      }
      if (!hasUserStoreAccess(authenticatedUser, order.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Pedido pertence a outra filial.' });
      }
    }

    res.json(order);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar pedido.' });
  }
});

export default router;
