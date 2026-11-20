import React from 'react';
import { MessageSquare, Sparkles, Tag } from 'lucide-react';
import { CouponCampaign } from '../../../../types';

export type CampaignType = 'RE_ENGAGEMENT' | 'PROMO' | 'LOYALTY';

interface WhatsAppCampaignBuilderProps {
  selectedCampaignType: CampaignType;
  onSelectCampaignType: (type: CampaignType) => void;
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  isGenerating: boolean;
  onGenerateAI: () => void;
  generatedMessage: string;
  onChangeGeneratedMessage: (val: string) => void;
  activeStoreCoupons: CouponCampaign[];
  onInsertCouponCode: (coupon: CouponCampaign) => void;
  previewCustomerName?: string;
  storeName: string;
}

export const WhatsAppCampaignBuilder: React.FC<WhatsAppCampaignBuilderProps> = ({
  selectedCampaignType,
  onSelectCampaignType,
  aiPrompt,
  setAiPrompt,
  isGenerating,
  onGenerateAI,
  generatedMessage,
  onChangeGeneratedMessage,
  activeStoreCoupons,
  onInsertCouponCode,
  previewCustomerName,
  storeName,
}) => {
  const renderedPreview = generatedMessage
    ? generatedMessage
        .replace(/{{name}}/g, previewCustomerName || 'Cliente')
        .replace(/{{storeName}}/g, storeName)
        .replace(/{{days}}/g, '15')
        .replace(/{{productName}}/g, 'Novidade da Semana')
    : '';

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300">01. Objetivo da Campanha</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'RE_ENGAGEMENT', label: 'Re-engajamento', desc: 'Recuperar clientes inativos' },
            { id: 'PROMO', label: 'Promoção & Oferta', desc: 'Divulgar combos e novidades' },
            { id: 'LOYALTY', label: 'Fidelidade VIP', desc: 'Recompensar clientes recorrentes' },
          ].map((type) => (
            <button
              type="button"
              key={type.id}
              onClick={() => onSelectCampaignType(type.id as CampaignType)}
              className={`p-4 rounded-xl border text-left transition-colors cursor-pointer ${
                selectedCampaignType === type.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700'
              }`}
            >
              <p
                className={`text-xs font-bold ${
                  selectedCampaignType === type.id ? 'text-blue-400' : 'text-white'
                }`}
              >
                {type.label}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{type.desc}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-bold text-slate-300">
            02. Mensagem da Campanha (Editável)
          </h3>
          {activeStoreCoupons.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Tag size={11} /> Inserir cupom ativo:
              </span>
              {activeStoreCoupons.slice(0, 4).map((cp) => (
                <button
                  key={cp.id}
                  type="button"
                  onClick={() => onInsertCouponCode(cp)}
                  className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-[10px] font-mono font-bold cursor-pointer"
                >
                  +{cp.code}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <textarea
            rows={4}
            placeholder="Escreva sua mensagem ou clique em Aplicar Template / Refinar abaixo. Use {{name}} e {{storeName}}."
            value={generatedMessage}
            onChange={(e) => onChangeGeneratedMessage(e.target.value)}
            className="w-full p-3 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:border-emerald-500 outline-none resize-none font-mono leading-relaxed"
          />

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="Instrução opcional p/ refinar (ex: cite entrega grátis hoje)..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={onGenerateAI}
              disabled={isGenerating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              <Sparkles size={13} />
              {isGenerating ? 'Gerando...' : 'Aplicar / Refinar Texto'}
            </button>
          </div>
        </div>
      </section>

      {renderedPreview && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <MessageSquare size={13} className="text-emerald-400" />
            03. Prévia Personalizada ({previewCustomerName || 'Cliente Exemplo'})
          </h3>
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl">
            <p className="text-xs whitespace-pre-wrap text-slate-200 leading-relaxed">
              {renderedPreview}
            </p>
          </div>
        </section>
      )}
    </div>
  );
};
