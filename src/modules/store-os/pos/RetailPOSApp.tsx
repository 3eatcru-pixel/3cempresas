import React from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { useAuth } from '../../../context/AuthContext';
import { ThermalReceiptModal } from '../common/ThermalReceiptModal';
import { RetailPosCheckoutPanel } from './layout/RetailPosCheckoutPanel';
import { RetailPosScanTable } from './layout/RetailPosScanTable';
import { RetailPosScannerBar } from './layout/RetailPosScannerBar';
import { RetailVariantPickerModal } from './layout/RetailVariantPickerModal';
import { RetailExchangeReturnModal } from './layout/RetailExchangeReturnModal';
import { PosCashDrawerBanner } from './components/PosCashDrawerBanner';
import { useRetailPOS } from './hooks/useRetailPOS';
import { SURFACE_TOKENS } from '@3c/design-system';

export const RetailPOSApp: React.FC = () => {
  const { getIdToken, user, profile } = useAuth();
  const {
    currentStore,
    menuItems,
    orders,
    coupons,
    customersCrm,
    cashSession,
    openCashRegister,
    createPosOrder,
    showNotification,
  } = useEcosystem();
  const storeCustomers = customersCrm.filter((c) => c.storeId === currentStore.id);
  const operatorName = profile?.name || user?.displayName || user?.email?.split('@')[0] || 'Operador Balcão';

  const {
    searchQuery,
    setSearchQuery,
    filteredItems,
    selectedItems,
    pushCartLine,
    addItem,
    updateQty,
    updateSerial,
    total,
    couponCode,
    setCouponCode,
    appliedDiscount,
    handleApplyCoupon,
    customerName,
    setCustomerName,
    selectedCrmCustomer,
    setSelectedCrmCustomer,
    isFinishing,
    handleFinish,
    lastOrderForReceipt,
    setLastOrderForReceipt,
    searchInputRef,
    variantPickerItem,
    setVariantPickerItem,
    showDeliverySchedule,
    scheduledDeliveryDate,
    setScheduledDeliveryDate,
    scheduledDeliveryPeriod,
    setScheduledDeliveryPeriod,
    assemblyRequired,
    setAssemblyRequired,
    isExchangeOpen,
    setIsExchangeOpen,
    exchangeSearch,
    setExchangeSearch,
    selectedExchangeOrder,
    setSelectedExchangeOrder,
    exchangeReason,
    setExchangeReason,
    storeOrdersForExchange,
    returningIdx,
    handleProcessReturnItem,
    hasLowStock,
  } = useRetailPOS({
    currentStore,
    menuItems,
    orders,
    coupons,
    createPosOrder,
    showNotification,
    getIdToken,
  });

  return (
    <div className={`flex flex-col h-full ${SURFACE_TOKENS.dark.canvasBg} text-slate-100 font-sans overflow-hidden`}>
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 border-b border-slate-800/80 bg-slate-900/40">
        <span className="text-xs font-bold text-slate-300">
          Frente de Caixa Varejo · {currentStore.name}
        </span>
        <PosCashDrawerBanner
          cashSession={cashSession}
          operatorDefault={operatorName}
          onOpenCashRegister={openCashRegister}
        />
      </div>

      <RetailPosScannerBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filteredItems={filteredItems}
        onAddItem={addItem}
        searchInputRef={searchInputRef}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <RetailPosScanTable
            selectedItems={selectedItems}
            onUpdateQty={updateQty}
            onUpdateSerial={updateSerial}
          />
        </div>

        <RetailPosCheckoutPanel
          selectedItems={selectedItems}
          total={total}
          appliedDiscount={appliedDiscount}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          onApplyCoupon={handleApplyCoupon}
          customers={storeCustomers}
          selectedCustomer={selectedCrmCustomer}
          onSelectCustomer={setSelectedCrmCustomer}
          customerName={customerName}
          setCustomerName={setCustomerName}
          onFinish={handleFinish}
          isFinishing={isFinishing}
          hasLowStock={hasLowStock}
          acceptedPaymentMethods={currentStore.operationalSettings?.acceptedPaymentMethods}
          showDeliverySchedule={showDeliverySchedule}
          scheduledDeliveryDate={scheduledDeliveryDate}
          setScheduledDeliveryDate={setScheduledDeliveryDate}
          scheduledDeliveryPeriod={scheduledDeliveryPeriod}
          setScheduledDeliveryPeriod={setScheduledDeliveryPeriod}
          assemblyRequired={assemblyRequired}
          setAssemblyRequired={setAssemblyRequired}
          onOpenExchangeModal={() => setIsExchangeOpen(true)}
          operatorName={operatorName}
          terminalLabel={currentStore?.code ? `CX-${currentStore.code}` : 'CX-01'}
        />
      </div>

      {variantPickerItem && (
        <RetailVariantPickerModal
          item={variantPickerItem}
          onSelectVariant={(item, variant) => {
            pushCartLine(item, variant);
            setVariantPickerItem(null);
          }}
          onClose={() => setVariantPickerItem(null)}
        />
      )}

      {isExchangeOpen && (
        <RetailExchangeReturnModal
          exchangeSearch={exchangeSearch}
          setExchangeSearch={setExchangeSearch}
          exchangeReason={exchangeReason}
          setExchangeReason={setExchangeReason}
          selectedExchangeOrder={selectedExchangeOrder}
          setSelectedExchangeOrder={setSelectedExchangeOrder}
          storeOrdersForExchange={storeOrdersForExchange}
          returningIdx={returningIdx}
          onProcessReturnItem={handleProcessReturnItem}
          onClose={() => {
            setIsExchangeOpen(false);
            setSelectedExchangeOrder(null);
          }}
        />
      )}

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
