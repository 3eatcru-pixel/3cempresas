import React from 'react';
import {
  Star,
  ShieldCheck,
  Mail,
  Phone,
  Edit3,
  MapPin,
  Settings,
} from 'lucide-react';
import { ConsumerProfile } from '../../types';

interface ConsumerHeroBannerProps {
  consumer: ConsumerProfile;
  onEditProfile: () => void;
}

export const ConsumerHeroBanner: React.FC<ConsumerHeroBannerProps> = ({
  consumer,
  onEditProfile,
}) => {
  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl relative">
      <div className="h-36 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-700 p-6 relative">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="px-3 py-1 bg-slate-950/70 backdrop-blur-md text-amber-400 font-mono text-xs font-black rounded-full border border-amber-500/30 flex items-center gap-1.5 shadow-lg">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> Member Level: GOLD VIP
          </span>
        </div>

        <div className="absolute -bottom-10 left-8 flex items-end gap-5">
          <div className="relative group">
            <img
              src={
                consumer.avatar ||
                'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80'
              }
              alt=""
              className="w-24 h-24 rounded-3xl object-cover border-4 border-slate-900 shadow-2xl bg-slate-950"
            />
            <button
              onClick={onEditProfile}
              className="absolute -bottom-1 -right-1 bg-amber-500 hover:bg-amber-400 text-slate-950 p-1.5 rounded-full border-2 border-slate-900 shadow-md transition-transform hover:scale-110 cursor-pointer"
              title="Editar perfil"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="pb-2">
            <h1 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter drop-shadow-md flex items-center gap-2">
              <span>{consumer.name}</span>
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-amber-300">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> {consumer.email}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> {consumer.phone}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-14 px-8 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border-t border-slate-800/80">
        <div className="flex flex-wrap gap-6 text-xs">
          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-black uppercase">Endereço Padrão</div>
            <div className="text-slate-200 font-bold flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {consumer.savedAddresses.find((a) => a.isDefault)?.label ||
                  (consumer.savedAddresses.length > 0
                    ? `${consumer.savedAddresses[0].street}, ${consumer.savedAddresses[0].number}`
                    : 'Nenhum endereço cadastrado')}
              </span>
            </div>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-black uppercase">Pontos Globais 3EAT</div>
            <div className="text-amber-400 font-black font-mono text-sm mt-0.5">
              340 pts acumulados
            </div>
          </div>

          <div className="bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800">
            <div className="text-[10px] text-slate-500 font-black uppercase">Forma PGTO Preferida</div>
            <div className="text-emerald-400 font-bold font-mono text-xs mt-0.5">
              {consumer.preferences.defaultPaymentMethod} (Desconto Split)
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={onEditProfile}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-amber-400" /> Editar Perfil
          </button>
        </div>
      </div>
    </div>
  );
};
