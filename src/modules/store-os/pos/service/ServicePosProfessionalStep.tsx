import React from 'react';
import { Calendar, Clock, Play } from 'lucide-react';
import { AdminUser, Reservation } from '../../../../types';

interface ServicePosProfessionalStepProps {
  professionals: AdminUser[];
  pendingReservations?: Reservation[];
  onCheckInReservation?: (res: Reservation) => void;
  onSelectProfessional: (pro: AdminUser) => void;
}

export const ServicePosProfessionalStep: React.FC<ServicePosProfessionalStepProps> = ({
  professionals,
  pendingReservations = [],
  onCheckInReservation,
  onSelectProfessional,
}) => {
  return (
    <div className="space-y-8">
      {pendingReservations.length > 0 && onCheckInReservation && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-pink-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Agenda Confirmada • Check-in Rápido
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {pendingReservations.length} agendamento(s)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingReservations.slice(0, 6).map((res) => (
              <div
                key={res.id}
                className="p-4 bg-slate-900/90 border border-pink-500/25 rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-pink-400 font-bold">
                    <Clock className="w-3 h-3" /> {res.date} às {res.time}
                  </div>
                  <p className="text-xs font-black text-white truncate mt-0.5">{res.clientName}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {res.serviceOrTable} • {res.professional || 'Geral'}
                  </p>
                </div>
                <button
                  onClick={() => onCheckInReservation(res)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Play className="w-3 h-3" /> Check-in
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black uppercase tracking-tight">Selecione o Profissional</h2>
          <p className="text-xs text-slate-500 uppercase font-bold tracking-widest">
            Atendimento avulso (Walk-in) • Quem realizará o serviço?
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {professionals.map(pro => (
            <button
              key={pro.id}
              onClick={() => onSelectProfessional(pro)}
              className="flex flex-col items-center gap-3 p-6 bg-slate-900/50 hover:bg-indigo-500/10 border-2 border-slate-800 hover:border-indigo-500/50 rounded-3xl transition-all group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 group-hover:text-indigo-400 group-hover:scale-110 transition-all shadow-inner font-black text-xl">
                {pro.name.charAt(0)}
              </div>
              <div className="text-center">
                <p className="text-xs font-black text-white uppercase truncate max-w-[120px]">{pro.name}</p>
                <p className="text-[9px] text-slate-500 font-bold uppercase mt-0.5">{pro.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
