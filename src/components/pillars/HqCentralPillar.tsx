import React, { useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { Store } from '../../types';
import { PillarEntrance } from '../common/PillarEntrance';
import { HqDashboardTab } from '../../modules/hq-central/HqDashboardTab';
import { HqMarketplaceTab } from '../../modules/hq-central/HqMarketplaceTab';
import { HqTelemetryTablesTab } from '../../modules/hq-central/HqTelemetryTablesTab';
import { HqOpportunitiesTab } from '../../modules/hq-central/HqOpportunitiesTab';
import { HqTenantsTab } from '../../modules/hq-central/HqTenantsTab';
import { HqPlansTab } from '../../modules/hq-central/HqPlansTab';
import { HqDevicesTab } from '../../modules/hq-central/HqDevicesTab';
import { HqRbacTab } from '../../modules/hq-central/HqRbacTab';
import { HqCrmTab } from '../../modules/hq-central/HqCrmTab';
import { HqIntegrationsTab } from '../../modules/hq-central/HqIntegrationsTab';
import { HqDownloadsTab } from '../../modules/hq-central/HqDownloadsTab';
import { HqAuditTab } from '../../modules/hq-central/HqAuditTab';
import { HqTabErrorBoundary } from '../../modules/hq-central/layout/HqTabErrorBoundary';
import { getHqTabMeta, HqSidebar, HqTabId } from '../../modules/hq-central/layout/HqSidebar';
import { HqResetPlatformModal } from '../../modules/hq-central/layout/HqResetPlatformModal';

const HQ_TAB_TITLES: Record<HqTabId, string> = {
  dashboard: 'Governança Corporativa do Ecossistema',
  opportunities: 'Radar de Lucratividade da Plataforma',
  marketplace: 'Gestão do Marketplace & Experiência do Consumidor',
  crm: 'Relacionamento & Campanhas Globais',
  tenants: 'Gestão de Empresas & Lojas Parceiras',
  plans: 'Planos SaaS & Faturamento da Plataforma',
  devices: 'Controle de Cotas de Hardware',
  integrations: 'Provedores & Integrações do Ecossistema',
  downloads: 'Distribuição de Aplicativos & Releases',
  rbac: 'Governança de Contas & Permissões',
  'telemetry-tables': 'Telemetria & Inspetor de Tabelas',
  audit: 'Logs de Auditoria Master',
};

export const HqCentralPillar: React.FC = () => {
  const { profile, logout } = useAuth();
  const { stores, syncHqData, setActiveSection, resetEntirePlatformData } = useEcosystem();

  const isDevOwner = profile?.role === 'DEV_OWNER';
  const isAuthorized = isDevOwner || profile?.role === 'SUPER_ADMIN';
  const activeMrrStores = stores.filter(
    (s: Store) =>
      !s._deleted &&
      String((s as any).status || 'ACTIVE').toUpperCase() !== 'SUSPENDED' &&
      s.tenantStatus !== 'SUSPENDED'
  );
  const liveEcosystemMrr = activeMrrStores.reduce(
    (acc: number, s: Store) => acc + (s.saasMonthlyFee || 0),
    0
  );

  const [activeTab, setActiveTab] = useState<HqTabId>('dashboard');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') return;
    setIsResetting(true);
    await resetEntirePlatformData();
    setIsResetting(false);
    setResetConfirmText('');
    setIsResetModalOpen(false);
  };

  const handleSyncInfra = async () => {
    setIsSyncing(true);
    try {
      await syncHqData();
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isAuthorized) {
    return (
      <PillarEntrance
        title="HQ Central"
        subtitle="Governança Global do Ecossistema SaaS. Gestão da plataforma, Marketplace, assinaturas e infraestrutura."
        icon={<ShieldCheck className="w-8 h-8" />}
        requiredRole="DEV_OWNER"
        pillarId="hq"
        colorClass={PILLAR_THEMES.hq.accentTextClass}
        features={[
          'Governança da Experiência do Marketplace e Curadoria de Vitrines',
          'Onboarding e Gestão Multi-Tenant de Lojistas',
          'Faturamento recorrente (MRR) e Planos SaaS',
          'Políticas Globais, Integrações e Provedores',
          'Controle de Licenças, Dispositivos, Releases e Auditoria',
        ]}
      />
    );
  }

  const { sectionLabel, tabLabel } = getHqTabMeta(activeTab);

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans">
      <HqSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        storesCount={activeMrrStores.length}
        liveEcosystemMrr={liveEcosystemMrr}
        isDevOwner={isDevOwner}
        onBackToPortal={() => setActiveSection('portal')}
        onLogout={() => void logout()}
        onOpenResetModal={() => {
          setResetConfirmText('');
          setIsResetModalOpen(true);
        }}
      />

      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
            <div className="space-y-1">
              <div className="text-xs text-slate-400">
                <span>HQ Central</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span>{sectionLabel}</span>
                <span className="mx-1.5 text-slate-600">/</span>
                <span className="text-slate-200">{tabLabel}</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {HQ_TAB_TITLES[activeTab]}
              </h2>
              <p className="text-xs text-slate-500">
                {profile?.email} · {isDevOwner ? 'DEV_OWNER' : 'SUPER_ADMIN'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => void handleSyncInfra()}
                disabled={isSyncing}
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`}
                />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'}
              </button>
            </div>
          </header>

          <HqTabErrorBoundary tabId={activeTab} onGoToDashboard={() => setActiveTab('dashboard')}>
            <div className="animate-fadeIn">
              {activeTab === 'dashboard' && <HqDashboardTab onNavigateTab={setActiveTab} />}
              {activeTab === 'opportunities' && <HqOpportunitiesTab />}
              {activeTab === 'marketplace' && <HqMarketplaceTab />}
              {activeTab === 'crm' && <HqCrmTab />}
              {activeTab === 'tenants' && <HqTenantsTab />}
              {activeTab === 'plans' && <HqPlansTab />}
              {activeTab === 'devices' && <HqDevicesTab />}
              {activeTab === 'integrations' && <HqIntegrationsTab />}
              {activeTab === 'downloads' && <HqDownloadsTab />}
              {activeTab === 'rbac' && <HqRbacTab />}
              {activeTab === 'telemetry-tables' && (isDevOwner ? <HqTelemetryTablesTab /> : <HqDashboardTab onNavigateTab={setActiveTab} />)}
              {activeTab === 'audit' && <HqAuditTab />}
            </div>
          </HqTabErrorBoundary>
        </div>
      </main>

      <HqResetPlatformModal
        isOpen={isResetModalOpen}
        resetConfirmText={resetConfirmText}
        setResetConfirmText={setResetConfirmText}
        isResetting={isResetting}
        onClose={() => {
          setResetConfirmText('');
          setIsResetModalOpen(false);
        }}
        onConfirmReset={handleConfirmReset}
      />
    </div>
  );
};
