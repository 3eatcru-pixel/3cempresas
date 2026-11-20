import express from 'express';
import { db, runWithSystemDbContext } from '../config.ts';
import { requireRoles, verifyAutonomousToken } from '../middleware/auth.ts';
import {
  probeSupabaseServerHealth,
  resolveSupabaseServerRuntime,
  verifySupabaseAccessToken,
} from '../services/supabaseProvider.ts';

const router = express.Router();

router.get(
  '/health',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN']),
  async (_req, res) => {
    try {
      const govSnap = await runWithSystemDbContext('SUPABASE_HEALTH_CHECK', () =>
        db.collection('governance').doc('governance').get()
      );
      const govData = govSnap.exists ? govSnap.data() : undefined;
      const flags = govData?.featureFlags || {};
      const masterEnabled = flags.supabaseEnabled !== false;
      const authEnabled = masterEnabled && flags.supabaseAuthEnabled !== false;
      const dbEnabled = masterEnabled && flags.supabaseDbEnabled !== false;

      if (!masterEnabled) {
        const runtime = resolveSupabaseServerRuntime(govData);
        return res.json({
          online: false,
          standbyByHq: true,
          configured: runtime.configured,
          hasSecretKey: runtime.hasSecretKey,
          masterEnabled: false,
          authEnabled: false,
          dbEnabled: false,
          url: runtime.url,
          jwksUrl: runtime.jwksUrl,
          jwksReachable: false,
          authHealthStatus: null,
          latencyMs: 0,
          source: runtime.source,
          detail: 'Conector Supabase em modo STANDBY pelo HQ Central.',
        });
      }

      const probe = await probeSupabaseServerHealth(govData);
      return res.json({
        ...probe,
        standbyByHq: false,
        masterEnabled,
        authEnabled,
        dbEnabled,
      });
    } catch {
      return res.status(500).json({ error: 'Falha ao consultar saúde do conector Supabase.' });
    }
  }
);

router.post(
  '/verify-token',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER']),
  async (req, res) => {
    try {
      const rawToken =
        typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
      if (!rawToken) {
        return res.status(400).json({ error: 'accessToken é obrigatório.' });
      }
      const govSnap = await runWithSystemDbContext('SUPABASE_TOKEN_VERIFY', () =>
        db.collection('governance').doc('governance').get()
      );
      const govData = govSnap.exists ? govSnap.data() : undefined;
      const claims = await verifySupabaseAccessToken(rawToken, govData);
      return res.json({ valid: true, claims });
    } catch (err: any) {
      return res.status(401).json({ valid: false, error: err?.message || 'Token inválido.' });
    }
  }
);

export default router;
