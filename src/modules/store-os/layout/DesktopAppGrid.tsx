import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AppIconProps {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  category: string;
  maturity: 'CORE_REAL' | 'ESTÁVEL_BETA' | 'SANDBOX_SIMULADO' | 'PROTÓTIPO_TELA';
  badge?: number;
  onClick: () => void;
}

import { MaturityBadge } from '../../../components/common/MaturityBadge';

export const DesktopAppIcon: React.FC<AppIconProps> = ({
  id,
  title,
  icon: Icon,
  color,
  category,
  maturity,
  badge,
  onClick
}) => {
  return (
    <button 
      onClick={onClick}
      className="group flex flex-col items-center gap-2 w-24 h-24 p-2 rounded-xl hover:bg-white/10 active:bg-white/20 transition-all transform active:scale-95 cursor-pointer"
      title={`${title} (${category}) [${maturity}]`}
    >
      <div className={`p-3.5 bg-gradient-to-tr ${color} rounded-2xl text-slate-950 font-bold shadow-xl ring-1 ring-white/20 group-hover:ring-white/50 group-hover:scale-110 transition-all relative`}>
        <Icon className="w-7 h-7" />
        {badge ? (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse border-2 border-slate-950 shadow-lg">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[10px] font-black text-white text-center drop-shadow-[0_1.5px_2px_rgba(0,0,0,1)] leading-tight line-clamp-2 px-0.5 uppercase tracking-tighter opacity-90 group-hover:opacity-100">
          {title}
        </span>
        <MaturityBadge level={maturity} showIcon={false} className="scale-[0.6] origin-top opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
};

interface DesktopAppGridProps {
  visibleApps: any[];
  onOpenApp: (id: string, title: string) => void;
}

export const DesktopAppGrid: React.FC<DesktopAppGridProps> = ({
  visibleApps,
  onOpenApp
}) => {
  const categories = ['Gestão', 'Vendas', 'Operação', 'Logística', 'Estoque', 'Marketing', 'Customização', 'Sistema', 'Utilitários'];

  return (
    <div className="absolute inset-0 p-6 pt-24 z-10 overflow-y-auto no-scrollbar pointer-events-none space-y-8">
      {categories.map(category => {
        const appsInCategory = visibleApps.filter(app => app.category === category);
        if (appsInCategory.length === 0) return null;
        
        return (
          <div key={category} className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 pl-2">{category}</h3>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(90px,1fr))] gap-x-2 gap-y-6 pointer-events-auto">
              {appsInCategory.sort((a,b) => (a.id === 'dashboard' ? -1 : 1)).map(app => (
                <DesktopAppIcon
                  key={app.id}
                  id={app.id}
                  title={app.title}
                  icon={app.icon}
                  color={app.color}
                  category={app.category}
                  maturity={app.maturity}
                  badge={app.badge}
                  onClick={() => onOpenApp(app.id, app.title)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
