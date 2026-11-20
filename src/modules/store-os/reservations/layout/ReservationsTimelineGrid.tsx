import React from 'react';
import { Clock, User, Plus } from 'lucide-react';
import { Reservation } from '../../../../types';
import { hasReservationConflict } from '../../../../utils/storeDomain';
import { STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';

interface ReservationsTimelineGridProps {
  timeSlots: string[];
  professionalColumns: string[];
  activeDayReservations: Reservation[];
  selectedDate: string;
  storeId: string;
  filterStatus: string;
  onSelectFreeSlot: (prefill: { date: string; time: string; professional: string }) => void;
}

export const ReservationsTimelineGrid: React.FC<ReservationsTimelineGridProps> = ({
  timeSlots,
  professionalColumns,
  activeDayReservations,
  selectedDate,
  storeId,
  filterStatus,
  onSelectFreeSlot,
}) => {
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className={`${surface.elevatedBg} border ${surface.border} rounded-3xl overflow-hidden shadow-xl`}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className={`${surface.canvasBg} border-b ${surface.border}`}>
              <th className={`p-3.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24 border-r ${surface.border}`}>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-pink-400" /> Horário
                </span>
              </th>
              {professionalColumns.map((prof) => (
                <th
                  key={prof}
                  className="p-3.5 text-[11px] font-black uppercase tracking-wider text-white border-r border-slate-800/70 last:border-r-0"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-pink-400" /> {prof}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {timeSlots.map((slot) => (
              <tr key={slot} className="hover:bg-slate-950/30 transition-colors">
                <td className={`p-3 text-xs font-mono font-black text-slate-300 border-r ${surface.border} bg-slate-950/50`}>
                  {slot}
                </td>
                {professionalColumns.map((prof) => {
                  const booking = hasReservationConflict(activeDayReservations, {
                    storeId,
                    date: selectedDate,
                    time: slot,
                    professional: prof,
                    durationMinutes: 55,
                  });
                  const showBooking =
                    booking && (filterStatus === 'ALL' || booking.status === filterStatus);

                  return (
                    <td
                      key={`${slot}-${prof}`}
                      className="p-2 border-r border-slate-800/50 last:border-r-0 align-top"
                    >
                      {showBooking && booking ? (
                        <div
                          className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                            booking.status === 'CONFIRMED'
                              ? `${STATUS_COLORS.SUCCESS.bgClass} ${STATUS_COLORS.SUCCESS.borderClass} text-emerald-100`
                              : booking.status === 'COMPLETED'
                              ? `${STATUS_COLORS.INFO.bgClass} ${STATUS_COLORS.INFO.borderClass} text-sky-100`
                              : 'bg-pink-500/15 border-pink-500/40 text-pink-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black truncate">{booking.clientName}</span>
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-950/80 text-slate-300 shrink-0">
                              {booking.time} • {booking.durationMinutes || 45}m
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 truncate">
                            {booking.serviceOrTable}
                          </div>
                          {booking.clientPreferences && (
                            <div className="text-[9px] text-indigo-300 truncate">
                              Obs: {booking.clientPreferences}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectFreeSlot({
                              date: selectedDate,
                              time: slot,
                              professional: prof,
                            })
                          }
                          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-800 hover:border-pink-500/50 hover:bg-pink-500/10 text-[10px] font-bold uppercase text-slate-500 hover:text-pink-300 transition-all cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Livre
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
