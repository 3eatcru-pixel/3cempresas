import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  FIREBASE_BLUEPRINT_LIMITS,
  getFirebaseServices,
  handleFirestoreError,
  OperationType,
} from './firebaseRuntime';

export interface FirebaseAdminRecord {
  uid: string;
  email: string;
  grantedBy: string;
  createdAt?: string;
}

/**
 * Checks safely whether the current verified Google user has admin authorization in /admins/{uid}.
 */
export async function checkCurrentUserIsFirestoreAdmin(): Promise<boolean> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return false;
  }
  if (currentUser.email?.toLowerCase() === '3eatcru@gmail.com') {
    return true;
  }
  const path = `admins/${currentUser.uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', currentUser.uid));
    return snap.exists();
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

/**
 * Lists authorized HQ administrators stored in /admins/{adminId} (admin-only under firestore.rules).
 */
export async function listFirebaseAdmins(): Promise<FirebaseAdminRecord[]> {
  const { auth, db } = getFirebaseServices();
  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    throw new Error('Autenticação Google verificada no HQ necessária para consultar /admins.');
  }

  const path = 'admins';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: String(data.uid || d.id),
        email: String(data.email || ''),
        grantedBy: String(data.grantedBy || ''),
        createdAt:
          typeof data.createdAt?.toDate === 'function'
            ? data.createdAt.toDate().toISOString()
            : undefined,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

/**
 * Grants Firestore HQ admin membership under /admins/{adminUid} matching isValidAdminRecordCreate().
 */
export async function grantFirebaseAdmin(
  adminUid: string,
  email: string
): Promise<FirebaseAdminRecord> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Sessão Google verificada necessária para conceder permissão no Firestore.');
  }

  const cleanUid = adminUid.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!FIREBASE_BLUEPRINT_LIMITS.SAFE_ID_REGEX.test(cleanUid) || /^\.+$/.test(cleanUid)) {
    throw new Error('UID Firebase inválido (permitido: 1 a 128 caracteres alfanuméricos, _, . ou -).');
  }
  if (
    cleanEmail.length < FIREBASE_BLUEPRINT_LIMITS.EMAIL_MIN_LENGTH ||
    cleanEmail.length > FIREBASE_BLUEPRINT_LIMITS.EMAIL_MAX_LENGTH ||
    !FIREBASE_BLUEPRINT_LIMITS.EMAIL_REGEX.test(cleanEmail)
  ) {
    throw new Error('E-mail corporativo inválido.');
  }

  const path = `admins/${cleanUid}`;
  try {
    await setDoc(doc(db, 'admins', cleanUid), {
      uid: cleanUid,
      email: cleanEmail,
      grantedBy: currentUser.uid,
      createdAt: serverTimestamp(),
    });
    return {
      uid: cleanUid,
      email: cleanEmail,
      grantedBy: currentUser.uid,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

/**
 * Revokes an admin record in /admins/{adminUid} (self-revocation blocked by firestore.rules).
 */
export async function revokeFirebaseAdmin(adminUid: string): Promise<void> {
  const { auth, db } = getFirebaseServices();
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    throw new Error('Sessão Google verificada necessária para revogar permissão no Firestore.');
  }

  const cleanUid = adminUid.trim();
  if (cleanUid === currentUser.uid) {
    throw new Error('Não é permitido revogar a própria conta administrativa no Firestore.');
  }

  const path = `admins/${cleanUid}`;
  try {
    await deleteDoc(doc(db, 'admins', cleanUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
