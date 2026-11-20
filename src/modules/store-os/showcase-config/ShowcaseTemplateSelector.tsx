import React from 'react';
import { Check } from 'lucide-react';
import { StoreShowcaseTemplate } from '../../../types';

export const COLOR_PALETTES = [
  { name: 'Âmbar Dourado (Hamburgueria)', value: '#f59e0b' },
  { name: 'Vermelho Pomodoro (Pizzaria)', value: '#ef4444' },
  { name: 'Esmeralda Fresco (Sushi/Saudável)', value: '#10b981' },
  { name: 'Rosa Doce (Café & Boutique)', value: '#ec4899' },
  { name: 'Madeira Nobre (Móveis & Decoração)', value: '#b45309' },
  { name: 'Azul Cobalto (Tech & Eletrônicos)', value: '#2563eb' },
  { name: 'Violeta Prime (Serviços & Beleza)', value: '#8b5cf6' },
  { name: 'Índigo Empório (Varejo & Mercado)', value: '#6366f1' },
];

export const TEMPLATES: { id: StoreShowcaseTemplate; name: string; desc: string; icon: string }[] = [
  {
    id: 'MULTI_COMMERCE',
    name: 'Multivendas Híbrido (Customizável)',
    desc: 'Loja 360° que vende de tudo: gastronomia/salão, produtos de varejo/tech e serviços agendáveis no mesmo endereço.',
    icon: '🏬',
  },
  {
    id: 'BURGER_MODERN',
    name: 'Burger & Fast Food',
    desc: 'Cartões arrojados, combos em destaque e botões de alta conversão.',
    icon: '🍔',
  },
  {
    id: 'PIZZA_TRATTORIA',
    name: 'Pizzaria & Trattoria',
    desc: 'Layout horizontal com destaque para massas artesanais, meio-a-meio e bordas.',
    icon: '🍕',
  },
  {
    id: 'FURNITURE_SHOWROOM',
    name: 'Móveis & Decoração',
    desc: 'Galeria visual com medidas AxLxP, materiais maciços, acabamentos e frete especial.',
    icon: '🛋️',
  },
  {
    id: 'TECH_ELECTRONICS',
    name: 'Eletrônicos & Informática',
    desc: 'Ficha técnica rigorosa, voltagem (bivolt), garantia estendida e modelos.',
    icon: '⚡',
  },
  {
    id: 'SERVICES_APPOINTMENT',
    name: 'Serviços & Estética',
    desc: 'Duração estimada, profissional responsável, atendimento VIP e agendamento.',
    icon: '✂️',
  },
  {
    id: 'FASHION_BOUTIQUE',
    name: 'Moda & Boutique',
    desc: 'Grade de tamanhos, cores selecionáveis, tecido e lookbook sofisticado.',
    icon: '👗',
  },
  {
    id: 'RETAIL_EMPORIO',
    name: 'Mercado & Empório',
    desc: 'Gôndola compacta com códigos SKU, peso/unidades e navegação rápida.',
    icon: '🛒',
  },
  {
    id: 'CAFE_CONFEITARIA',
    name: 'Cafeteria & Doceria',
    desc: 'Visual clean, aconchegante, detalhes de preparo artesanal e doces finos.',
    icon: '☕',
  },
  {
    id: 'JAPANESE_SUSHI',
    name: 'Sushi & Oriental',
    desc: 'Estilo minimalista com destaque para combinados, frescor e peças artesanais.',
    icon: '🍣',
  },
];

interface ShowcaseTemplateSelectorProps {
  templateSelection: StoreShowcaseTemplate;
  onSelectTemplate: (id: StoreShowcaseTemplate) => void;
  primaryColor: string;
  onSelectColor: (color: string) => void;
}

export const ShowcaseTemplateSelector: React.FC<ShowcaseTemplateSelectorProps> = ({
  templateSelection,
  onSelectTemplate,
  primaryColor,
  onSelectColor,
}) => {
  return (
    <div className="space-y-6">
      {/* Templates Grid */}
      <div className="space-y-3">
        <label className="block text-xs font-black uppercase text-slate-300 tracking-wider">
          1. Modelo Visual por Segmento de Mercado
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTemplate(t.id)}
              className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col justify-between cursor-pointer ${
                templateSelection === t.id
                  ? 'bg-pink-500/10 border-pink-500 shadow-lg shadow-pink-500/10'
                  : 'bg-slate-950 border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">{t.icon}</span>
                  {templateSelection === t.id && (
                    <span className="p-1 rounded-full bg-pink-500 text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </div>
                <div className="text-xs font-black text-white uppercase tracking-tight">{t.name}</div>
                <p className="text-[11px] text-slate-400 leading-snug">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color Accent Picker */}
      <div className="space-y-3 pt-4 border-t border-slate-800">
        <label className="block text-xs font-black uppercase text-slate-300 tracking-wider">
          2. Cor Primária da Marca
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {COLOR_PALETTES.map(p => (
            <button
              key={p.value}
              type="button"
              onClick={() => onSelectColor(p.value)}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                primaryColor === p.value
                  ? 'border-white bg-slate-800 ring-2 ring-pink-500/40'
                  : 'border-slate-800 bg-slate-950 hover:border-slate-700'
              }`}
            >
              <span className="w-6 h-6 rounded-full shadow-inner" style={{ backgroundColor: p.value }} />
              <span className="text-[10px] font-bold text-slate-300 text-center leading-tight line-clamp-1">
                {p.name.split('(')[0]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
