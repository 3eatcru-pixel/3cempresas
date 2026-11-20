import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { EcosystemSessionRole } from '../types';
import {
  buildStandardContractHeaders,
  getActiveClientAppId,
  getPlatformAdapters,
} from '../core/platform/PlatformAdapter';
import { apiClient } from '../core/api/apiClient';
import {
  AuthContextType,
  AuthModalContextId,
  GUEST_CUSTOMER_PROFILE,
  inferAuthContextFromRole,
  resolveDefaultAuthContextFromApp,
  UserProfile,
} from './authTypes';
import { useAuthActions } from './useAuthActions';

export type { AuthModalContextId, UserProfile };
export { GUEST_CUSTOMER_PROFILE };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const platform = getPlatformAdapters();
  const [token, setToken] = useState<string | null>(platform.storage.getItem('3ccorp_auth_token'));

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<'login' | 'signup'>('login');
  const [authModalDefaultRole, setAuthModalDefaultRole] = useState<EcosystemSessionRole>('CUSTOMER');
  const [authModalContext, setAuthModalContext] = useState<AuthModalContextId>(
    resolveDefaultAuthContextFromApp
  );
  const [firebaseEnabled, setFirebaseEnabled] = useState<boolean>(false);
  const [firebaseFirestoreEnabled, setFirebaseFirestoreEnabled] = useState<boolean>(false);

  const refreshAuthProviders = useCallback(async () => {
    try {
      const providers = await apiClient.getAuthProviders();
      setFirebaseEnabled(Boolean(providers?.firebaseEnabled));
      setFirebaseFirestoreEnabled(
        providers?.firebaseFirestoreEnabled !== undefined
          ? Boolean(providers.firebaseFirestoreEnabled)
          : Boolean(providers?.firebaseEnabled)
      );
    } catch {
      setFirebaseEnabled(false);
      setFirebaseFirestoreEnabled(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthProviders();
    if (typeof window === 'undefined') return;
    const handleProvidersChanged = () => {
      void refreshAuthProviders();
    };
    window.addEventListener('3c:auth-providers-changed', handleProvidersChanged);
    return () => {
      window.removeEventListener('3c:auth-providers-changed', handleProvidersChanged);
    };
  }, [refreshAuthProviders]);

  useEffect(() => {
    if (isAuthModalOpen) {
      void refreshAuthProviders();
    }
  }, [isAuthModalOpen, refreshAuthProviders]);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  const openAuthModal = (
    initialTab: 'login' | 'signup' = 'login',
    defaultRole: EcosystemSessionRole = 'CUSTOMER',
    contextId?: AuthModalContextId
  ) => {
    const resolvedContext = contextId || inferAuthContextFromRole(defaultRole);
    setAuthModalDefaultTab(initialTab);
    setAuthModalDefaultRole(defaultRole);
    setAuthModalContext(resolvedContext);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const applyAuthenticatedState = useCallback((sessionToken: string, userData: UserProfile) => {
    const normalizedRole =
      String(userData.role || '').toUpperCase() === 'DRIVER'
        ? ('COURIER' as EcosystemSessionRole)
        : userData.role;
    const normalizedUser: UserProfile = {
      ...userData,
      role: normalizedRole,
      blockedApps: Array.isArray(userData.blockedApps) ? userData.blockedApps : [],
      permissions: Array.isArray(userData.permissions) ? userData.permissions : [],
    };
    setProfile(normalizedUser);
    setUser({
      uid: normalizedUser.uid,
      email: normalizedUser.email,
      displayName: normalizedUser.name,
      emailVerified: normalizedUser.emailVerified,
      getIdToken: async () => sessionToken,
    });
  }, []);

  const clearAuthenticatedState = useCallback(
    (noticeMessage?: string) => {
      platform.storage.removeItem('3ccorp_auth_token');
      setToken(null);
      setUser(null);
      setProfile(GUEST_CUSTOMER_PROFILE);
      if (noticeMessage) {
        setAuthNotice(noticeMessage);
      }
    },
    [platform]
  );

  const refreshProfile = useCallback(async () => {
    const activeToken = token || platform.storage.getItem('3ccorp_auth_token');
    if (!activeToken) {
      setUser(null);
      setProfile(GUEST_CUSTOMER_PROFILE);
      return;
    }
    try {
      const resp = await fetch(`${platform.network.getApiBaseUrl()}/auth/me`, {
        credentials: 'include',
        headers: buildStandardContractHeaders({ token: activeToken }),
      });
      if (resp.ok) {
        const userData = await resp.json();
        applyAuthenticatedState(activeToken, userData);
      } else {
        const errData = await resp.json().catch(() => ({}));
        clearAuthenticatedState(errData?.error || 'Sua sessão expirou ou foi revogada.');
      }
    } catch (err) {
      console.warn('[Auth] Profile refresh failed:', err);
    }
  }, [token, platform, applyAuthenticatedState, clearAuthenticatedState]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        let activeToken = token || platform.storage.getItem('3ccorp_auth_token');
        if (!activeToken && platform.storage.getItemAsync) {
          activeToken = await platform.storage.getItemAsync('3ccorp_auth_token');
          if (active && activeToken) {
            setToken(activeToken);
          }
        }
        if (!activeToken) {
          if (active) {
            setUser(null);
            setProfile(GUEST_CUSTOMER_PROFILE);
          }
          return;
        }
        const resp = await fetch(`${platform.network.getApiBaseUrl()}/auth/me`, {
          credentials: 'include',
          headers: buildStandardContractHeaders({ token: activeToken }),
        });
        if (!active) return;
        if (resp.ok) {
          const userData = await resp.json();
          applyAuthenticatedState(activeToken, userData);
        } else {
          clearAuthenticatedState();
        }
      } catch (err) {
        console.warn('[Auth] Session restoration failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void restoreSession();
    return () => {
      active = false;
    };
  }, [token, platform, applyAuthenticatedState, clearAuthenticatedState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAuthInvalidated = (ev: Event) => {
      const customEv = ev as CustomEvent<{ reason?: string }>;
      clearAuthenticatedState(
        customEv?.detail?.reason || 'Sua sessão foi encerrada pelo HQ Central ou expirou.'
      );
    };

    const handleAuthRefresh = () => {
      void refreshProfile();
    };

    window.addEventListener('3c:auth-invalidated', handleAuthInvalidated);
    window.addEventListener('3c:auth-refresh', handleAuthRefresh);
    return () => {
      window.removeEventListener('3c:auth-invalidated', handleAuthInvalidated);
      window.removeEventListener('3c:auth-refresh', handleAuthRefresh);
    };
  }, [clearAuthenticatedState, refreshProfile]);

  const actions = useAuthActions({
    platform,
    token,
    profile,
    authModalContext,
    firebaseEnabled,
    firebaseFirestoreEnabled,
    setToken,
    setProfile,
    setAuthNotice,
    applyAuthenticatedState,
    clearAuthenticatedState,
  });

  const signIn = (contextId?: AuthModalContextId) => {
    openAuthModal(
      'login',
      'CUSTOMER',
      contextId || (getActiveClientAppId() === 'unified-portal' ? 'marketplace' : undefined)
    );
  };

  const signInManual = async (_name: string, _email: string, role: EcosystemSessionRole) => {
    openAuthModal('login', role);
  };

  const isRealAdmin = profile?.role === 'DEV_OWNER';
  const isHqAdmin = profile?.role === 'DEV_OWNER' || profile?.role === 'SUPER_ADMIN';
  const isMerchant = profile?.role === 'STORE_OWNER';
  const isAdmin = profile?.role === 'DEV_OWNER';
  const isAuthenticated = !!(profile && profile.uid !== 'guest-customer');

  const switchRole = (newRole: EcosystemSessionRole) => {
    console.warn(
      '[Security] Alteração client-side de papel não é suportada. Autentique com a conta correspondente para:',
      newRole
    );
  };

  const getIdToken = useCallback(async (): Promise<string | undefined> => {
    if (token) return token;
    return undefined;
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authNotice,
        clearAuthNotice,
        signIn,
        signInManual,
        ...actions,
        firebaseEnabled,
        firebaseFirestoreEnabled,
        refreshProfile,
        switchRole,
        isAdmin,
        isHqAdmin,
        isMerchant,
        isRealAdmin,
        isAuthenticated,
        getIdToken,
        isAuthModalOpen,
        authModalDefaultTab,
        authModalDefaultRole,
        authModalContext,
        openAuthModal,
        closeAuthModal,
        setAuthModalContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
