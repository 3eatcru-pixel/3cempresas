import React, { useEffect, useState } from 'react';
import { User, Phone, MapPin, MessageSquare, UtensilsCrossed, Heart, BookmarkCheck, CheckCircle2, Navigation } from 'lucide-react';
import {
  isValidLatLng,
  lookupBrazilianCep,
  NominatimGeocodeResult,
  searchAddressSuggestions,
} from '../../../components/common/map/mapUtils';

export interface SavedAddressItem {
  id: string;
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
}

interface CheckoutCustomerFieldsProps {
  name: string;
  setName: (name: string) => void;
  phone: string;
  setPhone: (phone: string) => void;
  address: string;
  setAddress: (address: string) => void;
  activeModality: 'DELIVERY' | 'PICKUP' | 'TABLE';
  deliveryInstructions: string;
  setDeliveryInstructions: (instr: string) => void;
  allowCutlery: boolean;
  needCutlery: boolean;
  setNeedCutlery: (val: boolean) => void;
  allowTip: boolean;
  courierTip: number;
  setCourierTip: (val: number) => void;
  isFoodStore?: boolean;
  savedAddresses?: SavedAddressItem[];
  resolvedDeliveryCoords?: [number, number] | null;
  distanceToStoreKm?: number | null;
  onSelectResolvedCoords?: (coords: [number, number], displayName: string) => void;
}

export const CheckoutCustomerFields: React.FC<CheckoutCustomerFieldsProps> = ({
  name,
  setName,
  phone,
  setPhone,
  address,
  setAddress,
  activeModality,
  deliveryInstructions,
  setDeliveryInstructions,
  allowCutlery,
  needCutlery,
  setNeedCutlery,
  allowTip,
  courierTip,
  setCourierTip,
  isFoodStore = true,
  savedAddresses = [],
  resolvedDeliveryCoords = null,
  distanceToStoreKm = null,
  onSelectResolvedCoords,
}) => {
  const isDelivery = activeModality === 'DELIVERY';
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimGeocodeResult[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  const formatSavedAddress = (addr: SavedAddressItem) =>
    `${addr.street}, ${addr.number}${addr.complement ? ` (${addr.complement})` : ''} - ${addr.neighborhood}, ${addr.city}`;

  useEffect(() => {
    if (!isDelivery || !inputFocused) {
      setAddressSuggestions([]);
      return;
    }
    const trimmed = address.trim();
    if (trimmed.length < 4) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const cleanDigits = trimmed.replace(/\D/g, '');
      if (/^\d{5}-?\d{3}$/.test(trimmed) || cleanDigits.length === 8) {
        const cepMatch = await lookupBrazilianCep(cleanDigits, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setAddressSuggestions(cepMatch ? [cepMatch] : []);
        }
        return;
      }
      const list = await searchAddressSuggestions(trimmed, {
        limit: 4,
        countryCodeFilter: 'BR',
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setAddressSuggestions(list);
      }
    }, 320);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [address, isDelivery, inputFocused]);

  return (
    <>
      {/* Nome */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-amber-400" />
          {activeModality === 'TABLE' ? 'Seu Nome na Comanda (Opcional)' : 'Seu Nome'}
        </label>
        <input
          type="text"
          required={activeModality !== 'TABLE'}
          placeholder={activeModality === 'TABLE' ? 'Ex: João (opcional)' : 'Seu nome completo'}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Telefone */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-amber-400" /> WhatsApp / Telefone
        </label>
        <input
          type="text"
          required={isDelivery}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Endereço exclusivamente para DELIVERY */}
      {isDelivery && (
        <div className="space-y-1.5 relative">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-400" /> Endereço de Entrega ou CEP
            </label>
            {resolvedDeliveryCoords && isValidLatLng(resolvedDeliveryCoords[0], resolvedDeliveryCoords[1]) && (
              <span className="text-[9px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Pino validado
                {typeof distanceToStoreKm === 'number' && distanceToStoreKm > 0
                  ? ` • ${distanceToStoreKm.toFixed(1)} km da loja`
                  : ''}
              </span>
            )}
          </div>
          {savedAddresses.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {savedAddresses.map((addr) => {
                const formatted = formatSavedAddress(addr);
                const isSelected = address === formatted;
                return (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => {
                      setAddress(formatted);
                      setAddressSuggestions([]);
                    }}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <BookmarkCheck className="w-3 h-3" />
                    <span>{addr.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <input
            type="text"
            required
            placeholder="Rua, Número, Bairro - Cidade/UF ou CEP (ex: 86015-010)"
            value={address}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setTimeout(() => setInputFocused(false), 180)}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500/50"
          />
          {addressSuggestions.length > 0 && (
            <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-800/80 shadow-2xl">
              {addressSuggestions.map((item, idx) => (
                <button
                  key={`${item.lat}-${item.lng}-${idx}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setAddress(item.displayName);
                    setAddressSuggestions([]);
                    setInputFocused(false);
                    onSelectResolvedCoords?.([item.lat, item.lng], item.displayName);
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] text-slate-200 hover:bg-slate-800 hover:text-amber-400 flex items-start gap-2 cursor-pointer transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 font-medium">{item.displayName}</div>
                    {item.cep && (
                      <div className="text-[9px] text-slate-400 font-mono">CEP {item.cep}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Observações do Pedido */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
          {activeModality === 'TABLE'
            ? 'Observações para a Cozinha (Opcional)'
            : activeModality === 'PICKUP'
            ? 'Observações para Retirada (Opcional)'
            : 'Observações do Pedido / Entrega (Opcional)'}
        </label>
        <input
          type="text"
          placeholder={
            activeModality === 'TABLE'
              ? 'Ex: Sem cebola, ponto da carne, gelo à parte...'
              : activeModality === 'PICKUP'
              ? 'Ex: Retiro em 20 min, nome na embalagem...'
              : 'Ex: Apto 102, Bloco C, interfone...'
          }
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-2.5 rounded-xl focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Talheres Descartáveis — ESTRITAMENTE para Delivery de Gastronomia */}
      {isDelivery && isFoodStore && allowCutlery && (
        <label className="flex items-center gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition-colors">
          <input
            type="checkbox"
            checked={needCutlery}
            onChange={(e) => setNeedCutlery(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
          />
          <div className="space-y-0.5 text-xs">
            <span className="font-bold text-white flex items-center gap-1.5">
              <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" /> Precisa de talheres
              descartáveis?
            </span>
            <p className="text-[10px] text-slate-400">
              Desmarque para ajudar a reduzir o uso de plásticos de uso único.
            </p>
          </div>
        </label>
      )}

      {/* Gorjeta Voluntária ao Motoboy — ESTRITAMENTE para Delivery */}
      {isDelivery && allowTip && (
        <div className="space-y-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-pink-400" /> Gorjeta Opcional para o Motoboy
            </label>
            <span className="text-[9px] text-emerald-400 font-mono">
              100% repassado ao entregador
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {[0, 2, 5, 10].map((val) => (
              <button
                type="button"
                key={val}
                onClick={() => setCourierTip(val)}
                className={`py-1.5 rounded-lg border font-mono font-bold transition-all cursor-pointer ${
                  courierTip === val
                    ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {val === 0 ? 'Sem gorjeta' : `+ R$ ${val}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
