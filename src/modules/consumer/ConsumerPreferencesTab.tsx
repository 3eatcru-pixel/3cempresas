import React from 'react';
import { useConsumer } from '../../context/ConsumerContext';
import { Settings, Sparkles, Check } from 'lucide-react';

export const ConsumerPreferencesTab: React.FC = () => {
  const { 
    consumer, toggleDietaryRestriction, toggleFavoriteCategory, updatePreferences 
  } = useConsumer();

  const dietaryOptions = [
    { key: 'VEGAN', label: '🌱 Vegano' },
    { key: 'VEGETARIAN', label: '🧀 Vegetariano' },
    { key: 'GLUTEN_FREE', label: '🌾 Sem Glúten' },
    { key: 'LACTOSE_FREE', label: '🥛 Sem Lactose' },
    { key: 'SUGAR_FREE', label: '🍬 Sem Açúcar' },
    { key: 'FIT_LOW_CARB', label: '🥑 Low Carb / Fit' },
  ];

  const categoryOptions = [
    { key: 'BURGER', label: '🍔 Hambúrgueres' },
    { key: 'PIZZA', label: '🍕 Pizzas' },
    { key: 'JAPANESE', label: '🍣 Comida Japonesa' },
    { key: 'RESTAURANT', label: '🍝 Pratos do Chef' },
    { key: 'RETAIL', label: '🛒 Mercado & Empório' },
    { key: 'BEVERAGES', label: '🍷 Bebidas & Adega' },
  ];

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl animate-fadeIn">
      <div className="border-b border-slate-800 pb-4">
        <h3 className="font-black text-white italic uppercase tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-400" /> Minhas Preferências Alimentares & Pagamento
        </h3>
        <p className="text-xs text-slate-400">Personalize seu feed de busca no Marketplace e forma de pagamento padrão</p>
      </div>

      <div className="space-y-6">
        {/* Dietary Restrictions */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-white flex items-center gap-2 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-emerald-400" /> Restrições Alimentares & Dieta:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {dietaryOptions.map(opt => {
              const isSelected = consumer.preferences.dietaryRestrictions.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleDietaryRestriction(opt.key)}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                    isSelected 
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Favorite Categories */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <label className="text-xs font-bold text-white uppercase tracking-wider">Categorias Favoritas:</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {categoryOptions.map(cat => {
              const isSelected = consumer.preferences.favoriteCategories.includes(cat.key);
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => toggleFavoriteCategory(cat.key)}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-between ${
                    isSelected 
                      ? 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-md' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>{cat.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Payment Method */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <label className="text-xs font-bold text-white uppercase tracking-wider">Forma de Pagamento Padrão:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'].map(method => (
              <button
                key={method}
                type="button"
                onClick={() => updatePreferences({ defaultPaymentMethod: method as any })}
                className={`p-3 rounded-2xl border font-mono font-bold transition-all ${
                  consumer.preferences.defaultPaymentMethod === method 
                    ? 'bg-amber-500 border-amber-500 text-slate-950 font-black shadow-lg' 
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Notification Settings */}
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <label className="text-xs font-bold text-white uppercase tracking-wider">Configurações de Notificações:</label>
          <div className="space-y-2">
            <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-900 transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white">E-mail Transacional</span>
                <p className="text-[10px] text-slate-500">Receber recibos e atualizações importantes por e-mail.</p>
              </div>
              <input 
                type="checkbox" 
                checked={consumer.preferences.emailNotifications}
                onChange={() => updatePreferences({ emailNotifications: !consumer.preferences.emailNotifications })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
            </label>
            <label className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-900 transition-colors">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white">Notificações via WhatsApp</span>
                <p className="text-[10px] text-slate-500">Alertas de pedido em preparação e saiu para entrega.</p>
              </div>
              <input 
                type="checkbox" 
                checked={consumer.preferences.whatsappNotifications}
                onChange={() => updatePreferences({ whatsappNotifications: !consumer.preferences.whatsappNotifications })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
