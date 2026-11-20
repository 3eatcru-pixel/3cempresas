import React, { useState, useMemo } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import {
  Calendar as CalendarIcon,
  Plus,
  LayoutGrid,
  Rows3,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { ReservationCard } from './layout/ReservationCard';
import { NewReservationModal } from './layout/NewReservationModal';
import { ReservationsTimelineGrid } from './layout/ReservationsTimelineGrid';
import { Reservation } from '../../../types';

const TIME_SLOTS = [
  '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
];

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Todas' },
  { value: 'CONFIRMED', label: 'Confirmadas' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'COMPLETED', label: 'Concluídas' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

const formatLocalDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftIsoDate = (isoDate: string, deltaDays: number) => {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
  return formatLocalDateIso(dt);
};

export const ReservationsCalendarApp: React.FC = () => {
  const {
    currentStore,
    menuItems,
    adminUsers,
    users,
    showNotification,
    reservations,
    addReservation,
    updateReservationStatus,
    deleteReservation,
  } = useEcosystem();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    date?: string;
    time?: string;
    professional?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'CARDS' | 'GRID'>('GRID');
  const [selectedDate, setSelectedDate] = useState<string>(
    formatLocalDateIso(new Date())
  );
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const storeMenuItems = menuItems.filter((m) => m.storeId === currentStore.id);
  const storeProfessionals = Array.from(
    new Map(
      [...adminUsers, ...users]
        .filter((u) => u.storeId === currentStore.id)
        .map((u) => [u.id || u.uid || u.email, u])
    ).values()
  );

  const professionalColumns = useMemo(() => {
    const names = new Set<string>();
    storeProfessionals.forEach((p) => {
      if (p.name) names.add(p.name);
    });
    reservations
      .filter((r) => r.storeId === currentStore.id && r.date === selectedDate)
      .forEach((r) => {
        names.add(r.professional || 'Geral');
      });
    if (names.size === 0) names.add('Geral');
    return Array.from(names);
  }, [storeProfessionals, reservations, currentStore.id, selectedDate]);

  const handleOpenNewModal = (prefill?: { date?: string; time?: string; professional?: string }) => {
    setModalPrefill(prefill || { date: selectedDate });
    setIsModalOpen(true);
  };

  const handleCreateReservation = async (data: {
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
  }) => {
    if (!data.clientName || !data.clientPhone || !data.serviceOrTable) {
      showNotification('Preencha os campos obrigatórios do agendamento.');
      return;
    }

    const ok = await addReservation({
      storeId: currentStore.id,
      tenantId: currentStore.tenantId || currentStore.id,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      serviceOrTable: data.serviceOrTable,
      professional: data.professional || 'Geral',
      date: data.date,
      time: data.time,
      durationMinutes: data.durationMinutes || 45,
      status: 'CONFIRMED',
      guestsCount: data.guestsCount,
      notes: data.notes,
      clientPreferences: data.clientPreferences,
      returnReminderDate: data.returnReminderDate,
    });

    if (ok) {
      setIsModalOpen(false);
      setModalPrefill(null);
    }
  };

  const buildWhatsAppUrl = (res: Reservation) => {
    const msg = encodeURIComponent(
      `Olá ${res.clientName}! Passando para confirmar seu agendamento/reserva em *${currentStore.name}* para o dia *${res.date}* às *${res.time}* (${res.serviceOrTable}). Profissional: ${res.professional || 'Geral'}. Aguardamos você!`
    );
    const cleanPhone = res.clientPhone.replace(/\D/g, '');
    return `https://wa.me/55${cleanPhone}?text=${msg}`;
  };

  const dayReservations = useMemo(
    () =>
      reservations.filter(
        (r) => r.storeId === currentStore.id && r.date === selectedDate
      ),
    [reservations, currentStore.id, selectedDate]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const matchesSearch = (r: Reservation) => {
    if (!normalizedSearch) return true;
    return (
      r.clientName.toLowerCase().includes(normalizedSearch) ||
      r.clientPhone.toLowerCase().includes(normalizedSearch) ||
      r.serviceOrTable.toLowerCase().includes(normalizedSearch) ||
      (r.professional || '').toLowerCase().includes(normalizedSearch)
    );
  };

  const filteredReservations = dayReservations.filter((r) => {
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchStatus && matchesSearch(r);
  });

  const activeDayReservations = dayReservations.filter(
    (r) => r.status !== 'CANCELLED' && matchesSearch(r)
  );

  const dailyStats = useMemo(() => {
    const confirmed = dayReservations.filter((r) => r.status === 'CONFIRMED').length;
    const pending = dayReservations.filter((r) => r.status === 'PENDING').length;
    const expectedGuests = dayReservations
      .filter((r) => r.status !== 'CANCELLED')
      .reduce((acc, r) => acc + (r.guestsCount || 1), 0);
    return {
      total: dayReservations.length,
      confirmed,
      pending,
      expectedGuests,
    };
  }, [dayReservations]);

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar animate-fadeIn text-slate-100">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20 text-pink-400">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight text-white">
              Agenda de Serviços, Profissionais e Mesas
            </h3>
            <p className="text-xs text-slate-400">
              Agenda operacional de <span className="text-slate-200 font-semibold">{currentStore.name}</span> · controle por profissional, detecção de conflitos e lembrete via WhatsApp.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                viewMode === 'GRID'
                  ? 'bg-pink-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Rows3 className="w-3.5 h-3.5" /> Grade
            </button>
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                viewMode === 'CARDS'
                  ? 'bg-pink-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cartões
            </button>
          </div>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftIsoDate(prev, -1))}
              title="Dia anterior"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(formatLocalDateIso(new Date()))}
              className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Hoje
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent px-2 py-1 text-xs font-mono tabular-nums text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setSelectedDate((prev) => shiftIsoDate(prev, 1))}
              title="Próximo dia"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleOpenNewModal({ date: selectedDate })}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white font-semibold rounded-xl transition-colors flex items-center gap-2 text-xs whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Reserva</span>
          </button>
        </div>
      </div>

      {/* Daily KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Reservas do Dia</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {dailyStats.total}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Confirmadas</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
            {dailyStats.confirmed}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Pendentes</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400 mt-1">
            {dailyStats.pending}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Pessoas Previstas</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-pink-400 mt-1">
            {dailyStats.expectedGuests}
          </div>
        </div>
      </div>

      {/* Search & Status Filters bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar cliente, telefone, serviço ou profissional..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-pink-500"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilterStatus(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                filterStatus === opt.value
                  ? 'bg-pink-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Mode: Timeline Grid or Cards */}
      {viewMode === 'GRID' ? (
        <ReservationsTimelineGrid
          timeSlots={TIME_SLOTS}
          professionalColumns={professionalColumns}
          activeDayReservations={activeDayReservations}
          selectedDate={selectedDate}
          storeId={currentStore.id}
          filterStatus={filterStatus}
          onSelectFreeSlot={(prefill) => handleOpenNewModal(prefill)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReservations.length === 0 ? (
            <div className="col-span-full py-14 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-2.5">
              <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="font-semibold text-slate-300 text-sm">
                Nenhuma reserva encontrada para {selectedDate}
              </h4>
              <p className="text-xs text-slate-500">
                Ajuste o filtro ou clique em "Nova Reserva" para agendar um horário ou mesa.
              </p>
            </div>
          ) : (
            filteredReservations.map((res) => (
              <ReservationCard
                key={res.id}
                reservation={res}
                whatsappUrl={buildWhatsAppUrl(res)}
                onSendWhatsApp={(r) =>
                  showNotification(`Link WhatsApp pronto para ${r.clientName}!`)
                }
                onUpdateStatus={updateReservationStatus}
                onDelete={deleteReservation}
              />
            ))
          )}
        </div>
      )}

      {/* New Reservation Modal */}
      {isModalOpen && (
        <NewReservationModal
          storeId={currentStore.id}
          existingReservations={reservations}
          initialDate={modalPrefill?.date || selectedDate}
          initialTime={modalPrefill?.time}
          initialProfessional={modalPrefill?.professional}
          serviceOptions={storeMenuItems.map((m) => m.name)}
          professionalOptions={professionalColumns}
          onClose={() => {
            setIsModalOpen(false);
            setModalPrefill(null);
          }}
          onSubmit={handleCreateReservation}
        />
      )}
    </div>
  );
};

