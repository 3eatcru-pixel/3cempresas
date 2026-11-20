import React, { useState, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';
import { Store, ConsumerProfile, MenuItem } from '../../../types';
import { isServiceCategory, isMultiCommerceStore, isItemService } from '../../../utils/storeDomain';

interface ShowcaseReservationsTabProps {
  store: Store;
  consumer: ConsumerProfile;
  selectedServiceItem?: MenuItem | null;
  onClearSelectedService?: () => void;
  onSubmitReservation: (reservationData: {
    storeId: string;
    clientName: string;
    clientPhone: string;
    serviceOrTable: string;
    professional?: string;
    date: string;
    time: string;
    durationMinutes?: number;
    status: 'PENDING';
    guestsCount: number;
    notes: string;
  }) => Promise<boolean | void>;
  onSuccess: () => void;
  showNotification: (msg: string) => void;
}

export const ShowcaseReservationsTab: React.FC<ShowcaseReservationsTabProps> = ({
  store,
  consumer,
  selectedServiceItem,
  onClearSelectedService,
  onSubmitReservation,
  onSuccess,
  showNotification,
}) => {
  const isService =
    isServiceCategory(store.category) ||
    Boolean(selectedServiceItem && isItemService(selectedServiceItem, store)) ||
    (isMultiCommerceStore(store) && store.showcaseTemplate?.customSections?.showTablesSection === false);
  const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState(isService ? '14:00' : '19:00');
  const [resGuests, setResGuests] = useState(isService ? 1 : 2);
  const [professional, setProfessional] = useState(selectedServiceItem?.specs?.professionalName || '');
  const [resNotes, setResNotes] = useState('');
  const [isSubmittingRes, setIsSubmittingRes] = useState(false);

  useEffect(() => {
    if (selectedServiceItem?.specs?.professionalName) {
      setProfessional(selectedServiceItem.specs.professionalName);
    }
  }, [selectedServiceItem]);

  const handlePublicReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRes(true);
    try {
      const ok = await onSubmitReservation({
        storeId: store.id,
        clientName: consumer.name || 'Cliente Marketplace',
        clientPhone: consumer.phone || '(43) 99999-0000',
        serviceOrTable: isService
          ? (selectedServiceItem ? `${selectedServiceItem.name} (R$ ${selectedServiceItem.price.toFixed(2)})` : 'Serviço Agendado')
          : 'Reserva de Mesa',
        professional: isService ? (professional.trim() || 'Profissional Disponível') : undefined,
        date: resDate,
        time: resTime,
        durationMinutes: selectedServiceItem?.specs?.durationMinutes || (isService ? 45 : 60),
        status: 'PENDING',
        guestsCount: isService ? 1 : resGuests,
        notes: resNotes,
      });
      if (ok !== false) {
        showNotification(isService ? 'Agendamento enviado com sucesso!' : 'Pedido de reserva enviado! Aguarde a confirmação do estabelecimento.');
        onSuccess();
      }
    } catch {
      showNotification('Erro ao enviar solicitação.');
    } finally {
      setIsSubmittingRes(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-stone-200 space-y-6 max-w-xl mx-auto shadow-lg animate-fadeIn">
      <div className="text-center space-y-1">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto border ${
          isService ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        }`}>
          <Calendar className="w-7 h-7" />
        </div>
        <h3 className="text-base font-black text-stone-900 uppercase tracking-tight">
          {isService ? 'Agendar Serviço / Horário' : 'Solicitar Reserva de Mesa'}
        </h3>
        <p className="text-xs text-stone-500">
          {isService
            ? <>Agende seu horário diretamente com <strong className="text-stone-800">{store.name}</strong> (sem frete ou carrinho de delivery).</>
            : <>Reserve sua mesa em <strong className="text-stone-800">{store.name}</strong>.</>}
        </p>
      </div>

      {isService && selectedServiceItem && (
        <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-black text-indigo-950 truncate">{selectedServiceItem.name}</div>
            <div className="text-[11px] font-mono text-indigo-700 flex items-center gap-2">
              <span className="font-bold">R$ {selectedServiceItem.price.toFixed(2)}</span>
              {selectedServiceItem.specs?.durationMinutes && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {selectedServiceItem.specs.durationMinutes} min
                </span>
              )}
            </div>
          </div>
          {onClearSelectedService && (
            <button type="button" onClick={onClearSelectedService} className="text-indigo-500 hover:text-indigo-800 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <form onSubmit={handlePublicReservation} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-stone-500 ml-1">Data</label>
          <input
            type="date"
            required
            value={resDate}
            onChange={e => setResDate(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs text-stone-900 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-stone-500 ml-1">Horário</label>
          <input
            type="time"
            required
            value={resTime}
            onChange={e => setResTime(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs text-stone-900 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        {isService ? (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-500 ml-1">Profissional (Opcional)</label>
            <input
              type="text"
              placeholder="Primeiro disponível ou especialista de preferência"
              value={professional}
              onChange={e => setProfessional(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs text-stone-900 focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        ) : (
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-500 ml-1">
              Pessoas: {resGuests}
            </label>
            <input
              type="range"
              min={1}
              max={15}
              value={resGuests}
              onChange={e => setResGuests(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
        )}

        <div className="sm:col-span-2 space-y-1">
          <label className="text-[10px] font-black uppercase text-stone-500 ml-1">Notas (Opcional)</label>
          <textarea
            rows={2}
            placeholder={isService ? 'Ex: Preferência de horário ou observações do atendimento...' : 'Ex: Aniversário, cadeira de bebê, área externa...'}
            value={resNotes}
            onChange={e => setResNotes(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-xs text-stone-900 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmittingRes}
          className={`sm:col-span-2 py-3 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
            isService ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'
          }`}
        >
          {isSubmittingRes ? 'ENVIANDO...' : isService ? 'CONFIRMAR AGENDAMENTO' : 'SOLICITAR RESERVA DE MESA'}
        </button>
      </form>
    </div>
  );
};
