import { useState, useEffect } from 'react';
import { DatabaseAdapterManager } from '../../services/databaseAdapter';
import { CustomerCRM, AutomatedMessage, Store } from '../../types';

export const useCRM = (
  user: any, 
  profile: any, 
  showNotification: (msg: string) => void,
  loading: boolean,
  isAuthenticated: boolean,
  selectedStoreId: string = 'store-1',
  stores: Store[] = []
) => {
  const [customersCrm, setCustomersCrm] = useState<CustomerCRM[]>([]);
  const [automatedMessages, setAutomatedMessages] = useState<AutomatedMessage[]>([]);

  const adapter = DatabaseAdapterManager.getAdapter();

  useEffect(() => {
    if (loading || !isAuthenticated) {
      if (!loading && !isAuthenticated) {
        setCustomersCrm([]);
        setAutomatedMessages([]);
      }
      return;
    }
    const roleUpper = String(profile?.role || user?.role || '').toUpperCase();
    const canAccessCrm = [
      'DEV_OWNER',
      'SUPER_ADMIN',
      'REGIONAL_MANAGER',
      'STORE_OWNER',
      'STORE_MANAGER',
      'CASHIER',
    ].includes(roleUpper);
    if (!canAccessCrm) {
      setCustomersCrm([]);
      setAutomatedMessages([]);
      return;
    }
    const unsubs: (() => void)[] = [];

    unsubs.push(
      adapter.subscribe<CustomerCRM>('customers_crm', (list) => {
        setCustomersCrm(list);
      })
    );

    unsubs.push(
      adapter.subscribe<AutomatedMessage>('automated_messages', (list) => {
        setAutomatedMessages(list);
      })
    );

    return () => unsubs.forEach(u => u());
  }, [loading, isAuthenticated, profile?.role, user?.role]);

  const addCustomerToCrm = async (customer: Omit<CustomerCRM, 'id' | 'storeId'>) => {
    try {
      const id = `cust-${Date.now()}`;
      const targetStoreId = selectedStoreId || profile?.storeId || 'store-1';
      const storeObj = stores.find(s => s.id === targetStoreId);
      const targetTenantId = storeObj?.tenantId || profile?.tenantId || 'tenant-1';
      await adapter.saveCustomer({
        ...customer,
        id,
        storeId: targetStoreId,
        tenantId: targetTenantId,
      });
      showNotification(`Cliente ${customer.name} cadastrado no CRM!`);
    } catch {
      showNotification('Erro ao cadastrar no CRM.');
    }
  };

  const updateCustomerNotes = async (customerId: string, notes: string) => {
    await adapter.updateCustomer(customerId, { notes });
    setCustomersCrm(prev => prev.map(c => (c.id === customerId ? { ...c, notes } : c)));
    showNotification('Observação do cliente atualizada.');
  };

  const updateCustomerProfile = async (
    customerId: string,
    updates: Partial<Pick<CustomerCRM, 'name' | 'phone' | 'email' | 'notes' | 'loyaltyTier' | 'loyaltyPoints'>>
  ): Promise<boolean> => {
    try {
      await adapter.updateCustomer(customerId, updates);
      setCustomersCrm(prev => prev.map(c => (c.id === customerId ? { ...c, ...updates } : c)));
      showNotification('Cadastro do cliente atualizado com sucesso!');
      return true;
    } catch {
      showNotification('Erro ao atualizar cadastro do cliente.');
      return false;
    }
  };

  const deleteCustomerFromCrm = async (customerId: string): Promise<boolean> => {
    try {
      await adapter.deleteDocument('customers_crm', customerId);
      setCustomersCrm(prev => prev.filter(c => c.id !== customerId));
      showNotification('Cliente removido da base CRM.');
      return true;
    } catch {
      showNotification('Erro ao remover cliente do CRM.');
      return false;
    }
  };

  const toggleAutomatedMessage = async (msgId: string) => {
    const msg = automatedMessages.find(m => m.id === msgId);
    if (!msg) return;
    const updated = { ...msg, isActive: !msg.isActive };
    await adapter.setDocument('automated_messages', msgId, updated, true);
    showNotification('Status da mensagem automatizada alterado.');
  };

  const updateAutomatedMessageContent = async (msgId: string, content: string) => {
    const msg = automatedMessages.find(m => m.id === msgId);
    if (!msg) return;
    const updated = { ...msg, content };
    await adapter.setDocument('automated_messages', msgId, updated, true);
    showNotification('Conteúdo da mensagem atualizado com sucesso!');
  };

  return {
    customersCrm, setCustomersCrm, automatedMessages, setAutomatedMessages,
    addCustomerToCrm, updateCustomerNotes, updateCustomerProfile, deleteCustomerFromCrm,
    toggleAutomatedMessage, updateAutomatedMessageContent
  };
};
