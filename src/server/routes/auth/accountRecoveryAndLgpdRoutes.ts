import express from 'express';
import crypto from 'crypto';
import {
  auth,
  db,
  hashPasswordAsync,
  revokeAuthSessionEverywhere,
  runWithSystemDbContext,
  verifyPasswordAsync,
} from '../../config.ts';
import {
  verifyAutonomousToken,
  AuthenticatedRequestUser,
} from '../../middleware/auth.ts';
import { broadcastSseEvent, broadcastUserSseEvent } from '../../state.ts';
import { generateAuditLogId } from '../../../utils/idGenerator.ts';
import { validateSafeExternalUrl } from '../admin/adminHelpersCore.ts';
import { clearSessionCookie, setSessionCookie } from './sessionCookie.ts';

const router = express.Router();

/**
 * Self-Service Profile Update (syncs users/{uid} and consumers/{uid})
 */
router.put('/profile', verifyAutonomousToken, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (
      authenticatedUser.authProvider === 'STORE_DEVICE_PDQ' ||
      authenticatedUser.authProvider === 'WAITER_PIN_TERMINAL'
    ) {
      return res.status(403).json({
        error: 'Sessão de terminal/PDQ da loja não permite alterar perfil de conta pessoal.',
      });
    }
    const { name, phone } = req.body || {};

    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ error: 'Nome inválido: informe pelo menos 2 caracteres.' });
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return res.status(400).json({ error: 'Telefone inválido.' });
    }

    const updatedUser = await db.runTransaction(async (transaction) => {
      const userRef = db.collection('users').doc(authenticatedUser.uid);
      const consumerRef = db.collection('consumers').doc(authenticatedUser.uid);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        return null;
      }
      const consumerSnap = await transaction.get(consumerRef);

      const existingUser = userSnap.data() || {};
      const nowIso = new Date().toISOString();
      const userPatch: Record<string, any> = { updatedAt: nowIso };
      if (typeof name === 'string') userPatch.name = name.trim();
      if (typeof phone === 'string') userPatch.phone = phone.trim();

      transaction.set(userRef, userPatch, { merge: true });

      const roleUpper = String(existingUser.role || '').toUpperCase();
      if (consumerSnap.exists || roleUpper === 'CUSTOMER' || roleUpper === 'CONSUMER') {
        transaction.set(
          consumerRef,
          {
            id: authenticatedUser.uid,
            uid: authenticatedUser.uid,
            email: existingUser.email || '',
            tenantId: 'tenant-1',
            ...(typeof name === 'string' ? { name: name.trim() } : {}),
            ...(typeof phone === 'string' ? { phone: phone.trim() } : {}),
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      const merged = { ...existingUser, ...userPatch };
      delete merged.passwordHash;
      delete merged.resetCodeHash;
      return merged;
    });

    if (!updatedUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ success: true, user: updatedUser });
  } catch {
    res.status(500).json({ error: 'Falha ao atualizar perfil do usuário.' });
  }
});

/**
 * Authenticated Password Change (rotates tokenVersion and issues fresh token for active caller)
 */
router.post('/change-password', verifyAutonomousToken, async (req, res) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    if (
      authenticatedUser.authProvider === 'STORE_DEVICE_PDQ' ||
      authenticatedUser.authProvider === 'WAITER_PIN_TERMINAL'
    ) {
      return res.status(403).json({
        error: 'Sessão de terminal/PDQ da loja não possui senha pessoal alterável.',
      });
    }
    const { currentPassword, newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 8 caracteres.' });
    }

    const userRef = db.collection('users').doc(authenticatedUser.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const userData = userSnap.data() || {};
    if (userData.passwordHash) {
      if (
        !currentPassword ||
        typeof currentPassword !== 'string' ||
        !(await verifyPasswordAsync(currentPassword, userData.passwordHash))
      ) {
        return res.status(401).json({ error: 'Senha atual incorreta.' });
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const nextTokenVersion = (Number(userData.tokenVersion) || 1) + 1;
    const nowIso = new Date().toISOString();

    await userRef.update({
      passwordHash: await hashPasswordAsync(newPassword),
      passwordSealed: false,
      mustChangePassword: false,
      resetCodeHash: null,
      resetCodeExpiresAt: null,
      resetAttempts: 0,
      tokenVersion: nextTokenVersion,
      tokenRevokedAtSec: nowSec - 1,
      updatedAt: nowIso,
    });

    const newToken = auth.generateDevToken({
      uid: userData.uid || authenticatedUser.uid,
      email: userData.email,
      email_verified: userData.emailVerified === true,
      name: userData.name,
      role: userData.role,
      tenantId: userData.tenantId || 'tenant-1',
      storeId: userData.storeId,
      tokenVersion: nextTokenVersion,
    });
    setSessionCookie(res, newToken);

    await db.collection('audit_logs').doc(generateAuditLogId()).set({
      type: 'USER_PASSWORD_CHANGED',
      payload: `Senha alterada pelo próprio usuário (${userData.email || authenticatedUser.uid})`,
      channel: 'auth/security',
      tenantId: userData.tenantId || 'tenant-1',
      actorUid: authenticatedUser.uid,
      timestamp: nowIso,
    });

    res.json({ success: true, token: newToken, tokenVersion: nextTokenVersion });
  } catch {
    res.status(500).json({ error: 'Falha ao alterar senha.' });
  }
});

/**
 * Autonomous Pillar 4 Password Recovery Request (Anti-enumeration + HQ/Audit Dispatch)
 */
router.post('/recover-request', async (req, res) => {
  try {
    return await runWithSystemDbContext('AUTH_RECOVER_REQUEST', async () => {
      const { email } = req.body || {};
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Informe um e-mail válido.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const usersSnap = await db.collection('users').get();
      const userDoc = usersSnap.docs.find((d) => d.data()?.email?.toLowerCase() === normalizedEmail);

      if (userDoc) {
        const userData = userDoc.data() || {};
        const isDisabled = userData.status === 'DISABLED' || userData.disabled === true;
        if (!isDisabled) {
          const recoveryCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          const nowIso = new Date().toISOString();

          await db.collection('users').doc(userDoc.id).update({
            resetCodeHash: await hashPasswordAsync(recoveryCode),
            resetCodeExpiresAt: expiresAt,
            resetAttempts: 0,
            resetRequestedAt: nowIso,
            updatedAt: nowIso,
          });

          let emailWebhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
          if (!emailWebhookUrl) {
            try {
              const govSnap = await db.collection('governance').doc('governance').get();
              const policyUrl = govSnap.exists ? govSnap.data()?.runtimePolicy?.emailWebhookUrl : '';
              if (typeof policyUrl === 'string' && policyUrl.trim()) {
                emailWebhookUrl = policyUrl.trim();
              }
            } catch {
              // keep empty fallback
            }
          }
          const isSmtpHostSet = Boolean((process.env.SMTP_HOST || '').trim());
          let deliveryChannel:
            | 'EXTERNAL_EMAIL_WEBHOOK'
            | 'SMTP_CONFIGURED_PENDING_TRANSPORT'
            | 'EMAIL_DELIVERY_FAILED'
            | 'SANDBOX_CONSOLE' = 'SANDBOX_CONSOLE';
          let deliveryDetail =
            'Código registrado em modo sandbox console (sem provedor externo configurado).';

          if (emailWebhookUrl) {
            const safeUrl = await validateSafeExternalUrl(emailWebhookUrl);
            if (safeUrl.ok === false) {
              deliveryChannel = 'EMAIL_DELIVERY_FAILED';
              deliveryDetail = `EMAIL_WEBHOOK_URL bloqueada por política anti-SSRF: ${safeUrl.reason}`;
            } else {
              try {
                const mailPayload = JSON.stringify({
                  event: 'PASSWORD_RECOVERY',
                  to: normalizedEmail,
                  name: userData.name || 'Usuário',
                  code: recoveryCode,
                  expiresAt,
                  tenantId: userData.tenantId || 'tenant-1',
                  issuedAt: nowIso,
                });
                const headers: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'X-3C-Event': 'PASSWORD_RECOVERY',
                };
                const webhookSecret = (process.env.EMAIL_WEBHOOK_SECRET || '').trim();
                if (webhookSecret) {
                  const sig = crypto
                    .createHmac('sha256', webhookSecret)
                    .update(mailPayload)
                    .digest('hex');
                  headers['X-3C-Signature'] = `sha256=${sig}`;
                }
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 3000);
                const mailResp = await fetch(safeUrl.url.toString(), {
                  method: 'POST',
                  redirect: 'error',
                  signal: controller.signal,
                  headers,
                  body: mailPayload,
                });
                clearTimeout(timer);
                if (mailResp.ok) {
                  deliveryChannel = 'EXTERNAL_EMAIL_WEBHOOK';
                  deliveryDetail = `Código despachado para EMAIL_WEBHOOK_URL (HTTP ${mailResp.status}).`;
                } else {
                  deliveryChannel = 'EMAIL_DELIVERY_FAILED';
                  deliveryDetail = `EMAIL_WEBHOOK_URL retornou HTTP ${mailResp.status}.`;
                }
              } catch (mailErr: any) {
                deliveryChannel = 'EMAIL_DELIVERY_FAILED';
                deliveryDetail = `Falha no envio via EMAIL_WEBHOOK_URL: ${mailErr?.message || 'timeout'}.`;
              }
            }
          } else if (isSmtpHostSet) {
            deliveryChannel = 'SMTP_CONFIGURED_PENDING_TRANSPORT';
            deliveryDetail =
              'SMTP_HOST definido sem EMAIL_WEBHOOK_URL ativo; entrega via transporte SMTP não executada neste runtime.';
          } else {
            console.info(
              `[Password Recovery Notice] Código de recuperação emitido para ${normalizedEmail}: ${recoveryCode} (válido por 15min até ${expiresAt}). Em produção sem provedor de e-mail configurado, configure EMAIL_WEBHOOK_URL.`
            );
          }

          await db.collection('audit_logs').doc(generateAuditLogId()).set({
            type: 'PASSWORD_RECOVERY_REQUESTED',
            payload: `Recuperação de senha solicitada para ${normalizedEmail} (${deliveryChannel}: ${deliveryDetail})`,
            channel: 'auth/recovery',
            tenantId: userData.tenantId || 'tenant-1',
            targetUid: userDoc.id,
            deliveryChannel,
            timestamp: nowIso,
          });

          broadcastSseEvent(
            'PASSWORD_RECOVERY_REQUESTED',
            { email: normalizedEmail, uid: userDoc.id, expiresAt, deliveryChannel },
            'ALL',
            true
          );
        }
      }

      res.json({
        success: true,
        message:
          'Se o e-mail estiver cadastrado e ativo, a solicitação de recuperação foi registrada. Caso não possua código, peça ao suporte HQ para redefinir sua senha.',
      });
    });
  } catch {
    res.status(500).json({ error: 'Erro ao solicitar recuperação de senha.' });
  }
});

/**
 * Autonomous Pillar 4 Password Recovery Confirmation
 */
router.post('/recover-reset', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (!code || typeof code !== 'string' || code.trim().length < 4) {
      return res.status(400).json({ error: 'Código de recuperação obrigatório.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'A nova senha deve possuir no mínimo 8 caracteres.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const txResult = await runWithSystemDbContext('AUTH_RECOVER_RESET', () =>
      db.runTransaction(async (transaction) => {
        const usersSnap = await db.collection('users').get();
        const userDoc = usersSnap.docs.find((d) => d.data()?.email?.toLowerCase() === normalizedEmail);
        if (!userDoc) {
          return { ok: false as const, status: 400, error: 'Código de recuperação inválido ou expirado.' };
        }

        const userRef = db.collection('users').doc(userDoc.id);
        const freshSnap = await transaction.get(userRef);
        const userData = freshSnap.data() || {};
        if (userData.status === 'DISABLED' || userData.disabled === true) {
          return { ok: false as const, status: 403, error: 'Conta suspensa pelo HQ Central.' };
        }
        if (!userData.resetCodeHash || !userData.resetCodeExpiresAt) {
          return { ok: false as const, status: 400, error: 'Nenhuma recuperação ativa para esta conta.' };
        }
        if (new Date(userData.resetCodeExpiresAt).getTime() < Date.now()) {
          return { ok: false as const, status: 400, error: 'Código de recuperação expirado. Solicite um novo.' };
        }

        const attempts = Number(userData.resetAttempts) || 0;
        if (attempts >= 5) {
          return {
            ok: false as const,
            status: 429,
            error: 'Muitas tentativas inválidas. Solicite um novo código de recuperação.',
          };
        }

        const validCode = await verifyPasswordAsync(code.trim().toUpperCase(), userData.resetCodeHash);
        if (!validCode) {
          transaction.update(userRef, { resetAttempts: attempts + 1 });
          return { ok: false as const, status: 400, error: 'Código de recuperação inválido ou expirado.' };
        }

        const nowSec = Math.floor(Date.now() / 1000);
        const nextTokenVersion = (Number(userData.tokenVersion) || 1) + 1;
        const nowIso = new Date().toISOString();

        transaction.update(userRef, {
          passwordHash: await hashPasswordAsync(newPassword),
          mustChangePassword: false,
          resetCodeHash: null,
          resetCodeExpiresAt: null,
          resetAttempts: 0,
          tokenVersion: nextTokenVersion,
          tokenRevokedAtSec: nowSec,
          updatedAt: nowIso,
        });

        return {
          ok: true as const,
          uid: userDoc.id,
          tenantId: userData.tenantId || 'tenant-1',
          nowIso,
        };
      })
    );

    if (!txResult.ok) {
      return res.status(txResult.status).json({ error: txResult.error });
    }

    await revokeAuthSessionEverywhere(txResult.uid);
    broadcastUserSseEvent(txResult.uid, 'USER_SESSION_REVOKED', { reason: 'PASSWORD_RECOVERED' });

    await runWithSystemDbContext('AUTH_RECOVER_AUDIT', () =>
      db.collection('audit_logs').doc(generateAuditLogId()).set({
        type: 'USER_PASSWORD_RECOVERED',
        payload: `Senha redefinida via recuperação para ${normalizedEmail}`,
        channel: 'auth/recovery',
        tenantId: txResult.tenantId,
        targetUid: txResult.uid,
        timestamp: txResult.nowIso,
      })
    );

    res.json({ success: true, message: 'Senha redefinida com sucesso! Faça login com a nova senha.' });
  } catch {
    res.status(500).json({ error: 'Erro ao redefinir senha.' });
  }
});

/**
 * LGPD Self-Deletion Route (DELETE /api/v1/auth/account & POST /api/v1/auth/delete-account)
 */
const handleSelfDeleteAccount = async (req: express.Request, res: express.Response) => {
  try {
    const authenticatedUser = (req as any).user as AuthenticatedRequestUser;
    const uid = authenticatedUser.uid;
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    const userData = userSnap.data() || {};
    if (String(userData.role || '').toUpperCase() === 'DEV_OWNER') {
      const allUsersSnap = await db.collection('users').get();
      const activeDevOwners = allUsersSnap.docs
        .map((d) => d.data())
        .filter((u) => u?.role === 'DEV_OWNER' && u?.status !== 'DISABLED' && u?.disabled !== true);
      if (activeDevOwners.length <= 1) {
        return res.status(400).json({
          error: 'Operação bloqueada: Não é permitido excluir o último DEV_OWNER ativo da plataforma.',
        });
      }
    }

    const nowIso = new Date().toISOString();

    await runWithSystemDbContext('AUTH_LGPD_DELETE', async () => {
      const ordersSnap = await db.collection('orders').get();
      const matchingOrderIds = ordersSnap.docs
        .filter((d) => d.data()?.customerId === uid)
        .map((d) => d.id);

      await db.runTransaction(async (transaction) => {
        const txUserSnap = await transaction.get(userRef);
        if (!txUserSnap.exists) {
          throw new Error('NOT_FOUND');
        }
        const adminRef = db.collection('admins').doc(uid);
        const consumerRef = db.collection('consumers').doc(uid);
        const [adminSnap, consumerSnap] = await Promise.all([
          transaction.get(adminRef),
          transaction.get(consumerRef),
        ]);

        for (const ordId of matchingOrderIds) {
          transaction.update(db.collection('orders').doc(ordId), {
            customerName: 'Consumidor Removido (LGPD)',
            customerEmail: null,
            customerPhone: null,
            updatedAt: nowIso,
          });
        }

        transaction.delete(userRef);
        if (adminSnap.exists) {
          transaction.delete(adminRef);
        }
        if (consumerSnap.exists) {
          transaction.delete(consumerRef);
        }
      });
    });

    await revokeAuthSessionEverywhere(uid, { deleteUser: true });
    broadcastUserSseEvent(uid, 'USER_DELETED', { reason: 'SELF_DELETED_LGPD' });

    await db.collection('audit_logs').doc(generateAuditLogId()).set({
      type: 'USER_SELF_DELETED_LGPD',
      payload: `Titular ${userData.email || uid} (${userData.role || 'CUSTOMER'}) excluiu permanentemente sua conta (LGPD)`,
      channel: 'auth/lgpd',
      tenantId: userData.tenantId || 'tenant-1',
      targetUid: uid,
      timestamp: nowIso,
    });

    clearSessionCookie(res);
    res.json({ success: true, deletedUid: uid });
  } catch {
    res.status(500).json({ error: 'Erro ao processar exclusão permanente da conta.' });
  }
};

router.delete('/account', verifyAutonomousToken, handleSelfDeleteAccount);
router.post('/delete-account', verifyAutonomousToken, handleSelfDeleteAccount);

export default router;
