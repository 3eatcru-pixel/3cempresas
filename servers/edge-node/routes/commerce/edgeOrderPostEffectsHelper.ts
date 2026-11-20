import { buildSyncOutboxEntry } from '../../../../src/server/persistence/PersistenceDriver.ts';
import { SqliteWalDriver } from '../../../../src/server/persistence/SqliteWalDriver.ts';
import { generateIdempotencyKey } from '@3c/commerce-engine';

export async function applyEdgeOrderPostEffects(params: {
  tx: any;
  driver: SqliteWalDriver;
  tenantId: string;
  storeId: string;
  nodeId: string;
  hlc: string;
  nowIso: string;
  orderId: string;
  orderCode: string;
  channel: string;
  paymentMethod: string;
  validatedTotal: number;
  isEdgeOrderPaid: boolean;
  tableNumber?: any;
  reservationId?: any;
  crmCustomerId?: any;
  callerScopedEdgeIdemId: string | null;
  explicitIdempotencyKey: string | null;
  callerUid?: string;
}): Promise<void> {
  const {
    tx,
    driver,
    tenantId,
    storeId,
    nodeId,
    hlc,
    nowIso,
    orderId,
    orderCode,
    channel,
    paymentMethod,
    validatedTotal,
    isEdgeOrderPaid,
    tableNumber,
    reservationId,
    crmCustomerId,
    callerScopedEdgeIdemId,
    explicitIdempotencyKey,
    callerUid,
  } = params;

  if (paymentMethod !== 'TABLE_BILL' && validatedTotal > 0) {
    const finId = `fin-ord-${orderId}`;
    const finRecord = {
      id: finId,
      tenantId,
      storeId,
      type: 'RECEIVABLE',
      category: 'VENDAS',
      description: `Venda Edge ${channel} ${orderCode} (${paymentMethod})`,
      amount: validatedTotal,
      dueDate: nowIso.split('T')[0],
      status: isEdgeOrderPaid ? 'PAID' : 'PENDING',
      ...(isEdgeOrderPaid ? { paidAt: nowIso } : {}),
      orderId,
      hlc,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    tx.set({ collectionName: 'financial_records', id: finId }, finRecord, { merge: false });
    const finOutbox = buildSyncOutboxEntry({
      entity: 'financial_records',
      entityId: finId,
      operation: 'UPSERT',
      tenantId,
      storeId,
      nodeId,
      hlc,
      idempotencyKey: generateIdempotencyKey(),
      payload: finRecord,
    });
    tx.set({ collectionName: 'sync_outbox', id: finOutbox.id }, finOutbox, { merge: false });

    const openCashSession = isEdgeOrderPaid
      ? (await driver.listDocs<any>('cash_sessions'))
          .filter((s) => s.storeId === storeId && s.status === 'OPEN' && !s._deleted)
          .sort((a, b) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime())[0]
      : null;

    if (openCashSession) {
      const nextTotalSales = Math.round(((Number(openCashSession.totalSales) || 0) + validatedTotal) * 100) / 100;
      const nextFinalCash = Math.round(((Number(openCashSession.finalCashCalculated) || 0) + validatedTotal) * 100) / 100;
      const updatedSession = {
        ...openCashSession,
        totalSales: nextTotalSales,
        finalCashCalculated: nextFinalCash,
        hlc,
        updatedAt: nowIso,
      };
      tx.update({ collectionName: 'cash_sessions', id: openCashSession.id }, {
        totalSales: nextTotalSales,
        finalCashCalculated: nextFinalCash,
        hlc,
        updatedAt: nowIso,
      });
      const cashOutbox = buildSyncOutboxEntry({
        entity: 'cash_sessions',
        entityId: openCashSession.id,
        operation: 'UPSERT',
        tenantId,
        storeId,
        nodeId,
        hlc,
        idempotencyKey: generateIdempotencyKey(),
        payload: updatedSession,
      });
      tx.set({ collectionName: 'sync_outbox', id: cashOutbox.id }, cashOutbox, { merge: false });
    }
  }

  if ((channel === 'TABLE' || channel === 'WAITER_TABLE') && tableNumber) {
    const matchingTable = (await driver.listDocs<any>('tables')).find(
      (t) => !t._deleted && t.tableNumber === Number(tableNumber) && (!t.storeId || t.storeId === storeId)
    );
    if (matchingTable) {
      const updatedTable = {
        ...matchingTable,
        status: 'OCCUPIED',
        hlc,
        updatedAt: nowIso,
      };
      tx.update({ collectionName: 'tables', id: matchingTable.id }, {
        status: 'OCCUPIED',
        hlc,
        updatedAt: nowIso,
      });
      const tableOutbox = buildSyncOutboxEntry({
        entity: 'tables',
        entityId: matchingTable.id,
        operation: 'UPSERT',
        tenantId,
        storeId,
        nodeId,
        hlc,
        idempotencyKey: generateIdempotencyKey(),
        payload: updatedTable,
      });
      tx.set({ collectionName: 'sync_outbox', id: tableOutbox.id }, tableOutbox, { merge: false });
    }
  }

  if (reservationId && typeof reservationId === 'string') {
    const resSnap = await tx.get({ collectionName: 'reservations', id: reservationId });
    if (resSnap.exists) {
      const resData = resSnap.data();
      if ((!resData.tenantId || resData.tenantId === tenantId) && (!resData.storeId || resData.storeId === storeId)) {
        const updatedRes = { ...resData, status: 'COMPLETED', hlc, updatedAt: nowIso };
        tx.update({ collectionName: 'reservations', id: reservationId }, { status: 'COMPLETED', hlc, updatedAt: nowIso });
        const resOutbox = buildSyncOutboxEntry({
          entity: 'reservations',
          entityId: reservationId,
          operation: 'UPSERT',
          tenantId,
          storeId,
          nodeId,
          hlc,
          idempotencyKey: generateIdempotencyKey(),
          payload: updatedRes,
        });
        tx.set({ collectionName: 'sync_outbox', id: resOutbox.id }, resOutbox, { merge: false });
      }
    }
  }

  if (typeof crmCustomerId === 'string' && crmCustomerId.trim().length > 0) {
    const crmSnap = await tx.get({ collectionName: 'customers_crm', id: crmCustomerId.trim() });
    if (crmSnap.exists) {
      const existingCrm = crmSnap.data() || {};
      if (
        (!existingCrm.storeId || existingCrm.storeId === storeId) &&
        (!existingCrm.tenantId || existingCrm.tenantId === tenantId)
      ) {
        const nextOrders = (Number(existingCrm.totalOrders) || 0) + 1;
        const nextSpent = Math.round(((Number(existingCrm.totalSpent) || 0) + validatedTotal) * 100) / 100;
        const nextPoints = (Number(existingCrm.loyaltyPoints) || 0) + Math.max(1, Math.floor(validatedTotal));
        const nextTier =
          nextSpent >= 1000 || nextOrders >= 15
            ? 'GOLD'
            : nextSpent >= 300 || nextOrders >= 5
            ? 'SILVER'
            : 'BRONZE';
        const updatedCrm = {
          ...existingCrm,
          totalOrders: nextOrders,
          totalSpent: nextSpent,
          loyaltyPoints: nextPoints,
          loyaltyTier: nextTier,
          lastOrderDate: nowIso.slice(0, 10),
          hlc,
          updatedAt: nowIso,
        };
        tx.set({ collectionName: 'customers_crm', id: crmCustomerId.trim() }, updatedCrm, { merge: true });
        const crmOutbox = buildSyncOutboxEntry({
          entity: 'customers_crm',
          entityId: crmCustomerId.trim(),
          operation: 'UPSERT',
          tenantId,
          storeId,
          nodeId,
          hlc,
          idempotencyKey: generateIdempotencyKey(),
          payload: updatedCrm,
        });
        tx.set({ collectionName: 'sync_outbox', id: crmOutbox.id }, crmOutbox, { merge: false });
      }
    }
  }

  if (callerScopedEdgeIdemId && explicitIdempotencyKey) {
    tx.set(
      { collectionName: 'order_idempotency_keys', id: callerScopedEdgeIdemId },
      {
        id: callerScopedEdgeIdemId,
        rawKey: explicitIdempotencyKey,
        callerUid: callerUid || 'anon',
        orderId,
        storeId,
        tenantId,
        createdAt: nowIso,
      },
      { merge: false }
    );
  }
}
