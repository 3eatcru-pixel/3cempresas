import React, { useMemo, useState } from 'react';
import { Plus, Search, Truck } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Supplier } from '../../../types';
import { SupplierPurchaseModal } from './SupplierPurchaseModal';
import { SupplierCard } from './SupplierCard';
import { SupplierFormModal, SupplierFormValues } from './SupplierFormModal';

const EMPTY_SUPPLIER_FORM: SupplierFormValues = {
  companyName: '',
  cnpj: '',
  contactName: '',
  phone: '',
  email: '',
  category: 'Insumos Gerais',
};

export const SuppliersApp: React.FC = () => {
  const {
    suppliers,
    menuItems,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addInventoryBatch,
    updateMenuItem,
    addFinancialRecord,
    showNotification,
    currentStore,
  } = useEcosystem();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [purchaseSupplier, setPurchaseSupplier] = useState<Supplier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<SupplierFormValues>(EMPTY_SUPPLIER_FORM);

  const storeItems = menuItems.filter((m) => m.storeId === currentStore?.id);

  const storeSuppliers = useMemo(
    () =>
      suppliers.filter((s) => {
        if (currentStore?.tenantId && s.tenantId && s.tenantId !== currentStore.tenantId) {
          return false;
        }
        if (currentStore?.id && s.storeId && s.storeId !== currentStore.id) {
          return false;
        }
        return true;
      }),
    [suppliers, currentStore?.id, currentStore?.tenantId]
  );

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(storeSuppliers.map((s) => s.category).filter(Boolean)))],
    [storeSuppliers]
  );

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return storeSuppliers.filter((s) => {
      if (selectedCategory !== 'Todas' && s.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        s.companyName?.toLowerCase().includes(q) ||
        s.contactName?.toLowerCase().includes(q) ||
        s.cnpj?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
      );
    });
  }, [storeSuppliers, selectedCategory, search]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setForm(EMPTY_SUPPLIER_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setForm({
      companyName: sup.companyName || '',
      cnpj: sup.cnpj || '',
      contactName: sup.contactName || '',
      phone: sup.phone || '',
      email: sup.email || '',
      category: sup.category || 'Insumos Gerais',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName.trim()) {
      showNotification('Informe a Razão Social ou Nome do fornecedor.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        companyName: form.companyName.trim(),
        cnpj: form.cnpj.trim(),
        contactName: form.contactName.trim() || 'Vendas',
        phone: form.phone.trim(),
        email: form.email.trim(),
        category: form.category.trim() || 'Geral',
      };
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload);
      } else {
        await addSupplier({
          ...payload,
          storeId: currentStore?.id,
          tenantId: currentStore?.tenantId,
        });
      }
      setIsModalOpen(false);
      setEditingSupplier(null);
    } catch {
      showNotification('Erro ao salvar fornecedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildWhatsAppLink = (sup: Supplier) => {
    const digits = (sup.phone || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    const normalized = digits.startsWith('55') ? digits : `55${digits}`;
    const text = encodeURIComponent(
      `Olá ${sup.contactName || sup.companyName}, aqui é da loja ${currentStore?.name || ''}. Gostaria de fazer uma cotação/reposição de insumos.`
    );
    return `https://wa.me/${normalized}?text=${text}`;
  };

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2 gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Fornecedores e Compras
            </h3>
            <p className="text-xs text-slate-400">
              <span className="font-mono tabular-nums text-slate-200">{storeSuppliers.length}</span> parceiro(s) cadastrado(s) · entrada de nota fiscal no estoque integrada a Contas a Pagar.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por razão social, CNPJ, contato ou categoria..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((sup) => (
          <SupplierCard
            key={sup.id}
            supplier={sup}
            whatsappLink={buildWhatsAppLink(sup)}
            isConfirmingDelete={confirmDeleteId === sup.id}
            onEdit={openEditModal}
            onRequestDelete={setConfirmDeleteId}
            onConfirmDelete={async (id) => {
              await deleteSupplier(id);
              setConfirmDeleteId(null);
            }}
            onCancelDelete={() => setConfirmDeleteId(null)}
            onOpenPurchase={setPurchaseSupplier}
          />
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 flex flex-col items-center justify-center gap-3">
          <Truck className="w-10 h-10 text-slate-600" />
          <p className="text-sm font-semibold text-slate-300">Nenhum fornecedor encontrado.</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="text-xs text-amber-400 font-semibold hover:underline cursor-pointer"
          >
            Cadastrar primeiro fornecedor
          </button>
        </div>
      )}

      {isModalOpen && (
        <SupplierFormModal
          isEditing={Boolean(editingSupplier)}
          isSubmitting={isSubmitting}
          form={form}
          onChangeForm={setForm}
          onClose={() => setIsModalOpen(false)}
          onSubmit={(e) => void handleSubmit(e)}
        />
      )}

      {purchaseSupplier && (
        <SupplierPurchaseModal
          supplier={purchaseSupplier}
          storeItems={storeItems}
          onClose={() => setPurchaseSupplier(null)}
          onConfirmPurchase={async (p) => {
            const batchNumber = p.invoiceNumber
              ? `NF-${p.invoiceNumber}`
              : `LOT-${Date.now().toString().slice(-6)}`;
            const batchOk = await addInventoryBatch({
              storeId: currentStore.id,
              tenantId: currentStore.tenantId,
              itemId: p.menuItem?.id || p.sku,
              sku: p.sku,
              itemName: p.itemName,
              batchNumber,
              quantity: p.quantity,
              costPrice: p.unitCost,
              costPerUnit: p.unitCost,
              expirationDate: p.expirationDate,
              supplierName: purchaseSupplier.companyName,
              status: 'ACTIVE',
            });
            if (!batchOk) return;

            if (p.mode === 'CATALOG_ITEM' && p.menuItem) {
              await updateMenuItem(p.menuItem.id, {
                stock: (Number(p.menuItem.stock) || 0) + p.quantity,
                ...(p.unitCost > 0 ? { costPrice: p.unitCost } : {}),
              });
            }

            const totalAmount = Math.round(p.quantity * p.unitCost * 100) / 100;
            if (p.launchPayable && totalAmount > 0) {
              await addFinancialRecord({
                storeId: currentStore.id,
                tenantId: currentStore.tenantId || currentStore.id,
                type: 'PAYABLE',
                category: 'FORNECEDORES & COMPRAS',
                description: `Compra ${purchaseSupplier.companyName} · ${p.quantity}x ${p.itemName}${p.invoiceNumber ? ` (NF ${p.invoiceNumber})` : ''}`,
                amount: totalAmount,
                dueDate: p.payableDueDate,
                status: 'PENDING',
                entityName: purchaseSupplier.companyName,
              });
            }
            showNotification(
              p.launchPayable && totalAmount > 0
                ? `Entrada de ${p.itemName} registrada no Estoque e Conta a Pagar lançada!`
                : `Entrada de ${p.itemName} registrada no Estoque!`
            );
          }}
        />
      )}
    </div>
  );
};
