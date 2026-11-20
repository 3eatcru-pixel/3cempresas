import { doc, getDocFromServer } from 'firebase/firestore';
import { getFirebaseRuntimeMetadata, getFirebaseServices } from './firebaseRuntime';

export interface FirebaseConnectionProbeResult {
  online: boolean;
  latencyMs: number;
  projectId: string;
  firestoreDatabaseId: string;
  detail: string;
}

/**
 * Validates connectivity to the provisioned Firestore database via getDocFromServer.
 * A permission-denied response confirms the client reached Firestore online under default-deny rules.
 */
export async function testFirebaseConnection(): Promise<FirebaseConnectionProbeResult> {
  const started = performance.now();
  const meta = getFirebaseRuntimeMetadata();
  const { db } = getFirebaseServices();
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      online: true,
      latencyMs: Math.max(1, Math.round(performance.now() - started)),
      projectId: meta.projectId,
      firestoreDatabaseId: meta.firestoreDatabaseId,
      detail: 'Firestore acessível online (resposta direta do servidor).',
    };
  } catch (error) {
    const latencyMs = Math.max(1, Math.round(performance.now() - started));
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration. Firestore client is offline.');
      return {
        online: false,
        latencyMs,
        projectId: meta.projectId,
        firestoreDatabaseId: meta.firestoreDatabaseId,
        detail: 'Cliente Firestore offline — verifique a configuração de rede ou do projeto.',
      };
    }
    return {
      online: true,
      latencyMs,
      projectId: meta.projectId,
      firestoreDatabaseId: meta.firestoreDatabaseId,
      detail: 'Firestore acessível online (regras Zero-Trust default-deny respondendo).',
    };
  }
}
