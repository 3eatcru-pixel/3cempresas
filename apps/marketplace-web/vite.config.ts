import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(import.meta.dirname, '../..');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: path.resolve(repoRoot, 'public'),
  resolve: {
    alias: {
      '@': repoRoot,
      '@3c/shared-types': path.resolve(repoRoot, 'packages/shared-types/src/index.ts'),
      '@3c/contracts': path.resolve(repoRoot, 'packages/contracts/src/index.ts'),
      '@3c/permissions': path.resolve(repoRoot, 'packages/permissions/src/index.ts'),
      '@3c/commerce-engine': path.resolve(repoRoot, 'packages/commerce-engine/src/index.ts'),
      '@3c/design-system': path.resolve(repoRoot, 'packages/design-system/src/index.ts'),
      '@3c/platform-adapters': path.resolve(repoRoot, 'packages/platform-adapters/src/index.ts'),
      '@3c/api-client': path.resolve(repoRoot, 'packages/api-client/src/index.ts'),
      '@3c/sync-engine/storage': path.resolve(repoRoot, 'packages/sync-engine/src/storage.ts'),
      '@3c/sync-engine': path.resolve(repoRoot, 'packages/sync-engine/src/index.ts'),
    },
  },
  define: {
    'import.meta.env.VITE_3C_APP_ID': JSON.stringify('marketplace'),
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
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
