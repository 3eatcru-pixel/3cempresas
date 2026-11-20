import React, { useState } from 'react';
import { DiningTable, MenuItem, StorePaymentMethod } from '../../types';
import { ThermalReceiptModal } from '../store-os/common/ThermalReceiptModal';
import { useEcosystem } from '../../context/EcosystemContext';

// Decomposed Components
import { WaiterNewOrderTab } from './layout/WaiterNewOrderTab';
import { WaiterConsumptionTab } from './layout/WaiterConsumptionTab';
import { WaiterBillTab } from './layout/WaiterBillTab';
import { ItemNotesModal } from './layout/ItemNotesModal';
import { WaiterModalHeader } from './layout/WaiterModalHeader';
import { WaiterModalSubNav, WaiterModalSubTab } from './layout/WaiterModalSubNav';

interface WaiterTableModalProps {
  selectedTable: DiningTable;
  storeMenuItems: MenuItem[];
  waiterName: string;
  onClose: () => void;
  onSendOrderToKitchen: (tableNum: number, items: { menuItem: MenuItem; qty: number; notes?: string }[]) => Promise<boolean> | boolean;
  onCloseTableBill: (tableId: string, paymentMethod?: StorePaymentMethod) => Promise<void> | void;
}

export const WaiterTableModal: React.FC<WaiterTableModalProps> = ({
  selectedTable,
  storeMenuItems,
  waiterName,
  onClose,
  onSendOrderToKitchen,
  onCloseTableBill,
}) => {
  const { currentStore, orders } = useEcosystem();
  const [activeSubTab, setActiveSubTab] = useState<WaiterModalSubTab>('new_order');

  const [orderItems, setOrderItems] = useState<{ menuItem: MenuItem; qty: number; notes?: string }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [activeItemForNotes, setActiveItemForNotes] = useState<MenuItem | null>(null);
  const [itemNoteInput, setItemNoteInput] = useState<string>('');

  const acceptedMethods = currentStore.operationalSettings?.acceptedPaymentMethods;
  const defaultPaymentMethod: StorePaymentMethod =
    Array.isArray(acceptedMethods) && acceptedMethods.length > 0
      ? acceptedMethods[0]
      : 'PIX';

  const [splitGuests, setSplitGuests] = useState(2);
  const [includeTip, setIncludeTip] = useState(true);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<StorePaymentMethod>(defaultPaymentMethod);
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [printBillData, setPrintBillData] = useState<any | null>(null);

  const categories = ['Todos', ...Array.from(new Set(storeMenuItems.map(i => i.category)))];
  const filteredMenuItems = selectedCategory === 'Todos'
    ? storeMenuItems
    : storeMenuItems.filter(i => i.category === selectedCategory);

  const tableOrders = orders.filter(
    o => o.tableNumber === selectedTable.tableNumber &&
    o.storeId === currentStore.id &&
    o.status !== 'DELIVERED' &&
    o.status !== 'CANCELLED'
  );

  const existingItemsCount = tableOrders.reduce((acc, o) => acc + o.items.reduce((sum, i) => sum + i.quantity, 0), 0);

  const handleAddItemToTableOrder = (item: MenuItem) => {
    setOrderItems(prev => {
      const existingIdx = prev.findIndex(i => i.menuItem.id === item.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx].qty += 1;
        return next;
      }
      return [...prev, { menuItem: item, qty: 1, notes: '' }];
    });
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    setOrderItems(prev => {
      const next = [...prev];
      next[index].qty += delta;
      if (next[index].qty <= 0) return next.filter((_, i) => i !== index);
      return next;
    });
  };

  const handleSaveItemNotes = () => {
    if (!activeItemForNotes) return;
    setOrderItems(prev => prev.map(i => (i.menuItem.id === activeItemForNotes.id ? { ...i, notes: itemNoteInput.trim() } : i)));
    setActiveItemForNotes(null);
    setItemNoteInput('');
  };

  const handleSendOrder = async () => {
    if (orderItems.length === 0 || isSendingOrder) return;
    setIsSendingOrder(true);
    try {
      const ok = await onSendOrderToKitchen(selectedTable.tableNumber, orderItems);
      if (ok) {
        setOrderItems([]);
      }
    } finally {
      setIsSendingOrder(false);
    }
  };

  const serviceFeeAmount = includeTip ? selectedTable.totalAmount * 0.10 : 0;
  const grandTotalWithTip = selectedTable.totalAmount + serviceFeeAmount;

  const handlePrintBill = () => {
    const allItems = tableOrders.flatMap(o => o.items);
    setPrintBillData({
      code: `MESA-${selectedTable.tableNumber}`,
      customerName: `Mesa ${selectedTable.tableNumber} (Garçom: ${waiterName})`,
      items: allItems.length > 0 ? allItems : [{ name: 'Consumo Restaurante', quantity: 1, price: selectedTable.totalAmount }],
      subtotal: selectedTable.totalAmount,
      deliveryFee: 0,
      discount: 0,
      total: grandTotalWithTip,
      paymentMethod: `MESA / ${selectedPaymentMethod}`,
      tableNumber: selectedTable.tableNumber,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl">
        <WaiterModalHeader selectedTable={selectedTable} waiterName={waiterName} onClose={onClose} />
        <WaiterModalSubNav
          activeSubTab={activeSubTab}
          onSelectTab={setActiveSubTab}
          orderItemsCount={orderItems.reduce((acc, i) => acc + i.qty, 0)}
          existingItemsCount={existingItemsCount}
        />
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {activeSubTab === 'new_order' && (
            <WaiterNewOrderTab
              categories={categories}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              filteredMenuItems={filteredMenuItems}
              orderItems={orderItems}
              handleAddItemToTableOrder={handleAddItemToTableOrder}
              handleUpdateItemQty={handleUpdateItemQty}
              handleSendOrder={handleSendOrder}
              newOrderTotal={orderItems.reduce((acc, i) => acc + (i.menuItem.price * i.qty), 0)}
              setActiveItemForNotes={setActiveItemForNotes}
              setItemNoteInput={setItemNoteInput}
            />
          )}

          {activeSubTab === 'consumption' && (
            <WaiterConsumptionTab
              tableNumber={selectedTable.tableNumber}
              totalAmount={selectedTable.totalAmount}
              tableOrders={tableOrders}
            />
          )}

          {activeSubTab === 'bill' && (
            <WaiterBillTab
              tableNumber={selectedTable.tableNumber}
              totalAmount={selectedTable.totalAmount}
              includeTip={includeTip}
              setIncludeTip={setIncludeTip}
              splitGuests={splitGuests}
              setSplitGuests={setSplitGuests}
              selectedPaymentMethod={selectedPaymentMethod}
              setSelectedPaymentMethod={setSelectedPaymentMethod}
              acceptedPaymentMethods={currentStore.operationalSettings?.acceptedPaymentMethods}
              handlePrintBill={handlePrintBill}
              handleFinalCloseBill={() => onCloseTableBill(selectedTable.id, selectedPaymentMethod)}
              serviceFeeAmount={serviceFeeAmount}
              grandTotalWithTip={grandTotalWithTip}
            />
          )}
        </div>
      </div>

      {activeItemForNotes && (
        <ItemNotesModal
          item={activeItemForNotes}
          input={itemNoteInput}
          setInput={setItemNoteInput}
          onSave={handleSaveItemNotes}
          onClose={() => setActiveItemForNotes(null)}
        />
      )}

      {printBillData && (
        <ThermalReceiptModal
          isOpen={!!printBillData}
          onClose={() => setPrintBillData(null)}
          order={printBillData}
          store={currentStore}
        />
      )}
    </div>
  );
};
