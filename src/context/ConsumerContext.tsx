import React, { createContext, useContext, useState, useEffect } from 'react';
import { DatabaseAdapterManager } from '../services/databaseAdapter';
import { useAuth } from './AuthContext';
import { ConsumerProfile, SavedAddress, ConsumerPreferences, LoyaltyReward } from '../types';
import { useEcosystem } from './EcosystemContext';

const INITIAL_CONSUMER_PROFILE: ConsumerProfile = {
  id: 'guest',
  name: 'Visitante',
  phone: '',
  email: '',
  avatar: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=150&auto=format&fit=crop&q=80',
  savedAddresses: [],
  preferences: {
    dietaryRestrictions: [],
    favoriteCategories: [],
    defaultPaymentMethod: 'PIX',
    emailNotifications: true,
    whatsappNotifications: true,
  },
  loyaltyRewards: [],
  favoriteStoreIds: [],
};

interface ConsumerContextType {
  consumer: ConsumerProfile;
  updateProfile: (profileData: Partial<ConsumerProfile>) => Promise<boolean>;
  addAddress: (addressData: Omit<SavedAddress, 'id'>) => Promise<boolean>;
  updateAddress: (id: string, addressData: Partial<SavedAddress>) => Promise<boolean>;
  deleteAddress: (id: string) => Promise<boolean>;
  setDefaultAddress: (id: string) => Promise<boolean>;
  updatePreferences: (prefs: Partial<ConsumerPreferences>) => Promise<boolean>;
  toggleDietaryRestriction: (restriction: string) => Promise<boolean>;
  toggleFavoriteCategory: (category: string) => Promise<boolean>;
  toggleFavoriteStore: (storeId: string) => Promise<boolean>;
  redeemReward: (rewardId: string) => Promise<boolean>;
  reorderOrder: (orderId: string) => void;
  isLoading: boolean;
}

const ConsumerContext = createContext<ConsumerContextType | undefined>(undefined);

export const ConsumerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, updateOwnProfile } = useAuth();
  const { showNotification, setGeoAddress, orders, addToCart, menuItems } = useEcosystem();
  const [consumer, setConsumer] = useState<ConsumerProfile>(INITIAL_CONSUMER_PROFILE);
  const [isLoading, setIsLoading] = useState(true);

  // Persistence logic: Pillar 4 Server Core REST (via StorageAdapter)
  const adapter = DatabaseAdapterManager.getAdapter();

  // Autonomous consumer profile sync
  useEffect(() => {
    const uid = user?.uid || profile?.uid;
    const roleUpper = String(profile?.role || '').toUpperCase();
    const isConsumerRole = roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER';
    if (!uid || uid === 'guest-customer' || !isConsumerRole) {
      setConsumer(INITIAL_CONSUMER_PROFILE);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    adapter.getDocument<ConsumerProfile>('consumers', uid).then(async doc => {
      if (cancelled) return;
      if (doc) {
        setConsumer({
          ...INITIAL_CONSUMER_PROFILE,
          ...doc,
          id: uid,
          name: doc.name || profile?.name || user?.displayName || 'Cliente',
          email: doc.email || profile?.email || user?.email || '',
          phone: doc.phone || profile?.phone || '',
        });
      } else {
        // Strictly null means HTTP 404 (profile doesn't exist yet)
        const newProfile: ConsumerProfile = {
          ...INITIAL_CONSUMER_PROFILE,
          id: uid,
          name: user?.displayName || profile?.name || 'Cliente',
          email: user?.email || profile?.email || '',
          phone: profile?.phone || '',
        };
        setConsumer(newProfile);
        try {
          await adapter.setDocument('consumers', uid, newProfile, true);
        } catch (createErr: any) {
          console.warn('Initial consumer profile creation failed:', createErr?.message);
        }
      }
      setIsLoading(false);
    }).catch((err: any) => {
      if (cancelled) return;
      // Server/network/auth error: DO NOT overwrite persisted consumer profile on server!
      setConsumer(prev => ({
        ...prev,
        id: uid,
        name: profile?.name || user?.displayName || prev.name || 'Cliente',
        email: profile?.email || user?.email || prev.email || '',
        phone: profile?.phone || prev.phone || '',
      }));
      console.warn('Consumer profile load error (preserving server data):', err?.message);
      showNotification('Não foi possível sincronizar seu perfil com o Server Core. Tente novamente.');
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, profile?.uid, profile?.name, profile?.phone]);

  const persistChange = async (update: Partial<ConsumerProfile>): Promise<ConsumerProfile | null> => {
    const uid = user?.uid || profile?.uid;
    const roleUpper = String(profile?.role || '').toUpperCase();
    const isConsumerRole = roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER';
    if (!uid || uid === 'guest-customer' || !isConsumerRole) {
      showNotification('Entre como consumidor para salvar seus endereços, favoritos e preferências.');
      return null;
    }
    const previous = consumer;
    const updated = { ...consumer, ...update, id: uid };
    setConsumer(updated);
    try {
      await adapter.setDocument('consumers', uid, updated, true);
      return updated;
    } catch (e: any) {
      setConsumer(previous);
      console.warn('Consumer persist failure (rolled back local state):', e?.message || e);
      showNotification(e?.message || 'Erro ao salvar alterações no Server Core. Nenhuma alteração foi persistida.');
      throw e;
    }
  };

  const updateProfile = async (profileData: Partial<ConsumerProfile>): Promise<boolean> => {
    const uid = user?.uid || profile?.uid;
    if (!uid || uid === 'guest-customer') {
      showNotification('Faça login para editar seu perfil.');
      return false;
    }
    try {
      if (adapter.type === 'SERVER_CORE_REST') {
        await updateOwnProfile({
          name: profileData.name,
          phone: profileData.phone,
        });
      }
      const { email: _lockedEmail, ...safeProfileUpdate } = profileData;
      const saved = await persistChange(safeProfileUpdate);
      if (!saved) return false;
      showNotification('Perfil atualizado e sincronizado com o HQ!');
      return true;
    } catch (e: any) {
      showNotification(e?.message || 'Erro ao atualizar perfil no Server Core.');
      return false;
    }
  };

  const addAddress = async (addressData: Omit<SavedAddress, 'id'>): Promise<boolean> => {
    const newAddress: SavedAddress = {
      ...addressData,
      id: `addr-${Date.now()}`,
    };
    
    let updatedAddresses = [...consumer.savedAddresses];
    if (newAddress.isDefault) {
      updatedAddresses = updatedAddresses.map(a => ({ ...a, isDefault: false }));
    }
    updatedAddresses.push(newAddress);

    try {
      const saved = await persistChange({ savedAddresses: updatedAddresses });
      if (!saved) return false;
      if (newAddress.isDefault) {
        setGeoAddress(`${newAddress.street}, ${newAddress.number} - ${newAddress.neighborhood}, ${newAddress.city} - ${newAddress.state}`);
      }
      showNotification(`Endereço "${newAddress.label}" adicionado!`);
      return true;
    } catch {
      return false;
    }
  };

  const updateAddress = async (id: string, addressData: Partial<SavedAddress>): Promise<boolean> => {
    let updatedAddresses = consumer.savedAddresses.map(a => a.id === id ? { ...a, ...addressData } : a);
    if (addressData.isDefault) {
      updatedAddresses = updatedAddresses.map(a => a.id === id ? a : { ...a, isDefault: false });
    }
    try {
      const saved = await persistChange({ savedAddresses: updatedAddresses });
      if (!saved) return false;
      showNotification('Endereço atualizado!');
      return true;
    } catch {
      return false;
    }
  };

  const deleteAddress = async (id: string): Promise<boolean> => {
    const updated = consumer.savedAddresses.filter(a => a.id !== id);
    try {
      const saved = await persistChange({ savedAddresses: updated });
      if (!saved) return false;
      showNotification('Endereço removido.');
      return true;
    } catch {
      return false;
    }
  };

  const setDefaultAddress = async (id: string): Promise<boolean> => {
    const updated = consumer.savedAddresses.map(a => ({ ...a, isDefault: a.id === id }));
    const target = updated.find(a => a.id === id);
    try {
      const saved = await persistChange({ savedAddresses: updated });
      if (!saved) return false;
      if (target) {
        setGeoAddress(`${target.street}, ${target.number} - ${target.neighborhood}, ${target.city} - ${target.state}`);
      }
      showNotification('Endereço padrão atualizado!');
      return true;
    } catch {
      return false;
    }
  };

  const updatePreferences = async (prefs: Partial<ConsumerPreferences>): Promise<boolean> => {
    try {
      const saved = await persistChange({ preferences: { ...consumer.preferences, ...prefs } });
      if (!saved) return false;
      showNotification('Preferências salvas!');
      return true;
    } catch {
      return false;
    }
  };

  const toggleDietaryRestriction = async (restriction: string): Promise<boolean> => {
    const current = consumer.preferences.dietaryRestrictions;
    const exists = current.includes(restriction);
    const updated = exists ? current.filter(r => r !== restriction) : [...current, restriction];
    try {
      const saved = await persistChange({ preferences: { ...consumer.preferences, dietaryRestrictions: updated } });
      return Boolean(saved);
    } catch {
      return false;
    }
  };

  const toggleFavoriteCategory = async (category: string): Promise<boolean> => {
    const current = consumer.preferences.favoriteCategories;
    const exists = current.includes(category);
    const updated = exists ? current.filter(c => c !== category) : [...current, category];
    try {
      const saved = await persistChange({ preferences: { ...consumer.preferences, favoriteCategories: updated } });
      return Boolean(saved);
    } catch {
      return false;
    }
  };

  const toggleFavoriteStore = async (storeId: string): Promise<boolean> => {
    const exists = consumer.favoriteStoreIds.includes(storeId);
    const updated = exists ? consumer.favoriteStoreIds.filter(id => id !== storeId) : [...consumer.favoriteStoreIds, storeId];
    try {
      const saved = await persistChange({ favoriteStoreIds: updated });
      if (!saved) return false;
      showNotification(exists ? 'Loja removida dos favoritos' : 'Loja adicionada aos favoritos!');
      return true;
    } catch {
      return false;
    }
  };

  const redeemReward = async (rewardId: string): Promise<boolean> => {
    const reward = consumer.loyaltyRewards.find(r => r.id === rewardId);
    if (!reward || reward.isRedeemed) return false;

    const updated = consumer.loyaltyRewards.map(r => r.id === rewardId ? { ...r, isRedeemed: true } : r);
    try {
      const saved = await persistChange({ loyaltyRewards: updated });
      if (!saved) return false;
      showNotification(`Cupom ${reward.couponCode} resgatado!`);
      return true;
    } catch {
      return false;
    }
  };

  const reorderOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let itemsAdded = 0;
    order.items.forEach(orderItem => {
      const menuItem = menuItems.find(m => m.id === orderItem.menuItemId);
      if (menuItem) {
        addToCart(menuItem, orderItem.quantity);
        itemsAdded++;
      }
    });

    if (itemsAdded > 0) {
      showNotification(`Re-pedido ${order.code}: ${itemsAdded} itens adicionados!`);
    } else {
      showNotification('Itens não encontrados no cardápio.');
    }
  };

  return (
    <ConsumerContext.Provider value={{
      consumer,
      updateProfile,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      updatePreferences,
      toggleDietaryRestriction,
      toggleFavoriteCategory,
      toggleFavoriteStore,
      redeemReward,
      reorderOrder,
      isLoading
    }}>
      {children}
    </ConsumerContext.Provider>
  );
};

export const useConsumer = () => {
  const ctx = useContext(ConsumerContext);
  if (!ctx) throw new Error('useConsumer must be used within a ConsumerProvider');
  return ctx;
};
