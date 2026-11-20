import React, { useState, useMemo } from 'react';
import { ChefHat, MessageSquare, Plus, Minus, Search, X } from 'lucide-react';
import { MenuItem } from '../../../types';

interface WaiterNewOrderTabProps {
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  filteredMenuItems: MenuItem[];
  orderItems: { menuItem: MenuItem; qty: number; notes?: string }[];
  handleAddItemToTableOrder: (item: MenuItem) => void;
  handleUpdateItemQty: (index: number, delta: number) => void;
  handleSendOrder: () => void;
  newOrderTotal: number;
  setActiveItemForNotes: (item: MenuItem) => void;
  setItemNoteInput: (val: string) => void;
}

export const WaiterNewOrderTab: React.FC<WaiterNewOrderTabProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredMenuItems,
  orderItems,
  handleAddItemToTableOrder,
  handleUpdateItemQty,
  handleSendOrder,
  newOrderTotal,
  setActiveItemForNotes,
  setItemNoteInput
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const visibleItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredMenuItems;
    return filteredMenuItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [filteredMenuItems, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Fast Product & Service Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Consultar produto, serviço, código ou categoria..."
          className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wide shrink-0 transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
        {visibleItems.map(item => {
          const isUnavailable = item.isAvailable === false || (typeof item.stock === 'number' && item.stock <= 0);
          return (
            <div
              key={item.id}
              className={`bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 transition-colors ${
                isUnavailable ? 'opacity-60' : 'hover:border-amber-500/40'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                  {isUnavailable && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                      Esgotado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-amber-400 font-mono font-bold">R$ {item.price.toFixed(2)}</p>
                  {typeof item.stock === 'number' && item.stock > 0 && (
                    <span className="text-[9px] text-slate-500 font-mono">Est: {item.stock}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => {
                    setActiveItemForNotes(item);
                    const existing = orderItems.find(i => i.menuItem.id === item.id);
                    setItemNoteInput(existing?.notes || '');
                  }}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-400 hover:text-amber-400 rounded-lg border border-slate-800 transition-colors cursor-pointer"
                  title="Adicionar Observação (ex: Sem cebola)"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
                
                <button
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => handleAddItemToTableOrder(item)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </div>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="col-span-full py-6 text-center text-xs text-slate-500">
            Nenhum produto ou serviço encontrado para &ldquo;{searchQuery}&rdquo;.
          </div>
        )}
      </div>

      {/* Order Basket Preview */}
      {orderItems.length > 0 ? (
        <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/30 space-y-3 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-xs font-black text-amber-400 uppercase flex items-center gap-1.5">
              <ChefHat className="w-4 h-4" /> Itens para Enviar à Cozinha
            </span>
            <span className="text-xs font-mono font-black text-white">R$ {newOrderTotal.toFixed(2)}</span>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
            {orderItems.map((i, idx) => (
              <div key={idx} className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="font-bold text-white truncate">{i.qty}x {i.menuItem.name}</div>
                  {i.notes ? (
                    <div className="text-[10px] text-amber-300 italic flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-amber-400" /> Obs: {i.notes}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveItemForNotes(i.menuItem);
                        setItemNoteInput(i.notes || '');
                      }}
                      className="text-[9px] text-slate-500 hover:text-amber-400 underline"
                    >
                      + Adicionar Observação
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-amber-400 font-bold">R$ {(i.menuItem.price * i.qty).toFixed(2)}</span>
                  <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button onClick={() => handleUpdateItemQty(idx, -1)} className="p-0.5 text-slate-400 hover:text-white">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono text-xs font-bold text-white px-1">{i.qty}</span>
                    <button onClick={() => handleUpdateItemQty(idx, 1)} className="p-0.5 text-slate-400 hover:text-white">
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSendOrder}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <ChefHat className="w-4 h-4" /> Disparar Pedido para o KDS da Cozinha
          </button>
        </div>
      ) : (
        <div className="p-4 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
          Selecione itens do cardápio acima para iniciar um novo pedido.
        </div>
      )}
    </div>
  );
};
