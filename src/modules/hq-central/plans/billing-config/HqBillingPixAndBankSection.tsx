import React from 'react';
import { AlertTriangle, Check, Copy, Landmark, QrCode } from 'lucide-react';
import { PlatformBillingPaymentConfig } from '../../../../types';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';

interface HqBillingPixAndBankSectionProps {
  form: PlatformBillingPaymentConfig;
  canEdit: boolean;
  previewPixPayload: string;
  copiedPreviewPix: boolean;
  onUpdateField: <K extends keyof PlatformBillingPaymentConfig>(
    key: K,
    value: PlatformBillingPaymentConfig[K]
  ) => void;
  onCopyPreviewPix: () => void;
}

export const HqBillingPixAndBankSection: React.FC<HqBillingPixAndBankSectionProps> = ({
  form,
  canEdit,
  previewPixPayload,
  copiedPreviewPix,
  onUpdateField,
  onCopyPreviewPix,
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 pt-2 border-t border-slate-800/80">
      <div className="xl:col-span-2 space-y-5">
        <div className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">
            2. Dados PIX &amp; Recebedor Oficial da Plataforma
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Chave PIX</label>
              <select
                disabled={!canEdit}
                value={form.pixKeyType}
                onChange={(e) =>
                  onUpdateField('pixKeyType', e.target.value as PlatformBillingPaymentConfig['pixKeyType'])
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              >
                <option value="CNPJ">CNPJ</option>
                <option value="CPF">CPF</option>
                <option value="EMAIL">E-mail</option>
                <option value="PHONE">Telefone (+55)</option>
                <option value="EVP">Chave Aleatória (EVP)</option>
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Chave PIX Oficial de Recebimento
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={form.pixKey}
                onChange={(e) => onUpdateField('pixKey', e.target.value)}
                placeholder="Ex: 12.345.678/0001-99 ou financeiro@suaempresa.com.br"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Nome do Beneficiário (EMV-Co)
              </label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={60}
                value={form.beneficiaryName}
                onChange={(e) => onUpdateField('beneficiaryName', e.target.value)}
                placeholder="3C CORP TECNOLOGIA"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Cidade do Beneficiário (EMV-Co)
              </label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={40}
                value={form.beneficiaryCity}
                onChange={(e) => onUpdateField('beneficiaryCity', e.target.value)}
                placeholder="Ex: LONDRINA, SAO PAULO, BRASIL"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                CNPJ / CPF do Recebedor
              </label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={30}
                value={form.beneficiaryDocument || ''}
                onChange={(e) => onUpdateField('beneficiaryDocument', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-60"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-800/60">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Landmark className="w-3.5 h-3.5 text-amber-400" />
            Conta Bancária para Transferência (TED / DOC)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Banco / Código</label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={80}
                value={form.bankName || ''}
                onChange={(e) => onUpdateField('bankName', e.target.value)}
                placeholder="Ex: Banco Inter (077) ou Itaú (341)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Agência</label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={20}
                value={form.bankAgency || ''}
                onChange={(e) => onUpdateField('bankAgency', e.target.value)}
                placeholder="0001"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Tipo de Conta</label>
              <select
                disabled={!canEdit}
                value={form.bankAccountType || 'CORRENTE'}
                onChange={(e) =>
                  onUpdateField(
                    'bankAccountType',
                    e.target.value as PlatformBillingPaymentConfig['bankAccountType']
                  )
                }
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-500 disabled:opacity-60"
              >
                <option value="CORRENTE">Conta Corrente</option>
                <option value="PAGAMENTO">Conta Pagamento</option>
                <option value="POUPANCA">Poupança</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Número da Conta c/ Dígito</label>
              <input
                type="text"
                disabled={!canEdit}
                maxLength={30}
                value={form.bankAccount || ''}
                onChange={(e) => onUpdateField('bankAccount', e.target.value)}
                placeholder="Ex: 1234567-8"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                Parcelamento Máximo no Cartão de Crédito
              </label>
              <select
                disabled={!canEdit}
                value={form.maxCreditInstallments ?? 12}
                onChange={(e) => onUpdateField('maxCreditInstallments', Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-blue-500 disabled:opacity-60"
              >
                {[1, 2, 3, 4, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? '1x (Somente à vista)' : `Até ${n}x no Cartão de Crédito`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Live QR Code EMV-Co Preview */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center text-center space-y-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <QrCode className="w-3.5 h-3.5 text-emerald-400" />
          Prévia Real PIX (R$ 149,00)
        </div>
        {previewPixPayload ? (
          <>
            <div className="w-32 h-32 bg-white p-2 rounded-xl shadow-lg">
              <LocalQrCode
                value={previewPixPayload}
                size={112}
                alt="Prévia QR Code PIX da Plataforma"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-full">
              {form.beneficiaryName || '3C CORP SAAS'} • {(form.beneficiaryCity || 'BRASIL').toUpperCase()}
            </div>
            <button
              type="button"
              onClick={onCopyPreviewPix}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedPreviewPix ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedPreviewPix ? 'Payload Copiado!' : 'Testar Copia e Cola'}
            </button>
          </>
        ) : (
          <div className="py-4 px-2 space-y-2">
            <AlertTriangle className="w-7 h-7 text-amber-400 mx-auto" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {form.pixEnabled
                ? 'Informe a chave PIX oficial ao lado para gerar o QR Code real de recebimento dos lojistas.'
                : 'Recebimento via PIX está bloqueado.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
