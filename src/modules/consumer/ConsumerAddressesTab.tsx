import React from 'react';
import { useConsumer } from '../../context/ConsumerContext';
import { MapPin, Compass, Plus, Edit3, Trash2 } from 'lucide-react';
import { SavedAddress } from '../../types';

interface ConsumerAddressesTabProps {
  onOpenNewAddress: () => void;
  onOpenEditAddress: (addr: SavedAddress) => void;
}

export const ConsumerAddressesTab: React.FC<ConsumerAddressesTabProps> = ({
  onOpenNewAddress,
  onOpenEditAddress
}) => {
  const { consumer, deleteAddress, setDefaultAddress } = useConsumer();

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" /> Meus Endereços de Entrega
          </h3>
          <p className="text-xs text-slate-400">Cadastre múltiplos endereços para entregas rápidas no Marketplace</p>
        </div>
        <button
          onClick={onOpenNewAddress}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Novo Endereço
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {consumer.savedAddresses.map(addr => (
          <div 
            key={addr.id} 
            className={`p-5 rounded-2xl border-2 space-y-3 relative transition-all ${
              addr.isDefault 
                ? 'bg-slate-950 border-amber-500 shadow-xl' 
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-amber-400 text-xs uppercase flex items-center gap-1.5">
                <Compass className="w-4 h-4" /> {addr.label}
              </span>

              {addr.isDefault ? (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/20">
                  ● ENDEREÇO PADRÃO
                </span>
              ) : (
                <button
                  onClick={() => setDefaultAddress(addr.id)}
                  className="text-[10px] text-slate-400 hover:text-white font-bold underline"
                >
                  Definir como Padrão
                </button>
              )}
            </div>

            <div className="space-y-1">
              <div className="text-white text-xs font-bold">{addr.street}, {addr.number} {addr.complement && `(${addr.complement})`}</div>
              <div className="text-slate-400 text-[11px]">{addr.neighborhood} — {addr.city}/{addr.state}</div>
              <div className="text-slate-500 font-mono text-[10px]">CEP: {addr.zipCode}</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
              <button
                onClick={() => onOpenEditAddress(addr)}
                className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                title="Editar"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              {!addr.isDefault && (
                <button
                  onClick={() => deleteAddress(addr.id)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
