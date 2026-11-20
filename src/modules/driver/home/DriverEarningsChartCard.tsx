import React, { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Order } from '../../../types';

interface DriverEarningsChartCardProps {
  walletBalance: number;
  completedOrders?: Order[];
}

export const DriverEarningsChartCard: React.FC<DriverEarningsChartCardProps> = ({
  walletBalance,
  completedOrders = [],
}) => {
  const { totalEarningsToday, todayCount, last7Days } = useMemo(() => {
    const now = new Date();
    const toLocalDateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const dayBuckets: Array<{ key: string; label: string; amount: number; isToday: boolean }> = [];
    const weekNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    for (let i = 6; i >= 0; i--) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      dayBuckets.push({
        key: toLocalDateKey(dt),
        label: weekNames[dt.getDay()],
        amount: 0,
        isToday: i === 0,
      });
    }

    let todaySum = 0;
    let todayTrips = 0;
    const todayKey = toLocalDateKey(now);

    for (const o of completedOrders) {
      const stamp = o.deliveredAt || o.updatedAt || o.createdAt;
      if (!stamp) continue;
      const dt = new Date(stamp);
      if (isNaN(dt.getTime())) continue;
      const key = toLocalDateKey(dt);
      const earned = (Number(o.deliveryFee) || 0) + (Number((o as any).courierTip) || 0);
      const bucket = dayBuckets.find(b => b.key === key);
      if (bucket) {
        bucket.amount = Math.round((bucket.amount + earned) * 100) / 100;
      }
      if (key === todayKey) {
        todaySum = Math.round((todaySum + earned) * 100) / 100;
        todayTrips += 1;
      }
    }

    const maxAmount = Math.max(1, ...dayBuckets.map(b => b.amount));
    const normalized = dayBuckets.map(b => ({
      ...b,
      pct: b.amount > 0 ? Math.max(12, Math.round((b.amount / maxAmount) * 100)) : 4,
    }));

    return {
      totalEarningsToday: todaySum,
      todayCount: todayTrips,
      last7Days: normalized,
    };
  }, [completedOrders]);

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs text-slate-400 font-medium">Ganhos de Hoje</span>
          <div className="text-2xl font-black text-[#00CCBC] mt-0.5 tabular-nums font-mono">
            R$ {totalEarningsToday.toFixed(2).replace('.', ',')}
          </div>
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            Carteira disponível: R$ {(Number(walletBalance) || 0).toFixed(2).replace('.', ',')}
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-bold text-[#00CCBC] bg-[#00CCBC]/10 border border-[#00CCBC]/20 px-2.5 py-1 rounded-lg tabular-nums">
          <TrendingUp className="w-3.5 h-3.5" /> {todayCount} {todayCount === 1 ? 'entrega hoje' : 'entregas hoje'}
        </span>
      </div>

      {/* Real 7-Day Earnings Bar Chart */}
      <div className="flex items-end justify-between gap-2 h-20 pt-2">
        {last7Days.map((day) => (
          <div
            key={day.key}
            title={`${day.label}: R$ ${day.amount.toFixed(2).replace('.', ',')}`}
            className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
          >
            <div
              className={`w-full rounded-t-md transition-all ${
                day.isToday ? 'bg-[#00CCBC]' : day.amount > 0 ? 'bg-[#00CCBC]/45' : 'bg-slate-800'
              }`}
              style={{ height: `${day.pct}%` }}
            />
            <span className="text-[10px] text-slate-400 font-mono">
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
