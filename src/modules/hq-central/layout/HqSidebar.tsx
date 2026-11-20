import React from 'react';
import {
  Activity,
  ArrowLeft,
  Building2,
  CreditCard,
  Database,
  Download,
  Globe,
  History,
  Laptop,
  LogOut,
  RotateCcw,
  Sparkles,
  Store as StoreIcon,
  Tag,
  Users,
} from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { BrandMark } from '../../../components/common/BrandLogo';
import { getActiveClientAppId } from '../../../core/platform/PlatformAdapter';

export type HqTabId =
  | 'dashboard'
  | 'opportunities'
  | 'marketplace'
  | 'crm'
  | 'tenants'
  | 'plans'
  | 'devices'
  | 'integrations'
  | 'downloads'
  | 'rbac'
  | 'telemetry-tables'
  | 'audit';

export interface HqNavSection {
  id: string;
  label: string;
  items: Array<{
    id: HqTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

export const HQ_NAV_SECTIONS: HqNavSection[] = [
  {
    id: 'overview',
    label: 'Visão Geral',
    items: [
      { id: 'dashboard', label: 'Governança Geral', icon: Activity },
      { id: 'opportunities', label: 'Radar de Lucratividade', icon: Sparkles },
    ],
  },
  {
    id: 'marketplace-experience',
    label: 'Marketplace & Experiência',
    items: [
      { id: 'marketplace', label: 'Gestão do Marketplace', icon: StoreIcon },
      { id: 'crm', label: 'Campanhas & CRM Global', icon: Tag },
    ],
  },
  {
    id: 'network-revenue',
    label: 'Rede & Receita SaaS',
    items: [
      { id: 'tenants', label: 'Empresas & Lojas', icon: Building2 },
      { id: 'plans', label: 'Planos & Billing', icon: CreditCard },
      { id: 'devices', label: 'Dispositivos & Cotas', icon: Laptop },
    ],
  },
  {
    id: 'platform-distribution',
    label: 'Plataforma & Distribuição',
    items: [
      { id: 'integrations', label: 'Provedores & Integrações', icon: Globe },
      { id: 'downloads', label: 'Downloads & Releases', icon: Download },
    ],
  },
  {
    id: 'security-infra',
    label: 'Segurança & Infra',
    items: [
      { id: 'rbac', label: 'Equipe & Contas', icon: Users },
      { id: 'telemetry-tables', label: 'Telemetria & Tabelas', icon: Database },
      { id: 'audit', label: 'Logs de Auditoria', icon: History },
    ],
  },
];

export function getHqTabMeta(tabId: HqTabId): { sectionLabel: string; tabLabel: string } {
  for (const section of HQ_NAV_SECTIONS) {
    const found = section.items.find((i) => i.id === tabId);
    if (found) {
      return { sectionLabel: section.label, tabLabel: found.label };
    }
  }
  return { sectionLabel: 'Visão Geral', tabLabel: 'Governança Geral' };
}

interface HqSidebarProps {
  activeTab: HqTabId;
  onSelectTab: (tab: HqTabId) => void;
  storesCount: number;
  liveEcosystemMrr: number;
  isDevOwner: boolean;
  onBackToPortal: () => void;
  onLogout?: () => void;
  onOpenResetModal: () => void;
}

export const HqSidebar: React.FC<HqSidebarProps> = ({
  activeTab,
  onSelectTab,
  storesCount,
  liveEcosystemMrr,
  isDevOwner,
  onBackToPortal,
  onLogout,
  onOpenResetModal,
}) => {
  const hqTheme = PILLAR_THEMES.hq;

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/70 backdrop-blur-xl flex flex-col fixed inset-y-0 left-0 z-40">
      <div className="p-5 border-b border-slate-800 space-y-4">
        <div className="flex items-center gap-2.5">
          <BrandMark id="hq" size="md" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white tracking-tight truncate">
              HQ <span className={hqTheme.accentTextClass}>Central</span>
            </h1>
            <p className="text-[11px] text-slate-400 truncate">Governança do Ecossistema</p>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            MRR SaaS · {storesCount} loja(s)
          </div>
          <div className={`text-lg font-bold ${hqTheme.accentTextClass} font-mono tabular-nums mt-0.5`}>
            R$ {liveEcosystemMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {HQ_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="space-y-1">
            <div className="px-3 pb-1 text-[11px] font-medium text-slate-500">
              {section.label}
            </div>
            {section.items
              .filter((tab) => isDevOwner || tab.id !== 'telemetry-tables')
              .map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onSelectTab(tab.id)}
                    className={`w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors flex items-center gap-2.5 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-indigo-500 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="p-3.5 border-t border-slate-800 space-y-2">
        {isDevOwner && (
          <button
            type="button"
            onClick={onOpenResetModal}
            className="w-full px-3 py-2 text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" /> Resetar Ambiente
          </button>
        )}
        {getActiveClientAppId() === 'unified-portal' && (
          <button
            type="button"
            onClick={onBackToPortal}
            className="w-full px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" /> Voltar ao Portal
          </button>
        )}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full px-3 py-2 text-xs font-medium bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" /> Sair da Conta
          </button>
        )}
      </div>
    </aside>
  );
};
