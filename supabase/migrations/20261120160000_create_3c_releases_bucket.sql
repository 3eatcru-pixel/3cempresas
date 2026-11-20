-- =============================================================================
-- 3C Corp — Public Releases Bucket (Supabase Storage CDN for Native Installers)
-- Migration: 20261120160000_create_3c_releases_bucket.sql
--
-- Bucket público `3c-releases` (somente leitura pública via URL CDN; escrita
-- restrita ao Server Core / Dashboard via service_role / secret key).
-- Permite distribuir .exe, .msi, .apk, .aab, .AppImage, .deb e SHA256SUMS.txt
-- configurando RELEASE_BASE_URL no HQ Central ou no .env.
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      '3c-releases',
      '3c-releases',
      true,
      209715200,
      ARRAY[
        'application/octet-stream',
        'application/x-msdownload',
        'application/x-msi',
        'application/vnd.microsoft.portable-executable',
        'application/vnd.android.package-archive',
        'application/x-debian-package',
        'application/x-executable',
        'application/json',
        'text/plain'
      ]
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
