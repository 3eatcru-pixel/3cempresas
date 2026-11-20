import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        '@3c/shared-types': path.resolve(import.meta.dirname, 'packages/shared-types/src/index.ts'),
        '@3c/contracts': path.resolve(import.meta.dirname, 'packages/contracts/src/index.ts'),
        '@3c/permissions': path.resolve(import.meta.dirname, 'packages/permissions/src/index.ts'),
        '@3c/commerce-engine': path.resolve(import.meta.dirname, 'packages/commerce-engine/src/index.ts'),
        '@3c/design-system': path.resolve(import.meta.dirname, 'packages/design-system/src/index.ts'),
        '@3c/platform-adapters': path.resolve(import.meta.dirname, 'packages/platform-adapters/src/index.ts'),
        '@3c/api-client': path.resolve(import.meta.dirname, 'packages/api-client/src/index.ts'),
        '@3c/sync-engine/storage': path.resolve(import.meta.dirname, 'packages/sync-engine/src/storage.ts'),
        '@3c/sync-engine': path.resolve(import.meta.dirname, 'packages/sync-engine/src/index.ts'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      allowedHosts: ['3eatcruempresas.ai.studio', '.ai.studio', '.run.app', 'localhost', '127.0.0.1'],
    },
  };
});
