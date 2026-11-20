import React, { useState } from 'react';
import { useConsumer } from '../../context/ConsumerContext';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { User, MapPin, Heart, Clock, Gift, Settings, ShieldCheck, HardDrive } from 'lucide-react';
import { SavedAddress } from '../../types';

// Decomposed Submodules & Modals
import { ConsumerGuestView } from '../../modules/consumer/ConsumerGuestView';
import { ConsumerHeroBanner } from '../../modules/consumer/ConsumerHeroBanner';
import { ConsumerSecurityTab } from '../../modules/consumer/ConsumerSecurityTab';
import { ConsumerVaultTab } from '../../modules/consumer/ConsumerVaultTab';
import { ConsumerEditProfileModal } from '../../modules/consumer/ConsumerEditProfileModal';
import { ConsumerAddressModal } from '../../modules/consumer/ConsumerAddressModal';
import { ConsumerReceiptModal } from '../../modules/consumer/ConsumerReceiptModal';
import { ConsumerLoyaltyTab } from '../../modules/consumer/ConsumerLoyaltyTab';
import { ConsumerAddressesTab } from '../../modules/consumer/ConsumerAddressesTab';
import { ConsumerPreferencesTab } from '../../modules/consumer/ConsumerPreferencesTab';
import { ConsumerOrdersTab } from '../../modules/consumer/ConsumerOrdersTab';
import { ConsumerFavoritesTab } from '../../modules/consumer/ConsumerFavoritesTab';
import { MarketplaceOrderTracking } from '../../modules/marketplace/MarketplaceOrderTracking';

export const ConsumerProfileComponent: React.FC = () => {
  const { openAuthModal, profile, isAuthenticated } = useAuth();
  const { consumer, updateAddress, addAddress, updateProfile, redeemReward } = useConsumer();
  const { orders } = useEcosystem();
  const roleUpper = String(profile?.role || '').toUpperCase();
  const isConsumerSession = Boolean(
    isAuthenticated && (roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER')
  );

  const [activeTab, setActiveTab] = useState<
    'overview' | 'addresses' | 'preferences' | 'orders' | 'loyalty' | 'favorites' | 'vault' | 'security'
  >('overview');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  // Modals state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<string | null>(null);

  const handleOpenNewAddressModal = () => {
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddressModal = (addr: SavedAddress) => {
    setEditingAddress(addr);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (addressData: Omit<SavedAddress, 'id'>) => {
    const ok = editingAddress
      ? await updateAddress(editingAddress.id, addressData)
      : await addAddress(addressData);
    if (ok) {
      setIsAddressModalOpen(false);
    }
  };

  const consumerOrders = orders.filter((o) => {
    if (!consumer || consumer.id === 'guest') return false;
    const matchesId = o.customerId === consumer.id || (profile?.uid && o.customerId === profile.uid);
    const matchesEmail = Boolean(consumer.email && o.customerEmail && o.customerEmail.toLowerCase() === consumer.email.toLowerCase());
    const matchesPhone = Boolean(consumer.phone && o.customerPhone && o.customerPhone === consumer.phone);
    return Boolean(matchesId || matchesEmail || matchesPhone);
  });

  const selectedReceiptOrder = consumerOrders.find((o) => o.id === selectedOrderForReceipt);
  const trackingOrder = consumerOrders.find((o) => o.id === trackingOrderId);

  if (trackingOrder) {
    return (
      <MarketplaceOrderTracking
        order={trackingOrder}
        onBack={() => setTrackingOrderId(null)}
      />
    );
  }

  if (!isConsumerSession || consumer.id === 'guest') {
    return (
      <ConsumerGuestView
        onSignIn={() => openAuthModal('login', 'CUSTOMER', 'marketplace')}
        onSignUp={() => openAuthModal('signup', 'CUSTOMER', 'marketplace')}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-fadeIn">
      {/* CONSUMER HERO BANNER */}
      <ConsumerHeroBanner
        consumer={consumer}
        onEditProfile={() => setIsEditingProfile(true)}
      />

      {/* NAVIGATION SUB-TABS */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto no-scrollbar shadow-lg">
        {[
          { id: 'overview', label: 'Geral & Resumo', icon: User },
          { id: 'addresses', label: `Endereços (${consumer.savedAddresses.length})`, icon: MapPin },
          { id: 'preferences', label: 'Preferências & Dieta', icon: Settings },
          { id: 'orders', label: `Meus Pedidos (${consumerOrders.length})`, icon: Clock },
          { id: 'loyalty', label: 'Fidelidade & Cupons', icon: Gift },
          {
            id: 'favorites',
            label: `Lojas Favoritas (${consumer.favoriteStoreIds.length})`,
            icon: Heart,
          },
          { id: 'vault', label: 'Meus Arquivos (Cofre)', icon: HardDrive },
          { id: 'security', label: 'Privacidade & Segurança', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap uppercase tracking-wider cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUBMODULE RENDERER */}
      {activeTab === 'overview' && (
        <ConsumerOrdersTab
          orders={consumerOrders.slice(0, 3)}
          onOpenReceipt={(id) => setSelectedOrderForReceipt(id)}
          onTrackOrder={(id) => setTrackingOrderId(id)}
        />
      )}
      {activeTab === 'addresses' && (
        <ConsumerAddressesTab
          onOpenNewAddress={handleOpenNewAddressModal}
          onOpenEditAddress={handleOpenEditAddressModal}
        />
      )}
      {activeTab === 'preferences' && <ConsumerPreferencesTab />}
      {activeTab === 'orders' && (
        <ConsumerOrdersTab
          orders={consumerOrders}
          onOpenReceipt={(id) => setSelectedOrderForReceipt(id)}
          onTrackOrder={(id) => setTrackingOrderId(id)}
        />
      )}
      {activeTab === 'loyalty' && (
        <ConsumerLoyaltyTab
          loyaltyRewards={consumer.loyaltyRewards}
          onRedeemReward={(id) => redeemReward(id)}
        />
      )}
      {activeTab === 'favorites' && <ConsumerFavoritesTab />}
      {activeTab === 'vault' && <ConsumerVaultTab />}
      {activeTab === 'security' && <ConsumerSecurityTab />}

      {/* MODALS */}
      {isEditingProfile && (
        <ConsumerEditProfileModal
          initialName={consumer.name}
          initialEmail={consumer.email}
          initialPhone={consumer.phone}
          onSave={async (data) => {
            const ok = await updateProfile(data);
            if (ok) {
              setIsEditingProfile(false);
            }
          }}
          onClose={() => setIsEditingProfile(false)}
        />
      )}

      {isAddressModalOpen && (
        <ConsumerAddressModal
          editingAddress={editingAddress}
          onSave={handleSaveAddress}
          onClose={() => setIsAddressModalOpen(false)}
        />
      )}

      <ConsumerReceiptModal
        order={selectedReceiptOrder || null}
        onClose={() => setSelectedOrderForReceipt(null)}
      />
    </div>
  );
};
