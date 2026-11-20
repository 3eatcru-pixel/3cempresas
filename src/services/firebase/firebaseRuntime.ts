import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export type FirebaseProductScope =
  | 'marketplace'
  | 'store-os'
  | 'driver'
  | 'waiter'
  | 'hq'
  | 'server-core';

export const VALID_FIREBASE_PRODUCT_SCOPES: readonly FirebaseProductScope[] = [
  'marketplace',
  'store-os',
  'driver',
  'waiter',
  'hq',
  'server-core',
] as const;

export const FIREBASE_BLUEPRINT_LIMITS = {
  UID_MIN_LENGTH: 1,
  UID_MAX_LENGTH: 128,
  EMAIL_MIN_LENGTH: 5,
  EMAIL_MAX_LENGTH: 254,
  DISPLAY_NAME_MIN_LENGTH: 1,
  DISPLAY_NAME_MAX_LENGTH: 120,
  PHOTO_URL_MAX_LENGTH: 500,
  LOCALE_MIN_LENGTH: 2,
  LOCALE_MAX_LENGTH: 16,
  SAFE_ID_REGEX: /^[A-Za-z0-9_.-]{1,128}$/,
  EMAIL_REGEX: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
} as const;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseRuntimeMetadata() {
  return {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
    storageBucket: firebaseConfig.storageBucket,
    appId: firebaseConfig.appId,
  };
}

export function getFirebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!cachedApp) {
    cachedApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
  if (!cachedAuth) {
    cachedAuth = getAuth(cachedApp);
  }
  if (!cachedDb) {
    cachedDb = getFirestore(cachedApp, firebaseConfig.firestoreDatabaseId);
  }
  return { app: cachedApp, auth: cachedAuth, db: cachedDb };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const { auth } = getFirebaseServices();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function parseFirestoreErrorInfo(rawMessage?: string | null): FirestoreErrorInfo | null {
  if (!rawMessage || typeof rawMessage !== 'string') return null;
  const trimmed = rawMessage.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed.error === 'string' && typeof parsed.operationType === 'string') {
      return parsed as FirestoreErrorInfo;
    }
  } catch {
    // ignore non-JSON error messages
  }
  return null;
}
