import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, Clock, Sparkles, User, X } from 'lucide-react';
import { Store, ConsumerProfile, MenuItem } from '../../../types';
import { isServiceCategory, isMultiCommerceStore, isItemService } from '../../../utils/storeDomain';

interface StoreShowcaseReservationFormProps {
  store: Store;
  consumer: ConsumerProfile;
  isLightMode: boolean;
  selectedServiceItem?: MenuItem | null;
  onClearSelectedService?: () => void;
  onSuccess: () => void;
  onSubmitReservation: (data: any) => Promise<boolean | void>;
}

export const StoreShowcaseReservationForm: React.FC<StoreShowcaseReservationFormProps> = ({
  store,
  consumer,
  isLightMode,
  selectedServiceItem,
  onClearSelectedService,
  onSuccess,
  onSubmitReservation
}) => {
  const isService =
    isServiceCategory(store.category) ||
    Boolean(selectedServiceItem && isItemService(selectedServiceItem, store)) ||
    (isMultiCommerceStore(store) && store.showcaseTemplate?.customSections?.showTablesSection === false);
  const [resDate, setResDate] = useState(new Date().toISOString().split('T')[0]);
  const [resTime, setResTime] = useState(isService ? '14:00' : '19:00');
  const [resGuests, setResGuests] = useState(isService ? 1 : 2);
  const [professional, setProfessional] = useState(selectedServiceItem?.specs?.professionalName || '');
  const [clientName, setClientName] = useState(consumer.name || '');
  const [clientPhone, setClientPhone] = useState(consumer.phone || '');
  const [resNotes, setResNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedServiceItem?.specs?.professionalName) {
      setProfessional(selectedServiceItem.specs.professionalName);
    }
  }, [selectedServiceItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const ok = await onSubmitReservation({
        storeId: store.id,
        clientName: clientName.trim() || consumer.name || 'Cliente Marketplace',
        clientPhone: clientPhone.trim() || consumer.phone || '(43) 99999-0000',
        serviceOrTable: isService
          ? (selectedServiceItem ? `${selectedServiceItem.name} (R$ ${selectedServiceItem.price.toFixed(2)})` : 'Atendimento / Serviço Agendado')
          : 'Reserva de Mesa',
        professional: isService ? (professional.trim() || 'Profissional Disponível') : undefined,
        date: resDate,
        time: resTime,
        durationMinutes: selectedServiceItem?.specs?.durationMinutes || (isService ? 45 : 60),
        status: 'PENDING',
        guestsCount: isService ? 1 : resGuests,
        notes: resNotes
      });
      if (ok !== false) {
        onSuccess();
      }
    } catch {
      // Error handled by parent showNotification
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`p-6 sm:p-8 rounded-3xl border space-y-6 shadow-xl max-w-2xl mx-auto animate-fadeIn ${
      isLightMode ? 'bg-white border-stone-200' : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center border shrink-0 ${
          isService
            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          <Calendar className="w-10 h-10" />
        </div>
        <div className="text-center sm:text-left space-y-1">
          <h3 className={`text-xl font-black uppercase tracking-tight ${isLightMode ? 'text-stone-900' : 'text-white'}`}>
            {isService ? 'Agendar Serviço / Horário' : 'Solicitar Reserva de Mesa'}
          </h3>
          <p className={`text-xs leading-relaxed ${isLightMode ? 'text-stone-600' : 'text-slate-400'}`}>
            {isService
              ? 'Escolha a data, horário e profissional desejado. Não há cobrança de frete nem sacola de entrega.'
              : 'Informe a data, horário e quantidade de pessoas para reservar sua mesa no salão.'}
          </p>
        </div>
      </div>

      {isService && selectedServiceItem && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
          isLightMode ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/30'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <img src={selectedServiceItem.image} alt={selectedServiceItem.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
            <div className="min-w-0">
              <div className={`text-xs font-black uppercase truncate ${isLightMode ? 'text-indigo-950' : 'text-white'}`}>
                {selectedServiceItem.name}
              </div>
              <div className="flex items-center gap-3 text-[11px] font-mono text-indigo-400 mt-0.5">
                <span className="font-bold">R$ {selectedServiceItem.price.toFixed(2)}</span>
                {selectedServiceItem.specs?.durationMinutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {selectedServiceItem.specs.durationMinutes} min
                  </span>
                )}
              </div>
            </div>
          </div>
          {onClearSelectedService && (
            <button
              type="button"
              onClick={onClearSelectedService}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              title="Trocar serviço"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Seu Nome</label>
          <input
            type="text"
            required
            placeholder="Nome completo"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">WhatsApp / Contato</label>
          <input
            type="text"
            required
            placeholder="(43) 99999-0000"
            value={clientPhone}
            onChange={e => setClientPhone(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Data Desejada</label>
          <input 
            type="date" required value={resDate} onChange={e => setResDate(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Horário Desejado</label>
          <input 
            type="time" required value={resTime} onChange={e => setResTime(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {isService ? (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1.5">
              <User className="w-3 h-3 text-indigo-400" /> Profissional / Especialista (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ex: Primeiro disponível ou nome do especialista"
              value={professional}
              onChange={e => setProfessional(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        ) : (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Número de Pessoas / Convidados</label>
            <div className="flex items-center gap-3">
              <input 
                type="range" min={1} max={20} value={resGuests} onChange={e => setResGuests(Number(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
              <span className="w-10 text-center font-black text-emerald-400 text-lg">{resGuests}</span>
            </div>
          </div>
        )}

        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Observações do Atendimento</label>
          <textarea 
            rows={2}
            placeholder={
              isService
                ? 'Ex: Preferência de atendimento, observações do procedimento...'
                : 'Ex: Cadeira de bebê, aniversário, preferência de área no salão...'
            }
            value={resNotes} onChange={e => setResNotes(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="sm:col-span-2 pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer ${
              isService
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-slate-950'
            }`}
          >
            {isService ? <Sparkles className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? 'ENVIANDO...' : isService ? 'CONFIRMAR AGENDAMENTO' : 'SOLICITAR RESERVA DE MESA'}
          </button>
          <p className="text-[9px] text-slate-500 text-center mt-3 uppercase font-bold tracking-tighter">
            ✓ Sem taxas de agendamento • Pagamento direto no estabelecimento após o atendimento
          </p>
        </div>
      </form>
    </div>
  );
};
