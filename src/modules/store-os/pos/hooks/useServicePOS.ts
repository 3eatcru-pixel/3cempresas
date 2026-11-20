import { useState, useMemo } from 'react';
import { MenuItem, AdminUser, Reservation, Store, CustomerCRM } from '../../../../types';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';
import { StorageService } from '../../../../services/StorageService';
import { syncEngine } from '../../../../core/sync/SyncEngine';

interface UseServicePOSParams {
  currentStore: Store;
  adminUsers: AdminUser[];
  users: AdminUser[];
  menuItems: MenuItem[];
  reservations: Reservation[];
  createPosOrder: (
    customerName: string,
    items: any[],
    paymentMethod: any,
    discount?: number,
    couponCode?: string,
    channel?: 'POS' | 'KIOSK',
    options?: any
  ) => Promise<any>;
  addFinancialRecord: (record: any) => Promise<any>;
  updateReservationStatus: (id: string, status: any) => Promise<any>;
  showNotification: (msg: string) => void;
}

export function useServicePOS({
  currentStore,
  adminUsers,
  users,
  menuItems,
  reservations,
  createPosOrder,
  addFinancialRecord,
  updateReservationStatus,
  showNotification,
}: UseServicePOSParams) {
  const [selectedProfessional, setSelectedProfessional] = useState<AdminUser | null>(null);
  const [selectedServices, setSelectedServices] = useState<{ menuItem: MenuItem; qty: number }[]>([]);
  const [clientName, setClientName] = useState<string>('');
  const [selectedCrmCustomer, setSelectedCrmCustomer] = useState<CustomerCRM | null>(null);
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null);
  const [commissionRate, setCommissionRate] = useState<number>(10);
  const [lastOrderForReceipt, setLastOrderForReceipt] = useState<any | null>(null);
  const [step, setStep] = useState<'PROFESSIONAL' | 'SERVICES' | 'CHECKOUT'>('PROFESSIONAL');

  // Strict storeId scoping (with store-owner fallback if store has no dedicated staff assigned yet)
  const professionals: AdminUser[] = useMemo(() => {
    const merged = [...adminUsers, ...users];
    const storeStaff = merged.filter((u) => u.storeId === currentStore.id);
    const deduped = Array.from(
      new Map(storeStaff.map((u) => [u.id || u.uid || u.email, u])).values()
    );
    if (deduped.length > 0) return deduped;
    return [
      {
        id: `pro-owner-${currentStore.id}`,
        name: `Atendente (${currentStore.name})`,
        email: currentStore.phone || 'atendimento@loja.com',
        role: 'STORE_OWNER',
        storeId: currentStore.id,
        tenantId: currentStore.tenantId || currentStore.id,
        permissions: ['ALL'],
        status: 'ACTIVE',
        lastLogin: new Date().toISOString(),
      },
    ];
  }, [adminUsers, users, currentStore]);

  const serviceItems = useMemo(
    () => menuItems.filter((m) => m.storeId === currentStore.id && m.isAvailable !== false),
    [menuItems, currentStore.id]
  );

  const pendingReservations = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.storeId === currentStore.id &&
          (r.status === 'CONFIRMED' || r.status === 'PENDING')
      ),
    [reservations, currentStore.id]
  );

  const addService = (item: MenuItem) => {
    setSelectedServices((prev) => {
      const existing = prev.find((i) => i.menuItem.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.menuItem.id === item.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { menuItem: item, qty: 1 }];
    });
  };

  const updateServiceQty = (id: string, delta: number) => {
    setSelectedServices((prev) =>
      prev
        .map((i) =>
          i.menuItem.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i
        )
        .filter((i) => i.qty > 0)
    );
  };

  const removeService = (id: string) => {
    setSelectedServices((prev) => prev.filter((i) => i.menuItem.id !== id));
  };

  const handleCheckInReservation = (res: Reservation) => {
    const matchedPro =
      professionals.find((p) =>
        p.name.toLowerCase().includes((res.professional || '').toLowerCase())
      ) || professionals[0];

    setSelectedProfessional(matchedPro);
    setClientName(res.clientName);
    setActiveReservation(res);

    const matchedItem = serviceItems.find(
      (it) =>
        it.name.toLowerCase() === (res.serviceOrTable || '').toLowerCase() ||
        (res.serviceOrTable || '').toLowerCase().includes(it.name.toLowerCase())
    );
    if (matchedItem) {
      setSelectedServices([{ menuItem: matchedItem, qty: 1 }]);
    } else {
      setSelectedServices([]);
    }
    setStep('SERVICES');
    showNotification(`Check-in iniciado para ${res.clientName}!`);
  };

  const total = selectedServices.reduce((acc, i) => acc + i.menuItem.price * i.qty, 0);
  const commissionAmount = Number(((total * commissionRate) / 100).toFixed(2));

  const handleFinish = async (
    method:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK' = 'CREDIT_CARD'
  ) => {
    if (!selectedProfessional || selectedServices.length === 0) return;
    const customerLabel =
      selectedCrmCustomer?.name || clientName.trim() || `Cliente de ${selectedProfessional.name}`;

    const platform = getPlatformAdapters();
    const resolvedNotes = activeReservation
      ? `Agendamento #${activeReservation.id} (${activeReservation.time})`
      : `Atendimento presencial com ${selectedProfessional.name}`;
    const offlineFallback = {
      storeId: currentStore.id,
      channel: 'POS',
      deliveryModality: 'PICKUP',
      code: `#OFF-${Math.floor(1000 + Math.random() * 9000)}`,
      customerName: customerLabel,
      items: selectedServices.map((s) => ({
        ...s.menuItem,
        menuItemId: s.menuItem.id,
        quantity: s.qty,
      })),
      total,
      paymentMethod: method,
      notes: resolvedNotes,
      professionalId: selectedProfessional.id,
      professionalName: selectedProfessional.name,
      commissionRate,
      commissionAmount,
      ...(activeReservation ? { reservationId: activeReservation.id } : {}),
      createdAt: new Date().toISOString(),
    };

    let order: any = null;
    let usedOfflineFallback = false;
    if (!platform.network.isOnline() && !platform.network.getEdgeBaseUrl()) {
      usedOfflineFallback = true;
      await StorageService.saveOfflineOrder(offlineFallback);
      await syncEngine.refreshCounts();
      order = offlineFallback;
      showNotification('Sem internet! Atendimento salvo na fila offline.');
    } else {
      try {
        order = await createPosOrder(
          customerLabel,
          selectedServices,
          method,
          0,
          '',
          'POS',
          {
            notes: resolvedNotes,
            professionalId: selectedProfessional.id,
            professionalName: selectedProfessional.name,
            commissionRate,
            commissionAmount,
            reservationId: activeReservation?.id,
            ...(selectedCrmCustomer
              ? { crmCustomerId: selectedCrmCustomer.id, customerPhone: selectedCrmCustomer.phone }
              : {}),
            paymentConfirmed: method !== 'BOLETO' && method !== 'PAYMENT_LINK',
            providerTransactionId: `SVC-TX-${Date.now().toString(36).toUpperCase()}`,
          }
        );
        if (!order) {
          usedOfflineFallback = true;
          await StorageService.saveOfflineOrder(offlineFallback);
          await syncEngine.refreshCounts();
          order = offlineFallback;
          showNotification('Atendimento salvo na fila offline para sincronização.');
        }
      } catch {
        usedOfflineFallback = true;
        await StorageService.saveOfflineOrder(offlineFallback);
        await syncEngine.refreshCounts();
        order = offlineFallback;
        showNotification('Rede indisponível! Atendimento salvo na fila offline.');
      }
    }

    if (order) {
      if (commissionAmount > 0 && !usedOfflineFallback) {
        await addFinancialRecord({
          storeId: currentStore.id,
          tenantId: currentStore.tenantId || currentStore.id,
          type: 'PAYABLE',
          description: `Comissão (${commissionRate}%) • ${selectedProfessional.name} • Pedido ${order.code}`,
          category: 'Comissões & Repasses',
          amount: commissionAmount,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'PENDING',
          entityName: selectedProfessional.name,
          paymentMethod: method,
        });
      } else if (commissionAmount > 0 && usedOfflineFallback) {
        const finComId = `fin-com-${offlineFallback.code.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
        await syncEngine.enqueueMutation({
          entity: 'financial_records',
          entityId: finComId,
          storeId: currentStore.id,
          appId: 'store-os',
          payload: {
            id: finComId,
            storeId: currentStore.id,
            tenantId: currentStore.tenantId || currentStore.id,
            type: 'PAYABLE',
            description: `Comissão (${commissionRate}%) • ${selectedProfessional.name} • Pedido ${offlineFallback.code}`,
            category: 'Comissões & Repasses',
            amount: commissionAmount,
            dueDate: new Date().toISOString().split('T')[0],
            status: 'PENDING',
            entityName: selectedProfessional.name,
            paymentMethod: method,
          },
        });
      }

      if (activeReservation && !usedOfflineFallback) {
        await updateReservationStatus(activeReservation.id, 'COMPLETED');
      } else if (activeReservation && usedOfflineFallback) {
        await syncEngine.enqueueMutation({
          entity: 'reservations',
          entityId: activeReservation.id,
          storeId: currentStore.id,
          appId: 'store-os',
          payload: { ...activeReservation, status: 'COMPLETED' },
        });
      }

      setLastOrderForReceipt({
        ...order,
        items: order.items.map((i: any) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        paymentMethod: `SERVIÇOS / ${method}`,
      });

      setSelectedServices([]);
      setSelectedProfessional(null);
      setClientName('');
      setSelectedCrmCustomer(null);
      setActiveReservation(null);
      setStep('PROFESSIONAL');
      if (!usedOfflineFallback) {
        showNotification(
          commissionAmount > 0
            ? `Atendimento finalizado! Comissão de R$ ${commissionAmount.toFixed(2)} lançada no Financeiro.`
            : 'Atendimento finalizado com sucesso!'
        );
      }
    }
  };

  return {
    step,
    setStep,
    selectedProfessional,
    setSelectedProfessional,
    selectedServices,
    addService,
    updateServiceQty,
    removeService,
    clientName,
    setClientName,
    selectedCrmCustomer,
    setSelectedCrmCustomer,
    activeReservation,
    setActiveReservation,
    handleCheckInReservation,
    commissionRate,
    setCommissionRate,
    commissionAmount,
    lastOrderForReceipt,
    setLastOrderForReceipt,
    professionals,
    serviceItems,
    pendingReservations,
    total,
    handleFinish,
  };
}
