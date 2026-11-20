import crypto from 'crypto';
import { generateUserId } from '../../utils/idGenerator.ts';
import { RESOLVED_SERVER_SECRET, hashPasswordAsync } from './cryptoVaultAndHashing.ts';

const TOKEN_ISSUER = '3c-server-core';
const TOKEN_AUDIENCE = '3c-ecosystem';

export async function revokeAuthSessionEverywhere(
  _uid: string,
  _options?: { deleteUser?: boolean; disabled?: boolean }
): Promise<void> {
  // Session revocation is enforced strictly via tokenVersion / tokenRevokedAtSec in Server Core DB.
}

export function createServerAuthProvider(setUserDoc: (uid: string, userDoc: any) => Promise<void>) {
  return {
    async verifyIdToken(token: string): Promise<any> {
      if (!token || typeof token !== 'string') {
        throw new Error('Token de autenticação não informado.');
      }

      // Support Proprietary HMAC Session Tokens: 'dev-token:<payload-b64>.<signature-b64>'
      if (token.startsWith('dev-token:')) {
        try {
          const raw = token.slice('dev-token:'.length);
          const parts = raw.split('.');

          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error('Token dev malformado ou sem assinatura.');
          }

          const [payloadB64, signatureB64] = parts;

          // Verify HMAC Signature strictly using timingSafeEqual
          const expectedSignature = crypto
            .createHmac('sha256', RESOLVED_SERVER_SECRET)
            .update(payloadB64)
            .digest('base64');

          const sigBuf = Buffer.from(signatureB64);
          const expBuf = Buffer.from(expectedSignature);

          if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            throw new Error('Assinatura do token dev inválida ou adulterada.');
          }

          const parsed = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));

          if (parsed.typ === 'edge_sync') {
            throw new Error('Token técnico Edge não é válido como sessão humana.');
          }
          if (parsed.iss && parsed.iss !== TOKEN_ISSUER) {
            throw new Error('Emissor (iss) do token inválido.');
          }
          if (parsed.aud && parsed.aud !== TOKEN_AUDIENCE) {
            throw new Error('Público (aud) do token inválido.');
          }

          // Expiration check (Mandatory expiration)
          if (!parsed.exp || typeof parsed.exp !== 'number') {
            throw new Error('Token sem campo de expiração obrigatório.');
          }

          if (parsed.exp < Math.floor(Date.now() / 1000)) {
            throw new Error('Token de desenvolvimento expirado.');
          }

          return {
            uid: parsed.uid,
            email: parsed.email || '',
            email_verified: Boolean(parsed.email_verified),
            name: parsed.name || 'Usuário Dev',
            role: parsed.role || 'CUSTOMER',
            tenantId: parsed.tenantId || 'tenant-1',
            storeId: parsed.storeId,
            tokenVersion: typeof parsed.tokenVersion === 'number' ? parsed.tokenVersion : 1,
            iat: parsed.iat,
            exp: parsed.exp,
            iss: parsed.iss || TOKEN_ISSUER,
            aud: parsed.aud || TOKEN_AUDIENCE,
            typ: parsed.typ || 'session',
            deviceDocId: parsed.deviceDocId,
            deviceId: parsed.deviceId,
            terminalId: parsed.terminalId,
            jti: parsed.jti,
          };
        } catch (e: any) {
          throw new Error(`Validação de token falhou: ${e.message}`);
        }
      }

      throw new Error('Token de autenticação não reconhecido. Exige token assinado HMAC do Server Core.');
    },

    async createUser(properties: {
      email: string;
      displayName?: string;
      emailVerified?: boolean;
      disabled?: boolean;
      password?: string;
    }): Promise<{ uid: string }> {
      const uid = generateUserId();
      const userDoc = {
        uid,
        id: uid,
        email: properties.email.toLowerCase().trim(),
        name: properties.displayName || 'Novo Usuário',
        emailVerified: properties.emailVerified ?? false,
        disabled: properties.disabled ?? false,
        role: 'CUSTOMER',
        tenantId: 'tenant-1',
        passwordHash: properties.password ? await hashPasswordAsync(properties.password) : null,
        createdAt: new Date().toISOString(),
      };
      await setUserDoc(uid, userDoc);
      return { uid };
    },

    generateDevToken(payload: any): string {
      const nowSec = Math.floor(Date.now() / 1000);
      const fullPayload = {
        iss: TOKEN_ISSUER,
        aud: TOKEN_AUDIENCE,
        typ: payload?.typ || 'session',
        jti: payload?.jti || `jti_${crypto.randomUUID()}`,
        iat: nowSec,
        exp: nowSec + 86400, // default 24 hours validity
        tokenVersion: typeof payload?.tokenVersion === 'number' ? payload.tokenVersion : 1,
        ...payload,
      };

      const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64');

      const signature = crypto
        .createHmac('sha256', RESOLVED_SERVER_SECRET)
        .update(payloadB64)
        .digest('base64');

      return `dev-token:${payloadB64}.${signature}`;
    },

    generateEdgeSyncToken(payload: {
      nodeId: string;
      tenantId: string;
      storeId: string;
      tokenVersion?: number;
      ttlSeconds?: number;
    }): { token: string; expiresAt: string; tokenVersion: number } {
      const nowSec = Math.floor(Date.now() / 1000);
      const ttl = Math.max(300, Math.min(86400, Number(payload.ttlSeconds) || 7200)); // default 2h, max 24h
      const tokenVersion = typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 1;
      const exp = nowSec + ttl;
      const fullPayload = {
        iss: TOKEN_ISSUER,
        aud: '3c-edge-sync',
        typ: 'edge_sync',
        jti: `edg_jti_${crypto.randomUUID()}`,
        nodeId: payload.nodeId,
        tenantId: payload.tenantId,
        storeId: payload.storeId,
        tokenVersion,
        iat: nowSec,
        exp,
      };
      const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64');
      const signature = crypto
        .createHmac('sha256', RESOLVED_SERVER_SECRET)
        .update(`edge:${payloadB64}`)
        .digest('base64');

      return {
        token: `edg-tok:${payloadB64}.${signature}`,
        expiresAt: new Date(exp * 1000).toISOString(),
        tokenVersion,
      };
    },

    async verifyEdgeSyncToken(token: string): Promise<{
      nodeId: string;
      tenantId: string;
      storeId: string;
      tokenVersion: number;
      iat: number;
      exp: number;
      jti: string;
    }> {
      if (!token || typeof token !== 'string' || !token.startsWith('edg-tok:')) {
        throw new Error('Credencial técnica Edge ausente ou em formato inválido.');
      }
      const raw = token.slice('edg-tok:'.length);
      const parts = raw.split('.');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Credencial técnica Edge malformada.');
      }
      const [payloadB64, signatureB64] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', RESOLVED_SERVER_SECRET)
        .update(`edge:${payloadB64}`)
        .digest('base64');

      const sigBuf = Buffer.from(signatureB64);
      const expBuf = Buffer.from(expectedSignature);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Assinatura da credencial técnica Edge inválida.');
      }
      const parsed = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8'));
      if (parsed.typ !== 'edge_sync' || parsed.iss !== TOKEN_ISSUER || parsed.aud !== '3c-edge-sync') {
        throw new Error('Contrato da credencial técnica Edge inválido.');
      }
      if (!parsed.exp || typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Credencial técnica Edge expirada.');
      }
      if (!parsed.nodeId || !parsed.tenantId || !parsed.storeId) {
        throw new Error('Credencial técnica Edge sem nodeId/tenantId/storeId.');
      }
      return {
        nodeId: String(parsed.nodeId),
        tenantId: String(parsed.tenantId),
        storeId: String(parsed.storeId),
        tokenVersion: typeof parsed.tokenVersion === 'number' ? parsed.tokenVersion : 1,
        iat: Number(parsed.iat) || 0,
        exp: parsed.exp,
        jti: String(parsed.jti || ''),
      };
    },
  };
}
