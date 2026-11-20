import { StorageAdapter } from '../../../services/adapters/StorageAdapterTypes';
import {
  MenuItem,
  Store,
  StoreOperationalSettings,
  StoreTemplateConfig,
} from '../../../types';
import { generateProductId } from '../../../utils/idGenerator';

interface UseStoreCatalogAndSettingsParams {
  adapter: StorageAdapter;
  stores: Store[];
  menuItems: MenuItem[];
  resolveActiveTenantId: (targetStoreId?: string) => string;
  showNotification: (msg: string) => void;
  logSystemEvent: (type: string, payload: string, channel: string, tenantId?: string) => Promise<void>;
}

export const useStoreCatalogAndSettings = ({
  adapter,
  stores,
  menuItems,
  resolveActiveTenantId,
  showNotification,
  logSystemEvent,
}: UseStoreCatalogAndSettingsParams) => {
  const updateStoreTemplate = async (storeId: string, templateUpdate: Partial<StoreTemplateConfig>) => {
    try {
      const store = stores.find((s) => s.id === storeId);
      const currentTemplate = store?.showcaseTemplate || {
        templateId: 'BURGER_MODERN',
        primaryColor: '#f59e0b',
        tagline: store?.name || '',
        showCategoryPills: true,
        showReviews: true,
        layoutStyle: 'GRID_CARDS' as const,
      };
      const storePatch: Partial<Store> = {
        showcaseTemplate: { ...currentTemplate, ...templateUpdate },
      };
      if (templateUpdate.socials) {
        storePatch.socials = {
          ...(store?.socials || {}),
          ...templateUpdate.socials,
        };
      }
      await adapter.updateStore(storeId, storePatch);
      showNotification('Template e identidade visual da loja atualizados!');
      logSystemEvent('STORE_THEME_UPDATE', `Template da loja ${store?.name} atualizado.`, 'store/config');
    } catch {
      showNotification('Erro ao atualizar template.');
    }
  };

  const updateEnabledModules = async (storeId: string, modules: string[]) => {
    try {
      await adapter.updateStore(storeId, { enabledModules: modules });
      showNotification('Módulos da loja atualizados!');
    } catch {
      showNotification('Erro ao salvar configuração de módulos.');
    }
  };

  const updateStoreOperationalSettings = async (storeId: string, settings: Partial<StoreOperationalSettings>) => {
    try {
      const store = stores.find((s) => s.id === storeId);
      const currentOps = store?.operationalSettings || {};
      await adapter.updateStore(storeId, { operationalSettings: { ...currentOps, ...settings } });
      showNotification('Configurações operacionais salvas!');
    } catch {
      showNotification('Erro ao salvar configurações.');
    }
  };

  const updateStoreData = async (storeId: string, data: Partial<Store>) => {
    try {
      await adapter.updateStore(storeId, data);
      showNotification('Perfil da loja atualizado!');
    } catch {
      showNotification('Erro ao salvar dados da loja.');
    }
  };

  const addMenuItem = async (newItem: Omit<MenuItem, 'id'>) => {
    try {
      const id = generateProductId();
      const completeItem: MenuItem = {
        ...newItem,
        id,
        tenantId: newItem.tenantId || resolveActiveTenantId(newItem.storeId),
      };
      await adapter.saveMenuItem(completeItem);
      showNotification(`Item ${newItem.name} cadastrado com sucesso!`);
    } catch {
      showNotification('Erro ao cadastrar item.');
    }
  };

  const updateMenuItem = async (id: string, updates: Partial<MenuItem>): Promise<boolean> => {
    try {
      await adapter.updateMenuItem(id, updates);
      showNotification('Item atualizado com sucesso!');
      return true;
    } catch {
      showNotification('Erro ao atualizar item.');
      return false;
    }
  };

  const deleteMenuItem = async (id: string) => {
    try {
      await adapter.deleteMenuItem(id);
      showNotification('Item removido com sucesso!');
    } catch {
      showNotification('Erro ao remover item.');
    }
  };

  const toggleMenuItemAvailability = async (id: string) => {
    const mi = menuItems.find((m) => m.id === id);
    if (mi) {
      await adapter.updateMenuItem(id, { isAvailable: !mi.isAvailable });
    }
  };

  return {
    updateStoreTemplate,
    updateEnabledModules,
    updateStoreOperationalSettings,
    updateStoreData,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
  };
};
