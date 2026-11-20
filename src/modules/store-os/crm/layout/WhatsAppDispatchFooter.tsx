import React from 'react';
import { ArrowRight, ExternalLink, Send } from 'lucide-react';
import { WhatsAppConnectorMode } from './WhatsAppConnectModal';

interface WhatsAppDispatchFooterProps {
  selectedCount: number;
  currentSendingIndex: number | null;
  currentCustomerName?: string;
  currentWaHref?: string | null;
  connectorMode: WhatsAppConnectorMode;
  isDispatchingApi: boolean;
  hasGeneratedMessage: boolean;
  onNextCustomer: () => void;
  onStartSending: () => void;
}

export const WhatsAppDispatchFooter: React.FC<WhatsAppDispatchFooterProps> = ({
  selectedCount,
  currentSendingIndex,
  currentCustomerName,
  currentWaHref,
  connectorMode,
  isDispatchingApi,
  hasGeneratedMessage,
  onNextCustomer,
  onStartSending,
}) => {
  return (
    <section className="pt-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xs font-bold text-white font-mono tabular-nums">
          Fila de Envio: {selectedCount} {selectedCount === 1 ? 'cliente selecionado' : 'clientes selecionados'}
        </p>
        <p className="text-[11px] text-slate-400">
          {connectorMode === 'WA_ME'
            ? 'Modo wa.me ativo: abertura direta no WhatsApp da loja sem custo por mensagem.'
            : `Modo ${connectorMode} ativo: disparos autenticados via Server Core com fallback para wa.me.`}
        </p>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        {currentSendingIndex !== null ? (
          <>
            {connectorMode === 'WA_ME' && currentWaHref && (
              <a
                href={currentWaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors"
              >
                <ExternalLink size={14} /> Abrir p/ {currentCustomerName || 'Cliente'}
              </a>
            )}
            <button
              type="button"
              disabled={isDispatchingApi}
              onClick={onNextCustomer}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-slate-950 rounded-xl font-black text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isDispatchingApi
                ? 'Enviando...'
                : currentSendingIndex + 1 >= selectedCount
                ? `Concluir Campanha (${currentSendingIndex + 1}/${selectedCount})`
                : `Próximo (${currentSendingIndex + 1}/${selectedCount})`}
              <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={selectedCount === 0 || !hasGeneratedMessage || isDispatchingApi}
            onClick={onStartSending}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 rounded-xl font-black text-xs transition-colors cursor-pointer"
          >
            <Send size={14} />
            {isDispatchingApi
              ? 'Enviando...'
              : connectorMode === 'WA_ME'
              ? 'Iniciar Fila wa.me'
              : `Enviar via ${connectorMode}`}
          </button>
        )}
      </div>
    </section>
  );
};
