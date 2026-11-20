import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { createServerCoreApp } from './src/server/app.ts';
import {
  assertProductionSecretConfigured,
  getRuntimePersistenceCapabilities,
  probeCloudDatabase,
  shutdownPersistence,
} from './src/server/config.ts';
import { sseClients } from './src/server/state.ts';

dotenv.config();

async function startServer() {
  try {
    assertProductionSecretConfigured();
  } catch (err: any) {
    console.warn(`[3C Cloud Hub Startup] ${err?.message || err}`);
  }
  const probe = await probeCloudDatabase();
  const caps = getRuntimePersistenceCapabilities();
  if (caps.sandboxModeBlockedInProduction) {
    console.error('[CRITICAL P0] Servidor iniciado em NODE_ENV=production sem banco Cloud primário configurado. Mutação de dados bloqueada até configurar PostgreSQL Cloud ou ALLOW_SANDBOX_IN_PRODUCTION=true.');
  } else {
    console.log(
      `[Server Core Persistence] Driver=${caps.persistenceDriver} Mode=${caps.persistenceMode} Provider=${caps.databaseProvider} ProdReady=${caps.productionDatabaseReady} CloudVerified=${probe.verified}`
    );
    if (!probe.verified && (process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL)) {
      console.warn(`[Server Core Persistence] Cloud PostgreSQL indisponível (${probe.error}); operando em fallback local.`);
    }
  }

  const app = createServerCoreApp();

  // 3. Production static serving vs Development Vite SPA middleware
  const isProd = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(process.cwd(), 'dist');

  if (isProd && fs.existsSync(distDir)) {
    const assetsDir = path.join(distDir, 'assets');
    app.use(
      express.static(distDir, {
        index: false,
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (filePath.startsWith(assetsDir + path.sep)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (filePath.endsWith('sw.js') || filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (/\.(?:png|svg|ico|webp|woff2?)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Rota de API não encontrada.' });
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        return res.sendFile(indexFile);
      }
      return next();
    });
  } else {
    app.use('/api', (_req, res) => {
      return res.status(404).json({ error: 'Rota de API não encontrada.' });
    });
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT) || 3000;
  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[3C Cloud Hub] Server running at http://0.0.0.0:${port} (mode=${isProd ? 'production' : 'development'})`);
  });

  let shuttingDown = false;
  const handleShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[3C Cloud Hub] Recebido ${signal}. Encerrando conexões e persistência...`);
    const forceTimer = setTimeout(() => {
      process.exit(1);
    }, 8000);
    forceTimer.unref();

    for (const client of sseClients.splice(0, sseClients.length)) {
      try {
        client.response.end();
      } catch {
        // ignore closed SSE streams
      }
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await shutdownPersistence();
    clearTimeout(forceTimer);
    process.exit(0);
  };

  process.once('SIGTERM', () => void handleShutdown('SIGTERM'));
  process.once('SIGINT', () => void handleShutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
