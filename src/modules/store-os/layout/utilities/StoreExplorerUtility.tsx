import React from 'react';
import {
  Download,
  FolderOpen,
  FileSpreadsheet,
  ArrowRight,
} from 'lucide-react';
import { WindowAppId } from '../storeOsAppsList';
import { Store, MenuItem } from '../../../../types';
import { useEcosystem } from '../../../../context/EcosystemContext';
import { getPlatformAdapters } from '../../../../core/platform/PlatformAdapter';

interface StoreExplorerUtilityProps {
  currentStore: Store;
  menuItems: MenuItem[];
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

export const StoreExplorerUtility: React.FC<StoreExplorerUtilityProps> = ({
  currentStore,
  menuItems,
  onOpenApp,
}) => {
  const { orders, showNotification } = useEcosystem();
  const storeOrders = orders.filter((o) => o.storeId === currentStore.id);
  const storeItems = menuItems.filter((i) => i.storeId === currentStore.id);

  const downloadCsv = (filename: string, rows: string[]) => {
    getPlatformAdapters().links.downloadTextFile(filename, rows.join('\n'), 'text/csv;charset=utf-8');
    showNotification(`Arquivo ${filename} exportado com sucesso!`);
  };

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto text-slate-200 animate-fadeIn">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400">
          <FolderOpen className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">
            Arquivos & Exportações CSV
          </h3>
          <p className="text-[11px] text-slate-400">
            Exporte planilhas de pedidos e catálogo de {currentStore.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400 font-black text-xs uppercase">
              <FileSpreadsheet className="w-4 h-4" /> Relatório de Pedidos
            </div>
            <span className="text-[10px] font-mono text-slate-400">{storeOrders.length} registros</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Exporta código, cliente, canal, status, forma de pagamento e total em formato CSV.
          </p>
          <button
            onClick={() =>
              downloadCsv(`pedidos_${currentStore.slug || currentStore.id}.csv`, [
                'Codigo,Cliente,Canal,Status,Pagamento,Total,Data',
                ...storeOrders.map(
                  (o) =>
                    `"${o.code}","${o.customerName}","${o.channel}","${o.status}","${o.paymentMethod}",${o.total},"${o.createdAt}"`
                ),
              ])
            }
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Baixar Pedidos CSV
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-black text-xs uppercase">
              <FileSpreadsheet className="w-4 h-4" /> Catálogo & Estoque
            </div>
            <span className="text-[10px] font-mono text-slate-400">{storeItems.length} itens</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Exporta SKU, EAN, categoria, preço de venda, custo e estoque atual do catálogo.
          </p>
          <button
            onClick={() =>
              downloadCsv(`catalogo_${currentStore.slug || currentStore.id}.csv`, [
                'SKU,Nome,Categoria,Preco,Custo,Estoque,Segmento',
                ...storeItems.map(
                  (i) =>
                    `"${i.sku}","${i.name}","${i.category}",${i.price},${i.costPrice},${i.stock},"${i.specs?.segment || currentStore.category}"`
                ),
              ])
            }
            className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Baixar Catálogo CSV
          </button>
        </div>
      </div>

      {onOpenApp && (
        <div className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Atalhos de Pastas Operacionais
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'catalog' as WindowAppId, title: 'Cardápio / Catálogo', desc: 'Produtos & Serviços' },
              { id: 'inventory' as WindowAppId, title: 'Estoque & Ficha Técnica', desc: 'Lotes & Saldo' },
              { id: 'finance' as WindowAppId, title: 'Financeiro & DRE', desc: 'Fluxo de Caixa' },
            ].map((folder) => (
              <button
                key={folder.id}
                onClick={() => onOpenApp(folder.id, folder.title)}
                className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer"
              >
                <div>
                  <div className="text-xs font-bold text-white">{folder.title}</div>
                  <div className="text-[10px] text-slate-500">{folder.desc}</div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
