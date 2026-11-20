import React, { useState } from 'react';
import { MenuItem } from '../../../types';
import { RefreshCw, Edit3, Trash2, Search, Package } from 'lucide-react';

interface CatalogProductGridProps {
  filteredItems: MenuItem[];
  onToggleAvailability: (id: string) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string, name: string) => void;
}

export const CatalogProductGrid: React.FC<CatalogProductGridProps> = ({
  filteredItems,
  onToggleAvailability,
  onEdit,
  onDelete,
}) => {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  return (
    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const isSvc = item.specs?.segment === 'SERVICE';
          const hasImage = Boolean(item.image && !failedImages[item.id]);
          const marginPct =
            item.costPrice && item.costPrice > 0 && item.price > 0
              ? Math.round(((item.price - item.costPrice) / item.price) * 100)
              : null;

          return (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col hover:border-slate-700 transition-colors"
            >
              <div className="h-32 w-full relative bg-slate-950">
                {hasImage ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                    }
                    className="w-full h-full object-cover opacity-85"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600">
                    <Package className="w-7 h-7" />
                    <span className="text-[11px] font-medium text-slate-500 truncate max-w-[80%] px-2">
                      {item.category || 'Produto'}
                    </span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-xs">
                  <span className="text-slate-300 font-medium truncate">
                    {item.category}
                  </span>
                  <span
                    className={`font-semibold shrink-0 ${
                      item.isAvailable ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {item.isAvailable ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm text-white truncate">{item.name}</h4>
                    {!isSvc && (
                      <span
                        className={`text-[11px] font-mono tabular-nums shrink-0 ${
                          item.stock <= (item.minStockAlert ?? 5)
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.stock} un
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description || 'Sem descrição cadastrada.'}
                  </p>
                  {item.specs && (
                    <div className="pt-1 text-[11px] font-mono tabular-nums text-slate-400 flex flex-wrap items-center gap-x-1.5 leading-tight">
                      {item.specs.dimensions && (
                        <span className="text-amber-300 font-medium">
                          {typeof item.specs.dimensions === 'string'
                            ? item.specs.dimensions
                            : `${item.specs.dimensions.widthCm || ''}×${item.specs.dimensions.heightCm || ''}×${item.specs.dimensions.depthCm || ''} cm`}
                        </span>
                      )}
                      {item.specs.material && <span>· {item.specs.material}</span>}
                      {item.specs.voltage && (
                        <span className="text-cyan-300 font-medium">{item.specs.voltage}</span>
                      )}
                      {item.specs.warrantyMonths && (
                        <span>· {item.specs.warrantyMonths}m garantia</span>
                      )}
                      {item.specs.durationMinutes && (
                        <span className="text-purple-300 font-medium">
                          {item.specs.durationMinutes} min
                        </span>
                      )}
                      {item.specs.professionalName && (
                        <span>· {item.specs.professionalName}</span>
                      )}
                      {item.specs.sizes && item.specs.sizes.length > 0 && (
                        <span className="text-pink-300">Tam: {item.specs.sizes.join('/')}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-3 gap-2">
                  {confirmingDeleteId === item.id ? (
                    <div className="flex items-center justify-between w-full gap-2 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-1.5">
                      <span className="text-xs font-semibold text-rose-300">Excluir item?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onDelete(item.id, item.name);
                            setConfirmingDeleteId(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Excluir
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        <span className="text-amber-400 font-mono tabular-nums font-bold text-sm">
                          R${' '}
                          {item.price.toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        {marginPct !== null && (
                          <span className="text-[11px] font-mono tabular-nums text-slate-400">
                            Margem {marginPct}%
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleAvailability(item.id)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                          title={
                            item.isAvailable
                              ? 'Pausar no Cardápio'
                              : 'Ativar no Cardápio'
                          }
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${!item.isAvailable ? 'text-amber-400' : ''}`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-700"
                          title="Editar Produto"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(item.id)}
                          className="p-2 bg-slate-800 hover:bg-rose-900/40 rounded-lg text-slate-400 hover:text-rose-400 transition-colors cursor-pointer border border-slate-700"
                          title="Excluir Produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-16 text-center bg-slate-900/40 rounded-2xl border border-slate-800 flex flex-col items-center gap-3">
            <Search className="w-10 h-10 text-slate-600" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200 text-sm">Nenhum item encontrado</p>
              <p className="text-xs text-slate-500">
                Tente ajustar o termo de busca, a categoria ou o filtro de disponibilidade.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

