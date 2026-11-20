import { DatabaseAdapterManager, StandaloneStorageAdapter } from './databaseAdapter';
import { apiClient } from '../core/api/apiClient';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../constants/platformDefaults';
import type { CashRegisterSession } from '../types';

const buildEmptyClosedCashSession = (storeId = ''): CashRegisterSession => ({
  id: `cash-closed-${storeId || 'default'}`,
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

export const seedDatabaseToLocalCore = async (
  showNotification: (msg: string) => void
): Promise<void> => {
  try {
    showNotification('Sincronizando governança base da plataforma...');
    const adapter = DatabaseAdapterManager.getAdapter();
    await adapter.saveGovernance(DEFAULT_PLATFORM_GOVERNANCE);
    showNotification('✅ Governança padrão restaurada com sucesso via StorageAdapter!');
  } catch (e: any) {
    showNotification(`Erro ao inicializar governança: ${e.message}`);
  }
};

export const resetEntirePlatformData = async (
  showNotification: (msg: string) => void,
  setOrders: (orders: any[]) => void,
  setCart: (cart: any[]) => void,
  setCustomersCrm: (crm: any[]) => void,
  setFinancialRecords: (records: any[]) => void,
  setCashSession: (session: any) => void,
  token?: string
): Promise<void> => {
  try {
    showNotification('Resetando plataforma...');
    const adapter = DatabaseAdapterManager.getAdapter();
    if (adapter instanceof StandaloneStorageAdapter) {
      adapter.resetToSeeds();
      setCustomersCrm([]);
      setFinancialRecords([]);
      setCashSession(buildEmptyClosedCashSession());
    } else if (adapter.type === 'SERVER_CORE_REST') {
      await apiClient.resetSandboxPlatform(token);
      const [freshCrm, freshFinance] = await Promise.all([
        adapter.getCustomers().catch(() => []),
        adapter.getFinancialRecords().catch(() => []),
      ]);
      setCustomersCrm(freshCrm);
      setFinancialRecords(freshFinance);
      setCashSession(buildEmptyClosedCashSession());
    } else {
      await seedDatabaseToLocalCore(showNotification);
      setCustomersCrm([]);
      setFinancialRecords([]);
      setCashSession(buildEmptyClosedCashSession());
    }
    setOrders([]);
    setCart([]);
    showNotification('✅ Reset limpo finalizado (zero dados mockados)!');
  } catch (e: any) {
    showNotification(`Erro ao resetar: ${e?.message || 'falha desconhecida'}`);
  }
};
