import React, { useState } from 'react';
import { X, CheckCircle2, UtensilsCrossed, ShoppingBag, Bike } from 'lucide-react';
import { useConsumer } from '../../context/ConsumerContext';
import { useAuth } from '../../context/AuthContext';
import { Store, StorePaymentMethod } from '../../types';
import { FulfillmentModality } from '../../utils/storeDomain';

import { ModalitySelector } from './checkout/ModalitySelector';
import { PaymentSelector } from './checkout/PaymentSelector';
import { CheckoutCustomerFields } from './checkout/CheckoutCustomerFields';
import { CheckoutAuthRequiredModal } from './checkout/CheckoutAuthRequiredModal';
import { CheckoutSummaryBox } from './checkout/CheckoutSummaryBox';
import { ServiceStoreNoticeModal } from './checkout/ServiceStoreNoticeModal';
import { TableBillingSelector } from './checkout/TableBillingSelector';
import { CheckoutInteractiveCartBag } from './checkout/CheckoutInteractiveCartBag';
import { CheckoutRemoteGpsWarning } from './checkout/CheckoutRemoteGpsWarning';
import { useCheckoutModalController } from './checkout/useCheckoutModalController';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent, deliveryCoordsOverride?: [number, number], extraNotes?: string) => void;
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  address: string;
  setAddress: (address: string) => void;
  payment: StorePaymentMethod;
  setPayment: (p: StorePaymentMethod) => void;
  coupon: string;
  setCoupon: (coupon: string) => void;
  deliveryInstructions: string;
  setDeliveryInstructions: (instr: string) => void;
  needCutlery?: boolean;
  setNeedCutlery?: (v: boolean) => void;
  cartTotal: number;
  deliveryFee: number;
  consumptionModality?: FulfillmentModality;
  setConsumptionModality?: (m: FulfillmentModality) => void;
  tableNumber?: number;
  setTableNumber?: (t: number) => void;
  tableBillingMode?: 'TABLE_BILL' | 'PAY_NOW';
  setTableBillingMode?: (m: 'TABLE_BILL' | 'PAY_NOW') => void;
  courierTip?: number;
  setCourierTip?: (t: number) => void;
  store?: Store;
  isSubmitting?: boolean;
}

export const MarketplaceCheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  name,
  setName,
  phone,
  setPhone,
  address,
  setAddress,
  payment,
  setPayment,
  coupon,
  setCoupon,
  deliveryInstructions,
  setDeliveryInstructions,
  needCutlery: needCutleryProp,
  setNeedCutlery: setNeedCutleryProp,
  cartTotal,
  deliveryFee,
  consumptionModality,
  setConsumptionModality,
  tableNumber,
  setTableNumber,
  tableBillingMode,
  setTableBillingMode,
  courierTip: courierTipProp,
  setCourierTip: setCourierTipProp,
  store: storeProp,
  isSubmitting = false,
}) => {
  const { user, openAuthModal } = useAuth();
  const { consumer } = useConsumer();
  const [cashChangeFor, setCashChangeFor] = useState('');

  const {
    resolvedStore,
    isServiceStore,
    allowedModalities,
    isFoodStore,
    cart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    activeModality,
    updateModality,
    activeTable,
    updateTable,
    updateTableBillingMode,
    needCutlery,
    setNeedCutlery,
    courierTip,
    setCourierTip,
    allowCutlery,
    allowTip,
    pixKey,
    isStoreClosed,
    isCartEmpty,
    effectiveDeliveryFee,
    effectiveCourierTip,
    matchedCoupon,
    discount,
    couponInvalid,
    total,
    eligibleCoupons,
    isOpenTableTab,
    distanceFromGpsKm,
    distanceToStoreKm,
    isFarFromGps,
    confirmRemoteOrder,
    setConfirmRemoteOrder,
    resolvedDeliveryCoords,
    setResolvedDeliveryCoords,
    handleUseCurrentGpsAddress,
  } = useCheckoutModalController({
    isOpen,
    address,
    setAddress,
    coupon,
    cartTotal,
    deliveryFee,
    consumptionModality,
    setConsumptionModality,
    tableNumber,
    setTableNumber,
    tableBillingMode,
    setTableBillingMode,
    needCutleryProp,
    setNeedCutleryProp,
    courierTipProp,
    setCourierTipProp,
    storeProp,
  });

  if (!isOpen) return null;

  if (!user) {
    return (
      <CheckoutAuthRequiredModal
        onSignIn={() => openAuthModal('login', 'CUSTOMER', 'marketplace')}
        onSignUp={() => openAuthModal('signup', 'CUSTOMER', 'marketplace')}
        onClose={onClose}
      />
    );
  }

  if (isServiceStore) {
    return <ServiceStoreNoticeModal storeName={resolvedStore.name} onClose={onClose} />;
  }

  const HeaderIcon =
    activeModality === 'TABLE' ? UtensilsCrossed : activeModality === 'PICKUP' ? ShoppingBag : Bike;

  const headerTitle =
    activeModality === 'TABLE'
      ? `Comanda Mesa ${String(activeTable).padStart(2, '0')} • ${
          isOpenTableTab ? 'Conta Aberta' : 'Pagamento Imediato'
        }`
      : activeModality === 'PICKUP'
      ? 'Retirada no Balcão • Pagamento Direto'
      : 'Finalizar Pedido Delivery • Pagamento Direto';

  const submitLabel =
    activeModality === 'TABLE'
      ? isOpenTableTab
        ? `Enviar Rodada para Cozinha (Mesa ${String(activeTable).padStart(2, '0')})`
        : `Pagar e Enviar para Cozinha (Mesa ${String(activeTable).padStart(2, '0')})`
      : activeModality === 'PICKUP'
      ? 'Confirmar Pedido para Retirada'
      : 'Confirmar e Transmitir Delivery';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || (isFarFromGps && !confirmRemoteOrder)) return;
    let extraNotes: string | undefined;
    if (payment === 'CASH' && cashChangeFor.trim()) {
      const tag = `[Troco para R$ ${cashChangeFor.trim()}]`;
      if (!deliveryInstructions.includes('Troco para')) {
        extraNotes = tag;
        setDeliveryInstructions(
          deliveryInstructions.trim() ? `${deliveryInstructions.trim()} ${tag}` : tag
        );
      }
    }
    onSubmit(e, resolvedDeliveryCoords || undefined, extraNotes);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={handleFormSubmit}
        className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl animate-scaleIn max-h-[92vh] overflow-y-auto custom-scrollbar overflow-hidden"
      >
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HeaderIcon className="w-5 h-5 text-amber-400" />
              {headerTitle}
            </h3>
            <p className="text-[11px] text-slate-400">
              Estabelecimento: <span className="text-white font-semibold">{resolvedStore.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {isStoreClosed && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1">
              <div className="font-black uppercase tracking-wider text-rose-400">
                Loja Fechada — Pedido Recusado Automaticamente
              </div>
              <p className="text-[11px] opacity-90">
                {resolvedStore.name} encontra-se fechado no momento e não está recebendo novos pedidos.
              </p>
            </div>
          )}

          <CheckoutInteractiveCartBag
            cart={cart}
            onClearCart={clearCart}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeFromCart}
          />

          <ModalitySelector
            activeModality={activeModality}
            updateModality={updateModality}
            activeTable={activeTable}
            updateTable={updateTable}
            currentStoreAddress={resolvedStore.address}
            allowedModalities={allowedModalities}
          />

          <CheckoutCustomerFields
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            address={address}
            setAddress={setAddress}
            activeModality={activeModality}
            deliveryInstructions={deliveryInstructions}
            setDeliveryInstructions={setDeliveryInstructions}
            allowCutlery={allowCutlery}
            needCutlery={needCutlery}
            setNeedCutlery={setNeedCutlery}
            allowTip={allowTip}
            courierTip={courierTip}
            setCourierTip={setCourierTip}
            isFoodStore={isFoodStore}
            savedAddresses={consumer.savedAddresses}
            resolvedDeliveryCoords={resolvedDeliveryCoords}
            distanceToStoreKm={distanceToStoreKm}
            onSelectResolvedCoords={(coords, displayName) => {
              setAddress(displayName);
              setResolvedDeliveryCoords(coords);
            }}
          />

          {activeModality === 'TABLE' && (
            <TableBillingSelector isOpenTableTab={isOpenTableTab} onChangeMode={updateTableBillingMode} />
          )}

          {!isOpenTableTab && (
            <PaymentSelector
              payment={payment}
              setPayment={setPayment}
              pixKey={pixKey}
              acceptedPaymentMethods={resolvedStore.operationalSettings?.acceptedPaymentMethods}
              cashChangeFor={cashChangeFor}
              setCashChangeFor={setCashChangeFor}
            />
          )}

          <CheckoutSummaryBox
            coupon={coupon}
            setCoupon={setCoupon}
            cartTotal={cartTotal}
            effectiveDeliveryFee={effectiveDeliveryFee}
            courierTip={effectiveCourierTip}
            discount={discount}
            couponApplied={Boolean(matchedCoupon)}
            couponInvalid={couponInvalid}
            total={total}
            activeModality={activeModality}
            tableNumber={activeTable}
            isOpenTableTab={isOpenTableTab}
            availableCoupons={eligibleCoupons}
          />

          {isFarFromGps && (
            <CheckoutRemoteGpsWarning
              distanceFromGpsKm={distanceFromGpsKm}
              confirmRemoteOrder={confirmRemoteOrder}
              onChangeConfirmRemoteOrder={setConfirmRemoteOrder}
              onUseCurrentGpsAddress={() => void handleUseCurrentGpsAddress()}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isStoreClosed || isCartEmpty || (isFarFromGps && !confirmRemoteOrder)}
          className={`w-full py-3.5 font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider ${
            isSubmitting || isStoreClosed || isCartEmpty || (isFarFromGps && !confirmRemoteOrder)
              ? 'bg-rose-950 text-rose-300 border border-rose-500/40 cursor-not-allowed opacity-70'
              : activeModality === 'TABLE'
              ? 'bg-gradient-to-r from-amber-500 to-orange-400 hover:from-amber-400 hover:to-orange-300 text-slate-950 cursor-pointer active:scale-98'
              : 'bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 cursor-pointer active:scale-98'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {isSubmitting
              ? 'Enviando Pedido...'
              : isStoreClosed
              ? 'Estabelecimento Fechado • Pedido Bloqueado'
              : isCartEmpty
              ? 'Sacola Vazia • Adicione Itens'
              : isFarFromGps && !confirmRemoteOrder
              ? 'Confirme a distância do endereço acima para pedir'
              : submitLabel}
          </span>
        </button>
      </form>
    </div>
  );
};
