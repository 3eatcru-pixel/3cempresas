import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';

// P0-03 Fix: Read from environment or persist a secure random secret to avoid token invalidation on restarts
const customSecretPath = process.env.SERVER_SECRET_PATH ? path.resolve(process.env.SERVER_SECRET_PATH) : null;
const defaultSecretFile = path.join(os.tmpdir(), '.3c-server-secret');
let SERVER_SECRET: string = (process.env.SERVER_SECRET || '').trim();
let secretLoadedFromCustomPath = false;

if (!SERVER_SECRET) {
  try {
    if (customSecretPath && fs.existsSync(customSecretPath)) {
      SERVER_SECRET = fs.readFileSync(customSecretPath, 'utf-8').trim();
      secretLoadedFromCustomPath = Boolean(SERVER_SECRET);
    } else if (process.env.NODE_ENV !== 'production' && fs.existsSync(defaultSecretFile)) {
      SERVER_SECRET = fs.readFileSync(defaultSecretFile, 'utf-8').trim();
    }
  } catch {
    // fallback
  }
}

const serverSecretWasEphemeral = !SERVER_SECRET;

if (!SERVER_SECRET) {
  SERVER_SECRET = crypto.randomBytes(32).toString('hex');
  const targetSecretPath = customSecretPath || defaultSecretFile;
  if (process.env.NODE_ENV !== 'production' && !customSecretPath) {
    try {
      fs.writeFileSync(targetSecretPath, SERVER_SECRET, 'utf-8');
      console.log(`[Security] Chave SERVER_SECRET gerada e persistida em ${targetSecretPath}`);
    } catch {
      console.warn(
        '[Security Warning] Não foi possível gravar SERVER_SECRET no disco (sistema de arquivos somente leitura). Usando segredo em memória.'
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[Security Warning] SERVER_SECRET não configurado no ambiente em produção; boot será bloqueado salvo ALLOW_SANDBOX_IN_PRODUCTION=true.'
    );
  }
}

export const RESOLVED_SERVER_SECRET: string = SERVER_SECRET;

export function assertProductionSecretConfigured(secretValue?: string): void {
  if (process.env.NODE_ENV !== 'production' || process.env.ALLOW_SANDBOX_IN_PRODUCTION === 'true') {
    return;
  }

  const envSecret = (process.env.SERVER_SECRET || '').trim();
  const runtimeCustomPath = process.env.SERVER_SECRET_PATH ? path.resolve(process.env.SERVER_SECRET_PATH) : null;
  let hasConfiguredFileSecret = false;
  try {
    if (runtimeCustomPath && fs.existsSync(runtimeCustomPath)) {
      hasConfiguredFileSecret = Boolean(fs.readFileSync(runtimeCustomPath, 'utf-8').trim());
    }
  } catch {
    hasConfiguredFileSecret = false;
  }

  if (secretValue !== undefined) {
    const provided = typeof secretValue === 'string' ? secretValue.trim() : '';
    const isUsingEphemeralFallback =
      provided === RESOLVED_SERVER_SECRET && serverSecretWasEphemeral && !envSecret && !hasConfiguredFileSecret;
    if (!provided || isUsingEphemeralFallback) {
      throw new Error(
        '[Security Fatal] SERVER_SECRET persistente não configurado em NODE_ENV=production. Defina SERVER_SECRET ou SERVER_SECRET_PATH no ambiente para garantir validação de sessão multi-instância consistente.'
      );
    }
    return;
  }

  if (!envSecret && !hasConfiguredFileSecret && (serverSecretWasEphemeral || !secretLoadedFromCustomPath)) {
    throw new Error(
      '[Security Fatal] SERVER_SECRET persistente não configurado em NODE_ENV=production. Defina SERVER_SECRET ou SERVER_SECRET_PATH no ambiente para garantir validação de sessão multi-instância consistente.'
    );
  }
}

const pbkdf2Async = util.promisify(crypto.pbkdf2);
const MIN_PBKDF2_ITERATIONS = 10_000;
const MAX_PBKDF2_ITERATIONS = 500_000;
const EXPECTED_PBKDF2_HASH_HEX_LEN = 128; // 64 bytes

function parseStoredPbkdf2Hash(
  storedHash?: string
): { salt: string; iterations: number; originalHash: string } | null {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return null;
  }
  const parts = storedHash.split(':');
  let salt: string;
  let iterations: number;
  let originalHash: string;

  if (parts.length === 3) {
    salt = parts[0];
    if (!/^\d+$/.test(parts[1])) return null;
    iterations = Number(parts[1]);
    originalHash = parts[2];
  } else if (parts.length === 2) {
    salt = parts[0];
    iterations = 10000;
    originalHash = parts[1];
  } else {
    return null;
  }

  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_PBKDF2_ITERATIONS ||
    iterations > MAX_PBKDF2_ITERATIONS
  ) {
    return null;
  }

  if (
    !salt ||
    salt.length < 8 ||
    salt.length > 128 ||
    !/^[a-f0-9]+$/i.test(salt) ||
    !originalHash ||
    originalHash.length !== EXPECTED_PBKDF2_HASH_HEX_LEN ||
    !/^[a-f0-9]+$/i.test(originalHash)
  ) {
    return null;
  }

  return { salt, iterations, originalHash };
}

/**
 * P0-02 Fix: Secure PBKDF2 Password Hashing with Salt and 100,000 iterations (NIST Compliant)
 */
export function hashPassword(password: string, salt?: string, iterations = 100000): string {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const safeIterations = Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, Math.floor(iterations)));
  const hash = crypto.pbkdf2Sync(password, s, safeIterations, 64, 'sha512').toString('hex');
  return `${s}:${safeIterations}:${hash}`;
}

export async function hashPasswordAsync(
  password: string,
  salt?: string,
  iterations = 100000
): Promise<string> {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const safeIterations = Math.min(MAX_PBKDF2_ITERATIONS, Math.max(MIN_PBKDF2_ITERATIONS, Math.floor(iterations)));
  const derived = await pbkdf2Async(password, s, safeIterations, 64, 'sha512');
  return `${s}:${safeIterations}:${derived.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  const parsed = parseStoredPbkdf2Hash(storedHash);
  if (!parsed) return false;
  const hash = crypto.pbkdf2Sync(password, parsed.salt, parsed.iterations, 64, 'sha512').toString('hex');
  const hashBuf = Buffer.from(hash, 'hex');
  const origBuf = Buffer.from(parsed.originalHash, 'hex');
  if (hashBuf.length !== origBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, origBuf);
}

export async function verifyPasswordAsync(password: string, storedHash?: string): Promise<boolean> {
  const parsed = parseStoredPbkdf2Hash(storedHash);
  if (!parsed) return false;
  const derived = await pbkdf2Async(password, parsed.salt, parsed.iterations, 64, 'sha512');
  const origBuf = Buffer.from(parsed.originalHash, 'hex');
  if (derived.length !== origBuf.length) return false;
  return crypto.timingSafeEqual(derived, origBuf);
}

export function computeSnapshotChecksum(tables: Record<string, any[]>): string {
  const canonical = JSON.stringify(
    Object.keys(tables)
      .sort()
      .reduce((acc: Record<string, any[]>, key) => {
        acc[key] = tables[key];
        return acc;
      }, {})
  );
  return crypto.createHmac('sha256', RESOLVED_SERVER_SECRET).update(canonical).digest('hex');
}

export function verifySnapshotChecksum(tables: Record<string, any[]>, providedChecksum?: string): boolean {
  if (!providedChecksum || typeof providedChecksum !== 'string') return false;
  const expected = computeSnapshotChecksum(tables);
  const a = Buffer.from(providedChecksum.trim(), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export interface EncryptedSecretEnvelope {
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
}

function deriveVaultKey(): Buffer {
  return crypto.createHash('sha256').update(`3c-vault:${RESOLVED_SERVER_SECRET}`).digest();
}

export function encryptIntegrationSecret(plaintext: string): EncryptedSecretEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };
}

export function decryptIntegrationSecret(envelope: EncryptedSecretEnvelope | null | undefined): string | null {
  if (!envelope || envelope.alg !== 'aes-256-gcm' || !envelope.iv || !envelope.tag || !envelope.data) {
    return null;
  }
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      deriveVaultKey(),
      Buffer.from(envelope.iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}
