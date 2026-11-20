import React, { useState, useMemo, useCallback } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { Store as StoreIcon } from 'lucide-react';
import { PILLAR_THEMES, STORE_OS_WALLPAPERS } from '@3c/design-system';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { syncEngine } from '../../core/sync/SyncEngine';
import { detectLocalTerminalInfo, getActiveClientAppId } from '../../core/platform/PlatformAdapter';
import { useStoreOsWindowManager } from '../../hooks/useStoreOsWindowManager';

import { PillarEntrance } from '../common/PillarEntrance';
import { OSWindow } from '../common/OSWindow';
import { CommandPalette } from '../common/CommandPalette';

import { TrialBanner } from '../../modules/store-os/layout/TrialBanner';
import { DesktopAppGrid } from '../../modules/store-os/layout/DesktopAppGrid';
import { StartMenu } from '../../modules/store-os/layout/StartMenu';
import { Taskbar } from '../../modules/store-os/layout/Taskbar';
import { NotificationTray } from '../../modules/store-os/layout/NotificationTray';
import { StoreOsQuickSettingsPopover } from '../../modules/store-os/layout/StoreOsQuickSettingsPopover';
import { getVisibleApps } from '../../modules/store-os/layout/storeOsAppsList';
import { StoreOsWindowRenderer } from '../../modules/store-os/layout/StoreOsWindowRenderer';
import { StoreOsOnboardingGate } from '../../modules/store-os/layout/StoreOsOnboardingGate';
import { useStoreOsDesktopState } from '../../modules/store-os/layout/useStoreOsDesktopState';

export const StoreOsPillar: React.FC = () => {
  const { profile, getIdToken, logout } = useAuth();
  const { currentStore, stores, setSelectedStoreId, orders, menuItems, setActiveSection, showNotification } =
    useEcosystem();
  const syncStatus = useSyncStatus();
  const [isSyncingQuick, setIsSyncingQuick] = useState(false);

  const localTerminal = useMemo(
    () =>
      detectLocalTerminalInfo({
        activeTransport: syncStatus.activeTransport,
        edgeBaseUrl: syncStatus.pairedEdge?.edgeBaseUrl,
      }),
    [syncStatus.activeTransport, syncStatus.pairedEdge?.edgeBaseUrl]
  );

  const isAuthorized =
    profile?.role === 'STORE_OWNER' ||
    profile?.role === 'STORE_MANAGER' ||
    profile?.role === 'REGIONAL_MANAGER' ||
    profile?.role === 'CASHIER' ||
    profile?.role === 'KITCHEN_STAFF';

  const {
    isStartMenuOpen,
    setIsStartMenuOpen,
    isQuickSettingsOpen,
    setIsQuickSettingsOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    isNotificationTrayOpen,
    setIsNotificationTrayOpen,
    desktopTheme,
    handleChangeDesktopTheme,
    searchFilter,
    setSearchFilter,
    notifications,
    setNotifications,
    currentTime,
    currentDate,
    accessibleTenantStores,
    canSwitchBranch,
    kdsPreparationOrdersCount,
    lowStockItemsExist,
    isFreeTrial,
    isTrialExpired,
    trialDaysRemaining,
  } = useStoreOsDesktopState({
    currentStore,
    stores,
    orders,
    menuItems,
    profile,
  });

  const visibleApps = useMemo(
    () => getVisibleApps(currentStore, kdsPreparationOrdersCount, profile?.role, profile?.blockedApps),
    [currentStore, kdsPreparationOrdersCount, profile?.role, profile?.blockedApps]
  );

  const onRestrictedModule = useCallback(
    (title: string) => showNotification(`Acesso restrito ou bloqueado ao módulo '${title}' para o seu perfil.`),
    [showNotification]
  );
  const onWindowOpened = useCallback(() => {
    setIsStartMenuOpen(false);
    setIsCommandPaletteOpen(false);
  }, [setIsStartMenuOpen, setIsCommandPaletteOpen]);

  const {
    openWindows,
    activeWindowId,
    handleOpenAppWindow,
    handleCloseWindow,
    handleToggleMinimizeWindow,
    handleToggleMaximizeWindow,
    handleFocusWindow,
  } = useStoreOsWindowManager({
    visibleApps,
    role: profile?.role,
    blockedApps: profile?.blockedApps,
    storeId: currentStore.id,
    onRestrictedModule,
    onWindowOpened,
  });

  if (!isAuthorized) {
    return (
      <PillarEntrance
        title="Store OS"
        subtitle="O coração operacional do seu negócio. Gerencie vendas, produção e estoque em uma interface multijanelas poderosa com cara de sistema operacional nativo."
        icon={<StoreIcon className="w-8 h-8" />}
        requiredRole="STORE_OWNER"
        pillarId="store-os"
        colorClass={PILLAR_THEMES['store-os'].accentTextClass}
        features={[
          'Ambiente Desktop com suporte a multijanelas e multitarefa simultânea',
          'PDV Frente de Caixa ágil com emissão de NFC-e (SEFAZ estadual)',
          'Monitor KDS (Kitchen Display System) para cozinha e expedição',
          'Gestão de Estoque por Ficha Técnica e Lotes com baixa automática',
          'Controle de Mesas, Comandas, Reservas e Balanço Financeiro DRE',
        ]}
      />
    );
  }

  const hasValidStore = Boolean(
    currentStore?.id &&
      currentStore.id.trim() !== '' &&
      stores.length > 0 &&
      currentStore.name !== 'Nenhuma loja ativa'
  );

  if (!hasValidStore) {
    return (
      <StoreOsOnboardingGate
        onStoreCreated={(newStoreId) => {
          setSelectedStoreId(newStoreId);
        }}
      />
    );
  }

  const wallpaperClasses =
    STORE_OS_WALLPAPERS[desktopTheme]?.gradientClass || STORE_OS_WALLPAPERS['neon-dark'].gradientClass;

  return (
    <div className="w-full h-screen p-0 m-0 overflow-hidden relative">
      <div
        className={`relative w-full h-full overflow-hidden border-2 border-slate-800 bg-gradient-to-br ${wallpaperClasses} flex flex-col justify-between shadow-2xl font-sans select-none`}
      >
        <div className="p-4 flex-1 relative overflow-hidden">
          <CommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            onRunAction={handleOpenAppWindow as any}
            apps={visibleApps.map((app) => ({
              id: app.id as string,
              title: app.title,
              icon: app.icon,
              category: app.category,
            }))}
          />

          <TrialBanner
            isFreeTrial={isFreeTrial}
            isTrialExpired={isTrialExpired}
            trialDaysRemaining={trialDaysRemaining}
            onOpenBilling={() => handleOpenAppWindow('saas-billing', 'Minha Assinatura')}
          />

          <DesktopAppGrid visibleApps={visibleApps} onOpenApp={handleOpenAppWindow as any} />

          {openWindows.map(
            (win, i) =>
              !win.isMinimized && (
                <OSWindow
                  key={win.id}
                  id={win.id}
                  title={win.title}
                  isActive={activeWindowId === win.id}
                  isMaximized={win.isMaximized}
                  zIndex={win.zIndex}
                  onFocus={() => handleFocusWindow(win.id)}
                  onClose={() => handleCloseWindow(win.id)}
                  onMinimize={() => handleToggleMinimizeWindow(win.id)}
                  onMaximize={() => handleToggleMaximizeWindow(win.id)}
                  initialPosition={{ x: 120 + i * 40, y: 80 + i * 40 }}
                >
                  <StoreOsWindowRenderer
                    appId={win.id}
                    currentStore={currentStore}
                    menuItems={menuItems}
                    onClose={() => handleCloseWindow(win.id)}
                    onOpenApp={handleOpenAppWindow}
                  />
                </OSWindow>
              )
          )}
        </div>

        <StartMenu
          isOpen={isStartMenuOpen}
          onClose={() => setIsStartMenuOpen(false)}
          currentStore={currentStore}
          tenantStores={accessibleTenantStores}
          canSwitchBranch={canSwitchBranch}
          onSelectStore={setSelectedStoreId}
          searchFilter={searchFilter}
          setSearchFilter={setSearchFilter}
          visibleApps={visibleApps}
          onOpenApp={handleOpenAppWindow as any}
          onLogout={() => {
            setIsStartMenuOpen(false);
            void logout();
            if (getActiveClientAppId() === 'unified-portal') {
              setActiveSection('portal');
            }
          }}
          localTerminal={localTerminal}
        />

        <NotificationTray
          isOpen={isNotificationTrayOpen}
          notifications={notifications}
          onClearAll={() => setNotifications([])}
        />

        {isQuickSettingsOpen && (
          <StoreOsQuickSettingsPopover
            activeTransport={syncStatus.activeTransport}
            totalPendingCount={syncStatus.totalPendingCount}
            localTerminal={localTerminal}
            isSyncingQuick={isSyncingQuick}
            desktopTheme={desktopTheme}
            onChangeTheme={handleChangeDesktopTheme}
            onSyncNow={async () => {
              setIsSyncingQuick(true);
              try {
                const token = await getIdToken();
                await syncEngine.flushAll({ token: token || undefined, storeId: currentStore.id });
                showNotification('Sincronização com o servidor da loja concluída.');
              } catch {
                showNotification('Sem conexão imediata; fila mantida localmente.');
              } finally {
                setIsSyncingQuick(false);
              }
            }}
            onOpenApp={handleOpenAppWindow}
            onClose={() => setIsQuickSettingsOpen(false)}
          />
        )}

        <Taskbar
          onStartClick={() => {
            setIsStartMenuOpen(!isStartMenuOpen);
            setIsQuickSettingsOpen(false);
            setIsNotificationTrayOpen(false);
          }}
          kdsPreparationOrdersCount={kdsPreparationOrdersCount}
          lowStockItemsExist={lowStockItemsExist}
          openWindows={openWindows}
          activeWindowId={activeWindowId}
          onWindowClick={(id) =>
            activeWindowId === id ? handleToggleMinimizeWindow(id) : handleFocusWindow(id)
          }
          onNotificationsClick={() => {
            setIsNotificationTrayOpen(!isNotificationTrayOpen);
            setIsStartMenuOpen(false);
            setIsQuickSettingsOpen(false);
          }}
          onQuickSettingsClick={() => {
            setIsQuickSettingsOpen(!isQuickSettingsOpen);
            setIsStartMenuOpen(false);
            setIsNotificationTrayOpen(false);
          }}
          notificationsCount={notifications.length}
          currentTime={currentTime}
          currentDate={currentDate}
          localTerminal={localTerminal}
          activeTransport={syncStatus.activeTransport}
        />
      </div>
    </div>
  );
};
