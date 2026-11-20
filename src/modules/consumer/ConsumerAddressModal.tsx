import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { SavedAddress } from '../../types';

interface ConsumerAddressModalProps {
  editingAddress?: SavedAddress | null;
  onSave: (addressData: Omit<SavedAddress, 'id'>) => void;
  onClose: () => void;
}

export const ConsumerAddressModal: React.FC<ConsumerAddressModalProps> = ({
  editingAddress,
  onSave,
  onClose,
}) => {
  const [addressLabel, setAddressLabel] = useState('Casa');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [addressComplement, setAddressComplement] = useState('');
  const [addressNeighborhood, setAddressNeighborhood] = useState('');
  const [addressCity, setAddressCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [addressZip, setAddressZip] = useState('');
  const [addressIsDefault, setAddressIsDefault] = useState(false);

  useEffect(() => {
    if (editingAddress) {
      setAddressLabel(editingAddress.label);
      setAddressStreet(editingAddress.street);
      setAddressNumber(editingAddress.number);
      setAddressComplement(editingAddress.complement || '');
      setAddressNeighborhood(editingAddress.neighborhood);
      setAddressCity(editingAddress.city);
      setAddressState(editingAddress.state);
      setAddressZip(editingAddress.zipCode);
      setAddressIsDefault(editingAddress.isDefault);
    }
  }, [editingAddress]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressStreet || !addressNumber || !addressNeighborhood) return;

    onSave({
      label: addressLabel,
      street: addressStreet,
      number: addressNumber,
      complement: addressComplement,
      neighborhood: addressNeighborhood,
      city: addressCity,
      state: addressState,
      zipCode: addressZip,
      isDefault: addressIsDefault,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <MapPin className="w-5 h-5 text-amber-400" />
            {editingAddress ? 'Editar Endereço' : 'Novo Endereço de Entrega'}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="col-span-2 space-y-1">
            <label className="font-bold text-slate-300">Rótulo do Local (ex: Casa, Trabalho)</label>
            <input
              type="text"
              required
              value={addressLabel}
              onChange={e => setAddressLabel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div className="col-span-2 space-y-1">
            <label className="font-bold text-slate-300">Logradouro / Rua / Avenida</label>
            <input
              type="text"
              required
              placeholder="Ex: Avenida Higienópolis"
              value={addressStreet}
              onChange={e => setAddressStreet(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">Número</label>
            <input
              type="text"
              required
              placeholder="1000"
              value={addressNumber}
              onChange={e => setAddressNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">Complemento (opcional)</label>
            <input
              type="text"
              placeholder="Apto 12B"
              value={addressComplement}
              onChange={e => setAddressComplement(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">Bairro</label>
            <input
              type="text"
              required
              placeholder="Bela Vista"
              value={addressNeighborhood}
              onChange={e => setAddressNeighborhood(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">CEP</label>
            <input
              type="text"
              required
              placeholder="01310-100"
              value={addressZip}
              onChange={e => setAddressZip(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-2.5 rounded-xl font-mono focus:outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-2">
          <input
            type="checkbox"
            checked={addressIsDefault}
            onChange={e => setAddressIsDefault(e.target.checked)}
            className="w-4 h-4 accent-amber-500 rounded"
          />
          <span>Definir este endereço como Padrão no Marketplace</span>
        </label>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow"
          >
            Salvar Endereço
          </button>
        </div>
      </form>
    </div>
  );
};
