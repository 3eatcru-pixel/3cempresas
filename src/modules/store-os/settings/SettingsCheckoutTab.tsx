import React, { useState } from 'react';
import {
  Receipt,
  Truck,
  QrCode,
  CreditCard,
  DollarSign,
  Zap,
  FileText,
  Landmark,
  Link2,
  Check,
} from 'lucide-react';
import { SettingsToggleRow } from './layout/SettingsToggleRow';
import { DeliveryFleetModality, Store, StorePaymentMethod } from '../../../types';
import { DriverQrPairingModal } from '../drivers/DriverQrPairingModal';

export const STORE_PAYMENT_METHODS_CATALOG: {
  id: StorePaymentMethod;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeColor: string;
}[] = [
  {
    id: 'PIX',
    label: 'PIX Direto / QR Dinâmico',
    shortLabel: 'PIX',
    icon: Zap,
    badgeColor: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/15',
  },
  {
    id: 'CREDIT_CARD',
    label: 'Cartão de Crédito',
    shortLabel: 'Crédito',
    icon: CreditCard,
    badgeColor: 'text-blue-400 border-blue-500/40 bg-blue-500/15',
  },
  {
    id: 'DEBIT_CARD',
    label: 'Cartão de Débito',
    shortLabel: 'Débito',
    icon: CreditCard,
    badgeColor: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/15',
  },
  {
    id: 'CASH',
    label: 'Dinheiro / Espécie',
    shortLabel: 'Dinheiro',
    icon: DollarSign,
    badgeColor: 'text-amber-400 border-amber-500/40 bg-amber-500/15',
  },
  {
    id: 'BOLETO',
    label: 'Boleto Bancário',
    shortLabel: 'Boleto',
    icon: FileText,
    badgeColor: 'text-purple-400 border-purple-500/40 bg-purple-500/15',
  },
  {
    id: 'BANK_TRANSFER',
    label: 'Transferência Bancária (TED/DOC)',
    shortLabel: 'TED / DOC',
    icon: Landmark,
    badgeColor: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/15',
  },
  {
    id: 'PAYMENT_LINK',
    label: 'Link de Pagamento / Carteira',
    shortLabel: 'Link / Carteira',
    icon: Link2,
    badgeColor: 'text-pink-400 border-pink-500/40 bg-pink-500/15',
  },
];

interface SettingsCheckoutTabProps {
  currentStore?: Store;
  requireCpf: boolean;
  setRequireCpf: (val: boolean) => void;
  autoNfce: boolean;
  setAutoNfce: (val: boolean) => void;
  autoDispatch: boolean;
  setAutoDispatch: (val: boolean) => void;
  allowCutleryOptIn: boolean;
  setAllowCutleryOptIn: (val: boolean) => void;
  allowCourierTip: boolean;
  setAllowCourierTip: (val: boolean) => void;
  sharedNeighborhoodFleet: boolean;
  setSharedNeighborhoodFleet: (val: boolean) => void;
  deliveryModality?: DeliveryFleetModality;
  onChangeDeliveryModality?: (modality: DeliveryFleetModality) => void;
  acceptedPaymentMethods?: StorePaymentMethod[];
  onTogglePaymentMethod?: (method: StorePaymentMethod) => void;
}

export const SettingsCheckoutTab: React.FC<SettingsCheckoutTabProps> = ({
  currentStore,
  requireCpf,
  setRequireCpf,
  autoNfce,
  setAutoNfce,
  autoDispatch,
  setAutoDispatch,
  allowCutleryOptIn,
  setAllowCutleryOptIn,
  allowCourierTip,
  setAllowCourierTip,
  sharedNeighborhoodFleet,
  setSharedNeighborhoodFleet,
  deliveryModality = 'STORE_FLEET',
  onChangeDeliveryModality,
  acceptedPaymentMethods = [
    'PIX',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CASH',
    'BOLETO',
    'BANK_TRANSFER',
    'PAYMENT_LINK',
  ],
  onTogglePaymentMethod,
}) => {
  const [isDriverQrOpen, setIsDriverQrOpen] = useState(false);

  return (
    <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h4 className="font-bold text-sm text-white flex items-center gap-2">
          <Receipt className="w-4 h-4 text-cyan-400" />
          <span>Checkout, Pagamentos, Fiscal & Logística</span>
        </h4>
        <span className="text-[10px] text-slate-500 uppercase font-mono">Operação da Loja</span>
      </div>

      {onChangeDeliveryModality && (
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-orange-400" />
              Modalidade de Frota & Entregas
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {deliveryModality === 'STORE_FLEET' ? 'FROTA PRÓPRIA' : 'FROTA PLATAFORMA'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeDeliveryModality('STORE_FLEET')}
              className={`py-2 px-3 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                deliveryModality === 'STORE_FLEET'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Frota Própria da Loja
            </button>
            <button
              type="button"
              onClick={() => onChangeDeliveryModality('PLATFORM_FLEET')}
              className={`py-2 px-3 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                deliveryModality === 'PLATFORM_FLEET'
                  ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Rede / Frota Compartilhada
            </button>
          </div>

          {currentStore && (
            <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-800/80">
              <span className="text-[10px] text-slate-400">
                Pareie seus entregadores próprios via QR Code / PIN de 6 dígitos:
              </span>
              <button
                type="button"
                onClick={() => setIsDriverQrOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-300 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                QR Code • Motorista Próprio
              </button>
            </div>
          )}
        </div>
      )}

      {/* All Payment Modes Configuration */}
      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
            Modos de Pagamento Habilitados (PDV, Salão, Totem & Vitrine)
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            {acceptedPaymentMethods.length} ATIVOS
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {STORE_PAYMENT_METHODS_CATALOG.map((pm) => {
            const isEnabled = acceptedPaymentMethods.includes(pm.id);
            const Icon = pm.icon;
            return (
              <button
                key={pm.id}
                type="button"
                onClick={() => onTogglePaymentMethod?.(pm.id)}
                className={`p-2 rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                  isEnabled
                    ? pm.badgeColor
                    : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[11px] font-bold truncate">{pm.label}</span>
                </div>
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                    isEnabled ? 'bg-white/20 text-white' : 'bg-slate-800 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <SettingsToggleRow
          title="Exigir CPF no Checkout do Consumidor"
          description="Se desativado, o cliente compra rapidamente sem burocracia."
          checked={requireCpf}
          onToggle={() => setRequireCpf(!requireCpf)}
          activeColor="bg-blue-500"
        />

        <SettingsToggleRow
          title="Emissão Fiscal NFC-e Automática"
          description="Transmite para o SEFAZ a cada venda. Desative se for MEI isento."
          checked={autoNfce}
          onToggle={() => setAutoNfce(!autoNfce)}
          activeColor="bg-emerald-500"
        />

        <SettingsToggleRow
          title="Despacho Automático de Motoboys"
          description="Chama o motoboy mais próximo assim que o prato fica pronto no KDS."
          checked={autoDispatch}
          onToggle={() => setAutoDispatch(!autoDispatch)}
          activeColor="bg-orange-500"
        />

        <SettingsToggleRow
          title="Pergunta Opcional de Talheres no Checkout"
          description="Pergunta se o cliente precisa de talheres plásticos (reduz custos e plástico)."
          checked={allowCutleryOptIn}
          onToggle={() => setAllowCutleryOptIn(!allowCutleryOptIn)}
          activeColor="bg-teal-500"
        />

        <SettingsToggleRow
          title="Gorjeta Opcional para o Motoboy"
          description="Habilita botões de gorjeta voluntária (R$ 2, R$ 5, R$ 10) no marketplace."
          checked={allowCourierTip}
          onToggle={() => setAllowCourierTip(!allowCourierTip)}
          activeColor="bg-amber-500"
        />

        <SettingsToggleRow
          title="Pool de Frota Compartilhada de Bairro"
          description="Permite que motoboys parceiros de lojas vizinhas atendam seus pedidos."
          checked={sharedNeighborhoodFleet}
          onToggle={() => setSharedNeighborhoodFleet(!sharedNeighborhoodFleet)}
          activeColor="bg-indigo-500"
        />
      </div>

      {isDriverQrOpen && currentStore && (
        <DriverQrPairingModal
          currentStore={currentStore}
          onClose={() => setIsDriverQrOpen(false)}
          isDriverClient={false}
        />
      )}
    </div>
  );
};
