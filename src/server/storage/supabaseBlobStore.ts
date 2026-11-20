import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient, resolveSupabaseServerRuntime } from '../services/supabaseProvider.ts';

/**
 * Storage híbrido do Server Core.
 *
 * - LOCAL_VOLUME: disco local (comportamento original; efêmero em Cloud Run).
 * - SUPABASE_STORAGE: bucket privado no Supabase Storage acessado SOMENTE pelo
 *   Server Core com a secret key (nunca exposta ao frontend). A autorização
 *   (tenant/filial/dono) continua 100% no Server Core.
 *
 * Seleção (env STORAGE_DRIVER):
 *   auto (padrão) -> SUPABASE_STORAGE se SUPABASE_URL + SUPABASE_SECRET_KEY existirem, senão LOCAL_VOLUME
 *   supabase      -> força SUPABASE_STORAGE (cai para LOCAL_VOLUME se não configurado)
 *   local         -> força LOCAL_VOLUME
 */
export type BlobStorageDriverId = 'LOCAL_VOLUME' | 'SUPABASE_STORAGE';

export interface BlobObjectKey {
  tenantId: string;
  appId: string;
  objectId: string;
  ownerUid?: string | null;
}

export const DEFAULT_SUPABASE_STORAGE_BUCKET = '3c-objects';

function sanitizeKeySegment(raw: string, fallback: string): string {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '_');
  return cleaned || fallback;
}

export function resolveSupabaseStorageBucket(env: Record<string, string | undefined> = process.env): string {
  const bucket = (env.SUPABASE_STORAGE_BUCKET || '').trim();
  return bucket ? sanitizeKeySegment(bucket, DEFAULT_SUPABASE_STORAGE_BUCKET) : DEFAULT_SUPABASE_STORAGE_BUCKET;
}

export function buildSupabaseObjectPath(key: BlobObjectKey): string {
  const parts = [
    sanitizeKeySegment(key.tenantId, 'tenant-1'),
    sanitizeKeySegment(key.appId, 'unified-portal'),
  ];
  if (key.ownerUid) {
    parts.push(sanitizeKeySegment(key.ownerUid, 'usr'));
  }
  parts.push(`${sanitizeKeySegment(key.objectId, 'obj')}.bin`);
  return parts.join('/');
}

export function isSupabaseStorageConfigured(): boolean {
  const runtime = resolveSupabaseServerRuntime();
  return Boolean(runtime.url && runtime.hasSecretKey);
}

export function resolveActiveBlobStorageDriver(
  env: Record<string, string | undefined> = process.env
): BlobStorageDriverId {
  const mode = String(env.STORAGE_DRIVER || 'auto').trim().toLowerCase();
  if (mode === 'local') return 'LOCAL_VOLUME';
  if (isSupabaseStorageConfigured()) return 'SUPABASE_STORAGE';
  if (mode === 'supabase') {
    console.warn(
      '[Storage] STORAGE_DRIVER=supabase, mas SUPABASE_URL/SUPABASE_SECRET_KEY ausentes. Usando LOCAL_VOLUME.'
    );
  }
  return 'LOCAL_VOLUME';
}

let cachedAdmin: { signature: string; client: SupabaseClient } | null = null;

function getAdminClient(): SupabaseClient {
  const runtime = resolveSupabaseServerRuntime();
  const signature = `${runtime.url}::${runtime.hasSecretKey}`;
  if (!cachedAdmin || cachedAdmin.signature !== signature) {
    cachedAdmin = { signature, client: getSupabaseAdminClient() };
  }
  return cachedAdmin.client;
}

export async function putSupabaseBlob(key: BlobObjectKey, buffer: Buffer, mimeType: string): Promise<string> {
  const objectPath = buildSupabaseObjectPath(key);
  const { error } = await getAdminClient()
    .storage.from(resolveSupabaseStorageBucket())
    .upload(objectPath, buffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: false,
      cacheControl: '300',
    });
  if (error) {
    throw new Error(`Supabase Storage upload falhou: ${error.message}`);
  }
  return objectPath;
}

export async function getSupabaseBlob(key: BlobObjectKey): Promise<Buffer | null> {
  const { data, error } = await getAdminClient()
    .storage.from(resolveSupabaseStorageBucket())
    .download(buildSupabaseObjectPath(key));
  if (error || !data) {
    return null;
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function removeSupabaseBlob(key: BlobObjectKey): Promise<void> {
  const { error } = await getAdminClient()
    .storage.from(resolveSupabaseStorageBucket())
    .remove([buildSupabaseObjectPath(key)]);
  if (error) {
    throw new Error(`Supabase Storage remove falhou: ${error.message}`);
  }
}
