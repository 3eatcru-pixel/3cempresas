import express from 'express';
import crypto from 'crypto';
import {
  db,
  hashPasswordAsync,
  revokeAuthSessionEverywhere,
} from '../../config.ts';
import { verifyAutonomousToken, requireRoles, AuthenticatedRequestUser } from '../../middleware/auth.ts';
import { broadcastUserSseEvent } from '../../state.ts';
import {
  HQ_ONLY_ROLES,
  normalizeUserRole,
  recordAdminAuditEvent,
} from './adminHelpersCore.ts';

const router = express.Router();

// ==========================================
// USER SECURITY & LIFECYCLE ENDPOINTS (HQ)
// ==========================================

router.post('/users/:uid/revoke-sessions', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { uid } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const callerRole = authenticatedUser.role || 'GUEST';

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const targetUser = userSnap.data();
    const targetRole = normalizeUserRole(targetUser?.role || 'CUSTOMER');

    if (callerRole === 'SUPER_ADMIN' && (targetRole === 'DEV_OWNER' || targetRole === 'SUPER_ADMIN') && uid !== authenticatedUser.uid) {
      return res.status(403).json({ error: 'Acesso negado: SUPER_ADMIN não pode revogar sessões de DEV_OWNER ou outro SUPER_ADMIN.' });
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const nextTokenVersion = (Number(targetUser?.tokenVersion) || 1) + 1;
    await userRef.update({
      tokenVersion: nextTokenVersion,
      tokenRevokedAtSec: nowSec,
      updatedAt: new Date().toISOString(),
    });

    await revokeAuthSessionEverywhere(uid);
    broadcastUserSseEvent(uid, 'USER_SESSION_REVOKED', { tokenVersion: nextTokenVersion });

    await recordAdminAuditEvent(
      'USER_SESSION_REVOKED',
      `Sessões do usuário ${targetUser?.email || uid} invalidadas pelo HQ (versão: ${nextTokenVersion})`,
      'hq/security',
      targetUser?.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'users',
        resourceId: uid,
        before: { tokenVersion: Number(targetUser?.tokenVersion) || 1 },
        after: { tokenVersion: nextTokenVersion },
      }
    );

    res.json({ success: true, tokenVersion: nextTokenVersion, revokedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ error: 'Falha ao revogar sessões do usuário.' });
  }
});

router.post('/users/:uid/reset-password', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { uid } = req.params;
    const { newPassword } = req.body || {};
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const callerRole = authenticatedUser.role || 'GUEST';

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const targetUser = userSnap.data() || {};
    const targetRole = normalizeUserRole(targetUser.role || 'CUSTOMER');

    if (callerRole === 'SUPER_ADMIN' && (targetRole === 'DEV_OWNER' || targetRole === 'SUPER_ADMIN') && uid !== authenticatedUser.uid) {
      return res.status(403).json({ error: 'Acesso negado: SUPER_ADMIN não pode redefinir senha de DEV_OWNER ou outro SUPER_ADMIN.' });
    }

    let temporaryPassword: string;
    if (typeof newPassword === 'string' && newPassword.trim().length > 0) {
      if (newPassword.trim().length < 8) {
        return res.status(400).json({ error: 'Senha temporária explícita deve conter no mínimo 8 caracteres.' });
      }
      temporaryPassword = newPassword.trim();
    } else {
      temporaryPassword = `3C-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const nextTokenVersion = (Number(targetUser.tokenVersion) || 1) + 1;
    const nowIso = new Date().toISOString();

    const passwordHash = await hashPasswordAsync(temporaryPassword);

    await userRef.update({
      passwordHash,
      mustChangePassword: true,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      resetAttempts: 0,
      tokenVersion: nextTokenVersion,
      tokenRevokedAtSec: nowSec,
      updatedAt: nowIso,
    });

    await revokeAuthSessionEverywhere(uid);
    broadcastUserSseEvent(uid, 'USER_SESSION_REVOKED', {
      tokenVersion: nextTokenVersion,
      reason: 'PASSWORD_RESET_BY_HQ',
    });

    await recordAdminAuditEvent(
      'USER_PASSWORD_RESET_BY_HQ',
      `Senha temporária redefinida pelo HQ para ${targetUser.email || uid} (${targetRole})`,
      'hq/security',
      targetUser.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'users',
        resourceId: uid,
        before: {
          tokenVersion: Number(targetUser.tokenVersion) || 1,
          mustChangePassword: Boolean(targetUser.mustChangePassword),
        },
        after: {
          tokenVersion: nextTokenVersion,
          mustChangePassword: true,
        },
      }
    );

    res.json({
      success: true,
      uid,
      temporaryPassword,
      mustChangePassword: true,
      tokenVersion: nextTokenVersion,
      resetAt: nowIso,
    });
  } catch {
    res.status(500).json({ error: 'Falha ao redefinir senha do usuário.' });
  }
});

router.delete('/users/:uid', verifyAutonomousToken, requireRoles(HQ_ONLY_ROLES), async (req, res) => {
  try {
    const { uid } = req.params;
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const callerRole = authenticatedUser.role || 'GUEST';

    if (uid === authenticatedUser.uid) {
      return res.status(400).json({ error: 'Operação bloqueada: Você não pode remover a própria conta em uso.' });
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || userSnap.data()?._deleted) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const targetUser = userSnap.data();
    const targetRole = normalizeUserRole(targetUser?.role || 'CUSTOMER');

    if (callerRole === 'SUPER_ADMIN' && (targetRole === 'DEV_OWNER' || targetRole === 'SUPER_ADMIN')) {
      return res.status(403).json({ error: 'Acesso negado: SUPER_ADMIN não pode excluir contas DEV_OWNER ou outro SUPER_ADMIN.' });
    }

    if (targetRole === 'DEV_OWNER') {
      const allUsersSnap = await db.collection('users').get();
      const activeDevOwners = allUsersSnap.docs
        .map(d => d.data())
        .filter(u => !u?._deleted && u?.role === 'DEV_OWNER' && u?.status !== 'DISABLED' && u?.disabled !== true);
      if (activeDevOwners.length <= 1 && activeDevOwners.some(u => u.uid === uid || u.id === uid)) {
        return res.status(400).json({ error: 'Operação bloqueada: Não é permitido excluir o último DEV_OWNER ativo da plataforma.' });
      }
    }

    await db.runTransaction(async (transaction) => {
      const adminRef = db.collection('admins').doc(uid);
      const consumerRef = db.collection('consumers').doc(uid);
      const driverRef = db.collection('drivers').doc(uid);
      const [adminSnap, consumerSnap, driverSnap] = await Promise.all([
        transaction.get(adminRef),
        transaction.get(consumerRef),
        transaction.get(driverRef),
      ]);
      transaction.delete(userRef);
      if (adminSnap.exists) {
        transaction.delete(adminRef);
      }
      if (consumerSnap.exists) {
        transaction.delete(consumerRef);
      }
      if (driverSnap.exists) {
        transaction.delete(driverRef);
      }
    });
    await revokeAuthSessionEverywhere(uid, { deleteUser: true });
    broadcastUserSseEvent(uid, 'USER_DELETED', { reason: 'DELETED_BY_HQ' });

    await recordAdminAuditEvent(
      'USER_DELETED_BY_HQ',
      `Conta ${targetUser?.email || uid} (${targetRole}) removida pelo HQ`,
      'hq/security',
      targetUser?.tenantId || 'tenant-1',
      {
        req,
        actor: authenticatedUser,
        resourceType: 'users',
        resourceId: uid,
        before: {
          email: targetUser?.email || null,
          role: targetRole,
          tenantId: targetUser?.tenantId || 'tenant-1',
        },
        after: null,
      }
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Falha ao excluir usuário.' });
  }
});

export default router;
