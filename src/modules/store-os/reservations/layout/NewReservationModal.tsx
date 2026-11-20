import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Reservation } from '../../../../types';
import { hasReservationConflict } from '../../../../utils/storeDomain';

interface NewReservationModalProps {
  storeId?: string;
  existingReservations?: Reservation[];
  initialDate?: string;
  initialTime?: string;
  initialProfessional?: string;
  serviceOptions?: string[];
  professionalOptions?: string[];
  onClose: () => void;
  onSubmit: (data: {
    clientName: string;
    clientPhone: string;
    serviceOrTable: string;
    professional: string;
    date: string;
    time: string;
    durationMinutes: number;
    guestsCount: number;
    notes: string;
    clientPreferences?: string;
    returnReminderDate?: string;
  }) => void;
}

export const NewReservationModal: React.FC<NewReservationModalProps> = ({
  storeId,
  existingReservations = [],
  initialDate,
  initialTime,
  initialProfessional,
  serviceOptions = [],
  professionalOptions = [],
  onClose,
  onSubmit,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [serviceOrTable, setServiceOrTable] = useState('');
  const [professional, setProfessional] = useState(initialProfessional || '');
  const [resDate, setResDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState(initialTime || '15:00');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [guestsCount, setGuestsCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [clientPreferences, setClientPreferences] = useState('');
  const [returnReminderDate, setReturnReminderDate] = useState('');

  const conflict = useMemo(() => {
    if (!storeId || existingReservations.length === 0) return null;
    return hasReservationConflict(existingReservations, {
      storeId,
      date: resDate,
      time: resTime,
      professional: professional.trim() || 'Geral',
      durationMinutes,
    });
  }, [existingReservations, storeId, resDate, resTime, professional, durationMinutes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conflict) return;
    onSubmit({
      clientName,
      clientPhone,
      serviceOrTable,
      professional,
      date: resDate,
      time: resTime,
      durationMinutes,
      guestsCount,
      notes,
      clientPreferences: clientPreferences.trim() || undefined,
      returnReminderDate: returnReminderDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleIn max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-pink-500/10 rounded-xl text-pink-400 border border-pink-500/20">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-white">Nova Reserva / Agendamento</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Nome do Cliente *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Carlos Silva"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                WhatsApp / Telefone *
              </label>
              <input
                type="text"
                required
                placeholder="(43) 99999-9999"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Serviço / Mesa / Item *
              </label>
              <input
                type="text"
                required
                list="res-service-options"
                placeholder="Ex: Mesa 04 ou Corte de Cabelo"
                value={serviceOrTable}
                onChange={(e) => setServiceOrTable(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
              <datalist id="res-service-options">
                {serviceOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Profissional / Atendente
              </label>
              <input
                type="text"
                list="res-professional-options"
                placeholder="Ex: Ana Estilista ou Geral"
                value={professional}
                onChange={(e) => setProfessional(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
              <datalist id="res-professional-options">
                {professionalOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Data *</label>
              <input
                type="date"
                required
                value={resDate}
                onChange={(e) => setResDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Horário *</label>
              <input
                type="time"
                required
                value={resTime}
                onChange={(e) => setResTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-pink-400" /> Duração
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
              >
                <option value={30}>30 min</option>
                <option value={45}>45 min</option>
                <option value={60}>60 min</option>
                <option value={90}>90 min</option>
                <option value={120}>120 min</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">Pessoas</label>
              <input
                type="number"
                min="1"
                max="50"
                value={guestsCount}
                onChange={(e) => setGuestsCount(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {conflict && (
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/40 flex items-start gap-2.5 text-xs text-red-300">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-black uppercase text-[11px] text-red-300">
                  Conflito de Horário Detectado
                </div>
                <p className="text-[11px] text-red-200/80">
                  <strong>{conflict.professional || 'Geral'}</strong> já possui atendimento com{' '}
                  <strong>{conflict.clientName}</strong> às <strong>{conflict.time}</strong> ({conflict.durationMinutes || 45} min). Altere o horário ou o profissional.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Preferências / Anamnese do Cliente
              </label>
              <input
                type="text"
                placeholder="Ex: Alergia a látex, prefere água fria, tonalidade 7.1..."
                value={clientPreferences}
                onChange={(e) => setClientPreferences(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1">
                Retorno Sugerido (Lembrete)
              </label>
              <input
                type="date"
                value={returnReminderDate}
                onChange={(e) => setReturnReminderDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Observações do Atendimento
            </label>
            <textarea
              rows={2}
              placeholder="Ex: Alergia a glúten, preferência de mesa perto da janela..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold uppercase hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={Boolean(conflict)}
              className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-pink-600/20 hover:from-pink-500 hover:to-rose-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {conflict ? 'Horário Indisponível' : 'Salvar Reserva & Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
