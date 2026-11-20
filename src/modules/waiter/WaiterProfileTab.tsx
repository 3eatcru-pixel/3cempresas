import React from 'react';
import { 
  Award, QrCode, Smartphone, 
  Shield, LogOut, Tablet 
} from 'lucide-react';
import { Store, DiningTable, Order } from '../../types';
import { UserProfile } from '../../context/AuthContext';

interface WaiterProfileTabProps {
  currentStore: Store;
  waiterName: string;
  setWaiterName: (name: string) => void;
  tables: DiningTable[];
  orders: Order[];
  profile?: UserProfile | null;
  onOpenQrPairing: () => void;
  onLogout?: () => void;
}

export const WaiterProfileTab: React.FC<WaiterProfileTabProps> = ({
  currentStore,
  waiterName,
  setWaiterName,
  orders,
  profile,
  onOpenQrPairing,
  onLogout,
}) => {
  const waiterOrders = orders.filter(
    o => o.storeId === currentStore.id && 
    o.channel === 'TABLE' && 
    o.status !== 'CANCELLED'
  );

  const totalSalesAmount = waiterOrders.reduce((acc, o) => acc + o.total, 0);
  const totalTip10 = totalSalesAmount * 0.10;
  const servedCount = waiterOrders.filter(o => o.status === 'DELIVERED').length;

  const isPdq = profile?.authProvider === 'STORE_DEVICE_PDQ';
  const isPin = profile?.authProvider === 'WAITER_PIN_TERMINAL';

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header Profile Card */}
      <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
            {waiterName.charAt(0)}
          </div>

          <div className="space-y-1 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-xl font-black text-white">{waiterName}</h2>
              {isPdq ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase inline-flex items-center gap-1 justify-center">
                  <Tablet className="w-3 h-3" /> PDQ / Dispositivo: {profile?.deviceId}
                </span>
              ) : isPin ? (
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono font-bold uppercase">
                  Terminal Salão • PIN Pareado
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase">
                  Conta Equipe • {profile?.email || 'Credenciado'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Estabelecimento: <span className="text-white font-bold">{currentStore.name}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-center">
            <button
              type="button"
              onClick={onOpenQrPairing}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 cursor-pointer shrink-0"
            >
              <QrCode className="w-4 h-4" /> Parear Celular
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-rose-300 border border-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" /> Trocar Conta / Sair
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
          <Award className="w-4 h-4" /> Desempenho no Turno Atual
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="text-xs font-semibold text-slate-400">Total de Vendas no Salão</div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              R$ {totalSalesAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {waiterOrders.length} comanda(s) lançada(s)
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="text-xs font-semibold text-slate-400">Comissão Estimada (10%)</div>
            <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              R$ {totalTip10.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              Ticket médio: R${' '}
              {(waiterOrders.length > 0 ? totalSalesAmount / waiterOrders.length : 0).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="text-xs font-semibold text-slate-400">Pedidos Servidos</div>
            <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {servedCount}{' '}
              <span className="text-xs font-sans font-normal text-slate-400">
                de {waiterOrders.length}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {waiterOrders.length - servedCount} em andamento no salão
            </div>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-3">
          <Smartphone className="w-4 h-4 text-blue-400" /> Configurações do Terminal do Atendente
        </h3>

        <div className="space-y-4 max-w-md">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Nome do Garçom / Operador</label>
            <input
              type="text"
              value={waiterName}
              onChange={e => setWaiterName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-500 outline-none font-bold"
              placeholder="Ex: Garçom Lucas"
            />
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" /> Conexão Segura ao Salão
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              O seu smartphone está autenticado via token temporário pareado no terminal do estabelecimento. Nenhuma informação bancária do lojista é armazenada neste terminal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
