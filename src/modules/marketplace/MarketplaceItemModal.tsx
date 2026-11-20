import React, { useState, useEffect } from 'react';
import { MenuItem } from '../../types';
import { ShoppingBag, X, Edit3, Calendar, Package } from 'lucide-react';
import { ItemVariantSelector } from './item/ItemVariantSelector';
import { ItemSpecsGrid } from './item/ItemSpecsGrid';

interface ItemModalProps {
  item: MenuItem | null;
  onClose: () => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  notes: string;
  setNotes: (notes: string) => void;
  onAddToCart: (variant?: { id: string; label: string }) => void;
  isServiceStore?: boolean;
  isStoreClosed?: boolean;
  onScheduleService?: (item: MenuItem) => void;
}

export const MarketplaceItemModal: React.FC<ItemModalProps> = ({
  item,
  onClose,
  quantity,
  setQuantity,
  notes,
  setNotes,
  onAddToCart,
  isServiceStore,
  isStoreClosed = false,
  onScheduleService,
}) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    if (item?.variants && item.variants.length > 0) {
      const firstAvail = item.variants.find((v) => v.stock > 0) || item.variants[0];
      setSelectedVariantId(firstAvail?.id || '');
    } else {
      setSelectedVariantId('');
    }
  }, [item?.id]);

  const isServiceItem = Boolean(item && (isServiceStore || item.specs?.segment === 'SERVICE'));
  const variants = item?.variants || [];
  const hasVariants = variants.length > 0;
  const selectedVariant = variants.find((v) => v.id === selectedVariantId);
  const rawMaxStock = isServiceItem
    ? 99
    : hasVariants
    ? (selectedVariant?.stock ?? 0)
    : typeof item?.stock === 'number'
    ? item.stock
    : 99;
  const maxSelectableQty = Math.max(1, rawMaxStock);

  useEffect(() => {
    if (!item || isServiceItem) return;
    if (quantity > maxSelectableQty) {
      setQuantity(maxSelectableQty);
    }
  }, [item?.id, selectedVariantId, maxSelectableQty, isServiceItem, quantity, setQuantity]);

  if (!item) return null;
  const hasStockAvailable = isServiceItem || rawMaxStock > 0;
  const canConfirmVariant =
    !isStoreClosed &&
    hasStockAvailable &&
    (!hasVariants || (selectedVariant && selectedVariant.stock > 0));

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#121316] border border-stone-800 w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-scaleIn my-auto">
        <div className="relative h-64 sm:h-72 bg-stone-900">
          {item.image && !imgFailed ? (
            <img
              src={item.image}
              alt={item.name}
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-stone-600">
              <Package className="w-12 h-12" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#121316] via-transparent to-transparent opacity-60" />
          <button
            onClick={onClose}
            className="absolute top-6 right-6 bg-stone-950/80 hover:bg-stone-950 text-white p-2.5 rounded-2xl backdrop-blur-xl transition-all shadow-lg active:scale-90 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-6 left-6 right-6">
            <span className="px-3 py-1 rounded-full bg-orange-500 text-slate-950 text-[10px] font-black uppercase tracking-widest shadow-lg mb-2 inline-block">
              {item.category || 'Destaque'}
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tighter uppercase italic">{item.name}</h3>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm text-stone-400 leading-relaxed font-medium">
                {item.description || 'Produto de alta qualidade selecionado especialmente para você, com foco em durabilidade e excelência no acabamento.'}
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-emerald-400 font-mono font-black text-2xl tracking-tighter">
                R$ {item.price.toFixed(2)}
              </span>
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Preço Unitário</span>
            </div>
          </div>

          {hasVariants && !isServiceItem && (
            <ItemVariantSelector
              variants={variants}
              selectedVariantId={selectedVariantId}
              selectedVariant={selectedVariant}
              onSelectVariant={setSelectedVariantId}
            />
          )}

          {item.specs && <ItemSpecsGrid specs={item.specs} />}

          {isServiceItem && onScheduleService ? (
            <button
              type="button"
              onClick={() => {
                const target = item;
                onClose();
                onScheduleService(target);
              }}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group cursor-pointer"
            >
              <Calendar className="w-5 h-5" strokeWidth={2.5} />
              <span className="text-sm uppercase tracking-tight italic">
                Agendar Horário • R$ {item.price.toFixed(2)}
              </span>
            </button>
          ) : (
            <>
              <div className="space-y-5">
                <div className="flex items-center justify-between bg-stone-950 p-4 rounded-2xl border border-stone-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Quantidade</span>
                    <span className="text-xs font-bold text-white">
                      {typeof rawMaxStock === 'number' && rawMaxStock < 99
                        ? `${rawMaxStock} em estoque`
                        : 'Unidades no pedido'}
                    </span>
                  </div>
                  <div className="flex items-center gap-5">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-2xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-white font-black text-xl transition-all active:scale-90 border border-stone-700/50 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-lg font-black text-white font-mono min-w-[20px] text-center">{quantity}</span>
                    <button
                      type="button"
                      disabled={quantity >= maxSelectableQty}
                      onClick={() => setQuantity(Math.min(maxSelectableQty, quantity + 1))}
                      className="w-10 h-10 rounded-2xl bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-white font-black text-xl transition-all active:scale-90 border border-stone-700/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Edit3 className="w-3 h-3 text-stone-500" />
                    <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">
                      Instruções Adicionais
                    </label>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      item.specs?.segment === 'FURNITURE'
                        ? 'Ex: Instruções de montagem ou entrega...'
                        : 'Ex: Adicionais, observações de preparo ou entrega...'
                    }
                    className="w-full bg-stone-950 border border-stone-800 text-xs text-white p-4 rounded-2xl focus:outline-none focus:border-orange-500/50 resize-none h-24 placeholder:text-stone-700 font-medium"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAddToCart(
                    selectedVariant
                      ? {
                          id: selectedVariant.id,
                          label: [selectedVariant.color, selectedVariant.size].filter(Boolean).join(' • '),
                        }
                      : undefined
                  )
                }
                disabled={!canConfirmVariant}
                className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-slate-950 font-black rounded-2xl shadow-[0_10px_30px_rgba(249,115,22,0.3)] transition-all transform active:scale-[0.98] flex items-center justify-center gap-3 group cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-5 h-5" strokeWidth={3} />
                <span className="text-sm uppercase tracking-tight italic font-mono tabular-nums">
                  {isStoreClosed
                    ? 'Loja Fechada no Momento'
                    : hasStockAvailable
                    ? `Confirmar Adição • R$ ${(item.price * quantity).toFixed(2)}`
                    : 'Produto Indisponível no Estoque'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
