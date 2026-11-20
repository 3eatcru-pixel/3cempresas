import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  FIREBASE_BLUEPRINT_LIMITS,
  FirebaseProductScope,
  getFirebaseServices,
  handleFirestoreError,
  OperationType,
  VALID_FIREBASE_PRODUCT_SCOPES,
} from './firebaseRuntime';

export type FirebaseCloudTheme = 'dark' | 'light' | 'system';

export interface FirebaseCloudPreference {
  uid: string;
  productScope: FirebaseProductScope;
  locale: string;
  theme: FirebaseCloudTheme;
  notificationsEnabled: boolean;
  updatedAt?: string;
}

const VALID_THEMES: readonly FirebaseCloudTheme[] = ['dark', 'light', 'system'];

function normalizeLocale(raw: string): string {
  const cleaned = String(raw || 'pt-BR')
    .trim()
    .slice(0, FIREBASE_BLUEPRINT_LIMITS.LOCALE_MAX_LENGTH);
  return cleaned.length >= FIREBASE_BLUEPRINT_LIMITS.LOCALE_MIN_LENGTH ? cleaned : 'pt-BR';
}

function normalizeTheme(raw: string): FirebaseCloudTheme {
  return VALID_THEMES.includes(raw as FirebaseCloudTheme) ? (raw as FirebaseCloudTheme) : 'dark';
}

function normalizeScope(raw: string): FirebaseProductScope {
  return VALID_FIREBASE_PRODUCT_SCOPES.includes(raw as FirebaseProductScope)
    ? (raw as FirebaseProductScope)
    : 'hq';
}

/**
 * Reads optional multi-device preferences from /cloud_preferences/{uid} (strict owner-only Firestore rules).
 */
export async function readFirebaseCloudPreferences(): Promise<FirebaseCloudPreference | null> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return null;
  }

  const path = `cloud_preferences/${currentUser.uid}`;
  const ref = doc(db, 'cloud_preferences', currentUser.uid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid: String(data.uid || currentUser.uid),
      productScope: normalizeScope(String(data.productScope || 'hq')),
      locale: normalizeLocale(String(data.locale || 'pt-BR')),
      theme: normalizeTheme(String(data.theme || 'dark')),
      notificationsEnabled: Boolean(data.notificationsEnabled),
      updatedAt:
        typeof data.updatedAt?.toDate === 'function'
          ? data.updatedAt.toDate().toISOString()
          : undefined,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Persists validated cloud preferences to /cloud_preferences/{uid}, matching firebase-blueprint.json & firestore.rules.
 */
export async function saveFirebaseCloudPreferences(input: {
  productScope: FirebaseProductScope;
  locale: string;
  theme: FirebaseCloudTheme;
  notificationsEnabled: boolean;
}): Promise<FirebaseCloudPreference> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Autenticação Google verificada necessária para sincronizar preferências na nuvem.');
  }

  const path = `cloud_preferences/${currentUser.uid}`;
  const ref = doc(db, 'cloud_preferences', currentUser.uid);
  const sanitized = {
    uid: currentUser.uid,
    productScope: normalizeScope(input.productScope),
    locale: normalizeLocale(input.locale),
    theme: normalizeTheme(input.theme),
    notificationsEnabled: Boolean(input.notificationsEnabled),
  };

  try {
    await setDoc(ref, {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
    return {
      ...sanitized,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteFirebaseCloudPreferences(): Promise<void> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return;
  }

  const path = `cloud_preferences/${currentUser.uid}`;
  try {
    await deleteDoc(doc(db, 'cloud_preferences', currentUser.uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
