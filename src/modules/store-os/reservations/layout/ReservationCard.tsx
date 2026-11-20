import React, { useState } from 'react';
import { Phone, MessageSquare, CheckCircle2, XCircle, Trash2, CheckCheck } from 'lucide-react';
import { Reservation } from '../../../../types';

interface ReservationCardProps {
  reservation: Reservation;
  whatsappUrl: string;
  onSendWhatsApp: (res: Reservation) => void;
  onUpdateStatus: (id: string, status: Reservation['status']) => void;
  onDelete: (id: string) => void;
}

const STATUS_META: Record<
  Reservation['status'],
  { label: string; colorClass: string }
> = {
  CONFIRMED: { label: 'Confirmada', colorClass: 'text-emerald-400' },
  PENDING: { label: 'Pendente', colorClass: 'text-amber-400' },
  COMPLETED: { label: 'Concluída', colorClass: 'text-sky-400' },
  CANCELLED: { label: 'Cancelada', colorClass: 'text-rose-400' },
};

export const ReservationCard: React.FC<ReservationCardProps> = ({
  reservation: res,
  whatsappUrl,
  onSendWhatsApp,
  onUpdateStatus,
  onDelete,
}) => {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const statusInfo = STATUS_META[res.status] || {
    label: res.status,
    colorClass: 'text-slate-400',
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="font-mono tabular-nums text-pink-400 font-semibold">
            <span>{res.time}</span>
            {res.durationMinutes ? (
              <>
                <span className="text-slate-600 mx-1.5">·</span>
                <span>{res.durationMinutes} min</span>
              </>
            ) : null}
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-slate-300">
              {res.guestsCount} {res.guestsCount === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>
          <span className={`text-xs font-semibold shrink-0 ${statusInfo.colorClass}`}>
            {statusInfo.label}
          </span>
        </div>

        <div>
          <h4 className="font-bold text-white text-base tracking-tight">{res.clientName}</h4>
          <p className="text-xs font-mono tabular-nums text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Phone className="w-3 h-3 text-emerald-400 shrink-0" /> {res.clientPhone}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Serviço / Mesa</span>
            <span className="text-white font-semibold text-right">{res.serviceOrTable}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Profissional</span>
            <span className="text-pink-300 font-medium text-right">{res.professional || 'Geral'}</span>
          </div>
          {res.clientPreferences && (
            <div className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5 mt-1.5">
              <span className="font-semibold text-indigo-400 block mb-0.5">Preferências / Anamnese</span>
              {res.clientPreferences}
            </div>
          )}
          {res.returnReminderDate && (
            <div className="flex justify-between text-[11px] pt-1">
              <span className="text-slate-500">Retorno sugerido</span>
              <span className="text-amber-400 font-mono tabular-nums font-semibold">{res.returnReminderDate}</span>
            </div>
          )}
          {res.notes && (
            <p className="text-[11px] text-slate-400 italic pt-1.5 border-t border-slate-800/60 mt-1.5">
              "{res.notes}"
            </p>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        {confirmingDelete ? (
          <div className="flex items-center justify-between w-full gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-rose-300">Excluir reserva?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDelete(res.id)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Excluir
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              >
                Não
              </button>
            </div>
          </div>
        ) : (
          <>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onSendWhatsApp(res)}
              className="flex-1 py-2 px-3 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </a>

            <div className="flex items-center gap-1">
              {res.status !== 'CONFIRMED' && res.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(res.id, 'CONFIRMED')}
                  title="Confirmar reserva"
                  className="p-2 bg-slate-800 hover:bg-emerald-600/20 text-emerald-400 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              {res.status !== 'COMPLETED' && res.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(res.id, 'COMPLETED')}
                  title="Marcar como concluída"
                  className="p-2 bg-slate-800 hover:bg-sky-600/20 text-sky-400 rounded-lg transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {res.status !== 'CANCELLED' && res.status !== 'COMPLETED' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(res.id, 'CANCELLED')}
                  title="Cancelar reserva"
                  className="p-2 bg-slate-800 hover:bg-rose-600/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                title="Excluir reserva"
                className="p-2 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

