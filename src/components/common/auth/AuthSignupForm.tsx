import React, { useEffect, useState } from 'react';
import { Store, ShoppingBag, User, Mail, Lock, Building2, MapPin } from 'lucide-react';
import { PILLAR_THEMES, SURFACE_TOKENS } from '@3c/design-system';
import { BRAZILIAN_STATES, EcosystemSessionRole } from '../../../types';
import { AuthModalContextId } from '../../../context/AuthContext';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

interface AuthSignupFormProps {
  contextId: AuthModalContextId;
  selectedRole: EcosystemSessionRole;
  onSelectRole: (role: EcosystemSessionRole) => void;
  name: string;
  setName: (val: string) => void;
  storeName: string;
  setStoreName: (val: string) => void;
  storeCity: string;
  setStoreCity: (val: string) => void;
  storeState: string;
  setStoreState: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
}

export const AuthSignupForm: React.FC<AuthSignupFormProps> = ({
  contextId,
  selectedRole,
  onSelectRole,
  name,
  setName,
  storeName,
  setStoreName,
  storeCity,
  setStoreCity,
  storeState,
  setStoreState,
  email,
  setEmail,
  password,
  setPassword,
}) => {
  const storeTheme = PILLAR_THEMES['store-os'];
  const marketTheme = PILLAR_THEMES.marketplace;
  const surface = SURFACE_TOKENS.dark;

  const isStoreOsOnly = contextId === 'store-os';
  const isMarketplaceOnly = contextId === 'marketplace';
  const effectiveRole: EcosystemSessionRole = isStoreOsOnly
    ? 'STORE_OWNER'
    : isMarketplaceOnly
    ? 'CUSTOMER'
    : selectedRole;

  const focusBorderClass =
    effectiveRole === 'CUSTOMER' ? 'focus:border-emerald-500' : 'focus:border-amber-500';

  const [cityOptions, setCityOptions] = useState<string[]>([]);

  useEffect(() => {
    if (effectiveRole !== 'STORE_OWNER' || !storeState) return;
    let active = true;
    const apiBase = getPlatformAdapters().network.getApiBaseUrl();
    fetch(`${apiBase}/maps/ibge/cities?uf=${encodeURIComponent(storeState)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.cities)) return;
        setCityOptions(data.cities.map((c: any) => String(c.name || '')).filter(Boolean));
      })
      .catch(() => {
        if (active) setCityOptions([]);
      });
    return () => {
      active = false;
    };
  }, [effectiveRole, storeState]);

  return (
    <div className="space-y-4">
      {isStoreOsOnly && (
        <div className={`p-3.5 rounded-xl border ${storeTheme.badgeClass} flex items-center gap-3`}>
          <Store className={`w-5 h-5 shrink-0 ${storeTheme.accentTextClass}`} />
          <div>
            <div className="text-xs font-black text-white uppercase tracking-tight">
              Nova Conta Lojista • Store OS
            </div>
            <div className="text-[11px] text-slate-300">
              Cria sua loja exclusiva com 7 dias de degustação gratuita em qualquer cidade do Brasil.
            </div>
          </div>
        </div>
      )}

      {isMarketplaceOnly && (
        <div className={`p-3.5 rounded-xl border ${marketTheme.badgeClass} flex items-center gap-3`}>
          <ShoppingBag className={`w-5 h-5 shrink-0 ${marketTheme.accentTextClass}`} />
          <div>
            <div className="text-xs font-black text-white uppercase tracking-tight">
              Cadastro de Consumidor • Marketplace
            </div>
            <div className="text-[11px] text-slate-300">
              Para fazer pedidos, salvar endereços e acompanhar entregas.
            </div>
          </div>
        </div>
      )}

      {!isStoreOsOnly && !isMarketplaceOnly && (
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Tipo de Conta
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onSelectRole('STORE_OWNER')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                effectiveRole === 'STORE_OWNER'
                  ? `${storeTheme.badgeClass} shadow-md`
                  : `${surface.canvasBg} ${surface.border} text-slate-400 hover:border-slate-700`
              }`}
            >
              <Store className={`w-4 h-4 mb-1 ${effectiveRole === 'STORE_OWNER' ? storeTheme.accentTextClass : 'text-slate-500'}`} />
              <div className="text-xs font-black">Lojista (Store OS)</div>
              <div className="text-[10px] text-slate-400 font-normal">Cadastrar minha loja</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectRole('CUSTOMER')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                effectiveRole === 'CUSTOMER'
                  ? `${marketTheme.badgeClass} shadow-md`
                  : `${surface.canvasBg} ${surface.border} text-slate-400 hover:border-slate-700`
              }`}
            >
              <ShoppingBag className={`w-4 h-4 mb-1 ${effectiveRole === 'CUSTOMER' ? marketTheme.accentTextClass : 'text-slate-500'}`} />
              <div className="text-xs font-black">Consumidor</div>
              <div className="text-[10px] text-slate-400 font-normal">Comprar no Marketplace</div>
            </button>
          </div>
        </div>
      )}

      {effectiveRole === 'STORE_OWNER' && (
        <>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Nome da Loja / Estabelecimento
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                minLength={2}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Burger Central, Loja Bella Moda"
                className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none ${focusBorderClass} transition-all`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                UF
              </label>
              <select
                value={storeState}
                onChange={(e) => {
                  const nextUf = e.target.value;
                  setStoreState(nextUf);
                  if (storeCity.trim().toLowerCase() === 'londrina' && nextUf !== 'PR') {
                    setStoreCity('');
                  }
                }}
                className={`w-full px-3 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white focus:outline-none ${focusBorderClass} transition-all cursor-pointer`}
              >
                {BRAZILIAN_STATES.map((st) => (
                  <option key={st.uf} value={st.uf}>
                    {st.uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Cidade da Loja
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  minLength={2}
                  list="signup-ibge-cities"
                  value={storeCity}
                  onChange={(e) => setStoreCity(e.target.value)}
                  placeholder="Ex: Londrina, São Paulo, Curitiba..."
                  className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none ${focusBorderClass} transition-all`}
                />
                {cityOptions.length > 0 && (
                  <datalist id="signup-ibge-cities">
                    {cityOptions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          {effectiveRole === 'STORE_OWNER' ? 'Nome do Responsável' : 'Nome Completo'}
        </label>
        <div className="relative">
          <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={effectiveRole === 'STORE_OWNER' ? 'Seu nome completo' : 'Como deseja ser chamado'}
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none ${focusBorderClass} transition-all`}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          {effectiveRole === 'STORE_OWNER' ? 'E-mail Comercial' : 'Endereço de E-mail'}
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={effectiveRole === 'STORE_OWNER' ? 'contato@sualoja.com' : 'voce@email.com'}
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none ${focusBorderClass} transition-all`}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
          Senha de Acesso (mín. 8 caracteres)
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full pl-10 pr-4 py-3 ${surface.canvasBg} border ${surface.border} rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none ${focusBorderClass} transition-all`}
          />
        </div>
      </div>
    </div>
  );
};
