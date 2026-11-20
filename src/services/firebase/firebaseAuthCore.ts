import { getApps } from 'firebase/app';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  FIREBASE_BLUEPRINT_LIMITS,
  FirebaseProductScope,
  getFirebaseServices,
  handleFirestoreError,
  OperationType,
} from './firebaseRuntime';

export async function signInWithFirebaseGooglePopup(
  productScope: FirebaseProductScope,
  options?: { syncFirestoreProfile?: boolean }
) {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const firebaseUser = credential.user;
  const idToken = await firebaseUser.getIdToken(true);

  if (options?.syncFirestoreProfile !== false) {
    // Best-effort optional profile sync to Firestore under strict owner-only rules
    void syncFirebaseUserProfileDoc(productScope).catch((err) => {
      console.warn('[FirebaseAuthCore] Optional Firestore profile sync skipped:', err);
    });
  }

  return {
    idToken,
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
    photoURL: firebaseUser.photoURL || '',
    emailVerified: firebaseUser.emailVerified,
  };
}

export async function syncFirebaseUserProfileDoc(
  productScope: FirebaseProductScope
): Promise<void> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email || !currentUser.emailVerified) {
    return;
  }

  const path = `users/${currentUser.uid}`;
  const ref = doc(db, 'users', currentUser.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  const displayName = (currentUser.displayName || currentUser.email.split('@')[0] || 'Usuario')
    .trim()
    .slice(0, FIREBASE_BLUEPRINT_LIMITS.DISPLAY_NAME_MAX_LENGTH);
  const photoUrl =
    currentUser.photoURL && currentUser.photoURL.startsWith('https://')
      ? currentUser.photoURL.slice(0, FIREBASE_BLUEPRINT_LIMITS.PHOTO_URL_MAX_LENGTH)
      : '';

  try {
    if (!existingSnap.exists()) {
      await setDoc(ref, {
        uid: currentUser.uid,
        email: currentUser.email.slice(0, FIREBASE_BLUEPRINT_LIMITS.EMAIL_MAX_LENGTH),
        displayName,
        photoUrl,
        productScope,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          displayName,
          photoUrl,
          productScope,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(
      err,
      existingSnap.exists() ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export function getActiveFirebaseAuthUser() {
  if (getApps().length === 0) return null;
  const { auth } = getFirebaseServices();
  return auth.currentUser;
}

export function subscribeFirebaseAuthUser(onChange: (user: User | null) => void): () => void {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, (firebaseUser) => {
    onChange(firebaseUser);
  });
}

export async function waitForFirebaseAuthReady(): Promise<User | null> {
  const { auth } = getFirebaseServices();
  await auth.authStateReady();
  return auth.currentUser;
}

export async function signOutFirebaseIfActive(): Promise<void> {
  if (getApps().length === 0) return;
  try {
    const { auth } = getFirebaseServices();
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Non-blocking cleanup
  }
}
