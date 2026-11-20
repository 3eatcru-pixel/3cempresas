import React, { useState } from 'react';
import { Search, CheckCircle2, Ticket, WifiOff } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { MenuItem } from '../../../types';
import { KioskCartDrawer, KioskCartItem } from './layout/KioskCartDrawer';
import { KioskItemNotesModal } from './layout/KioskItemNotesModal';
import { KioskPixModal } from './layout/KioskPixModal';
import { KioskHeaderBar } from './layout/KioskHeaderBar';
import { KioskItemCard } from './layout/KioskItemCard';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { StorageService } from '../../../services/StorageService';
import { syncEngine } from '../../../core/sync/SyncEngine';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: 'PIX',
  CREDIT_CARD: 'Cartão de Crédito',
  DEBIT_CARD: 'Cartão de Débito',
  CASH: 'Dinheiro (Balcão)',
  BOLETO: 'Boleto',
  BANK_TRANSFER: 'Transferência Bancária',
  PAYMENT_LINK: 'Link de Pagamento',
};

export const KioskApp: React.FC = () => {
  const { currentStore, menuItems, createPosOrder, showNotification } = useEcosystem();

  const storeItems = menuItems.filter((i) => i.storeId === currentStore.id && i.isAvailable);
  const categories = ['Todos', ...Array.from(new Set(storeItems.map((i) => i.category)))];

  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [kioskCart, setKioskCart] = useState<KioskCartItem[]>([]);
  const [activeItemForNotes, setActiveItemForNotes] = useState<MenuItem | null>(null);
  const [customNotes, setCustomNotes] = useState('');
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [orderCompletedCode, setOrderCompletedCode] = useState<string | null>(null);
  const [completedPaymentMethod, setCompletedPaymentMethod] = useState<string | null>(null);
  const [completedSavedOffline, setCompletedSavedOffline] = useState(false);
  const [completedTotal, setCompletedTotal] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = storeItems.filter((item) => {
    const matchCategory = selectedCategory === 'Todos' || item.category === selectedCategory;
    if (!matchCategory) return false;
    if (!normalizedQuery) return true;
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      (item.description || '').toLowerCase().includes(normalizedQuery) ||
      (item.category || '').toLowerCase().includes(normalizedQuery)
    );
  });

  const totalAmount = kioskCart.reduce((sum, ci) => sum + ci.item.price * ci.qty, 0);

  const handleAddToCart = (item: MenuItem, notes?: string) => {
    setKioskCart((prev) => {
      const idx = prev.findIndex(
        (p) => p.item.id === item.id && (p.notes || '') === (notes || '')
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx].qty += 1;
        return next;
      }
      return [...prev, { item, qty: 1, notes }];
    });
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setKioskCart((prev) => {
      const next = [...prev];
      next[index].qty += delta;
      if (next[index].qty <= 0) {
        return next.filter((_, i) => i !== index);
      }
      return next;
    });
  };

  const handleOpenNotes = (item: MenuItem) => {
    setActiveItemForNotes(item);
    setCustomNotes('');
  };

  const handleSaveNotesAndAdd = () => {
    if (activeItemForNotes) {
      handleAddToCart(activeItemForNotes, customNotes.trim() ? customNotes : undefined);
      setActiveItemForNotes(null);
      setCustomNotes('');
    }
  };

  const handleFinishSelfServiceOrder = async (
    paymentMethod:
      | 'PIX'
      | 'CREDIT_CARD'
      | 'DEBIT_CARD'
      | 'CASH'
      | 'BOLETO'
      | 'BANK_TRANSFER'
      | 'PAYMENT_LINK' = 'PIX'
  ) => {
    if (kioskCart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const snapshotTotal = totalAmount;
      const platform = getPlatformAdapters();
      const offlineKioskOrder = {
        storeId: currentStore.id,
        channel: 'KIOSK',
        deliveryModality: 'PICKUP',
        code: `#OFF-${Math.floor(1000 + Math.random() * 9000)}`,
        customerName: 'Cliente Autoatendimento (Totem)',
        notes: `Pedido realizado via Totem de Autoatendimento (Kiosk) • Pagamento: ${paymentMethod}.`,
        items: kioskCart.map((ci) => ({
          ...ci.item,
          menuItemId: ci.item.id,
          quantity: ci.qty,
          notes: ci.notes || '',
        })),
        subtotal: snapshotTotal,
        discount: 0,
        total: snapshotTotal,
        paymentMethod,
        createdAt: new Date().toISOString(),
      };

      let order: any = null;
      let savedOffline = false;
      if (!platform.network.isOnline() && !platform.network.getEdgeBaseUrl()) {
        savedOffline = true;
        await StorageService.saveOfflineOrder(offlineKioskOrder);
        await syncEngine.refreshCounts();
        order = offlineKioskOrder;
      } else {
        try {
          order = await createPosOrder(
            'Cliente Autoatendimento (Totem)',
            kioskCart.map((ci) => ({ menuItem: ci.item, qty: ci.qty, notes: ci.notes })),
            paymentMethod,
            0,
            '',
            'KIOSK',
            {
              notes: `Pedido realizado via Totem de Autoatendimento (Kiosk) • Pagamento: ${paymentMethod}.`,
              paymentConfirmed: paymentMethod !== 'PIX' && paymentMethod !== 'PAYMENT_LINK',
            }
          );
          if (!order) {
            savedOffline = true;
            await StorageService.saveOfflineOrder(offlineKioskOrder);
            await syncEngine.refreshCounts();
            order = offlineKioskOrder;
          }
        } catch {
          savedOffline = true;
          await StorageService.saveOfflineOrder(offlineKioskOrder);
          await syncEngine.refreshCounts();
          order = offlineKioskOrder;
        }
      }

      if (order) {
        setCompletedTotal(typeof order.total === 'number' ? order.total : snapshotTotal);
        setOrderCompletedCode(order.code);
        setCompletedPaymentMethod(paymentMethod);
        setCompletedSavedOffline(savedOffline);
        if (paymentMethod === 'PIX') {
          setIsPixModalOpen(true);
        } else {
          setKioskCart([]);
        }
        showNotification(
          savedOffline
            ? `Modo Offline: Pedido ${order.code} (${PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod}) salvo na fila para sincronização!`
            : `Pedido ${order.code} (${PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod}) registrado no totem e enviado para preparação!`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetKiosk = () => {
    setKioskCart([]);
    setIsPixModalOpen(false);
    setOrderCompletedCode(null);
    setCompletedPaymentMethod(null);
    setCompletedSavedOffline(false);
    setCompletedTotal(0);
    setSearchQuery('');
  };

  const pixKey = (
    currentStore.operationalSettings?.pixKey ||
    currentStore.phone ||
    ''
  ).trim();

  const merchantCity =
    currentStore.address?.split(',').pop()?.trim() || 'BRASIL';

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 rounded-xl overflow-hidden relative select-none">
      <KioskHeaderBar
        storeName={currentStore.name}
        hasCartItems={kioskCart.length > 0}
        onClearCart={() => setKioskCart([])}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 overflow-hidden space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
            <div className="relative sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar produto ou sabor..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
              <p className="text-sm font-semibold text-slate-300">
                Nenhum item encontrado para o filtro atual.
              </p>
              <p className="text-xs text-slate-500">
                Limpe a busca ou selecione outra categoria para visualizar o cardápio.
              </p>
              {(searchQuery || selectedCategory !== 'Todos') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('Todos');
                  }}
                  className="mt-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Mostrar todos os itens
                </button>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-1 custom-scrollbar">
              {filteredItems.map((item) => (
                <KioskItemCard
                  key={item.id}
                  item={item}
                  onOpenNotes={handleOpenNotes}
                  onAddToCart={handleAddToCart}
                />
              ))}
            </div>
          )}
        </div>

        <KioskCartDrawer
          kioskCart={kioskCart}
          totalAmount={totalAmount}
          acceptedPaymentMethods={currentStore.operationalSettings?.acceptedPaymentMethods}
          onUpdateQty={handleUpdateQty}
          onFinishOrder={handleFinishSelfServiceOrder}
        />
      </div>

      {activeItemForNotes && (
        <KioskItemNotesModal
          item={activeItemForNotes}
          customNotes={customNotes}
          setCustomNotes={setCustomNotes}
          onClose={() => setActiveItemForNotes(null)}
          onSave={handleSaveNotesAndAdd}
        />
      )}

      {isPixModalOpen && (
        <KioskPixModal
          pixKey={pixKey}
          merchantName={currentStore.name}
          merchantCity={merchantCity}
          orderCompletedCode={orderCompletedCode}
          totalAmount={completedTotal || totalAmount}
          savedOffline={completedSavedOffline}
          onReset={handleResetKiosk}
        />
      )}

      {orderCompletedCode && !isPixModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 text-center shadow-2xl animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Pedido Enviado para Preparo</h3>
              <p className="text-xs text-slate-400">
                Acompanhe a sua senha no painel de retirada da loja.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-1">
              <div className="text-[11px] font-medium text-slate-400 flex items-center justify-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                <span>Senha de Retirada</span>
              </div>
              <div className="text-3xl font-black font-mono tabular-nums text-amber-400 tracking-tight">
                {orderCompletedCode}
              </div>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono tabular-nums space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Forma de Pagamento</span>
                <span className="text-slate-200 font-sans font-semibold">
                  {PAYMENT_METHOD_LABELS[completedPaymentMethod || ''] || completedPaymentMethod || 'Balcão'}
                </span>
              </div>
              <div className="flex justify-between text-white font-bold">
                <span>Valor Total</span>
                <span className="text-emerald-400">
                  R$ {completedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {completedSavedOffline && (
              <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Salvo em modo offline — será sincronizado automaticamente.</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleResetKiosk}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Iniciar Novo Pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

