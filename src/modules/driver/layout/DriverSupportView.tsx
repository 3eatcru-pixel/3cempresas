import React, { useState } from 'react';
import { HelpCircle, Phone, MessageSquare, X, AlertTriangle, CheckCircle2, Send } from 'lucide-react';

interface DriverSupportViewProps {
  storeName?: string;
  storePhone?: string;
  onReportOccurrence?: (summary: string, kind: 'OCCURRENCE' | 'TICKET') => void;
  onBack: () => void;
  onShowNotification: (msg: string) => void;
}

const QUICK_OCCURRENCES = [
  'Atraso no preparo do pedido na loja',
  'Cliente não atende no endereço de entrega',
  'Problema com endereço ou localização no mapa',
  'Dúvida sobre cobrança ou troco na entrega',
];

const sanitizeBrazilWhatsApp = (phone?: string): string | null => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  return `55${digits}`;
};

export const DriverSupportView: React.FC<DriverSupportViewProps> = ({
  storeName,
  storePhone,
  onReportOccurrence,
  onBack,
  onShowNotification,
}) => {
  const [reportedItem, setReportedItem] = useState<string | null>(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketMessage, setTicketMessage] = useState('');

  const waNumber = sanitizeBrazilWhatsApp(storePhone);

  const handleQuickOccurrence = (item: string) => {
    setReportedItem(item);
    if (onReportOccurrence) {
      onReportOccurrence(item, 'OCCURRENCE');
    }
    onShowNotification(`Ocorrência registrada: "${item}". O estabelecimento foi notificado.`);
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = ticketMessage.trim();
    if (clean.length < 5) {
      onShowNotification('Descreva sua solicitação com pelo menos 5 caracteres.');
      return;
    }
    if (onReportOccurrence) {
      onReportOccurrence(clean, 'TICKET');
    }
    setTicketMessage('');
    setShowTicketForm(false);
    onShowNotification('Chamado registrado com sucesso na central operacional.');
  };

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-5 space-y-4 text-center">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-left">
        <h3 className="font-black text-white text-sm">Ajuda e Suporte Operacional</h3>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="w-16 h-16 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/30 text-[#00CCBC] flex items-center justify-center mx-auto">
        <HelpCircle className="w-8 h-8" />
      </div>

      <div>
        <h4 className="font-extrabold text-white text-base">
          Central Operacional de Entregas &amp; Estabelecimento
        </h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Reporte ocorrências em tempo real ao estabelecimento ou acione o suporte logístico para coletas, PIN ou repasses.
        </p>
      </div>

      <div className="bg-[#0B1117] border border-slate-800 rounded-xl p-3 text-left space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Reportar Ocorrência Rápida
        </p>
        <div className="space-y-1.5">
          {QUICK_OCCURRENCES.map((item) => {
            const isSent = reportedItem === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => handleQuickOccurrence(item)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                  isSent
                    ? 'bg-[#00CCBC]/15 border-[#00CCBC]/40 text-[#00CCBC]'
                    : 'bg-[#111922] hover:bg-slate-800 border-slate-800 text-slate-200'
                }`}
              >
                <span>{item}</span>
                {isSent && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-1 text-left">
        {waNumber ? (
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(
              `Olá${storeName ? ` ${storeName}` : ''}, sou motorista parceiro e preciso de apoio operacional.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Phone className="w-4 h-4" /> Falar no WhatsApp da Loja
          </a>
        ) : (
          <div className="p-3 rounded-xl bg-[#0B1117] border border-slate-800 text-[11px] text-slate-400 text-center">
            O estabelecimento atual não possui WhatsApp operacional cadastrado. Utilize o chamado abaixo.
          </div>
        )}

        {showTicketForm ? (
          <form onSubmit={handleTicketSubmit} className="bg-[#0B1117] border border-slate-800 rounded-xl p-3 space-y-2.5">
            <label className="block text-[11px] font-bold text-slate-300">
              Descreva a ocorrência ou dúvida:
            </label>
            <textarea
              rows={3}
              value={ticketMessage}
              onChange={(e) => setTicketMessage(e.target.value)}
              placeholder="Ex.: Cliente alterou o endereço ou problema no repasse..."
              className="w-full rounded-xl bg-[#111922] border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-[#00CCBC]"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowTicketForm(false)}
                className="min-h-[40px] flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[40px] flex-1 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Enviar Chamado
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowTicketForm(true)}
            className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" /> Abrir Chamado de Suporte
          </button>
        )}
      </div>
    </div>
  );
};
