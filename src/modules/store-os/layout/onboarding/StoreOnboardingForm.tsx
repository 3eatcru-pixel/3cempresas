import React from 'react';
import {
  ArrowRight,
  CreditCard,
  Loader2,
  MapPin,
  Phone,
  Store as StoreIcon,
} from 'lucide-react';
import { BRAZILIAN_STATES, StoreCategory, SubscriptionPlanTier } from '../../../../types';

export interface StoreOnboardingFormValues {
  storeName: string;
  slug: string;
  category: StoreCategory;
  phone: string;
  stateUf: string;
  city: string;
  neighborhood: string;
  address: string;
  pixKey: string;
  plan: SubscriptionPlanTier;
}

interface StoreOnboardingFormProps {
  form: StoreOnboardingFormValues;
  cityOptions: string[];
  loading: boolean;
  errorMsg: string | null;
  onNameChange: (val: string) => void;
  onStateChange: (nextUf: string) => void;
  onUpdateField: <K extends keyof StoreOnboardingFormValues>(
    key: K,
    value: StoreOnboardingFormValues[K]
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const StoreOnboardingForm: React.FC<StoreOnboardingFormProps> = ({
  form,
  cityOptions,
  loading,
  errorMsg,
  onNameChange,
  onStateChange,
  onUpdateField,
  onSubmit,
}) => {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <StoreIcon className="w-3.5 h-3.5 text-amber-400" /> Nome Comercial da Loja
          </label>
          <input
            type="text"
            required
            value={form.storeName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ex: Cantina da Nonna, Empório Central..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Link da Vitrine (Slug)
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => onUpdateField('slug', e.target.value)}
            placeholder="cantina-da-nonna"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Segmento Comercial
          </label>
          <select
            value={form.category}
            onChange={(e) => onUpdateField('category', e.target.value as StoreCategory)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
          >
            <option value="RESTAURANT">Gastronomia / Restaurante</option>
            <option value="RETAIL">Varejo &amp; Conveniência</option>
            <option value="SERVICES">Prestação de Serviços</option>
            <option value="MULTI_COMMERCE">Multi-Comércio Híbrido</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" /> Estado (UF)
          </label>
          <select
            value={form.stateUf}
            onChange={(e) => onStateChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
          >
            {BRAZILIAN_STATES.map((st) => (
              <option key={st.uf} value={st.uf}>
                {st.uf} · {st.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" /> Cidade
          </label>
          <input
            type="text"
            required
            minLength={2}
            list="onboarding-ibge-cities"
            value={form.city}
            onChange={(e) => onUpdateField('city', e.target.value)}
            placeholder="Ex: Londrina, São Paulo, Curitiba..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
          {cityOptions.length > 0 && (
            <datalist id="onboarding-ibge-cities">
              {cityOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Phone className="w-3 h-3 text-amber-400" /> WhatsApp / Telefone
          </label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => onUpdateField('phone', e.target.value)}
            placeholder="(DDD) 99999-0000"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin className="w-3 h-3 text-amber-400" /> Bairro / Região
          </label>
          <input
            type="text"
            value={form.neighborhood}
            onChange={(e) => onUpdateField('neighborhood', e.target.value)}
            placeholder="Ex: Centro, Jardins, Batel..."
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Endereço Comercial (Rua e Número)
          </label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => onUpdateField('address', e.target.value)}
            placeholder="Ex: Av. Principal, 1000 - Sala 2"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-emerald-400" /> Chave PIX para Recebimentos (Opcional)
          </label>
          <input
            type="text"
            value={form.pixKey}
            onChange={(e) => onUpdateField('pixKey', e.target.value)}
            placeholder="CNPJ, E-mail ou Chave Aleatória"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800">
        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Plano Operacional
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onUpdateField('plan', 'FREE')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              form.plan === 'FREE'
                ? 'border-amber-500 bg-amber-500/10 text-white'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white">Trial 14 Dias</div>
            <div className="text-[11px] text-slate-400">R$ 0 / mês · 1 Filial</div>
          </button>

          <button
            type="button"
            onClick={() => onUpdateField('plan', 'BASIC')}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
              form.plan === 'BASIC'
                ? 'border-amber-500 bg-amber-500/10 text-white'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="text-xs font-bold text-white">Plano Básico</div>
            <div className="text-[11px] text-slate-400">R$ 99 / mês · 1 Filial + PDV</div>
          </button>
        </div>
      </div>

      <div className="pt-4 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Inicializando Loja...</span>
            </>
          ) : (
            <>
              <span>Criar Loja e Iniciar Store OS</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
