import React, { useState } from 'react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { Package, Plus, RefreshCw, FileSpreadsheet, Sparkles, PackagePlus, Download } from 'lucide-react';
import { predictInventoryDepletionAI } from '../../../services/gemini';
import { MenuItem } from '../../../types';
import { isItemService, isServiceCategory } from '../../../utils/storeDomain';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

// Modular Components
import { InventoryStats } from './components/InventoryStats';
import { InventoryStockTab } from './components/InventoryStockTab';
import { InventoryBOMTab } from './components/InventoryBOMTab';
import { InventoryAdjustModal } from './components/InventoryAdjustModal';
import { InventoryBomEditorModal } from './components/InventoryBomEditorModal';
import { InventoryBatchModal } from './components/InventoryBatchModal';

export const InventoryApp: React.FC<{ isSharedMode?: boolean }> = ({ isSharedMode = false }) => {
  const {
    currentStore,
    menuItems,
    inventoryBatches,
    suppliers,
    updateMenuItem,
    addInventoryBatch,
    addFinancialRecord,
    showNotification,
    governance,
  } = useEcosystem();
  const aiEngineEnabled = governance?.featureFlags?.aiEngineEnabled ?? true;
  const [activeInventoryTab, setActiveInventoryTab] = useState<'stock' | 'bom' | 'warehouse'>('stock');

  const [isAiInventoryPredicting, setIsAiInventoryPredicting] = useState(false);
  const [aiInventoryReport, setAiInventoryReport] = useState<string | null>(null);

  const [adjustingItem, setAdjustingItem] = useState<MenuItem | null>(null);
  const [adjustQty, setAdjustQty] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('Entrada de Mercadoria');
  const [adjustMinAlert, setAdjustMinAlert] = useState<number>(5);
  const [adjustSupplier, setAdjustSupplier] = useState<string>('');
  const [adjustUnitCost, setAdjustUnitCost] = useState<number>(0);
  const [adjustExpDate, setAdjustExpDate] = useState<string>(
    new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
  );

  const [editingBomItem, setEditingBomItem] = useState<MenuItem | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  const storeItems = isSharedMode
    ? menuItems.filter(m => m.tenantId === currentStore.tenantId)
    : menuItems.filter(m => m.storeId === currentStore.id);
  const storeSuppliers = suppliers.filter(
    s => (!s.storeId || s.storeId === currentStore.id) && (!s.tenantId || s.tenantId === currentStore.tenantId)
  );
  const storeBatches = inventoryBatches.filter(
    b => b.storeId === currentStore.id || (currentStore.operationalSettings?.sharedWarehouseMode && !b.storeId)
  );
  const isPureServiceStore = isServiceCategory(currentStore.category);
  const lowStockItems = storeItems.filter(
    m => !isItemService(m, currentStore) && m.stock <= (m.minStockAlert ?? 5)
  );

  const openAdjustModal = (item: MenuItem) => {
    setAdjustingItem(item);
    setAdjustQty(10);
    setAdjustReason('Entrada de Mercadoria');
    setAdjustMinAlert(item.minStockAlert ?? 5);
    setAdjustSupplier(storeSuppliers[0]?.companyName || '');
    setAdjustUnitCost(Number(item.costPrice) || 0);
    setAdjustExpDate(new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]);
  };

  const handlePredictInventory = async () => {
    if (!aiEngineEnabled) {
      showNotification('Previsão de Estoque IA está desativada na governança.');
      return;
    }
    setIsAiInventoryPredicting(true);
    try {
      const simplifiedItems = lowStockItems.map(m => ({ name: m.name, stock: m.stock, minAlert: m.minStockAlert }));
      const result = await predictInventoryDepletionAI(currentStore.name, simplifiedItems);
      setAiInventoryReport(result);
      showNotification('Análise de inventário via IA concluída!');
    } catch {
      showNotification('Erro na análise via IA.');
    } finally {
      setIsAiInventoryPredicting(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    const delta = Number(adjustQty);
    const minAlertChanged = adjustMinAlert !== (adjustingItem.minStockAlert ?? 5);
    if (!Number.isFinite(delta) || (delta === 0 && !minAlertChanged)) {
      showNotification('Informe uma quantidade de ajuste válida ou altere o alerta mínimo.');
      return;
    }

    const newStock = Math.max(0, adjustingItem.stock + delta);
    try {
      const stockOk = await updateMenuItem(adjustingItem.id, {
        stock: newStock,
        minStockAlert: adjustMinAlert,
        ...(delta > 0 && adjustUnitCost > 0 ? { costPrice: adjustUnitCost } : {}),
      });
      if (!stockOk) return;

      if (delta > 0) {
        const batchOk = await addInventoryBatch({
          storeId: currentStore.id,
          itemId: adjustingItem.id,
          itemName: adjustingItem.name,
          sku: adjustingItem.sku || `SKU-${adjustingItem.id.slice(-4)}`,
          batchNumber: `LOT-${Date.now().toString().slice(-6)}`,
          quantity: delta,
          costPrice: adjustUnitCost || adjustingItem.costPrice || 0,
          costPerUnit: adjustUnitCost || adjustingItem.costPrice || 0,
          expirationDate: adjustExpDate || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
          supplierName: adjustSupplier || adjustReason || 'Entrada de Estoque',
          status: 'ACTIVE',
        });
        if (!batchOk) {
          await updateMenuItem(adjustingItem.id, { stock: adjustingItem.stock });
          showNotification('Erro ao registrar lote de entrada; saldo de estoque revertido.');
          return;
        }
      }

      showNotification(`Estoque de "${adjustingItem.name}" atualizado para ${newStock} un!`);
      setAdjustingItem(null);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao salvar ajuste de estoque.');
    }
  };

  return (
    <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 sticky top-0 bg-[#0a0e17] z-10 py-2 gap-3">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-emerald-400" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
                {isSharedMode
                  ? 'Hub de Estoque Centralizado'
                  : isPureServiceStore
                  ? 'Estoque de Insumos & Produtos de Revenda'
                  : 'Estoque, Lotes FEFO & Ficha Técnica'}
              </h3>
              {isSharedMode && (
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded uppercase tracking-widest">
                  Dark Kitchen Hub
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {isSharedMode
                ? 'Gerenciando estoque compartilhado.'
                : isPureServiceStore
                ? 'Serviços possuem capacidade ilimitada; controle aqui insumos e produtos físicos.'
                : 'Saldos por produto, lotes FEFO com validade e ficha técnica (BOM) integrada ao PDV.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => setActiveInventoryTab('stock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeInventoryTab === 'stock' ? 'bg-emerald-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Saldos</span>
            </button>
            {!isPureServiceStore && (
              <button
                type="button"
                onClick={() => setActiveInventoryTab('bom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeInventoryTab === 'bom' ? 'bg-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Ficha Técnica & Lotes</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (storeItems.length === 0) {
                showNotification('Nenhum item em estoque para exportar.');
                return;
              }
              const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
              const rows = [
                'SKU,Produto,Categoria,Tipo,Saldo,Minimo,CustoUnitario,PrecoVenda',
                ...storeItems.map((m) =>
                  [
                    m.sku || '',
                    m.name,
                    m.category,
                    m.specs?.segment === 'SERVICE' ? 'SERVICO' : 'PRODUTO',
                    m.specs?.segment === 'SERVICE' ? 'ILIMITADO' : m.stock,
                    m.minStockAlert ?? 5,
                    (Number(m.costPrice) || 0).toFixed(2),
                    (Number(m.price) || 0).toFixed(2),
                  ]
                    .map(esc)
                    .join(',')
                ),
              ].join('\n');
              const filename = `Inventario_${currentStore.slug || currentStore.id}_${new Date()
                .toISOString()
                .split('T')[0]}.csv`;
              getPlatformAdapters().links.downloadTextFile(filename, rows);
              showNotification(`Inventário exportado: ${filename}`);
            }}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <PackagePlus className="w-3.5 h-3.5" /> Novo Lote
          </button>

          <button
            type="button"
            onClick={handlePredictInventory}
            disabled={isAiInventoryPredicting}
            className="px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            {isAiInventoryPredicting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Previsão IA
          </button>
        </div>
      </div>

      {aiInventoryReport && (
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-[11px] text-indigo-200 leading-relaxed relative overflow-hidden animate-fadeIn">
          <div className="flex items-center gap-2 mb-2 font-bold text-indigo-400">
            <Sparkles className="w-4 h-4" /> Relatório de Previsão de Ruptura
          </div>
          <p className="whitespace-pre-wrap">{aiInventoryReport}</p>
          <button
            type="button"
            onClick={() => setAiInventoryReport(null)}
            className="absolute top-4 right-4 text-indigo-400/50 hover:text-indigo-400 cursor-pointer"
          >
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>
      )}

      {activeInventoryTab === 'stock' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <InventoryStats storeItems={storeItems} lowStockItems={lowStockItems} />
          <InventoryStockTab storeItems={storeItems} onAdjust={openAdjustModal} />
        </div>
      ) : (
        <InventoryBOMTab
          storeItems={storeItems}
          inventoryBatches={storeBatches}
          onEditBom={(item) => setEditingBomItem(item)}
          onOpenNewBatch={() => setIsBatchModalOpen(true)}
          onRecalculate={async (item, calculatedCost) => {
            if (calculatedCost > 0) {
              await updateMenuItem(item.id, { costPrice: Math.round(calculatedCost * 100) / 100 });
            }
            showNotification(`Custo CMV de "${item.name}" atualizado para R$ ${calculatedCost.toFixed(2)}!`);
          }}
        />
      )}

      {adjustingItem && (
        <InventoryAdjustModal
          item={adjustingItem}
          suppliers={storeSuppliers}
          adjustQty={adjustQty}
          setAdjustQty={setAdjustQty}
          adjustReason={adjustReason}
          setAdjustReason={setAdjustReason}
          minStockAlert={adjustMinAlert}
          setMinStockAlert={setAdjustMinAlert}
          supplierName={adjustSupplier}
          setSupplierName={setAdjustSupplier}
          unitCost={adjustUnitCost}
          setUnitCost={setAdjustUnitCost}
          expirationDate={adjustExpDate}
          setExpirationDate={setAdjustExpDate}
          onClose={() => setAdjustingItem(null)}
          onSubmit={handleSaveAdjustment}
        />
      )}

      {editingBomItem && (
        <InventoryBomEditorModal
          item={editingBomItem}
          inventoryBatches={storeBatches}
          onClose={() => setEditingBomItem(null)}
          onSave={async (itemId, recipe, calculatedCost) => {
            const ok = await updateMenuItem(itemId, {
              recipe,
              ...(calculatedCost > 0 ? { costPrice: calculatedCost } : {}),
            });
            if (ok) {
              showNotification(`Ficha técnica de "${editingBomItem.name}" salva com sucesso!`);
            }
          }}
        />
      )}

      {isBatchModalOpen && (
        <InventoryBatchModal
          storeId={currentStore.id}
          tenantId={currentStore.tenantId}
          suppliers={storeSuppliers}
          onClose={() => setIsBatchModalOpen(false)}
          onSaveBatch={async (batch, payable) => {
            const ok = await addInventoryBatch(batch);
            if (ok && payable) {
              await addFinancialRecord({
                storeId: currentStore.id,
                tenantId: currentStore.tenantId || currentStore.id,
                type: 'PAYABLE',
                category: 'COMPRA DE INSUMOS',
                description: `Compra Lote ${batch.batchNumber} (${batch.itemName})${payable.invoiceNumber ? ` · NF ${payable.invoiceNumber}` : ''}`,
                amount: payable.totalAmount,
                dueDate: payable.dueDate,
                status: 'PENDING',
                entityName: payable.supplierName,
              });
              showNotification('Lote registrado e Conta a Pagar lançada no Financeiro!');
            }
          }}
        />
      )}
    </div>
  );
};

