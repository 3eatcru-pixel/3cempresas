import { useState, useEffect, useCallback } from 'react';
import {
  OsAppDefinition,
  WindowAppId,
  WindowState,
  getDefaultAppForRole,
  isAppAllowedForRole,
} from '../modules/store-os/layout/storeOsAppsList';

interface UseStoreOsWindowManagerParams {
  visibleApps: OsAppDefinition[];
  role?: string | null;
  blockedApps?: string[] | null;
  storeId?: string;
  onRestrictedModule: (title: string) => void;
  onWindowOpened?: () => void;
}

export function useStoreOsWindowManager({
  visibleApps,
  role,
  blockedApps,
  storeId,
  onRestrictedModule,
  onWindowOpened,
}: UseStoreOsWindowManagerParams) {
  const [openWindows, setOpenWindows] = useState<WindowState[]>(() => {
    const def = getDefaultAppForRole(role, blockedApps);
    return def ? [{ id: def.id, title: def.title, isMinimized: false, isMaximized: false, zIndex: 1 }] : [];
  });
  const [activeWindowId, setActiveWindowId] = useState<WindowAppId | null>(
    () => getDefaultAppForRole(role, blockedApps)?.id || null
  );

  const visibleIdsKey = visibleApps.map((a) => a.id).join('|');

  useEffect(() => {
    const visibleSet = new Set(visibleApps.map((a) => a.id));
    const resolveFallback = (): { id: WindowAppId; title: string } | null => {
      const roleDef = getDefaultAppForRole(role, blockedApps);
      if (roleDef && (visibleSet.size === 0 || visibleSet.has(roleDef.id))) {
        return roleDef;
      }
      const firstVisible = visibleApps[0];
      if (firstVisible) {
        return { id: firstVisible.id, title: firstVisible.title };
      }
      return roleDef;
    };

    setOpenWindows((prev) => {
      const allowed = prev.filter(
        (w) =>
          isAppAllowedForRole(w.id, role, blockedApps) &&
          (visibleSet.size === 0 || visibleSet.has(w.id))
      );
      if (allowed.length > 0) return allowed;
      const fallback = resolveFallback();
      return fallback
        ? [{ id: fallback.id, title: fallback.title, isMinimized: false, isMaximized: false, zIndex: 1 }]
        : [];
    });

    setActiveWindowId((prev) => {
      if (
        prev &&
        isAppAllowedForRole(prev, role, blockedApps) &&
        (visibleSet.size === 0 || visibleSet.has(prev))
      ) {
        return prev;
      }
      return resolveFallback()?.id || null;
    });
  }, [role, blockedApps, storeId, visibleIdsKey]);

  const handleOpenAppWindow = useCallback(
    (appId: WindowAppId, title: string) => {
      if (!isAppAllowedForRole(appId, role, blockedApps)) {
        onRestrictedModule(title);
        return;
      }
      setOpenWindows((prev) => {
        const existing = prev.find((w) => w.id === appId);
        const maxZ = Math.max(...prev.map((w) => w.zIndex), 0);
        if (existing) {
          return prev.map((w) =>
            w.id === appId ? { ...w, isMinimized: false, zIndex: maxZ + 1 } : w
          );
        }
        return [
          ...prev,
          { id: appId, title, isMinimized: false, isMaximized: false, zIndex: maxZ + 1 },
        ];
      });
      setActiveWindowId(appId);
      onWindowOpened?.();
    },
    [role, blockedApps, onRestrictedModule, onWindowOpened]
  );

  const handleCloseWindow = useCallback((appId: WindowAppId) => {
    setOpenWindows((prev) => prev.filter((w) => w.id !== appId));
    setActiveWindowId((prev) => (prev === appId ? null : prev));
  }, []);

  const handleToggleMinimizeWindow = useCallback((appId: WindowAppId) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === appId ? { ...w, isMinimized: !w.isMinimized } : w))
    );
    setActiveWindowId((prev) => (prev === appId ? null : prev));
  }, []);

  const handleToggleMaximizeWindow = useCallback((appId: WindowAppId) => {
    setOpenWindows((prev) =>
      prev.map((w) => (w.id === appId ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const handleFocusWindow = useCallback((appId: WindowAppId) => {
    setOpenWindows((prev) => {
      const maxZ = Math.max(...prev.map((w) => w.zIndex), 0);
      return prev.map((w) =>
        w.id === appId ? { ...w, isMinimized: false, zIndex: maxZ + 1 } : w
      );
    });
    setActiveWindowId(appId);
  }, []);

  return {
    openWindows,
    activeWindowId,
    handleOpenAppWindow,
    handleCloseWindow,
    handleToggleMinimizeWindow,
    handleToggleMaximizeWindow,
    handleFocusWindow,
  };
}
