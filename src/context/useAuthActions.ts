import React from 'react';
import { EcosystemSessionRole } from '../types';
import { buildStandardContractHeaders, PlatformAdapters } from '../core/platform/PlatformAdapter';
import { apiClient } from '../core/api/apiClient';
import {
  FirebaseProductScope,
  signInWithFirebaseGooglePopup,
  signOutFirebaseIfActive,
} from '../services/firebaseClient';
import { getSupabaseClient } from '../services/supabaseClient';
import { AuthModalContextId, UserProfile } from './authTypes';

interface UseAuthActionsParams {
  platform: PlatformAdapters;
  token: string | null;
  profile: UserProfile | null;
  authModalContext: AuthModalContextId;
  firebaseEnabled: boolean;
  firebaseFirestoreEnabled: boolean;
  supabaseEnabled: boolean;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setAuthNotice: React.Dispatch<React.SetStateAction<string | null>>;
  applyAuthenticatedState: (sessionToken: string, userData: UserProfile) => void;
  clearAuthenticatedState: (noticeMessage?: string) => void;
}

export function useAuthActions(params: UseAuthActionsParams) {
  const {
    platform,
    token,
    profile,
    authModalContext,
    firebaseEnabled,
    firebaseFirestoreEnabled,
    supabaseEnabled,
    setToken,
    setProfile,
    setAuthNotice,
    applyAuthenticatedState,
    clearAuthenticatedState,
  } = params;

  const loginWithPassword = async (email: string, password: string, contextId?: AuthModalContextId) => {
    const targetContext = contextId || authModalContext;
    const resp = await fetch(`${platform.network.getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: buildStandardContractHeaders({ token: null }),
      body: JSON.stringify({ email, password, contextId: targetContext }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || 'Credenciais inválidas.');
    }

    const { token: sessionToken, user: userData } = await resp.json();
    platform.storage.setItem('3ccorp_auth_token', sessionToken);
    setToken(sessionToken);
    setAuthNotice(
      userData?.mustChangePassword
        ? userData?.role === 'DEV_OWNER'
          ? 'Primeiro acesso detectado: defina uma senha definitiva para liberar o HQ Central.'
          : 'Troca obrigatória de senha ativa. Defina sua nova senha para continuar.'
        : null
    );
    applyAuthenticatedState(sessionToken, userData);
  };

  const loginWithFirebaseGoogle = async (contextId?: AuthModalContextId) => {
    if (!firebaseEnabled) {
      throw new Error(
        'Autenticação Google/Firebase está desativada no momento. Utilize e-mail e senha.'
      );
    }
    const rawContext = contextId || authModalContext;
    const productScope: FirebaseProductScope =
      rawContext === 'store-os' ||
      rawContext === 'driver' ||
      rawContext === 'waiter' ||
      rawContext === 'hq' ||
      rawContext === 'server-core'
        ? rawContext
        : 'marketplace';

    let idToken = '';
    try {
      const firebaseRes = await signInWithFirebaseGooglePopup(productScope, {
        syncFirestoreProfile: firebaseFirestoreEnabled,
      });
      idToken = firebaseRes.idToken;
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        throw new Error('Login com Google cancelado.');
      }
      if (code === 'auth/popup-blocked') {
        throw new Error('Pop-up bloqueado pelo navegador. Autorize pop-ups para continuar com Google.');
      }
      throw new Error(err?.message || 'Não foi possível concluir a autenticação com Google.');
    }

    try {
      const exchanged = await apiClient.loginWithFirebaseToken({
        idToken,
        contextId: productScope,
      });
      platform.storage.setItem('3ccorp_auth_token', exchanged.token);
      setToken(exchanged.token);
      setAuthNotice(null);
      applyAuthenticatedState(exchanged.token, exchanged.user);
    } catch (err) {
      await signOutFirebaseIfActive();
      throw err;
    }
  };

  const loginWithSupabaseToken = async (accessToken: string, contextId?: AuthModalContextId) => {
    if (!supabaseEnabled) {
      throw new Error(
        'Autenticação via Supabase está desativada no momento. Utilize e-mail e senha.'
      );
    }
    const trimmed = String(accessToken || '').trim();
    if (!trimmed) {
      throw new Error('Token de sessão Supabase ausente.');
    }
    const rawContext = contextId || authModalContext;
    const productScope: FirebaseProductScope =
      rawContext === 'store-os' ||
      rawContext === 'driver' ||
      rawContext === 'waiter' ||
      rawContext === 'hq' ||
      rawContext === 'server-core'
        ? rawContext
        : 'marketplace';

    const exchanged = await apiClient.loginWithSupabaseToken({
      accessToken: trimmed,
      contextId: productScope,
    });
    platform.storage.setItem('3ccorp_auth_token', exchanged.token);
    setToken(exchanged.token);
    setAuthNotice(null);
    applyAuthenticatedState(exchanged.token, exchanged.user);
  };

  const loginWaiterWithPin = async (payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    operatorName?: string;
  }) => {
    const res = await apiClient.loginWaiterByPin(payload);
    platform.storage.setItem('3ccorp_auth_token', res.token);
    setToken(res.token);
    setAuthNotice(null);
    applyAuthenticatedState(res.token, res.user);
    return { store: res.store };
  };

  const loginDriverWithPin = async (payload: {
    storeId?: string;
    pin?: string;
    qrPayload?: string | Record<string, any>;
    driverName?: string;
    phone?: string;
    vehicle?: 'SCOOTER' | 'BIKE' | 'CAR';
    vehiclePlate?: string;
  }) => {
    const res = await apiClient.loginDriverByPin(payload);
    platform.storage.setItem('3ccorp_auth_token', res.token);
    setToken(res.token);
    setAuthNotice(null);
    applyAuthenticatedState(res.token, res.user);
    return { store: res.store, driver: res.driver };
  };

  const loginStoreDevice = async (payload: {
    deviceIdentifier: string;
    pairingCode: string;
    operatorName?: string;
  }) => {
    const res = await apiClient.loginStoreDevice(payload);
    platform.storage.setItem('3ccorp_auth_token', res.token);
    setToken(res.token);
    setAuthNotice(null);
    applyAuthenticatedState(res.token, res.user);
    return { store: res.store, device: res.device };
  };

  const signUpManual = async (
    name: string,
    email: string,
    password: string,
    role: EcosystemSessionRole,
    storeName?: string,
    storeLocation?: { city?: string; state?: string }
  ) => {
    const resp = await fetch(`${platform.network.getApiBaseUrl()}/auth/signup`, {
      method: 'POST',
      credentials: 'include',
      headers: buildStandardContractHeaders({ token: null }),
      body: JSON.stringify({
        name,
        email,
        password,
        role,
        ...(storeName ? { storeName } : {}),
        ...(storeLocation?.city ? { storeCity: storeLocation.city } : {}),
        ...(storeLocation?.state ? { storeState: storeLocation.state } : {}),
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || 'Falha ao criar conta.');
    }

    const { token: sessionToken, user: userData } = await resp.json();
    platform.storage.setItem('3ccorp_auth_token', sessionToken);
    setToken(sessionToken);
    setAuthNotice(null);
    applyAuthenticatedState(sessionToken, userData);
  };

  const updateOwnProfile = async (payload: { name?: string; phone?: string }): Promise<UserProfile | null> => {
    const activeToken = token || platform.storage.getItem('3ccorp_auth_token');
    if (!activeToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const res = await apiClient.updateOwnProfile(payload, activeToken);
    if (res?.user) {
      applyAuthenticatedState(activeToken, res.user);
      return res.user;
    }
    return null;
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    const activeToken = token || platform.storage.getItem('3ccorp_auth_token');
    if (!activeToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const res = await apiClient.changePassword({ currentPassword, newPassword }, activeToken);
    if (res?.token) {
      platform.storage.setItem('3ccorp_auth_token', res.token);
      setToken(res.token);
      setProfile((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      setAuthNotice(null);
    }
  };

  const deleteOwnAccount = async (): Promise<void> => {
    const activeToken = token || platform.storage.getItem('3ccorp_auth_token');
    if (!activeToken) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    await apiClient.deleteOwnAccount(activeToken);
    clearAuthenticatedState('Sua conta foi excluída permanentemente conforme LGPD.');
  };

  const logout = async () => {
    const activeToken = token || platform.storage.getItem('3ccorp_auth_token');
    if (activeToken && profile?.terminalId) {
      try {
        await apiClient.disconnectWaiterTerminal(activeToken);
      } catch {
        // best-effort server disconnect on logout
      }
    }
    try {
      await fetch(`${platform.network.getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: buildStandardContractHeaders({ token: activeToken || null }),
      });
    } catch {
      // Clear local session state even if network is offline
    }
    await signOutFirebaseIfActive();
    const sbClient = getSupabaseClient();
    if (sbClient) {
      await sbClient.auth.signOut().catch(() => {});
    }
    clearAuthenticatedState();
  };

  return {
    loginWithPassword,
    loginWithFirebaseGoogle,
    loginWithSupabaseToken,
    loginWaiterWithPin,
    loginDriverWithPin,
    loginStoreDevice,
    signUpManual,
    updateOwnProfile,
    changePassword,
    deleteOwnAccount,
    logout,
  };
}
