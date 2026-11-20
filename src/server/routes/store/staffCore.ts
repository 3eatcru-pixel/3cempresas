import express from 'express';
import crypto from 'crypto';
import { db, hashPasswordAsync, revokeAuthSessionEverywhere, runWithSystemDbContext } from '../../config.ts';
import {
  AuthenticatedRequestUser,
  hasUserStoreAccess,
  requireRoles,
  verifyAutonomousToken,
} from '../../middleware/auth.ts';
import { broadcastUserSseEvent } from '../../state.ts';
import { generateEventId, generateUserId } from '../../../utils/idGenerator.ts';
import { isSingleBranchLocked, sanitizeStringList } from './storeAccessHelpers.ts';

const router = express.Router();

const STORE_STAFF_MANAGABLE_ROLES = new Set([
  'REGIONAL_MANAGER',
  'STORE_MANAGER',
  'CASHIER',
  'KITCHEN_STAFF',
  'WAITER',
]);

// Precedence inside Store OS: STORE_OWNER (account owner) > REGIONAL_MANAGER > STORE_MANAGER > operational staff
const STORE_STAFF_AUTHORITY: Record<string, number> = {
  DEV_OWNER: 100,
  SUPER_ADMIN: 90,
  STORE_OWNER: 80,
  REGIONAL_MANAGER: 70,
  STORE_MANAGER: 60,
  CASHIER: 50,
  KITCHEN_STAFF: 40,
  WAITER: 30,
};

function normalizeStaffRole(role?: string): string {
  return String(role || '').trim().toUpperCase();
}

router.get(
  '/staff',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER']),
  async (req, res) => {
    try {
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const requestedStoreId = req.query.storeId ? String(req.query.storeId) : '';
      const isHq = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';

      if (!isHq && requestedStoreId && !hasUserStoreAccess(authenticatedUser, requestedStoreId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }

      const snap = await db.collection('users').get();
      let list = snap.docs
        .filter((d) => !d.data()?._deleted)
        .map((d) => {
          const raw = d.data() || {};
          const { passwordHash: _ph, resetCodeHash: _rch, ...safe } = raw;
          return {
            ...safe,
            uid: safe.uid || safe.id || d.id,
            role: normalizeStaffRole(safe.role),
            status: safe.disabled === true ? 'DISABLED' : (safe.status || 'ACTIVE'),
            blockedApps: Array.isArray(safe.blockedApps) ? safe.blockedApps : [],
            permissions: Array.isArray(safe.permissions) ? safe.permissions : [],
          };
        })
        .filter((u: any) => !['CUSTOMER', 'CONSUMER', 'COURIER', 'DRIVER', 'DEV_OWNER', 'SUPER_ADMIN'].includes(u.role));

      if (!isHq) {
        const userTenant = authenticatedUser.tenantId || 'tenant-1';
        list = list.filter((u: any) => u.tenantId === userTenant);
        if (isSingleBranchLocked(authenticatedUser)) {
          list = list.filter((u: any) => u.storeId === authenticatedUser.storeId);
        } else if (authenticatedUser.storeId) {
          list = list.filter((u: any) => !u.storeId || hasUserStoreAccess(authenticatedUser, u.storeId));
        }
      }
      if (requestedStoreId) {
        list = list.filter((u: any) => u.storeId === requestedStoreId);
      }

      res.json(list);
    } catch {
      res.status(500).json({ error: 'Erro ao listar equipe da loja.' });
    }
  }
);

router.post(
  '/staff',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER']),
  async (req, res) => {
    try {
      const { name, email, password, role, storeId, phone, blockedApps, permissions } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const callerRole = normalizeStaffRole(authenticatedUser.role);
      const isHq = callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN';

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'E-mail válido é obrigatório.' });
      }
      if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ error: 'Senha explícita de no mínimo 8 caracteres é obrigatória.' });
      }

      const targetRole = normalizeStaffRole(role);
      if (!STORE_STAFF_MANAGABLE_ROLES.has(targetRole)) {
        return res.status(403).json({
          error: `Acesso negado: A Loja só pode criar perfis operacionais internos (${Array.from(STORE_STAFF_MANAGABLE_ROLES).join(', ')}). Contas de motoristas e administradores globais são exclusivas do HQ Central.`,
        });
      }

      if (!isHq && (STORE_STAFF_AUTHORITY[targetRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
        return res.status(403).json({
          error: `Acesso negado: Perfil '${callerRole}' não pode criar colaborador com nível '${targetRole}'.`,
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const targetStoreId =
        !isHq && isSingleBranchLocked(authenticatedUser)
          ? String(authenticatedUser.storeId)
          : targetRole === 'REGIONAL_MANAGER' && !storeId
          ? null
          : (storeId ? String(storeId) : (authenticatedUser.storeId || null));
      if (!isHq && targetStoreId && !hasUserStoreAccess(authenticatedUser, targetStoreId)) {
        return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
      }

      const uid = generateUserId();
      const nowIso = new Date().toISOString();
      const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
      const sanitizedBlockedApps = sanitizeStringList(blockedApps) || [];
      const sanitizedPermissions = sanitizeStringList(permissions) || [];
      const staffPasswordHash = await hashPasswordAsync(password);

      const globalEmailConflict = await runWithSystemDbContext('STAFF_GLOBAL_EMAIL_CHECK', async () => {
        const allUsers = await db.collection('users').get();
        return allUsers.docs.some((d) => !d.data()?._deleted && d.data()?.email?.toLowerCase() === normalizedEmail);
      });
      if (globalEmailConflict) {
        return res.status(409).json({ error: 'E-mail já cadastrado na plataforma.' });
      }

      const { staffDoc, resolvedTenantId } = await db.runTransaction(async (transaction) => {
        const existingUsers = await db.collection('users').get();
        if (existingUsers.docs.some((d) => !d.data()?._deleted && d.data()?.email?.toLowerCase() === normalizedEmail)) {
          const err: any = new Error('E-mail já cadastrado na plataforma.');
          err.statusCode = 409;
          throw err;
        }

        let txTenantId = authenticatedUser.tenantId || 'tenant-1';
        if (targetStoreId) {
          const storeSnap = await transaction.get(db.collection('stores').doc(targetStoreId));
          if (!storeSnap.exists || storeSnap.data()?._deleted) {
            const err: any = new Error(`Loja '${targetStoreId}' não encontrada.`);
            err.statusCode = 404;
            throw err;
          }
          const storeTenantId = storeSnap.data()?.tenantId;
          if (!isHq && storeTenantId !== authenticatedUser.tenantId) {
            const err: any = new Error('Acesso negado: Loja especificada pertence a outra empresa/tenant.');
            err.statusCode = 403;
            throw err;
          }
          if (storeTenantId) txTenantId = storeTenantId;
        }

        const docData: Record<string, any> = {
          uid,
          id: uid,
          name: (typeof name === 'string' && name.trim()) || 'Colaborador',
          email: normalizedEmail,
          ...(cleanPhone ? { phone: cleanPhone } : {}),
          role: targetRole,
          tenantId: txTenantId,
          storeId: targetStoreId,
          blockedApps: sanitizedBlockedApps,
          permissions: sanitizedPermissions,
          passwordHash: staffPasswordHash,
          emailVerified: false,
          status: 'ACTIVE',
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        transaction.set(db.collection('users').doc(uid), docData, { merge: false });
        return { staffDoc: docData, resolvedTenantId: txTenantId };
      });

      const evtId = generateEventId();
      await db.collection('events').doc(evtId).set({
        id: evtId,
        type: 'STORE_STAFF_CREATED',
        payload: `Colaborador ${normalizedEmail} (${targetRole}) cadastrado na loja ${targetStoreId || resolvedTenantId}`,
        channel: 'store/staff',
        tenantId: resolvedTenantId,
        actorUid: authenticatedUser.uid,
        timestamp: nowIso,
        timeStr: new Date(nowIso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });

      const { passwordHash: _omitted, ...safeUser } = staffDoc;
      res.status(201).json({ success: true, uid, user: safeUser });
    } catch (err: any) {
      res.status(err?.statusCode || 500).json({ error: err?.message || 'Erro ao cadastrar colaborador da loja.' });
    }
  }
);

router.put(
  '/staff/:uid',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER', 'STORE_MANAGER']),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const { role, storeId, status, name, phone, blockedApps, permissions } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const callerRole = normalizeStaffRole(authenticatedUser.role);
      const isHq = callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN';

      const userRef = db.collection('users').doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists || userSnap.data()?._deleted) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }

      const targetUser = userSnap.data() || {};
      const targetCurrentRole = normalizeStaffRole(targetUser.role);

      if (!STORE_STAFF_MANAGABLE_ROLES.has(targetCurrentRole) && !(isHq && targetCurrentRole === 'STORE_OWNER')) {
        return res.status(403).json({
          error: `Acesso negado: Conta '${targetCurrentRole}' é gerenciada exclusivamente pelo HQ Central.`,
        });
      }

      if (!isHq) {
        if (targetUser.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outra empresa/tenant.' });
        }
        if (targetUser.storeId && !hasUserStoreAccess(authenticatedUser, targetUser.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outra filial.' });
        }
        if ((STORE_STAFF_AUTHORITY[targetCurrentRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
          return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode alterar '${targetCurrentRole}'.` });
        }
      }

      let nextRole = targetCurrentRole;
      if (role !== undefined) {
        const candidateRole = normalizeStaffRole(role);
        if (!STORE_STAFF_MANAGABLE_ROLES.has(candidateRole)) {
          return res.status(403).json({ error: `Perfil '${role}' não pode ser atribuído pela gestão da loja.` });
        }
        if (!isHq && (STORE_STAFF_AUTHORITY[candidateRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
          return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode promover para '${candidateRole}'.` });
        }
        nextRole = candidateRole;
      }

      if (status !== undefined && !['ACTIVE', 'DISABLED', 'PENDING_ACTIVATION'].includes(status)) {
        return res.status(400).json({ error: `Status '${status}' inválido.` });
      }
      if (uid === authenticatedUser.uid && status === 'DISABLED') {
        return res.status(400).json({ error: 'Operação bloqueada: Você não pode suspender a própria conta.' });
      }

      let resolvedStoreId = storeId !== undefined ? (storeId ? String(storeId) : null) : targetUser.storeId ?? null;
      if (nextRole === 'REGIONAL_MANAGER' && storeId === undefined && targetCurrentRole !== 'REGIONAL_MANAGER') {
        resolvedStoreId = null;
      }
      if (resolvedStoreId) {
        if (!isHq && !hasUserStoreAccess(authenticatedUser, resolvedStoreId)) {
          return res.status(403).json({ error: 'Acesso negado: Perfil restrito a outra filial.' });
        }
        const storeSnap = await db.collection('stores').doc(resolvedStoreId).get();
        if (!storeSnap.exists) {
          return res.status(404).json({ error: `Loja '${resolvedStoreId}' não encontrada.` });
        }
        if (!isHq && storeSnap.data()?.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Loja pertence a outro tenant.' });
        }
      }
      if (!isHq && isSingleBranchLocked(authenticatedUser)) {
        resolvedStoreId = String(authenticatedUser.storeId);
      }

      const currentStatus = targetUser.disabled === true ? 'DISABLED' : (targetUser.status || 'ACTIVE');
      const nextStatus = status ?? currentStatus;
      const sanitizedBlockedApps = sanitizeStringList(blockedApps);
      const sanitizedPermissions = sanitizeStringList(permissions);
      const isSecurityChanged =
        nextRole !== targetCurrentRole ||
        nextStatus !== currentStatus ||
        resolvedStoreId !== (targetUser.storeId ?? null) ||
        sanitizedBlockedApps !== undefined;

      const nextTokenVersion = isSecurityChanged
        ? (Number(targetUser.tokenVersion) || 1) + 1
        : (targetUser.tokenVersion || 1);
      const nowSec = Math.floor(Date.now() / 1000);
      const nowIso = new Date().toISOString();

      const patch: Record<string, any> = {
        role: nextRole,
        storeId: resolvedStoreId,
        status: nextStatus,
        disabled: nextStatus === 'DISABLED',
        tokenVersion: nextTokenVersion,
        ...(typeof name === 'string' && name.trim().length >= 2 ? { name: name.trim() } : {}),
        ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
        ...(sanitizedBlockedApps !== undefined ? { blockedApps: sanitizedBlockedApps } : {}),
        ...(sanitizedPermissions !== undefined ? { permissions: sanitizedPermissions } : {}),
        ...(isSecurityChanged ? { tokenRevokedAtSec: nowSec } : {}),
        updatedAt: nowIso,
      };

      await userRef.update(patch);

      if (isSecurityChanged) {
        await revokeAuthSessionEverywhere(uid, { disabled: nextStatus === 'DISABLED' });
        if (nextStatus === 'DISABLED') {
          broadcastUserSseEvent(uid, 'USER_SUSPENDED', { status: 'DISABLED' });
        } else {
          broadcastUserSseEvent(uid, 'USER_ROLE_UPDATED', {
            role: nextRole,
            tenantId: targetUser.tenantId,
            storeId: resolvedStoreId,
            blockedApps: sanitizedBlockedApps ?? targetUser.blockedApps ?? [],
            status: nextStatus,
          });
        }
      }

      const { passwordHash: _omitted, resetCodeHash: _omittedR, ...safeUser } = { ...targetUser, ...patch };
      res.json({ success: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Erro ao atualizar colaborador da loja.' });
    }
  }
);

router.post(
  '/staff/:uid/revoke-sessions',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER']),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const callerRole = normalizeStaffRole(authenticatedUser.role);
      const isHq = callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN';

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists || snap.data()?._deleted) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
      const targetUser = snap.data() || {};
      const targetRole = normalizeStaffRole(targetUser.role);
      if (!STORE_STAFF_MANAGABLE_ROLES.has(targetRole) && !isHq) {
        return res.status(403).json({ error: 'Acesso negado: Conta não gerenciável pela loja.' });
      }
      if (!isHq) {
        if (targetUser.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outro tenant.' });
        }
        if (targetUser.storeId && !hasUserStoreAccess(authenticatedUser, targetUser.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outra filial.' });
        }
        if ((STORE_STAFF_AUTHORITY[targetRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
          return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode revogar sessões de '${targetRole}'.` });
        }
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const nextTokenVersion = (Number(targetUser.tokenVersion) || 1) + 1;
      await userRef.update({ tokenVersion: nextTokenVersion, tokenRevokedAtSec: nowSec, updatedAt: new Date().toISOString() });
      await revokeAuthSessionEverywhere(uid);
      broadcastUserSseEvent(uid, 'USER_SESSION_REVOKED', { tokenVersion: nextTokenVersion });
      res.json({ success: true, tokenVersion: nextTokenVersion });
    } catch {
      res.status(500).json({ error: 'Falha ao revogar sessões do colaborador.' });
    }
  }
);

router.post(
  '/staff/:uid/reset-password',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER']),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const { newPassword } = req.body || {};
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const callerRole = normalizeStaffRole(authenticatedUser.role);
      const isHq = callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN';

      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists || snap.data()?._deleted) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
      const targetUser = snap.data() || {};
      const targetRole = normalizeStaffRole(targetUser.role);
      if (!STORE_STAFF_MANAGABLE_ROLES.has(targetRole) && !isHq) {
        return res.status(403).json({ error: 'Acesso negado: Conta não gerenciável pela loja.' });
      }
      if (!isHq) {
        if (targetUser.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outro tenant.' });
        }
        if (targetUser.storeId && !hasUserStoreAccess(authenticatedUser, targetUser.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outra filial.' });
        }
        if ((STORE_STAFF_AUTHORITY[targetRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
          return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode redefinir senha de '${targetRole}'.` });
        }
      }

      const temporaryPassword =
        typeof newPassword === 'string' && newPassword.trim().length >= 8
          ? newPassword.trim()
          : `3C-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;

      const nowSec = Math.floor(Date.now() / 1000);
      const nextTokenVersion = (Number(targetUser.tokenVersion) || 1) + 1;
      const nowIso = new Date().toISOString();

      const resetPasswordHash = await hashPasswordAsync(temporaryPassword);

      await userRef.update({
        passwordHash: resetPasswordHash,
        mustChangePassword: true,
        resetCodeHash: null,
        resetCodeExpiresAt: null,
        resetAttempts: 0,
        tokenVersion: nextTokenVersion,
        tokenRevokedAtSec: nowSec,
        updatedAt: nowIso,
      });

      await revokeAuthSessionEverywhere(uid);
      broadcastUserSseEvent(uid, 'USER_SESSION_REVOKED', { tokenVersion: nextTokenVersion, reason: 'PASSWORD_RESET_BY_STORE' });
      res.json({ success: true, uid, temporaryPassword, mustChangePassword: true, tokenVersion: nextTokenVersion, resetAt: nowIso });
    } catch {
      res.status(500).json({ error: 'Falha ao redefinir senha do colaborador.' });
    }
  }
);

router.delete(
  '/staff/:uid',
  verifyAutonomousToken,
  requireRoles(['DEV_OWNER', 'SUPER_ADMIN', 'STORE_OWNER', 'REGIONAL_MANAGER']),
  async (req, res) => {
    try {
      const { uid } = req.params;
      const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
      const callerRole = normalizeStaffRole(authenticatedUser.role);
      const isHq = callerRole === 'DEV_OWNER' || callerRole === 'SUPER_ADMIN';

      if (uid === authenticatedUser.uid) {
        return res.status(400).json({ error: 'Operação bloqueada: Você não pode remover a própria conta.' });
      }
      const userRef = db.collection('users').doc(uid);
      const snap = await userRef.get();
      if (!snap.exists || snap.data()?._deleted) {
        return res.status(404).json({ error: 'Colaborador não encontrado.' });
      }
      const targetUser = snap.data() || {};
      const targetRole = normalizeStaffRole(targetUser.role);
      if (!STORE_STAFF_MANAGABLE_ROLES.has(targetRole) && !isHq) {
        return res.status(403).json({ error: 'Acesso negado: Conta não pode ser removida pela loja.' });
      }
      if (!isHq) {
        if (targetUser.tenantId !== authenticatedUser.tenantId) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outro tenant.' });
        }
        if (targetUser.storeId && !hasUserStoreAccess(authenticatedUser, targetUser.storeId)) {
          return res.status(403).json({ error: 'Acesso negado: Colaborador pertence a outra filial.' });
        }
        if ((STORE_STAFF_AUTHORITY[targetRole] || 0) >= (STORE_STAFF_AUTHORITY[callerRole] || 0)) {
          return res.status(403).json({ error: `Acesso negado: Perfil '${callerRole}' não pode remover '${targetRole}'.` });
        }
      }

      await userRef.delete();
      await revokeAuthSessionEverywhere(uid, { deleteUser: true });
      broadcastUserSseEvent(uid, 'USER_DELETED', { reason: 'DELETED_BY_STORE' });
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Falha ao remover colaborador da loja.' });
    }
  }
);

export default router;
