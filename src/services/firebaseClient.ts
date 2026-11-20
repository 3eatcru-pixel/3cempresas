/**
 * Thin barrel re-exporting modular Firebase connector cores (src/services/firebase/*).
 * Preserves backwards compatibility while isolating Firebase SDK strictly inside the connector boundary.
 */
export {
  FIREBASE_BLUEPRINT_LIMITS,
  OperationType,
  VALID_FIREBASE_PRODUCT_SCOPES,
  getFirebaseRuntimeMetadata,
  getFirebaseServices,
  handleFirestoreError,
  parseFirestoreErrorInfo,
  type FirebaseProductScope,
  type FirestoreErrorInfo,
} from './firebase/firebaseRuntime';

export {
  testFirebaseConnection,
  type FirebaseConnectionProbeResult,
} from './firebase/firebaseHealthProbe';

export {
  getActiveFirebaseAuthUser,
  signInWithFirebaseGooglePopup,
  signOutFirebaseIfActive,
  subscribeFirebaseAuthUser,
  syncFirebaseUserProfileDoc,
  waitForFirebaseAuthReady,
} from './firebase/firebaseAuthCore';

export {
  deleteFirebaseCloudPreferences,
  readFirebaseCloudPreferences,
  saveFirebaseCloudPreferences,
  type FirebaseCloudPreference,
  type FirebaseCloudTheme,
} from './firebase/firebasePreferencesCore';

export {
  checkCurrentUserIsFirestoreAdmin,
  grantFirebaseAdmin,
  listFirebaseAdmins,
  revokeFirebaseAdmin,
  type FirebaseAdminRecord,
} from './firebase/firebaseAdminsCore';
