import React, { useMemo, useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { MenuItem } from '../../../types';
import { generateSmartMenuDescription, suggestSmartPricingAI } from '../../../services/gemini';
import { computeTotalVariantStock } from '../../../utils/storeDomain';

import { CatalogProductGrid } from './CatalogProductGrid';
import { CatalogItemModal } from './CatalogItemModal';
import { CatalogHeaderBar } from './layout/CatalogHeaderBar';

type AvailabilityFilter = 'ALL' | 'AVAILABLE' | 'UNAVAILABLE';

export const CatalogApp: React.FC = () => {
  const {
    currentStore,
    menuItems,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    toggleMenuItemAvailability,
    showNotification,
    governance,
  } = useEcosystem();

  const aiMenuEnabled = governance?.featureFlags?.aiMenuAssistantEnabled ?? true;
  const aiEngineEnabled = governance?.featureFlags?.aiEngineEnabled ?? true;

  const storeItems = useMemo(
    () => menuItems.filter((item) => item.storeId === currentStore.id),
    [menuItems, currentStore.id]
  );

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(storeItems.map((i) => i.category).filter(Boolean)))],
    [storeItems]
  );

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isPricingLoading, setIsAiPricingLoading] = useState(false);
  const [pricingJustification, setPricingJustification] = useState<string | null>(null);

  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    name: '',
    description: '',
    price: 0,
    costPrice: 0,
    category: 'Principais',
    prepTimeMin: 15,
    isAvailable: true,
    stock: 100,
    minStockAlert: 10,
    image: '',
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredItems = useMemo(
    () =>
      storeItems.filter((it) => {
        if (selectedCategory !== 'Todas' && it.category !== selectedCategory) return false;
        if (availabilityFilter === 'AVAILABLE' && !it.isAvailable) return false;
        if (availabilityFilter === 'UNAVAILABLE' && it.isAvailable) return false;
        if (!normalizedSearch) return true;
        return (
          it.name.toLowerCase().includes(normalizedSearch) ||
          it.category.toLowerCase().includes(normalizedSearch) ||
          (it.sku || '').toLowerCase().includes(normalizedSearch)
        );
      }),
    [storeItems, selectedCategory, availabilityFilter, normalizedSearch]
  );

  const availableCount = useMemo(
    () => storeItems.filter((i) => i.isAvailable).length,
    [storeItems]
  );

  const handleAiDescribe = async () => {
    if (!aiMenuEnabled) {
      showNotification('Assistente de Cardápio IA está desativado na governança.');
      return;
    }
    if (!newItem.name) {
      showNotification('Digite o nome do produto primeiro para a IA analisar.');
      return;
    }
    setIsAiLoading(true);
    try {
      const aiDesc = await generateSmartMenuDescription(newItem.name, currentStore.category);
      setNewItem((prev) => ({ ...prev, description: aiDesc }));
      showNotification('Descrição otimizada pela Gemini AI!');
    } catch {
      showNotification('Falha ao conectar com o Assistente IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiPrice = async () => {
    if (!aiEngineEnabled) {
      showNotification('Engenharia de Preço IA desativada globalmente.');
      return;
    }
    if (!newItem.name || !newItem.costPrice) {
      showNotification('Digite o nome e o preço de custo para a IA sugerir o preço de venda.');
      return;
    }
    setIsAiPricingLoading(true);
    try {
      const result = await suggestSmartPricingAI(
        newItem.name,
        newItem.costPrice,
        newItem.category || 'Geral',
        currentStore.category
      );
      setNewItem((prev) => ({ ...prev, price: result.suggestedPrice }));
      setPricingJustification(result.justification);
      showNotification('Engenharia de preço concluída pela IA!');
    } catch {
      showNotification('Erro ao processar precificação inteligente.');
    } finally {
      setIsAiPricingLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingItem(null);
    const defaultSegment =
      currentStore.category === 'FURNITURE'
        ? 'FURNITURE'
        : currentStore.category === 'ELECTRONICS'
        ? 'ELECTRONICS'
        : currentStore.category === 'SERVICES' || currentStore.category === 'BEAUTY'
        ? 'SERVICE'
        : currentStore.category === 'FASHION'
        ? 'FASHION'
        : currentStore.category === 'RETAIL'
        ? 'RETAIL_GENERAL'
        : 'FOOD';

    const isSvc = defaultSegment === 'SERVICE';

    setNewItem({
      name: '',
      description: '',
      price: 0,
      costPrice: 0,
      category:
        currentStore.category === 'FURNITURE'
          ? 'Móveis & Decoração'
          : currentStore.category === 'ELECTRONICS'
          ? 'Tecnologia'
          : isSvc
          ? 'Serviços & Atendimentos'
          : 'Principais',
      prepTimeMin: isSvc ? 45 : 15,
      isAvailable: true,
      stock: isSvc ? 9999 : 50,
      minStockAlert: isSvc ? 0 : 5,
      specs: { segment: defaultSegment },
      image: '',
    });
    setPricingJustification(null);
    setIsAdding(true);
  };

  const handleStartEdit = (item: MenuItem) => {
    setEditingItem(item);
    setNewItem({
      name: item.name,
      description: item.description,
      price: item.price,
      costPrice: item.costPrice || 0,
      category: item.category,
      prepTimeMin: item.prepTimeMin || 15,
      isAvailable: item.isAvailable,
      stock: item.stock || 0,
      minStockAlert: item.minStockAlert || 5,
      image: item.image,
      variants: item.variants || [],
      specs: item.specs || { segment: 'FOOD' },
    });
    setPricingJustification(null);
    setIsAdding(true);
  };

  const handleDeleteItem = (id: string, name: string) => {
    deleteMenuItem(id);
    showNotification(`Item "${name}" removido do catálogo.`);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = (newItem.name || '').trim();
    const parsedPrice = Number(newItem.price);
    const parsedCost = Number(newItem.costPrice || 0);
    const parsedStock = Number(newItem.stock || 0);
    const parsedMinAlert = Number(newItem.minStockAlert || 0);

    if (!trimmedName) {
      showNotification('Informe o nome do item antes de salvar.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      showNotification('Preço de venda inválido: deve ser um número >= 0.');
      return;
    }
    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      showNotification('Preço de custo inválido: deve ser um número >= 0.');
      return;
    }
    if (
      !Number.isFinite(parsedStock) ||
      parsedStock < 0 ||
      !Number.isFinite(parsedMinAlert) ||
      parsedMinAlert < 0
    ) {
      showNotification('Valores de estoque devem ser maiores ou iguais a zero.');
      return;
    }

    const isSvc = newItem.specs?.segment === 'SERVICE';
    const hasVariants = Array.isArray(newItem.variants) && newItem.variants.length > 0;
    const computedStock = isSvc
      ? 9999
      : hasVariants
      ? computeTotalVariantStock(newItem.variants)
      : parsedStock;

    const completeItem: Omit<MenuItem, 'id'> = {
      storeId: currentStore.id,
      sku: newItem.sku || editingItem?.sku || `SKU-${Math.floor(Math.random() * 10000)}`,
      barcode: editingItem?.barcode || `789${Math.floor(Math.random() * 100000000)}`,
      name: trimmedName,
      description: newItem.description || '',
      price: parsedPrice,
      costPrice: parsedCost,
      category: newItem.category || 'Geral',
      image: newItem.image || '',
      isAvailable: newItem.isAvailable !== undefined ? newItem.isAvailable : true,
      stock: computedStock,
      minStockAlert: isSvc ? 0 : parsedMinAlert,
      prepTimeMin: Number(
        isSvc
          ? newItem.specs?.durationMinutes || newItem.prepTimeMin || 45
          : newItem.prepTimeMin || 15
      ),
      variants: hasVariants ? newItem.variants : undefined,
      specs: newItem.specs,
    };

    try {
      if (editingItem) {
        await updateMenuItem(editingItem.id, completeItem);
        showNotification(`Item "${trimmedName}" atualizado!`);
      } else {
        await addMenuItem(completeItem);
        showNotification(`Item "${trimmedName}" adicionado ao catálogo!`);
      }
      setIsAdding(false);
      setEditingItem(null);
      setPricingJustification(null);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao salvar item do catálogo.');
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 overflow-hidden">
      <CatalogHeaderBar search={search} setSearch={setSearch} onOpenAdd={handleOpenAdd} />

      {/* Category & Availability Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 shrink-0">
          {(
            [
              { id: 'ALL', label: `Todos (${storeItems.length})` },
              { id: 'AVAILABLE', label: `Ativos (${availableCount})` },
              { id: 'UNAVAILABLE', label: `Pausados (${storeItems.length - availableCount})` },
            ] as Array<{ id: AvailabilityFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAvailabilityFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                availabilityFilter === tab.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <CatalogProductGrid
        filteredItems={filteredItems}
        onToggleAvailability={toggleMenuItemAvailability}
        onEdit={handleStartEdit}
        onDelete={handleDeleteItem}
      />

      <CatalogItemModal
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        onSubmit={handleAddSubmit}
        editingItem={editingItem}
        newItem={newItem}
        setNewItem={setNewItem}
        onAiDescribe={handleAiDescribe}
        isAiLoading={isAiLoading}
        onAiPrice={handleAiPrice}
        isPricingLoading={isPricingLoading}
        pricingJustification={pricingJustification}
      />
    </div>
  );
};

