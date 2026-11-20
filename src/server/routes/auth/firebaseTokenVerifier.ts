import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CertCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let certCache: CertCache | null = null;

export function getConfiguredFirebaseProjectId(overrideProjectId?: string | null): string {
  const hqOverride = typeof overrideProjectId === 'string' ? overrideProjectId.trim() : '';
  if (hqOverride) {
    return hqOverride;
  }
  const envId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  if (envId) {
    return envId;
  }
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (typeof parsed?.projectId === 'string' && parsed.projectId.trim()) {
        return parsed.projectId.trim();
      }
    }
  } catch {
    // ignore missing config
  }
  return '';
}

function decodeBase64UrlToBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function decodeBase64UrlJson(segment: string): Record<string, any> {
  return JSON.parse(decodeBase64UrlToBuffer(segment).toString('utf-8'));
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certCache && certCache.expiresAtMs > now) {
    return certCache.certs;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Falha ao consultar certificados públicos Firebase (HTTP ${response.status}).`);
  }

  const certs = (await response.json()) as Record<string, string>;
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlSec = maxAgeMatch ? Math.max(60, Number(maxAgeMatch[1])) : 3600;
  certCache = {
    certs,
    expiresAtMs: now + ttlSec * 1000,
  };
  return certs;
}

export interface VerifiedFirebaseTokenClaims {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Cryptographically verifies a Firebase Auth ID token (RS256) against Google's official X.509 certificates
 * without requiring firebase-admin IAM credentials.
 */
export async function verifyFirebaseIdToken(
  idToken: string,
  overrideProjectId?: string | null
): Promise<VerifiedFirebaseTokenClaims> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Token Firebase ausente.');
  }

  const projectId = getConfiguredFirebaseProjectId(overrideProjectId);
  if (!projectId) {
    throw new Error('Projeto Firebase não configurado no Server Core.');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Formato de token Firebase inválido.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: Record<string, any>;
  let payload: Record<string, any>;
  try {
    header = decodeBase64UrlJson(headerB64);
    payload = decodeBase64UrlJson(payloadB64);
  } catch {
    throw new Error('Não foi possível decodificar o token Firebase.');
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Algoritmo ou identificador de chave Firebase inválido.');
  }

  let certs = await fetchGooglePublicCerts(false);
  let certPem = certs[header.kid];
  if (!certPem) {
    certs = await fetchGooglePublicCerts(true);
    certPem = certs[header.kid];
  }
  if (!certPem) {
    throw new Error('Certificado público Firebase não encontrado para a chave informada.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signatureBuf = decodeBase64UrlToBuffer(signatureB64);
  const validSignature = verifier.verify(certPem, signatureBuf);
  if (!validSignature) {
    throw new Error('Assinatura criptográfica do token Firebase inválida.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) {
    throw new Error('Audiência (aud) do token Firebase não corresponde ao projeto.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Emissor (iss) do token Firebase inválido.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub.trim()) {
    throw new Error('Identificador (sub) ausente no token Firebase.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Token Firebase expirado. Tente autenticar novamente.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Timestamp de emissão (iat) do token Firebase inválido.');
  }
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) {
    throw new Error('Conta Google sem e-mail válido.');
  }
  if (payload.email_verified !== true) {
    throw new Error('E-mail Google não verificado.');
  }

  return {
    uid: payload.sub.trim(),
    email: payload.email.toLowerCase().trim(),
    emailVerified: true,
    name:
      typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim().slice(0, 120)
        : payload.email.split('@')[0],
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
