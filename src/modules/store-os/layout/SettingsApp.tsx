import React, { useState, useEffect } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Sliders, Check } from 'lucide-react';
import { StorePaymentMethod } from '../../../types';
import { SettingsDiningTab } from '../settings/SettingsDiningTab';
import { SettingsCheckoutTab } from '../settings/SettingsCheckoutTab';
import { SettingsProfileAndPixTab } from '../settings/SettingsProfileAndPixTab';
import { SettingsEdgeSyncTab } from '../settings/SettingsEdgeSyncTab';
import { StorePeripheralsManager } from '../billing/StorePeripheralsManager';

const DEFAULT_ACCEPTED_PAYMENT_METHODS: StorePaymentMethod[] = [
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BOLETO',
  'BANK_TRANSFER',
  'PAYMENT_LINK',
];

export const SettingsApp: React.FC = () => {
  const { currentStore, updateStoreOperationalSettings, updateStoreData, toggleStoreDeliveryModality } = useEcosystem();

  const ops = currentStore.operationalSettings || {};

  // Local state for optional toggles initialized with store data
  const [pixKey, setPixKey] = useState<string>(
    ops.pixKey || currentStore.phone || 'financeiro@loja.com'
  );
  const [acceptedPaymentMethods, setAcceptedPaymentMethods] = useState<StorePaymentMethod[]>(
    Array.isArray(ops.acceptedPaymentMethods) && ops.acceptedPaymentMethods.length > 0
      ? ops.acceptedPaymentMethods
      : DEFAULT_ACCEPTED_PAYMENT_METHODS
  );
  const [serviceFee10, setServiceFee10] = useState<boolean>(ops.serviceFee10 ?? false);
  const [requireCpf, setRequireCpf] = useState<boolean>(ops.requireCpfOnCheckout ?? false);
  const [autoNfce, setAutoNfce] = useState<boolean>(ops.autoNfce ?? false);
  const [autoDispatch, setAutoDispatch] = useState<boolean>(ops.autoDispatch ?? true);
  const [kdsAudioAlert, setKdsAudioAlert] = useState<boolean>(ops.kdsAudioAlert ?? true);
  const [darkKitchenMode, setDarkKitchenMode] = useState<boolean>(ops.darkKitchenMode ?? false);
  const [allowCutleryOptIn, setAllowCutleryOptIn] = useState<boolean>(
    ops.allowCutleryOptIn ?? true
  );
  const [allowCourierTip, setAllowCourierTip] = useState<boolean>(ops.allowCourierTip ?? true);
  const [sharedNeighborhoodFleet, setSharedNeighborhoodFleet] = useState<boolean>(
    ops.sharedNeighborhoodFleet ?? false
  );
  const [sharedWarehouseMode, setSharedWarehouseMode] = useState<boolean>(
    ops.sharedWarehouseMode ?? false
  );
  const [aiMenuAssistantEnabled, setAiMenuAssistantEnabled] = useState<boolean>(
    ops.aiMenuAssistantEnabled ?? true
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  useEffect(() => {
    const nextOps = currentStore.operationalSettings || {};
    setPixKey(nextOps.pixKey || currentStore.phone || 'financeiro@loja.com');
    setAcceptedPaymentMethods(
      Array.isArray(nextOps.acceptedPaymentMethods) && nextOps.acceptedPaymentMethods.length > 0
        ? nextOps.acceptedPaymentMethods
        : DEFAULT_ACCEPTED_PAYMENT_METHODS
    );
    setServiceFee10(nextOps.serviceFee10 ?? false);
    setRequireCpf(nextOps.requireCpfOnCheckout ?? false);
    setAutoNfce(nextOps.autoNfce ?? false);
    setAutoDispatch(nextOps.autoDispatch ?? true);
    setKdsAudioAlert(nextOps.kdsAudioAlert ?? true);
    setDarkKitchenMode(nextOps.darkKitchenMode ?? false);
    setAllowCutleryOptIn(nextOps.allowCutleryOptIn ?? true);
    setAllowCourierTip(nextOps.allowCourierTip ?? true);
    setSharedNeighborhoodFleet(nextOps.sharedNeighborhoodFleet ?? false);
    setSharedWarehouseMode(nextOps.sharedWarehouseMode ?? false);
    setAiMenuAssistantEnabled(nextOps.aiMenuAssistantEnabled ?? true);
    setSavedSuccess(false);
  }, [currentStore.id]);

  const handleTogglePaymentMethod = (method: StorePaymentMethod) => {
    setAcceptedPaymentMethods((prev) => {
      const exists = prev.includes(method);
      if (exists) {
        if (prev.length <= 1) return prev;
        return prev.filter((m) => m !== method);
      }
      return [...prev, method];
    });
  };

  const handleSaveSettings = async () => {
    await updateStoreOperationalSettings(currentStore.id, {
      darkKitchenMode,
      sharedWarehouseMode,
      serviceFee10,
      requireCpfOnCheckout: requireCpf,
      autoNfce,
      autoDispatch,
      kdsAudioAlert,
      pixKey,
      acceptedPaymentMethods,
      allowCutleryOptIn,
      allowCourierTip,
      sharedNeighborhoodFleet,
      aiMenuAssistantEnabled,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar animate-fadeIn text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3 sticky top-0 bg-[#0a0e17] z-10 py-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800/80 rounded-xl text-amber-400 border border-slate-700">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
              Configurações Operacionais & Opcionais
            </h3>
            <p className="text-xs text-slate-400">
              Personalize o funcionamento do Store OS para o seu modelo de negócio (Restaurante,
              Dark Kitchen ou Varejo).
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-md hover:from-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4" /> Salvo!
            </>
          ) : (
            <>
              <Check className="w-4 h-4" /> Salvar Preferências
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GROUP 1: Atendimento, Salão & Dark Kitchen */}
        <SettingsDiningTab
          darkKitchenMode={darkKitchenMode}
          setDarkKitchenMode={setDarkKitchenMode}
          serviceFee10={serviceFee10}
          setServiceFee10={setServiceFee10}
          kdsAudioAlert={kdsAudioAlert}
          setKdsAudioAlert={setKdsAudioAlert}
          sharedWarehouseMode={sharedWarehouseMode}
          setSharedWarehouseMode={setSharedWarehouseMode}
        />

        {/* GROUP 2: Checkout, Fiscal & Logística */}
        <SettingsCheckoutTab
          currentStore={currentStore}
          requireCpf={requireCpf}
          setRequireCpf={setRequireCpf}
          autoNfce={autoNfce}
          setAutoNfce={setAutoNfce}
          autoDispatch={autoDispatch}
          setAutoDispatch={setAutoDispatch}
          allowCutleryOptIn={allowCutleryOptIn}
          setAllowCutleryOptIn={setAllowCutleryOptIn}
          allowCourierTip={allowCourierTip}
          setAllowCourierTip={setAllowCourierTip}
          sharedNeighborhoodFleet={sharedNeighborhoodFleet}
          setSharedNeighborhoodFleet={setSharedNeighborhoodFleet}
          deliveryModality={currentStore.deliveryModality || 'STORE_FLEET'}
          onChangeDeliveryModality={(modality) => toggleStoreDeliveryModality(currentStore.id, modality)}
          acceptedPaymentMethods={acceptedPaymentMethods}
          onTogglePaymentMethod={handleTogglePaymentMethod}
        />
      </div>

      {/* GROUP 3 & 4: IA, Setor, PIX Direto, Cota Hardware & Pino GPS */}
      <SettingsProfileAndPixTab
        currentStore={currentStore}
        aiMenuAssistantEnabled={aiMenuAssistantEnabled}
        setAiMenuAssistantEnabled={setAiMenuAssistantEnabled}
        pixKey={pixKey}
        setPixKey={setPixKey}
        onUpdateCategory={(cat) => updateStoreData(currentStore.id, { category: cat })}
        onUpdateLocation={(loc) => updateStoreData(currentStore.id, loc)}
        onSaveSettings={handleSaveSettings}
      />

      {/* GROUP 5: Periféricos Físicos (Impressoras ESC/POS, Balanças & KDS) */}
      <StorePeripheralsManager currentStore={currentStore} />

      {/* GROUP 6: 3C Edge Node Padrão & Sincronização Offline */}
      <SettingsEdgeSyncTab currentStore={currentStore} />
    </div>
  );
};
