import React from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Scissors, User } from 'lucide-react';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';
import { ServicePosProfessionalStep } from './service/ServicePosProfessionalStep';
import { ServicePosServicesStep } from './service/ServicePosServicesStep';
import { ServicePosCheckoutStep } from './service/ServicePosCheckoutStep';
import { ServicePosCartSidebar } from './service/ServicePosCartSidebar';
import { useServicePOS } from './hooks/useServicePOS';
import { PosCashDrawerBanner } from './components/PosCashDrawerBanner';
import { useAuth } from '../../../context/AuthContext';
import { COMMERCE_SEGMENT_COLORS, SURFACE_TOKENS } from '@3c/design-system';

export const ServicePOSApp: React.FC = () => {
  const { user, profile } = useAuth();
  const {
    currentStore,
    adminUsers,
    users,
    menuItems,
    reservations,
    customersCrm,
    cashSession,
    openCashRegister,
    createPosOrder,
    addFinancialRecord,
    updateReservationStatus,
    showNotification,
  } = useEcosystem();
  const storeCustomers = customersCrm.filter((c) => c.storeId === currentStore.id);
  const operatorName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Operador Caixa';

  const serviceTheme = COMMERCE_SEGMENT_COLORS.SERVICE;
  const surface = SURFACE_TOKENS.dark;

  const {
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
  } = useServicePOS({
    currentStore,
    adminUsers,
    users,
    menuItems,
    reservations,
    createPosOrder,
    addFinancialRecord,
    updateReservationStatus,
    showNotification,
  });

  return (
    <div className={`flex flex-col h-full ${surface.canvasBg} text-slate-100 animate-fadeIn`}>
      {/* Step Header */}
      <header className={`p-4 ${surface.elevatedBg} border-b ${surface.border} flex items-center justify-between flex-wrap gap-3`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 ${serviceTheme.bgClass} ${serviceTheme.textClass} rounded-xl border ${serviceTheme.borderClass}`}>
            <Scissors size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase italic tracking-tighter">
              PDV de Serviços, Agenda & Comissões
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-1.5 w-8 rounded-full ${step === 'PROFESSIONAL' ? 'bg-indigo-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 w-8 rounded-full ${step === 'SERVICES' ? 'bg-indigo-500' : 'bg-slate-700'}`} />
              <div className={`h-1.5 w-8 rounded-full ${step === 'CHECKOUT' ? 'bg-indigo-500' : 'bg-slate-700'}`} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PosCashDrawerBanner
            cashSession={cashSession}
            operatorDefault={operatorName}
            onOpenCashRegister={openCashRegister}
          />
          {activeReservation && (
            <span className="px-2.5 py-1 rounded-lg bg-pink-500/15 border border-pink-500/30 text-[10px] font-black text-pink-300 uppercase">
              Agenda {activeReservation.time}
            </span>
          )}
          {selectedProfessional && (
            <div className={`flex items-center gap-2 px-3 py-1.5 ${serviceTheme.bgClass} border ${serviceTheme.borderClass} rounded-lg`}>
              <User size={12} className={serviceTheme.textClass} />
              <span className="text-[10px] font-bold text-white uppercase">
                {selectedProfessional.name}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {step === 'PROFESSIONAL' && (
            <ServicePosProfessionalStep
              professionals={professionals}
              pendingReservations={pendingReservations}
              onCheckInReservation={handleCheckInReservation}
              onSelectProfessional={(pro) => {
                setSelectedProfessional(pro);
                setActiveReservation(null);
                setStep('SERVICES');
              }}
            />
          )}

          {step === 'SERVICES' && (
            <ServicePosServicesStep
              serviceItems={serviceItems}
              selectedServices={selectedServices}
              clientName={clientName}
              setClientName={setClientName}
              customers={storeCustomers}
              selectedCustomer={selectedCrmCustomer}
              onSelectCustomer={setSelectedCrmCustomer}
              onAddService={addService}
              onBackToProfessional={() => setStep('PROFESSIONAL')}
            />
          )}

          {step === 'CHECKOUT' && (
            <ServicePosCheckoutStep
              selectedProfessional={selectedProfessional}
              clientName={clientName}
              selectedServices={selectedServices}
              total={total}
              commissionRate={commissionRate}
              setCommissionRate={setCommissionRate}
              commissionAmount={commissionAmount}
              acceptedPaymentMethods={currentStore.operationalSettings?.acceptedPaymentMethods}
              onFinish={handleFinish}
            />
          )}
        </div>

        {/* Floating Sidebar (Cart Summary) */}
        {step !== 'PROFESSIONAL' && (
          <ServicePosCartSidebar
            step={step}
            selectedServices={selectedServices}
            total={total}
            onUpdateQty={updateServiceQty}
            onRemoveService={removeService}
            onToggleStep={() => setStep(step === 'SERVICES' ? 'CHECKOUT' : 'SERVICES')}
          />
        )}
      </div>

      {/* Receipt Modal */}
      {lastOrderForReceipt && (
        <ThermalReceiptModal
          isOpen={!!lastOrderForReceipt}
          onClose={() => setLastOrderForReceipt(null)}
          order={lastOrderForReceipt}
          store={currentStore}
        />
      )}
    </div>
  );
};
