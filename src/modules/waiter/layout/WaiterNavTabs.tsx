import React from 'react';
import { Home, Users, ChefHat, Bell, User } from 'lucide-react';

export type WaiterTabId = 'home' | 'tables' | 'kitchen' | 'notifications' | 'profile';

interface WaiterNavTabsProps {
  activeTab: WaiterTabId;
  onSelectTab: (tab: WaiterTabId) => void;
  readyOrdersCount: number;
  billCallsCount: number;
}

export const WaiterNavTabs: React.FC<WaiterNavTabsProps> = ({
  activeTab,
  onSelectTab,
  readyOrdersCount,
  billCallsCount,
}) => {
  const totalAlerts = billCallsCount + readyOrdersCount;

  const tabs: Array<{
    id: WaiterTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeClass?: string;
  }> = [
    { id: 'home', label: 'Início', icon: Home },
    { id: 'tables', label: 'Mesas', icon: Users },
    {
      id: 'kitchen',
      label: 'Cozinha',
      icon: ChefHat,
      badge: readyOrdersCount,
      badgeClass: 'bg-emerald-500 text-slate-950',
    },
    {
      id: 'notifications',
      label: 'Avisos',
      icon: Bell,
      badge: totalAlerts,
      badgeClass: 'bg-purple-500 text-white',
    },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  return (
    <div className="grid grid-cols-5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`min-h-[44px] py-2 px-1 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors relative cursor-pointer whitespace-nowrap ${
              isActive
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-[11px] sm:text-xs">{tab.label}</span>
            {tab.badge && tab.badge > 0 ? (
              <span
                className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono tabular-nums font-bold flex items-center justify-center ${
                  tab.badgeClass || 'bg-amber-500 text-slate-950'
                }`}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};

