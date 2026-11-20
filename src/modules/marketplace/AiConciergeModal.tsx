import React, { useState } from 'react';
import { Sparkles, X, Send, Bot, MapPin, Star, ShoppingBag, Loader2 } from 'lucide-react';
import { Store } from '../../types';

import { smartDiscoveryWithMeta } from '../../services/gemini';

interface AiConciergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStore: (slug: string) => void;
  stores: Store[];
}

export const AiConciergeModal: React.FC<AiConciergeModalProps> = ({ isOpen, onClose, onSelectStore, stores }) => {
  const [query, setQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'bot' | 'user'; text: string; recommendedStore?: Store; usedFallback?: boolean }[]>([
    { role: 'bot', text: 'Olá! Sou seu Concierge 3C Commerce. O que você gostaria de comer hoje? Posso te ajudar a encontrar as melhores ofertas e sabores da região!' }
  ]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!query.trim()) return;
    
    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setIsTyping(true);

    try {
      const { text: responseText, usedFallback } = await smartDiscoveryWithMeta(
        userMsg,
        stores.map(s => ({ name: s.name, category: s.category, rating: s.rating }))
      );

      const lower = userMsg.toLowerCase();
      let recommendedStore = stores.find(s =>
        s.name.toLowerCase().includes(lower) ||
        (s.category && lower.includes(s.category.toLowerCase())) ||
        responseText.toLowerCase().includes(s.name.toLowerCase())
      );
      if (!recommendedStore && stores.length > 0) {
        recommendedStore = stores[0];
      }

      setMessages(prev => [...prev, { role: 'bot', text: responseText, recommendedStore, usedFallback }]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'bot',
          text: 'Encontrei estas opções recomendadas no catálogo local!',
          recommendedStore: stores[0],
          usedFallback: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[600px] animate-scaleIn">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm uppercase tracking-tighter italic leading-none">Concierge Discovery</h3>
              <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">Recomendações para seu pedido</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-white/50 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-950/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-amber-500 text-slate-950 font-bold rounded-tr-none shadow-md shadow-amber-500/20' 
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm'
              }`}>
                <p className="leading-relaxed">{msg.text}</p>
                {msg.role === 'bot' && msg.usedFallback && (
                  <span className="mt-1.5 inline-block text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Modo Catálogo Local
                  </span>
                )}
                
                {msg.recommendedStore && (
                  <div className="mt-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden group hover:border-amber-500 transition-all cursor-pointer shadow-inner"
                       onClick={() => onSelectStore(msg.recommendedStore!.slug)}>
                    <img src={msg.recommendedStore.banner} className="w-full h-24 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="p-3 space-y-1">
                       <div className="flex justify-between items-center">
                         <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs">{msg.recommendedStore.name}</h4>
                         <div className="flex items-center gap-1 text-amber-500">
                           <Star size={10} fill="currentColor" />
                           <span className="text-[10px] font-bold">{msg.recommendedStore.rating}</span>
                         </div>
                       </div>
                       <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                         <MapPin size={10} />
                         <span>{msg.recommendedStore.deliveryTimeMin} min • R$ {msg.recommendedStore.deliveryFee.toFixed(2)}</span>
                       </div>
                       <div className="pt-2">
                         <button className="w-full py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                           Ver Cardápio <ShoppingBag size={12} />
                         </button>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-amber-500" />
                <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Consultando lojas...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2">
            <input 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ex: Quero um lanche bem apimentado e barato"
              className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 text-slate-900 dark:text-white"
            />
            <button 
              onClick={handleSend}
              disabled={isTyping || !query.trim()}
              className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 disabled:opacity-50 active:scale-95 transition-all"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
