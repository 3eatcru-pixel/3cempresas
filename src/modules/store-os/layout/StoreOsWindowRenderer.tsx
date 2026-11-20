import React, { Suspense } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { WindowAppId, isAppAllowedForRole } from './storeOsAppsList';
import { Store, MenuItem } from '../../../types';
import { useAuth } from '../../../context/AuthContext';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';
import { WindowErrorBoundary } from './WindowErrorBoundary';

// Lazy-loaded Store OS desktop apps (loaded on demand when a window opens)
const POSApp = lazyWithRetry(() => import('../pos/POSApp').then((m) => ({ default: m.POSApp })));
const KDSApp = lazyWithRetry(() => import('../kds/KDSApp').then((m) => ({ default: m.KDSApp })));
const InventoryApp = lazyWithRetry(() => import('../inventory/InventoryApp').then((m) => ({ default: m.InventoryApp })));
const TablesApp = lazyWithRetry(() => import('../tables/TablesApp').then((m) => ({ default: m.TablesApp })));
const FinanceApp = lazyWithRetry(() => import('../finance/FinanceApp').then((m) => ({ default: m.FinanceApp })));
const CRMApp = lazyWithRetry(() => import('../crm/CRMApp').then((m) => ({ default: m.CRMApp })));
const StaffApp = lazyWithRetry(() => import('../staff/StaffApp').then((m) => ({ default: m.StaffApp })));
const DriversApp = lazyWithRetry(() => import('./DriversApp').then((m) => ({ default: m.DriversApp })));
const BillingApp = lazyWithRetry(() => import('./BillingApp').then((m) => ({ default: m.BillingApp })));
const ShowcaseConfigApp = lazyWithRetry(() => import('./ShowcaseConfigApp').then((m) => ({ default: m.ShowcaseConfigApp })));
const SettingsApp = lazyWithRetry(() => import('./SettingsApp').then((m) => ({ default: m.SettingsApp })));
const AppLibraryApp = lazyWithRetry(() => import('../appstore/AppLibraryApp').then((m) => ({ default: m.AppLibraryApp })));
const ReservationsCalendarApp = lazyWithRetry(() =>
  import('../reservations/ReservationsCalendarApp').then((m) => ({ default: m.ReservationsCalendarApp }))
);
const KioskApp = lazyWithRetry(() => import('../kiosk/KioskApp').then((m) => ({ default: m.KioskApp })));
const CatalogApp = lazyWithRetry(() => import('../catalog/CatalogApp').then((m) => ({ default: m.CatalogApp })));
const WhatsAppMarketingApp = lazyWithRetry(() =>
  import('../crm/WhatsAppMarketingApp').then((m) => ({ default: m.WhatsAppMarketingApp }))
);
const CashbackApp = lazyWithRetry(() => import('../crm/CashbackApp').then((m) => ({ default: m.CashbackApp })));
const RetailPOSApp = lazyWithRetry(() => import('../pos/RetailPOSApp').then((m) => ({ default: m.RetailPOSApp })));
const ServicePOSApp = lazyWithRetry(() => import('../pos/ServicePOSApp').then((m) => ({ default: m.ServicePOSApp })));
const MerchantVitrineView = lazyWithRetry(() =>
  import('../../merchant/MerchantVitrineView').then((m) => ({ default: m.MerchantVitrineView }))
);
const MerchantDashboardApp = lazyWithRetry(() =>
  import('./MerchantDashboardApp').then((m) => ({ default: m.MerchantDashboardApp }))
);
const TerminalApp = lazyWithRetry(() => import('./TerminalApp').then((m) => ({ default: m.TerminalApp })));
const SystemLogsApp = lazyWithRetry(() => import('./SystemLogsApp').then((m) => ({ default: m.SystemLogsApp })));
const LogisticsMonitorApp = lazyWithRetry(() =>
  import('./LogisticsMonitorApp').then((m) => ({ default: m.LogisticsMonitorApp }))
);
const SuppliersApp = lazyWithRetry(() => import('../suppliers/SuppliersApp').then((m) => ({ default: m.SuppliersApp })));
const StoreBrowserUtility = lazyWithRetry(() =>
  import('./utilities/StoreBrowserUtility').then((m) => ({ default: m.StoreBrowserUtility }))
);
const StoreExplorerUtility = lazyWithRetry(() =>
  import('./utilities/StoreExplorerUtility').then((m) => ({ default: m.StoreExplorerUtility }))
);
const StoreTasksMonitorUtility = lazyWithRetry(() =>
  import('./utilities/StoreTasksMonitorUtility').then((m) => ({ default: m.StoreTasksMonitorUtility }))
);

interface StoreOsWindowRendererProps {
  appId: WindowAppId;
  currentStore: Store;
  menuItems: MenuItem[];
  onClose: () => void;
  onOpenApp?: (appId: WindowAppId, title: string) => void;
}

const WindowLoadingFallback: React.FC = () => (
  <div className="h-full min-h-[240px] flex flex-col items-center justify-center gap-3 text-slate-400">
    <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
    <span className="text-xs font-mono uppercase tracking-wider">Carregando módulo...</span>
  </div>
);

export const StoreOsWindowRenderer: React.FC<StoreOsWindowRendererProps> = ({
  appId,
  currentStore,
  menuItems,
  onClose,
  onOpenApp,
}) => {
  const { profile } = useAuth();
  if (!isAppAllowedForRole(appId, profile?.role, profile?.blockedApps)) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white uppercase tracking-tight">
          Acesso Restrito pelo RBAC
        </h3>
        <p className="text-xs text-slate-400 max-w-sm">
          Seu perfil ({profile?.role || 'Desconhecido'}) não possui permissão para operar o módulo{' '}
          <span className="font-mono text-amber-400">{appId}</span>.
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
        >
          Fechar Janela
        </button>
      </div>
    );
  }

  const renderAppContent = () => {
    switch (appId) {
      case 'dashboard':
        return <MerchantDashboardApp onOpenApp={onOpenApp} />;
      case 'pdv':
        return <POSApp />;
      case 'pdv-retail':
        return <RetailPOSApp />;
      case 'pdv-service':
        return <ServicePOSApp />;
      case 'kds':
        return <KDSApp />;
      case 'inventory':
        return <InventoryApp />;
      case 'tables':
        return <TablesApp />;
      case 'finance':
        return <FinanceApp />;
      case 'crm':
        return <CRMApp />;
      case 'staff':
        return <StaffApp />;
      case 'drivers':
        return <DriversApp />;
      case 'saas-billing':
        return <BillingApp />;
      case 'showcase-templates':
        return <ShowcaseConfigApp />;
      case 'vitrine-preview':
        return (
          <MerchantVitrineView
            currentStore={currentStore}
            menuItems={menuItems.filter((m) => m.storeId === currentStore.id)}
          />
        );
      case 'settings':
        return <SettingsApp />;
      case 'appstore':
        return <AppLibraryApp />;
      case 'reservations':
        return <ReservationsCalendarApp />;
      case 'kiosk':
        return <KioskApp />;
      case 'catalog':
        return <CatalogApp />;
      case 'terminal':
        return <TerminalApp onClose={onClose} />;
      case 'audit-logs':
        return <SystemLogsApp onOpenTerminal={() => onOpenApp?.('terminal', 'Terminal Shell')} />;
      case 'whatsapp-marketing':
        return <WhatsAppMarketingApp />;
      case 'cashback':
        return <CashbackApp />;
      case 'shared-inventory':
        return <InventoryApp isSharedMode={true} />;
      case 'logistics':
        return <LogisticsMonitorApp />;
      case 'browser':
        return <StoreBrowserUtility currentStore={currentStore} onOpenApp={onOpenApp} />;
      case 'explorer':
        return (
          <StoreExplorerUtility
            currentStore={currentStore}
            menuItems={menuItems}
            onOpenApp={onOpenApp}
          />
        );
      case 'tasks':
        return (
          <StoreTasksMonitorUtility
            currentStore={currentStore}
            menuItems={menuItems}
            onOpenApp={onOpenApp}
          />
        );
      case 'suppliers':
        return <SuppliersApp />;
      default:
        return null;
    }
  };

  return (
    <WindowErrorBoundary appId={appId} onClose={onClose}>
      <Suspense fallback={<WindowLoadingFallback />}>{renderAppContent()}</Suspense>
    </WindowErrorBoundary>
  );
};
