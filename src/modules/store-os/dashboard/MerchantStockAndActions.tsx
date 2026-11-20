import React from 'react';
import { Package, Plus, CheckCircle2, Zap, AlertCircle, TrendingUp } from 'lucide-react';
import { Store, MenuItem, Order } from '../../../types';
import { useEcosystem } from '../../../context/EcosystemContext';
import { getPlatformAdapters } from '../../../core/platform/PlatformAdapter';

interface MerchantStockAndActionsProps {
  currentStore: Store;
  lowStockItems: MenuItem[];
  todayOrders: Order[];
}

export const MerchantStockAndActions: React.FC<MerchantStockAndActionsProps> = ({
  currentStore,
  lowStockItems,
  todayOrders,
}) => {
  const { updateMenuItem, showNotification } = useEcosystem();

  const rawPhone = (currentStore.phone || '').replace(/\D/g, '');
  const supportMsg = encodeURIComponent(
    `Olá Suporte! Preciso de auxílio operacional na loja ${currentStore.name} (ID: ${currentStore.id}).`
  );
  const supportUrl = rawPhone
    ? `https://wa.me/${rawPhone.startsWith('55') ? rawPhone : `55${rawPhone}`}?text=${supportMsg}`
    : null;

  const handleQuickRestock = async (item: MenuItem) => {
    await updateMenuItem(item.id, { stock: item.stock + 10 });
    showNotification(`+10 unidades adicionadas ao estoque de ${item.name}.`);
  };

  const handleOpenSupport = () => {
    if (!supportUrl) {
      showNotification('Telefone da loja não configurado. Cadastre em Configurações > Perfil.');
      return;
    }
    getPlatformAdapters().links.openExternal(supportUrl);
  };

  const handleExportOrdersCsv = () => {
    const csvRows = [
      'Código,Cliente,Data,Total,Status',
      ...todayOrders.map(
        o => `"${o.code}","${o.customerName}","${o.createdAt}",${o.total},"${o.status}"`
      ),
    ].join('\n');
    const filename = `Vendas_${currentStore.slug || 'loja'}_${new Date().toISOString().split('T')[0]}.csv`;
    getPlatformAdapters().links.downloadTextFile(filename, csvRows);
    showNotification(`Relatório de vendas exportado: ${filename}`);
  };

  return (
    <div className="space-y-6">
      {/* Stock Alerts Card */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 bg-slate-950/50">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-cyan-500" /> Alertas de Estoque
          </h3>
        </div>
        <div className="p-4 space-y-3">
          {lowStockItems.length > 0 ? (
            lowStockItems.slice(0, 4).map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800/80"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover opacity-80"
                      />
                    ) : (
                      <Package className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate max-w-[130px]">{item.name}</div>
                    <div className="text-[11px] text-rose-400 font-mono tabular-nums">
                      Restam {item.stock} un
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickRestock(item)}
                  title="Repor +10 unidades rapidamente"
                  className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          ) : (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto opacity-50" />
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                Estoque em conformidade
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 rounded-3xl border border-indigo-500/30 p-5 space-y-4 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Zap className="w-16 h-16 text-indigo-400" />
        </div>
        <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Ações Rápidas</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleOpenSupport}
            className="flex flex-col items-center gap-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-amber-500/50 transition-all group cursor-pointer"
          >
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-300 uppercase">Solicitar Suporte</span>
          </button>
          <button
            type="button"
            onClick={handleExportOrdersCsv}
            className="flex flex-col items-center gap-2 p-3 bg-slate-950/80 rounded-2xl border border-slate-800 hover:border-emerald-500/50 transition-all group cursor-pointer"
          >
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black text-slate-300 uppercase">Exportar Vendas CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
