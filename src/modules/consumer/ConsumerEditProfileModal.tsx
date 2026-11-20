import React, { useState } from 'react';
import { User } from 'lucide-react';

interface ConsumerEditProfileModalProps {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  onSave: (data: { name: string; email: string; phone: string }) => void;
  onClose: () => void;
}

export const ConsumerEditProfileModal: React.FC<ConsumerEditProfileModalProps> = ({
  initialName,
  initialEmail,
  initialPhone,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, email, phone });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <h3 className="font-black text-white text-base flex items-center gap-2">
            <User className="w-5 h-5 text-amber-400" /> Editar Perfil do Consumidor
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-300">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">E-mail de Acesso (Identidade Vinculada)</label>
            <input
              type="email"
              value={email}
              disabled
              readOnly
              className="w-full bg-slate-950/50 border border-slate-800 text-slate-400 p-3 rounded-xl cursor-not-allowed opacity-75"
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-300">Telefone / WhatsApp</label>
            <input
              type="text"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

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
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  );
};
