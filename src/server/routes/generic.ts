import express from 'express';
import { db, runWithSystemDbContext } from '../config.ts';
import { verifyAutonomousToken, hasUserStoreAccess } from '../middleware/auth.ts';
import {
  ALLOWED_GENERIC_COLLECTIONS,
  RESTRICTED_COLLECTIONS,
  RBAC_PERMISSIONS,
  isActionAllowed,
} from '@3c/permissions';
import {
  RESERVED_PAGINATION_QUERY_KEYS,
  applyPaginationAndHeaders,
  parsePaginationParams,
} from '../utils/pagination.ts';

import {
  FORBIDDEN_PROTO_KEYS,
  TRANSACTIONAL_ONLY_COLLECTIONS,
  getActiveCatalogContext,
  sanitizeConsumerWritePayload,
  sanitizeReadDocument,
  stripPrototypePollution,
  validateGenericDomainPayload,
} from './genericHelpers.ts';

export { ALLOWED_GENERIC_COLLECTIONS, RESTRICTED_COLLECTIONS, RBAC_PERMISSIONS, isActionAllowed };

const router = express.Router();

/**
 * Generic Document Reader (Multi-tenant & Whitelist & RBAC Enforced - P0-03 & P0-04)
 */
router.get('/:collection/:id', verifyAutonomousToken, async (req, res) => {
  try {
    const { collection, id } = req.params;
    const authenticatedUser = (req as any).user;

    if (RESTRICTED_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: A coleção '${collection}' é restrita e exige rotas de domínio dedicadas.` });
    }

    if (!ALLOWED_GENERIC_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Coleção '${collection}' não autorizada na API genérica.` });
    }

    if (!isActionAllowed(authenticatedUser.role, collection, 'read')) {
      return res.status(403).json({ error: `Acesso negado: O papel '${authenticatedUser.role}' não possui permissão de leitura ('read') na coleção '${collection}'.` });
    }

    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const isConsumerCrossTenantRead =
      isConsumer && (collection === 'stores' || collection === 'menu_items' || collection === 'coupons' || collection === 'orders');

    const doc = isConsumerCrossTenantRead
      ? await runWithSystemDbContext('GENERIC_CONSUMER_DOC_GET', () => db.collection(collection).doc(id).get())
      : await db.collection(collection).doc(id).get();
    if (!doc.exists || doc.data()?._deleted) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    const docData = doc.data();
    if (collection === 'consumers') {
      if (!isHqAdmin && id !== authenticatedUser.uid && docData?.id !== authenticatedUser.uid) {
        return res.status(403).json({ error: 'Acesso negado: Perfil de consumidor pertence a outro usuário.' });
      }
    } else if (isConsumer && collection === 'orders') {
      if (docData?.customerId !== authenticatedUser.uid) {
        return res.status(403).json({ error: 'Acesso negado: Pedido pertence a outro consumidor.' });
      }
    } else if (isConsumer && (collection === 'stores' || collection === 'menu_items' || collection === 'coupons')) {
      const { suspendedTenants, activeStoreIds } = await getActiveCatalogContext();
      if (docData?._deleted) {
        return res.status(404).json({ error: 'Documento não encontrado.' });
      }
      if (collection === 'stores') {
        if (!activeStoreIds.has(id)) {
          return res.status(403).json({ error: 'Estabelecimento indisponível no marketplace.' });
        }
      } else if (collection === 'menu_items') {
        if (
          (docData?.tenantId && suspendedTenants.has(docData.tenantId)) ||
          (docData?.storeId && !activeStoreIds.has(docData.storeId))
        ) {
          return res.status(403).json({ error: 'Produto de estabelecimento indisponível no marketplace.' });
        }
      } else if (collection === 'coupons') {
        const valDate = docData?.validUntil || docData?.expiresAt;
        const isExpired = valDate ? new Date(valDate).getTime() < Date.now() : false;
        if (
          docData?.audience === 'MERCHANT' ||
          docData?.isActive === false ||
          isExpired ||
          (docData?.tenantId && suspendedTenants.has(docData.tenantId)) ||
          (docData?.storeId && !activeStoreIds.has(docData.storeId))
        ) {
          return res.status(403).json({ error: 'Cupom expirado ou indisponível.' });
        }
      }
    } else if (!isHqAdmin) {
      if (!docData?.tenantId || docData.tenantId !== authenticatedUser.tenantId) {
        return res.status(403).json({ error: 'Acesso negado: Documento pertence a outra empresa/tenant.' });
      }
      if (collection === 'stores') {
        if (!hasUserStoreAccess(authenticatedUser, id)) {
          return res.status(403).json({ error: 'Acesso negado: Estabelecimento pertence a outra filial.' });
        }
      } else if (docData?.storeId && !hasUserStoreAccess(authenticatedUser, docData.storeId)) {
        return res.status(403).json({ error: 'Acesso negado: Documento pertence a outra filial.' });
      }
    }

    return res.json(sanitizeReadDocument(collection, docData, isConsumer));
  } catch (error) {
    res.status(500).json({ error: 'Erro ao ler documento.' });
  }
});

/**
 * Generic Document Writer (Multi-tenant & Whitelist & RBAC Enforced - P0-03 & P0-04)
 */
router.post('/:collection/:id', verifyAutonomousToken, async (req, res) => {
  try {
    const { collection, id } = req.params;
    const { data, merge } = req.body;
    const authenticatedUser = (req as any).user;

    if (RESTRICTED_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: A modificação da coleção '${collection}' via API genérica é proibida.` });
    }

    if (!ALLOWED_GENERIC_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Coleção '${collection}' não autorizada na API genérica.` });
    }

    // Transactional & audit collections must go through dedicated server domain pipelines
    if (TRANSACTIONAL_ONLY_COLLECTIONS.has(collection)) {
      return res.status(403).json({
        error: `Acesso negado: A coleção '${collection}' exige rotas transacionais de domínio (/api/v1/commerce/* ou /api/v1/store/*).`,
      });
    }
    if (collection === 'events' || collection === 'audit_logs') {
      return res.status(403).json({ error: 'Acesso negado: Eventos de auditoria são imutáveis (append-only) e gerados exclusivamente pelo servidor.' });
    }

    if (!isActionAllowed(authenticatedUser.role, collection, 'write')) {
      return res.status(403).json({ error: `Acesso negado: O papel '${authenticatedUser.role}' não possui permissão de escrita ('write') na coleção '${collection}'.` });
    }

    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    if (collection === 'consumers' && !isHqAdmin && id !== authenticatedUser.uid) {
      return res.status(403).json({ error: 'Acesso negado: Não é permitido alterar perfil de outro consumidor.' });
    }

    const docRef = db.collection(collection).doc(id);
    const txResult = await db.runTransaction(async (transaction: any) => {
      const existingSnap = await transaction.get(docRef);
      const existingData = existingSnap.exists ? existingSnap.data() : null;

      if (!existingSnap.exists && collection === 'stores' && !isHqAdmin) {
        return {
          status: 403,
          error: 'Acesso negado: Criação de lojas ou filiais deve utilizar /api/v1/store/branches ou /api/v1/admin/stores.',
        };
      }

      if (existingSnap.exists) {
        if (!isHqAdmin && collection !== 'consumers') {
          if (existingData?.tenantId !== authenticatedUser.tenantId) {
            return {
              status: 403,
              error: 'Acesso negado: Não é permitido alterar registros de outra empresa/tenant.',
            };
          }
          if (collection === 'stores') {
            if (!hasUserStoreAccess(authenticatedUser, id)) {
              return {
                status: 403,
                error: 'Acesso negado: Registro pertence a outra filial.',
              };
            }
          } else {
            if (!existingData?.storeId) {
              return {
                status: 403,
                error: 'Acesso negado: Registros globais sem filial vinculada só podem ser alterados pelo HQ Central.',
              };
            }
            if (!hasUserStoreAccess(authenticatedUser, existingData.storeId)) {
              return {
                status: 403,
                error: 'Acesso negado: Registro pertence a outra filial.',
              };
            }
          }
        }
      }

      const cleanInput = stripPrototypePollution(data || {});
      let sanitizedData: Record<string, any> = { ...cleanInput, id };
      if (collection === 'consumers') {
        const consumerRes = sanitizeConsumerWritePayload({
          id,
          cleanInput,
          existingData,
          authenticatedUser,
          isHqAdmin,
        });
        if (!consumerRes.ok) {
          return { status: consumerRes.status, error: consumerRes.error };
        }
        sanitizedData = consumerRes.data;
      } else if (!isHqAdmin) {
        sanitizedData.tenantId = authenticatedUser.tenantId || 'tenant-1';
        const isSingleBranchLocked = Boolean(
          authenticatedUser.storeId &&
          !(Array.isArray(authenticatedUser.allowedStoreIds) && authenticatedUser.allowedStoreIds.length > 1)
        );
        if (isSingleBranchLocked && collection !== 'stores') {
          sanitizedData.storeId = authenticatedUser.storeId;
        } else if (sanitizedData.storeId && !hasUserStoreAccess(authenticatedUser, String(sanitizedData.storeId))) {
          return {
            status: 403,
            error: 'Acesso negado: Perfil restrito a outra filial.',
          };
        }
      }
      if (collection === 'stores' && authenticatedUser.role !== 'DEV_OWNER') {
        delete sanitizedData.subscriptionPlan;
        delete sanitizedData.billingCycle;
        delete sanitizedData.maxAllowedBranches;
        delete sanitizedData.maxAllowedDevices;
        delete sanitizedData.commissionRate;
        delete sanitizedData.saasMonthlyFee;
        delete sanitizedData.saasPaymentMethod;
        delete sanitizedData.saasPaymentStatus;
        delete sanitizedData.saasNextDueDate;
        delete sanitizedData.trialExpiresAt;
        delete sanitizedData.waiterPairingPin;
        delete sanitizedData.waiterPairingPinUpdatedAt;
        delete sanitizedData.pendingUpgradeRequest;
      }

      const candidateDoc = { ...(existingData || {}), ...sanitizedData };
      if (collection === 'coupons' && !isHqAdmin) {
        if (String(candidateDoc.audience || '').toUpperCase() === 'MERCHANT') {
          return {
            status: 403,
            error: 'Acesso negado: Apenas o HQ Central pode criar ou alterar cupons SaaS para lojistas.',
          };
        }
        if (!candidateDoc.storeId) {
          return {
            status: 403,
            error: 'Acesso negado: Lojistas só podem criar ou editar cupons vinculados à própria filial.',
          };
        }
      }
      const domainError = validateGenericDomainPayload(collection, candidateDoc);
      if (domainError) {
        return { status: 400, error: domainError };
      }

      transaction.set(docRef, sanitizedData, { merge: merge ?? true });
      return { status: 200 };
    }, !isHqAdmin && collection !== 'consumers' && authenticatedUser.tenantId ? { tenantId: authenticatedUser.tenantId } : undefined);

    if (txResult.status !== 200) {
      return res.status(txResult.status).json({ error: txResult.error });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gravar documento.' });
  }
});

/**
 * Generic Document Deleter (Multi-tenant & Whitelist & RBAC Enforced - P0-03 & P0-04)
 */
router.delete('/:collection/:id', verifyAutonomousToken, async (req, res) => {
  try {
    const { collection, id } = req.params;
    const authenticatedUser = (req as any).user;

    if (RESTRICTED_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Remoção na coleção '${collection}' via API genérica é proibida.` });
    }

    if (!ALLOWED_GENERIC_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Coleção '${collection}' não autorizada na API genérica.` });
    }

    if (TRANSACTIONAL_ONLY_COLLECTIONS.has(collection)) {
      return res.status(403).json({
        error: `Acesso negado: Remoção direta na coleção '${collection}' via API genérica é proibida.`,
      });
    }

    if (collection === 'events' || collection === 'audit_logs') {
      return res.status(403).json({ error: 'Acesso negado: Eventos de auditoria são imutáveis.' });
    }

    if (!isActionAllowed(authenticatedUser.role, collection, 'delete')) {
      return res.status(403).json({ error: `Acesso negado: O papel '${authenticatedUser.role}' não possui permissão de exclusão ('delete') na coleção '${collection}'.` });
    }

    const docRef = db.collection(collection).doc(id);
    const delResult = await db.runTransaction(async (transaction: any) => {
      const existingSnap = await transaction.get(docRef);
      if (!existingSnap.exists) {
        return { status: 404, error: 'Documento não encontrado.' };
      }

      const existingData = existingSnap.data();
      const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
      if (collection === 'consumers' && !isHqAdmin && id !== authenticatedUser.uid) {
        return { status: 403, error: 'Acesso negado: Não é permitido remover perfil de outro consumidor.' };
      }

      if (authenticatedUser.role !== 'DEV_OWNER') {
        if (existingData?.tenantId !== authenticatedUser.tenantId) {
          return { status: 403, error: 'Acesso negado: Não é permitido remover registros de outra empresa/tenant.' };
        }
        if (!isHqAdmin) {
          if (collection === 'stores') {
            if (!hasUserStoreAccess(authenticatedUser, id)) {
              return { status: 403, error: 'Acesso negado: Registro pertence a outra filial.' };
            }
          } else {
            if (!existingData?.storeId || (collection === 'coupons' && existingData?.audience === 'MERCHANT')) {
              return {
                status: 403,
                error: 'Acesso negado: Apenas o HQ Central pode remover registros globais ou cupons SaaS.',
              };
            }
            if (!hasUserStoreAccess(authenticatedUser, existingData.storeId)) {
              return { status: 403, error: 'Acesso negado: Registro pertence a outra filial.' };
            }
          }
        }
      }

      transaction.delete(docRef);
      return { status: 200 };
    }, authenticatedUser.role !== 'DEV_OWNER' && authenticatedUser.role !== 'SUPER_ADMIN' && collection !== 'consumers' && authenticatedUser.tenantId ? { tenantId: authenticatedUser.tenantId } : undefined);

    if (delResult.status !== 200) {
      return res.status(delResult.status).json({ error: delResult.error });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar documento.' });
  }
});

/**
 * Generic Collection Querier (Multi-tenant & Whitelist & RBAC Enforced - P0-03 & P0-04)
 */
router.get('/:collection', verifyAutonomousToken, async (req, res) => {
  try {
    const { collection } = req.params;
    const filter = req.query;
    const authenticatedUser = (req as any).user;

    if (RESTRICTED_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Leitura da coleção '${collection}' exige rotas administrativas dedicadas.` });
    }

    if (!ALLOWED_GENERIC_COLLECTIONS.includes(collection)) {
      return res.status(403).json({ error: `Acesso negado: Coleção '${collection}' não autorizada na API genérica.` });
    }

    if (!isActionAllowed(authenticatedUser.role, collection, 'read')) {
      return res.status(403).json({ error: `Acesso negado: O papel '${authenticatedUser.role}' não possui permissão de leitura ('read') na coleção '${collection}'.` });
    }

    const isHqAdmin = authenticatedUser.role === 'DEV_OWNER' || authenticatedUser.role === 'SUPER_ADMIN';
    const isConsumer = authenticatedUser.role === 'CUSTOMER' || authenticatedUser.role === 'CONSUMER';
    const isConsumerCrossTenantList =
      isConsumer && (collection === 'stores' || collection === 'menu_items' || collection === 'coupons' || collection === 'orders');

    const pagination = parsePaginationParams(filter as Record<string, any>, { maxLimit: 1000 });
    const requestedStoreId = typeof filter.storeId === 'string' && filter.storeId.trim() ? filter.storeId.trim() : undefined;
    const pushdownFilter: { tenantId?: string; storeId?: string } = {};
    if (!isHqAdmin && !isConsumerCrossTenantList && collection !== 'consumers' && authenticatedUser.tenantId) {
      pushdownFilter.tenantId = authenticatedUser.tenantId;
    }
    if (requestedStoreId && collection !== 'stores' && collection !== 'consumers') {
      pushdownFilter.storeId = requestedStoreId;
    }

    const fetchCollection = () =>
      pushdownFilter.tenantId || pushdownFilter.storeId
        ? db.collection(collection).query(pushdownFilter)
        : db.collection(collection).get();

    const snapshot = isConsumerCrossTenantList
      ? await runWithSystemDbContext('GENERIC_CONSUMER_COLL_GET', fetchCollection)
      : await fetchCollection();
    let docs = snapshot.docs.map(d => d.data()).filter((item: any) => item && !item._deleted);
    if (collection === 'consumers') {
      if (!isHqAdmin) {
        docs = docs.filter((item: any) => item.id === authenticatedUser.uid || item.uid === authenticatedUser.uid);
      }
    } else if (isConsumer && collection === 'orders') {
      docs = docs.filter((item: any) => item.customerId === authenticatedUser.uid);
    } else if (isConsumer && (collection === 'stores' || collection === 'menu_items' || collection === 'coupons')) {
      const { suspendedTenants, activeStoreIds } = await getActiveCatalogContext();
      docs = docs.filter((item: any) => !item?._deleted);
      if (collection === 'stores') {
        docs = docs.filter((item: any) => activeStoreIds.has(item.id));
      } else if (collection === 'menu_items') {
        docs = docs.filter((item: any) => {
          if (item?.tenantId && suspendedTenants.has(item.tenantId)) return false;
          if (item?.storeId && !activeStoreIds.has(item.storeId)) return false;
          return true;
        });
      } else if (collection === 'coupons') {
        const nowMs = Date.now();
        docs = docs.filter((item: any) => {
          if (item?.audience === 'MERCHANT') return false;
          if (item.isActive === false) return false;
          const valDate = item?.validUntil || item?.expiresAt;
          if (valDate && new Date(valDate).getTime() < nowMs) return false;
          if (item?.tenantId && suspendedTenants.has(item.tenantId)) return false;
          if (item?.storeId && !activeStoreIds.has(item.storeId)) return false;
          return true;
        });
      }
    } else if (!isHqAdmin) {
      const userTenant = authenticatedUser.tenantId || 'tenant-1';
      docs = docs.filter((item: any) => item.tenantId === userTenant);
      if (collection !== 'stores') {
        docs = docs.filter((item: any) => !item.storeId || hasUserStoreAccess(authenticatedUser, item.storeId));
      }
    }

    docs = docs.map((item: any) => sanitizeReadDocument(collection, item, isConsumer));

    const filterEntries = Object.entries(filter).filter(
      ([k]) => !FORBIDDEN_PROTO_KEYS.has(k) && !RESERVED_PAGINATION_QUERY_KEYS.has(k)
    );
    if (filterEntries.length > 0) {
      docs = docs.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        for (const [k, v] of filterEntries) {
          if (v !== undefined) {
            if (!Object.prototype.hasOwnProperty.call(item, k) || String(item[k]) !== String(v)) {
              return false;
            }
          }
        }
        return true;
      });
    }

    const pageResult = applyPaginationAndHeaders(
      res,
      docs,
      pagination,
      (item: any) => String(item?.id || item?.uid || '')
    );

    res.json(pagination.envelope ? pageResult : pageResult.items);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar coleção.' });
  }
});

export default router;
