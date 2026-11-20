import { useState, useEffect } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import { FinancialRecord, CashRegisterSession, Store } from '../../types';
import { apiClient } from '../../core/api/apiClient';
import { getPlatformAdapters } from '../../core/platform/PlatformAdapter';
import { generateSessionId, generateStandardId } from '../../utils/idGenerator';

export const useFinance = (
  user: any, 
  profile: any, 
  showNotification: (msg: string) => void,
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>,
  selectedStoreId: string,
  loading: boolean,
  isAuthenticated: boolean,
  stores: Store[] = []
) => {
  const resolveTenantId = (storeId?: string) => {
    const storeObj = stores.find(s => s.id === (storeId || selectedStoreId));
    return storeObj?.tenantId || profile?.tenantId || 'tenant-1';
  };
  const buildClosedSession = (storeId: string): CashRegisterSession => ({
    id: `cash-closed-${storeId}`,
    storeId,
    openedBy: '-',
    openedAt: '--:--',
    initialCash: 0,
    totalSales: 0,
    totalSangrias: 0,
    totalSuprimentos: 0,
    finalCashCalculated: 0,
    status: 'CLOSED',
  });

  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [cashSession, setCashSession] = useState<CashRegisterSession>(() => buildClosedSession(selectedStoreId));

  const adapter = DatabaseAdapterManager.getAdapter();

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading && !isAuthenticated) {
        setFinancialRecords([]);
        setCashSession(buildClosedSession(selectedStoreId));
      }
      return;
    }
    const unsubs: (() => void)[] = [];

    // Subscribe to financial records (Store Managerial roles only)
    const userRole = String(profile?.role || user?.role || '').toUpperCase();
    const canAccessFinancialRecords = [
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
    ].includes(userRole);

    if (canAccessFinancialRecords) {
      unsubs.push(
        adapter.subscribe<FinancialRecord>('financial_records', (records) => {
          setFinancialRecords(records);
        })
      );
    } else {
      setFinancialRecords([]);
    }

    // Subscribe to cash sessions (Store Cashier / Managerial roles only)
    const canAccessCashSession = [
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
      'CASHIER',
    ].includes(userRole);

    if (canAccessCashSession && selectedStoreId) {
      unsubs.push(
        adapter.subscribe<CashRegisterSession>(
          'cash_sessions',
          (sessions) => {
            const open = sessions.find(s => s.storeId === selectedStoreId && s.status === 'OPEN');
            if (open) {
              setCashSession(open);
            } else {
              const storeSessions = sessions
                .filter(s => s.storeId === selectedStoreId)
                .sort((a: any, b: any) =>
                  String(b.updatedAt || b.createdAt || b.openedAt || '').localeCompare(
                    String(a.updatedAt || a.createdAt || a.openedAt || '')
                  )
                );
              setCashSession(storeSessions[0] || buildClosedSession(selectedStoreId));
            }
          },
          { storeId: selectedStoreId }
        )
      );
    } else {
      setCashSession(buildClosedSession(selectedStoreId));
    }

    return () => unsubs.forEach(u => u());
  }, [selectedStoreId, loading, isAuthenticated, profile?.role, user?.role]);

  const addSangria = async (amount: number, reason: string) => {
    if (cashSession.status !== 'OPEN') {
      showNotification('Operação bloqueada: Abra um turno de caixa antes de registrar sangria.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showNotification('Informe um valor positivo válido para a sangria.');
      return;
    }
    if (amount > (cashSession.finalCashCalculated || 0)) {
      showNotification(
        `Saldo insuficiente em caixa para sangria (disponível: R$ ${(cashSession.finalCashCalculated || 0).toFixed(2)}).`
      );
      return;
    }
    try {
      const tenantId = resolveTenantId(selectedStoreId);
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token') || undefined;
        const result = await apiClient.recordCashMovement(
          {
            storeId: selectedStoreId,
            sessionId: cashSession.id,
            type: 'SANGRIA',
            amount: Math.round(amount * 100) / 100,
            reason,
          },
          token
        );
        if (result?.session) setCashSession(result.session);
        if (result?.financialRecord) {
          setFinancialRecords((prev) => [result.financialRecord, ...prev.filter((r) => r.id !== result.financialRecord.id)]);
        }
      } else {
        const updated = {
          ...cashSession,
          totalSangrias: Math.round(((cashSession.totalSangrias || 0) + amount) * 100) / 100,
          finalCashCalculated: Math.round(((cashSession.finalCashCalculated || 0) - amount) * 100) / 100,
        };
        await adapter.saveCashSession(updated);
        setCashSession(updated);
        await adapter.saveFinancialRecord({
          id: generateStandardId('fin'),
          storeId: selectedStoreId,
          tenantId,
          type: 'PAYABLE',
          category: 'SANGRIA',
          description: `Sangria de Caixa: ${reason || 'Retirada'}`,
          amount: Math.round(amount * 100) / 100,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'PAID',
          entityName: cashSession.openedBy || 'Caixa PDV',
        });
      }
      showNotification(`Sangria de R$ ${amount.toFixed(2)} realizada (${reason || 'Retirada'})`);
      logSystemEvent('CASHIER_SANGRIA', `Sangria de R$ ${amount.toFixed(2)}: ${reason}`, 'finance/cashier', tenantId);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao registrar sangria.');
    }
  };

  const addSuprimento = async (amount: number, reason: string) => {
    if (cashSession.status !== 'OPEN') {
      showNotification('Operação bloqueada: Abra um turno de caixa antes de registrar suprimento.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showNotification('Informe um valor positivo válido para o suprimento.');
      return;
    }
    try {
      const tenantId = resolveTenantId(selectedStoreId);
      if (adapter.type === 'SERVER_CORE_REST') {
        const token = getPlatformAdapters().storage.getItem('3ccorp_auth_token') || undefined;
        const result = await apiClient.recordCashMovement(
          {
            storeId: selectedStoreId,
            sessionId: cashSession.id,
            type: 'SUPRIMENTO',
            amount: Math.round(amount * 100) / 100,
            reason,
          },
          token
        );
        if (result?.session) setCashSession(result.session);
        if (result?.financialRecord) {
          setFinancialRecords((prev) => [result.financialRecord, ...prev.filter((r) => r.id !== result.financialRecord.id)]);
        }
      } else {
        const updated = {
          ...cashSession,
          totalSuprimentos: Math.round(((cashSession.totalSuprimentos || 0) + amount) * 100) / 100,
          finalCashCalculated: Math.round(((cashSession.finalCashCalculated || 0) + amount) * 100) / 100,
        };
        await adapter.saveCashSession(updated);
        setCashSession(updated);
        await adapter.saveFinancialRecord({
          id: generateStandardId('fin'),
          storeId: selectedStoreId,
          tenantId,
          type: 'RECEIVABLE',
          category: 'SUPRIMENTO',
          description: `Suprimento de Caixa: ${reason || 'Reforço'}`,
          amount: Math.round(amount * 100) / 100,
          dueDate: new Date().toISOString().split('T')[0],
          status: 'PAID',
          entityName: cashSession.openedBy || 'Caixa PDV',
        });
      }
      showNotification(`Suprimento de R$ ${amount.toFixed(2)} adicionado (${reason || 'Reforço'})`);
      logSystemEvent('CASHIER_SUPRIMENTO', `Suprimento de R$ ${amount.toFixed(2)}: ${reason}`, 'finance/cashier', tenantId);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao registrar suprimento.');
    }
  };

  const closeCashRegister = async (reconciliation?: {
    countedCash?: number;
    cashVariance?: number;
    closingNotes?: string;
    closedBy?: string;
    paymentBreakdown?: Record<string, number>;
  }) => {
    if (cashSession.status === 'CLOSED') {
      showNotification('O turno de caixa já se encontra fechado.');
      return;
    }
    try {
      const tenantId = resolveTenantId(selectedStoreId);
      const updated: CashRegisterSession = {
        ...cashSession,
        status: 'CLOSED',
        closedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        ...(reconciliation?.closedBy ? { closedBy: reconciliation.closedBy } : {}),
        ...(typeof reconciliation?.countedCash === 'number'
          ? { countedCash: Math.round(reconciliation.countedCash * 100) / 100 }
          : {}),
        ...(typeof reconciliation?.cashVariance === 'number'
          ? { cashVariance: Math.round(reconciliation.cashVariance * 100) / 100 }
          : {}),
        ...(reconciliation?.closingNotes ? { closingNotes: reconciliation.closingNotes } : {}),
        ...(reconciliation?.paymentBreakdown
          ? { paymentBreakdown: reconciliation.paymentBreakdown }
          : {}),
      };
      await adapter.saveCashSession(updated);
      setCashSession(updated);
      showNotification('Turno de caixa conferido e fechado com sucesso!');
      logSystemEvent(
        'CASHIER_CLOSED',
        `Turno de caixa encerrado${
          typeof reconciliation?.cashVariance === 'number'
            ? ` (diferença: R$ ${reconciliation.cashVariance.toFixed(2)})`
            : ''
        }.`,
        'finance/cashier',
        tenantId
      );
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao fechar caixa.');
    }
  };

  const openCashRegister = async (initialCash: number, operator: string) => {
    if (!Number.isFinite(initialCash) || initialCash < 0) {
      showNotification('Fundo de troco inicial inválido: informe um valor >= 0.');
      return;
    }
    if (cashSession.status === 'OPEN') {
      showNotification('Já existe um turno de caixa aberto para esta loja. Feche o turno atual primeiro.');
      return;
    }
    try {
      const tenantId = resolveTenantId(selectedStoreId);
      const safeInitial = Math.round(initialCash * 100) / 100;
      const newSession: CashRegisterSession = {
        id: generateSessionId(),
        storeId: selectedStoreId,
        openedBy: operator,
        openedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        initialCash: safeInitial,
        totalSales: 0,
        totalSangrias: 0,
        totalSuprimentos: 0,
        finalCashCalculated: safeInitial,
        status: 'OPEN',
        createdAt: new Date().toISOString()
      };
      await adapter.saveCashSession({ ...newSession, tenantId } as any);
      setCashSession(newSession);
      showNotification('Novo turno de caixa aberto!');
      logSystemEvent('CASHIER_OPENED', `Turno aberto por ${operator} com R$ ${safeInitial.toFixed(2)}`, 'finance/cashier', tenantId);
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao abrir caixa.');
    }
  };

  const addFinancialRecord = async (record: Omit<FinancialRecord, 'id'>) => {
    try {
      const id = generateStandardId('fin');
      const created: FinancialRecord = {
        ...record,
        id,
        storeId: record.storeId || selectedStoreId,
        tenantId: record.tenantId || resolveTenantId(record.storeId),
      };
      await adapter.saveFinancialRecord(created);
      setFinancialRecords((prev) => [created, ...prev.filter((r) => r.id !== id)]);
      showNotification(`Lançamento financeiro registrado.`);
    } catch {
      showNotification('Erro ao registrar financeiro.');
    }
  };

  const markFinancialPaid = async (id: string) => {
    const target = financialRecords.find((r) => r.id === id);
    if (target) {
      const updated: FinancialRecord = { ...target, status: 'PAID' };
      await adapter.saveFinancialRecord(updated);
      setFinancialRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      showNotification('Título marcado como PAGO!');
    }
  };

  return {
    financialRecords, setFinancialRecords, cashSession, setCashSession,
    addSangria, addSuprimento, openCashRegister, closeCashRegister,
    addFinancialRecord, markFinancialPaid
  };
};
