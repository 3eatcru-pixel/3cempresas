import React, { useMemo, useState } from 'react';
import { Store as StoreIcon, Sparkles, QrCode, Laptop, CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import { Store } from '../../../types';
import { getStoreMaxBranches, getStoreMaxDevices } from '../../../utils/storeDomain';
import { generateEmvCoPixPayload } from '../../../utils/pix';
import { StoreGeolocationMapCard } from './StoreGeolocationMapCard';

interface SettingsProfileAndPixTabProps {
  currentStore: Store;
  aiMenuAssistantEnabled: boolean;
  setAiMenuAssistantEnabled: (val: boolean) => void;
  pixKey: string;
  setPixKey: (val: string) => void;
  onUpdateCategory: (category: any) => void;
  onUpdateLocation?: (updates: {
    address: string;
    city?: string;
    state?: string;
    latitude: number;
    longitude: number;
  }) => Promise<void> | void;
  onSaveSettings: () => void;
}

const detectPixKeyType = (rawKey: string): { valid: boolean; label: string } => {
  const key = rawKey.trim();
  if (!key) return { valid: false, label: 'Chave não configurada' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return { valid: true, label: 'E-mail' };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return { valid: true, label: 'Chave Aleatória (EVP)' };
  }
  const digits = key.replace(/\D/g, '');
  if (key.startsWith('+55') && digits.length >= 12 && digits.length <= 13) {
    return { valid: true, label: 'Celular (+55)' };
  }
  if (digits.length === 14 && /^[\d.\-/]+$/.test(key)) return { valid: true, label: 'CNPJ' };
  if (digits.length === 11 && /^[\d.\-()+\s]+$/.test(key)) {
    return { valid: true, label: 'CPF ou Celular' };
  }
  if (key.length >= 6) return { valid: true, label: 'Chave Personalizada' };
  return { valid: false, label: 'Formato muito curto' };
};

export const SettingsProfileAndPixTab: React.FC<SettingsProfileAndPixTabProps> = ({
  currentStore,
  aiMenuAssistantEnabled,
  setAiMenuAssistantEnabled,
  pixKey,
  setPixKey,
  onUpdateCategory,
  onUpdateLocation,
  onSaveSettings,
}) => {
  const [showEmvPreview, setShowEmvPreview] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  const pixValidation = useMemo(() => detectPixKeyType(pixKey), [pixKey]);

  const sampleEmvPayload = useMemo(() => {
    if (!pixValidation.valid) return '';
    return generateEmvCoPixPayload({
      pixKey: pixKey.trim(),
      amount: 1.0,
      merchantName: currentStore.name,
      merchantCity: currentStore.city || 'BRASIL',
      txid: 'TESTE3C01',
      description: 'Validacao PIX',
    });
  }, [pixKey, pixValidation.valid, currentStore.name, currentStore.city]);

  const handleCopyEmv = () => {
    if (!sampleEmvPayload) return;
    navigator.clipboard?.writeText(sampleEmvPayload).then(() => {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    }).catch(() => {});
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GROUP 3: IA & Inteligência de Dados */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>IA &amp; Inteligência de Dados</span>
            </h4>
            <span className="text-[10px] text-slate-500 uppercase font-mono">Incluso Pro</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
              <div className="space-y-0.5 max-w-[75%]">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  Assistente de Cardápio
                </div>
                <div className="text-[10px] text-slate-400">
                  Sugere descrições vendedoras e ajuda na precificação do catálogo da loja.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiMenuAssistantEnabled(!aiMenuAssistantEnabled)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  aiMenuAssistantEnabled ? 'bg-amber-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    aiMenuAssistantEnabled ? 'right-0.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* GROUP 4: Perfil do Estabelecimento & Setor */}
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h4 className="font-bold text-sm text-white flex items-center gap-2">
              <StoreIcon className="w-4 h-4 text-emerald-400" />
              <span>Perfil do Estabelecimento</span>
            </h4>
            <span className="text-[10px] text-slate-500 uppercase font-mono">Setor</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">
                Setor de Atuação (Muda o Layout do PDV)
              </label>
              <select
                value={currentStore.category}
                onChange={(e) => onUpdateCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl font-bold focus:outline-none focus:border-emerald-400"
              >
                <option value="BURGER">Gastronomia / Hamburgueria (Delivery + Salão)</option>
                <option value="PIZZA">Gastronomia / Pizzaria (Massas &amp; Mesas)</option>
                <option value="JAPANESE">Gastronomia / Culinária Japonesa (Sushis &amp; Mesas)</option>
                <option value="RESTAURANT">Gastronomia / Restaurante Completo (Salão &amp; Delivery)</option>
                <option value="BEVERAGES">Distribuidora de Bebidas (Modo Gôndola)</option>
                <option value="RETAIL">Varejo / Empório / Mercado (Gôndola &amp; Barcode)</option>
                <option value="FURNITURE">Móveis &amp; Decoração (Showroom &amp; Dimensões)</option>
                <option value="ELECTRONICS">Eletrônicos &amp; Tech (Ficha Técnica &amp; Garantia)</option>
                <option value="FASHION">Moda, Vestuário &amp; Boutique (Tamanhos &amp; Cores)</option>
                <option value="HEALTH">Saúde &amp; Farmácia (Cuidados &amp; Varejo)</option>
                <option value="BEAUTY">Salão de Beleza / Barbearia (Agendamento de Serviços)</option>
                <option value="SERVICES">Serviços Especializados / Clínica (Agendamento)</option>
                <option value="MULTI_COMMERCE">Multivendas Híbrido (Vende de Tudo + Comida + Serviços)</option>
              </select>
              <p className="text-[9px] text-slate-500">
                Isso altera como o Terminal de Vendas e o Inventário se comportam.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chave PIX Direta (0% de Taxa) & Hardware Quota */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <h4 className="font-bold text-sm text-white">
                Chave PIX Direta (0% Taxa)
              </h4>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                pixValidation.valid
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}
            >
              {pixValidation.valid ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <AlertTriangle className="w-3 h-3" />
              )}
              {pixValidation.label}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Cadastre a chave PIX da conta da loja (CNPJ, Celular +55, E-mail ou Chave Aleatória) para gerar QR Codes EMVCo direto no checkout.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Ex: 12.345.678/0001-99 ou pix@loja.com"
              className="flex-1 min-w-[180px] bg-slate-950 border border-slate-700 text-xs px-3.5 py-2 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={onSaveSettings}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Salvar PIX
            </button>
            <button
              type="button"
              disabled={!pixValidation.valid}
              onClick={() => setShowEmvPreview((v) => !v)}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              {showEmvPreview ? 'Ocultar EMV' : 'Testar EMV'}
            </button>
          </div>

          {showEmvPreview && sampleEmvPayload && (
            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold uppercase text-emerald-400">
                  BR Code EMVCo Gerado (Teste R$ 1,00 • CRC16 OK)
                </span>
                <button
                  type="button"
                  onClick={handleCopyEmv}
                  className="inline-flex items-center gap-1 text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedPayload ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <div className="font-mono text-[10px] text-slate-300 break-all bg-slate-900/90 p-2 rounded-lg border border-slate-800 select-all">
                {sampleEmvPayload}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Laptop className="w-4 h-4 text-cyan-400" />
              <h4 className="font-bold text-sm text-white">
                Plano Contratado &amp; Cota de Filiais
              </h4>
            </div>
            <p className="text-xs text-slate-400">
              Plano:{' '}
              <span className="text-amber-400 font-bold uppercase">
                {currentStore.subscriptionPlan || 'FREE'}
              </span>{' '}
              • Limites:{' '}
              <span className="text-white font-bold font-mono tabular-nums">
                {getStoreMaxBranches(currentStore)} filial(is) •{' '}
                {getStoreMaxDevices(currentStore) >= 999
                  ? 'Terminais Ilimitados'
                  : `Até ${getStoreMaxDevices(currentStore)} Terminais`}
              </span>
              .
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-emerald-400 font-bold font-mono tabular-nums">
              {(currentStore.enabledModules || []).length} Módulo(s) Operacional(is) Ativo(s)
            </span>
            <span className="font-mono text-slate-500">Conexão Segura Ativa</span>
          </div>
        </div>
      </div>

      {onUpdateLocation && (
        <StoreGeolocationMapCard
          currentStore={currentStore}
          onUpdateLocation={onUpdateLocation}
        />
      )}
    </>
  );
};
