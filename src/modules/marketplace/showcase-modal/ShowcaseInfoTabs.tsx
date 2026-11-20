import React from 'react';
import { Store } from '../../../types';
import { getStoreSocials, isServiceCategory } from '../../../utils/storeDomain';
import { 
  Sparkles, Check, ShieldCheck, Bike, Clock, Star, Phone, 
  MapPin, Instagram, MessageSquare, Facebook, Globe, ShoppingBag 
} from 'lucide-react';

interface ShowcaseInfoTabsProps {
  store: Store;
  activeTab: 'Sobre' | 'Avaliações' | 'Contato';
  totalReviews: number;
}

export const ShowcaseInfoTabs: React.FC<ShowcaseInfoTabsProps> = ({
  store,
  activeTab,
  totalReviews
}) => {
  const socials = getStoreSocials(store);
  const isService = isServiceCategory(store.category);

  if (activeTab === 'Sobre') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto animate-fadeIn">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 space-y-3 shadow-sm">
          <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-500" />
            Sobre {store.name}
          </h3>
          <p className="text-xs text-stone-600 leading-relaxed">
            {store.showcaseTemplate?.tagline || `Bem-vindo ao ${store.name}! Oferecemos o melhor em ${store.category.toLowerCase()}, priorizando qualidade e atendimento direto sem intermediários.`}
          </p>
          <div className="space-y-2 pt-3 border-t border-stone-100 text-xs text-stone-700 font-medium">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>CNPJ & Cadastro Verificado</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Pagamento Direto via PIX e Cartões</span>
            </div>
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-emerald-500" />
              <span>{isService ? 'Agendamento Online com Hora Marcada' : 'Suporte a Entrega e Retirada no Local'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 space-y-3 shadow-sm">
          <h3 className="font-extrabold text-stone-900 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-500" />
            Horários de Funcionamento
          </h3>
          <div className="space-y-1.5 text-xs text-stone-600 font-mono">
            <div className="flex justify-between py-1 border-b border-stone-100">
              <span className="font-sans text-stone-800">Segunda a Sexta</span>
              <span className="font-bold text-stone-900">{isService ? '09:00 às 19:00' : '11:00 às 23:00'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-stone-100">
              <span className="font-sans text-stone-800">Sábado e Domingo</span>
              <span className="font-bold text-stone-900">{isService ? '09:00 às 17:00' : '11:00 às 00:00'}</span>
            </div>
            <div className="flex justify-between py-1 text-emerald-600 font-bold font-sans pt-1">
              <span>Status Atual:</span>
              <span>{store.isOpen ? 'Aberto / Atendendo' : 'Fechado no Momento'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'Avaliações') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-fadeIn">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-3xl font-black text-stone-900 font-mono">{store.rating.toFixed(1)}</div>
            <div className="flex text-amber-400 gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className="w-4 h-4 fill-amber-400" />
              ))}
            </div>
            <div className="text-xs text-stone-500 mt-1">Baseado em {totalReviews} avaliações</div>
          </div>
          <div className="text-right text-xs text-stone-600 space-y-1">
            <div>Qualidade Geral: <strong className="text-stone-900">4.9</strong></div>
            <div>Pontualidade: <strong className="text-stone-900">4.8</strong></div>
            <div>Atendimento: <strong className="text-stone-900">5.0</strong></div>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { name: 'Lucas Prado', rating: 5, date: 'Ontem', comment: 'Atendimento rápido e excelente! Superou as expectativas.' },
            { name: 'Camila Rocha', rating: 5, date: 'Há 3 dias', comment: 'Melhor opção da região. Qualidade constante e preço justo.' },
            { name: 'Fernando Dias', rating: 4, date: 'Há 1 semana', comment: 'Muito bom, recomendo para quem busca praticidade.' }
          ].map((fb, i) => (
            <div key={i} className="bg-white p-3.5 rounded-xl border border-stone-200 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-stone-900">{fb.name}</span>
                <span className="text-stone-400 font-mono text-[10px]">{fb.date}</span>
              </div>
              <div className="flex text-amber-400 gap-0.5">
                {Array.from({ length: fb.rating }).map((_, idx) => (
                  <Star key={idx} className="w-3 h-3 fill-amber-400" />
                ))}
              </div>
              <p className="text-stone-600 italic">"{fb.comment}"</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'Contato') {
    const whatsappNum = (socials.whatsapp || store.phone || '').replace(/\D/g, '');
    return (
      <div className="bg-white p-6 rounded-2xl border border-stone-200 max-w-xl mx-auto space-y-4 shadow-sm text-xs animate-fadeIn">
        <h3 className="font-extrabold text-stone-900 text-sm">Canais Oficiais & Redes Sociais</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
            <Phone className="w-4 h-4 text-orange-600" />
            <div>
              <div className="font-bold text-stone-800">Telefone / WhatsApp:</div>
              <div className="text-stone-600 font-mono">{socials.whatsapp || store.phone || '(43) 3324-7890'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
            <MapPin className="w-4 h-4 text-orange-600" />
            <div>
              <div className="font-bold text-stone-800">Endereço Físico:</div>
              <div className="text-stone-600">{store.address}</div>
            </div>
          </div>
          {socials.instagram && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
              <Instagram className="w-4 h-4 text-pink-600" />
              <div>
                <div className="font-bold text-stone-800">Instagram:</div>
                <a href={`https://instagram.com/${socials.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">
                  @{socials.instagram.replace('@', '')}
                </a>
              </div>
            </div>
          )}
          {socials.facebook && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
              <Facebook className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-bold text-stone-800">Facebook:</div>
                <a href={socials.facebook.startsWith('http') ? socials.facebook : `https://${socials.facebook}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">
                  {socials.facebook}
                </a>
              </div>
            </div>
          )}
          {socials.ifood && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
              <ShoppingBag className="w-4 h-4 text-rose-600" />
              <div>
                <div className="font-bold text-stone-800">iFood:</div>
                <a href={socials.ifood.startsWith('http') ? socials.ifood : `https://${socials.ifood}`} target="_blank" rel="noopener noreferrer" className="text-rose-600 hover:underline font-semibold">
                  Ver loja no iFood
                </a>
              </div>
            </div>
          )}
          {socials.website && (
            <div className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl">
              <Globe className="w-4 h-4 text-purple-600" />
              <div>
                <div className="font-bold text-stone-800">Website Oficial:</div>
                <a href={socials.website.startsWith('http') ? socials.website : `https://${socials.website}`} target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline font-semibold">
                  {socials.website}
                </a>
              </div>
            </div>
          )}
          {whatsappNum && (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="font-bold text-stone-800">Atendimento Direto:</div>
                <a 
                  href={`https://wa.me/55${whatsappNum}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-emerald-700 font-bold hover:underline"
                >
                  Chamar no WhatsApp Oficial
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
