import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, QrCode, X } from 'lucide-react';
import { PlatformBillingPaymentConfig, Store } from '../../../types';
import { LocalQrCode } from '../../../components/common/LocalQrCode';

export interface SelectedPixCharge {
  store: Store;
  pixCode: string;
  amount: number;
  planLabel: string;
}

interface HqPixChargeModalProps {
  selectedPixStore: SelectedPixCharge;
  billingConfig: PlatformBillingPaymentConfig;
  onClose: () => void;
}

export const HqPixChargeModal: React.FC<HqPixChargeModalProps> = ({
  selectedPixStore,
  billingConfig,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPix = () => {
    if (!selectedPixStore.pixCode) return;
    navigator.clipboard.writeText(selectedPixStore.pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              Cobrança PIX SaaS — {selectedPixStore.store.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {selectedPixStore.pixCode ? (
          <>
            <div className="text-center space-y-1">
              <div className="text-[11px] text-slate-400">
                {selectedPixStore.planLabel} • Beneficiário:{' '}
                <strong className="text-slate-200">{billingConfig.beneficiaryName}</strong>
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono tabular-nums">
                R$ {selectedPixStore.amount.toFixed(2)}
              </div>
            </div>

            <div className="w-44 h-44 bg-white p-2.5 rounded-2xl mx-auto flex items-center justify-center shadow-lg border-2 border-slate-800">
              <LocalQrCode
                value={selectedPixStore.pixCode}
                size={156}
                alt="QR Code PIX Assinatura SaaS"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-emerald-400 break-all select-all max-h-24 overflow-y-auto">
              {selectedPixStore.pixCode}
            </div>

            <p className="text-[11px] text-slate-400">
              Chave oficial configurada ({billingConfig.pixKeyType}):{' '}
              <span className="font-mono text-slate-200">{billingConfig.pixKey}</span>. Após receber
              o pagamento, clique em <strong>Confirmar Pago</strong> ou integre o webhook{' '}
              <code className="text-slate-300">POST /api/v1/admin/billing/webhook</code>.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleCopyPix}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar PIX Copia e Cola'}</span>
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2">
              <div className="font-black uppercase flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="w-4 h-4" /> Chave PIX da Plataforma Não Configurada
              </div>
              <p>
                Para gerar cobranças PIX EMV-Co reais para os lojistas, preencha a{' '}
                <strong>Chave PIX Oficial</strong> no painel{' '}
                <em>Configuração de Pagamentos para Lojistas</em> acima e salve.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
