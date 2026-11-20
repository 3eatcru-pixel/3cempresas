import { requestJson } from './httpClient.ts';

export const authApi = {
  async getAuthProviders() {
    return requestJson<{
      autonomousEmailPassword: boolean;
      firebaseEnabled: boolean;
      firebaseMasterEnabled?: boolean;
      firebaseAuthEnabled?: boolean;
      firebaseFirestoreEnabled?: boolean;
      firebaseConfigured: boolean;
      firebaseProjectId: string | null;
      googlePopupSupported: boolean;
    }>('/auth/providers', {
      method: 'GET',
      skipAuthInvalidationOn401: true,
    });
  },

  async loginWithFirebaseToken(payload: { idToken: string; contextId: string }) {
    return requestJson<{ token: string; user: any }>('/auth/firebase-exchange', {
      method: 'POST',
      body: payload,
      skipAuthInvalidationOn401: true,
    });
  },

  async updateOwnProfile(payload: { name?: string; phone?: string }, token?: string) {
    return requestJson<{ success: boolean; user: any }>('/auth/profile', {
      method: 'PUT',
      body: payload,
      token,
    });
  },

  async changePassword(
    payload: { currentPassword?: string; newPassword: string },
    token?: string
  ) {
    return requestJson<{ success: boolean; token: string; tokenVersion: number }>(
      '/auth/change-password',
      {
        method: 'POST',
        body: payload,
        token,
        skipAuthInvalidationOn401: true,
      }
    );
  },

  async recoverPasswordRequest(email: string) {
    return requestJson<{ success: boolean; message: string }>('/auth/recover-request', {
      method: 'POST',
      body: { email },
    });
  },

  async recoverPasswordReset(payload: { email: string; code: string; newPassword: string }) {
    return requestJson<{ success: boolean; message: string }>('/auth/recover-reset', {
      method: 'POST',
      body: payload,
    });
  },

  async deleteOwnAccount(token?: string) {
    return requestJson<{ success: boolean; deletedUid: string }>('/auth/account', {
      method: 'DELETE',
      token,
    });
  },
};
