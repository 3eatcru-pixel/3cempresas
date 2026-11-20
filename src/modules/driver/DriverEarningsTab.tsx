import React, { useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, DollarSign, ArrowUpRight, CheckCircle2, Clock
} from 'lucide-react';
import { Driver, DriverPayout, Order } from '../../types';
import { DriverPixWithdrawModal } from './earnings/DriverPixWithdrawModal';
import { DriverEarningsLedger } from './earnings/DriverEarningsLedger';

interface DriverEarningsTabProps {
  currentDriver: Driver;
  completedOrders: Order[];
  payouts: DriverPayout[];
  onRequestWithdraw: (driverId: string, amount: number, pixKey: string) => Promise<boolean>;
  onShowNotification: (msg: string) => void;
}

const formatBRL = (val: number) => `R$ ${val.toFixed(2).replace('.', ',')}`;

const formatPayoutStatusLabel = (status?: string) => {
  switch (String(status || '').toUpperCase()) {
    case 'PAID':
    case 'COMPLETED':
      return 'Pago';
    case 'APPROVED':
      return 'Aprovado';
    case 'PROCESSING':
      return 'Em processamento';
    case 'PENDING':
    case 'REQUESTED':
      return 'Pendente';
    case 'REJECTED':
    case 'FAILED':
    case 'CANCELLED':
      return 'Recusado';
    default:
      return status || 'Solicitado';
  }
};

const getOrderEarning = (order: Order) =>
  Math.round(((Number(order.deliveryFee) || 0) + (Number((order as any).courierTip) || 0)) * 100) / 100;

export const DriverEarningsTab: React.FC<DriverEarningsTabProps> = ({
  currentDriver,
  completedOrders,
  payouts,
  onRequestWithdraw,
  onShowNotification,
}) => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const metrics = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 6 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let todayTotal = 0;
    let todayTrips = 0;
    let weekTotal = 0;
    let weekTrips = 0;
    let monthTotal = 0;
    let monthTrips = 0;
    let totalDeliveryFees = 0;
    let totalTips = 0;

    completedOrders.forEach((order) => {
      const fee = Number(order.deliveryFee) || 0;
      const tip = Number((order as any).courierTip) || 0;
      const earning = fee + tip;
      totalDeliveryFees += fee;
      totalTips += tip;

      const ts = new Date(order.deliveredAt || order.updatedAt || order.createdAt || '').getTime();
      if (Number.isFinite(ts) && ts >= startOfMonth) {
        monthTotal += earning;
        monthTrips += 1;
      }
      if (Number.isFinite(ts) && ts >= startOfWeek) {
        weekTotal += earning;
        weekTrips += 1;
      }
      if (Number.isFinite(ts) && ts >= startOfToday) {
        todayTotal += earning;
        todayTrips += 1;
      }
    });

    const totalWithdrawn = payouts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    return {
      todayTotal,
      todayTrips,
      weekTotal,
      weekTrips,
      monthTotal,
      monthTrips,
      totalDeliveryFees,
      totalTips,
      totalWithdrawn,
    };
  }, [completedOrders, payouts]);

  const ledgerEntries = useMemo(() => {
    const payoutItems = payouts.map((p) => ({
      id: `payout-${p.id}`,
      kind: 'PAYOUT' as const,
      title: `Saque PIX (${p.pixKey})`,
      subtitle: `${formatPayoutStatusLabel(p.status)} • ${new Date(p.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      amount: Number(p.amount) || 0,
      timestamp: new Date(p.createdAt).getTime() || 0,
    }));

    const orderItems = completedOrders.map((o) => {
      const ts = new Date(o.deliveredAt || o.updatedAt || o.createdAt || '').getTime() || 0;
      return {
        id: `order-${o.id}`,
        kind: 'EARNING' as const,
        title: `${o.storeName || 'Entrega'} (${o.code})`,
        subtitle: ts > 0
          ? new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : 'Entrega concluída',
        amount: getOrderEarning(o),
        timestamp: ts,
      };
    });

    return [...payoutItems, ...orderItems].sort((a, b) => b.timestamp - a.timestamp);
  }, [completedOrders, payouts]);

  const openWithdrawModal = () => {
    setWithdrawError(null);
    setWithdrawAmount(currentDriver.walletBalance > 0 ? currentDriver.walletBalance.toFixed(2) : '');
    const savedPix =
      (currentDriver as Driver & { pixKey?: string }).pixKey ||
      (() => {
        try {
          return localStorage.getItem(`3c_driver_pix_${currentDriver.id}`) || '';
        } catch {
          return '';
        }
      })();
    if (savedPix && !pixKey) {
      setPixKey(savedPix);
    }
    setShowWithdrawModal(true);
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    const parsedAmount = Math.round(Number(String(withdrawAmount).replace(',', '.')) * 100) / 100;
    const cleanPix = pixKey.trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setWithdrawError('Informe um valor de saque maior que zero.');
      return;
    }
    if (parsedAmount > currentDriver.walletBalance) {
      setWithdrawError('Saldo insuficiente na carteira para o valor solicitado.');
      return;
    }
    if (cleanPix.length < 3) {
      setWithdrawError('Informe uma chave PIX válida (mínimo 3 caracteres).');
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const ok = await onRequestWithdraw(currentDriver.id, parsedAmount, cleanPix);
      if (ok) {
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        setPixKey('');
      }
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      <div>
        <h2 className="text-lg font-black text-white">Meus Ganhos e Carteira</h2>
        <p className="text-xs text-slate-400">
          Repasses unificados das modalidades Plataforma Aberta e Frota da Loja registrados em carteira.
        </p>
      </div>

      <div className="bg-[#111922] border border-[#00CCBC]/40 rounded-2xl p-5 sm:p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10 text-[#00CCBC]">
          <Wallet className="w-28 h-28" />
        </div>

        <div className="relative z-10 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Saldo Disponível para Saque
          </span>
          <div className="text-3xl font-black text-[#00CCBC] font-mono tabular-nums">
            {formatBRL(Number(currentDriver.walletBalance) || 0)}
          </div>

          <button
            type="button"
            onClick={() => {
              if ((Number(currentDriver.walletBalance) || 0) <= 0) {
                onShowNotification('Você ainda não possui saldo disponível para saque.');
                return;
              }
              openWithdrawModal();
            }}
            className="w-full sm:w-auto px-6 h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <DollarSign className="w-4 h-4" /> Sacar Valores via PIX
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Hoje', value: formatBRL(metrics.todayTotal), trips: `${metrics.todayTrips} corridas finalizadas` },
          { label: 'Últimos 7 dias', value: formatBRL(metrics.weekTotal), trips: `${metrics.weekTrips} corridas finalizadas` },
          { label: 'Este Mês', value: formatBRL(metrics.monthTotal), trips: `${metrics.monthTrips} corridas finalizadas` },
        ].map((item, idx) => (
          <div key={idx} className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-1">
            <span className="text-xs text-slate-400 font-medium">{item.label}</span>
            <div className="text-xl font-black text-[#00CCBC] font-mono tabular-nums flex items-center justify-between">
              <span>{item.value}</span>
              <ArrowUpRight className="w-4 h-4 text-[#00CCBC]" />
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums">{item.trips}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Detalhamento dos Ganhos</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800">
              <span className="text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#00CCBC]" /> Taxas de Entrega ({completedOrders.length})
              </span>
              <span className="font-bold text-white font-mono tabular-nums">{formatBRL(metrics.totalDeliveryFees)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800">
              <span className="text-slate-300 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Gorjetas de Clientes
              </span>
              <span className="font-bold text-emerald-400 font-mono tabular-nums">+ {formatBRL(metrics.totalTips)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-[#0B1117] rounded-xl border border-slate-800">
              <span className="text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Saques Solicitados ({payouts.length})
              </span>
              <span className="font-bold text-amber-300 font-mono tabular-nums">- {formatBRL(metrics.totalWithdrawn)}</span>
            </div>
          </div>
        </div>

        <DriverEarningsLedger
          ledgerEntries={ledgerEntries}
          showAllHistory={showAllHistory}
          onToggleShowAll={() => setShowAllHistory((v) => !v)}
          formatBRL={formatBRL}
        />
      </div>

      {showWithdrawModal && (
        <DriverPixWithdrawModal
          walletBalance={Number(currentDriver.walletBalance) || 0}
          withdrawAmount={withdrawAmount}
          setWithdrawAmount={setWithdrawAmount}
          pixKey={pixKey}
          setPixKey={setPixKey}
          submitting={submittingWithdraw}
          errorMessage={withdrawError}
          onClose={() => setShowWithdrawModal(false)}
          onSubmit={handleWithdrawSubmit}
        />
      )}
    </div>
  );
};
