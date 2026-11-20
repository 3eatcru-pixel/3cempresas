import React from 'react';
import { Home, Package, Map, Wallet, User } from 'lucide-react';

export type DriverTab = 'home' | 'orders' | 'map' | 'earnings' | 'profile';

interface DriverBottomNavProps {
  activeTab: DriverTab;
  onTabChange: (tab: DriverTab) => void;
  availableCount?: number;
  activeCount?: number;
}

export const DriverBottomNav: React.FC<DriverBottomNavProps> = ({
  activeTab,
  onTabChange,
  availableCount = 0,
  activeCount = 0,
}) => {
  const tabs: { id: DriverTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Início', icon: <Home className="w-5 h-5" /> },
    { 
      id: 'orders', 
      label: 'Pedidos', 
      icon: <Package className="w-5 h-5" />, 
      badge: availableCount > 0 ? availableCount : undefined 
    },
    { 
      id: 'map', 
      label: 'Mapa', 
      icon: <Map className="w-5 h-5" />, 
      badge: activeCount > 0 ? activeCount : undefined 
    },
    { id: 'earnings', label: 'Ganhos', icon: <Wallet className="w-5 h-5" /> },
    { id: 'profile', label: 'Perfil', icon: <User className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#111922]/95 backdrop-blur-md border-t border-slate-800 shadow-2xl">
      <div className="max-w-5xl mx-auto flex items-center justify-around py-1.5 px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[44px] relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-all cursor-pointer ${
                isActive ? 'text-[#00CCBC] font-bold' : 'text-slate-400 hover:text-slate-200 font-medium'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#00CCBC] text-slate-950 font-black text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center tabular-nums">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1">{tab.label}</span>
              {isActive && (
                <span className="w-5 h-0.5 rounded-full bg-[#00CCBC] mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
