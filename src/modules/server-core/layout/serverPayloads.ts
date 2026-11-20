import { RestEndpointSpec } from '../../../types';

export const DEV_CONSOLE_ENDPOINTS: RestEndpointSpec[] = [
  { method: 'GET', path: '/api/v1/health', description: 'Saúde do cluster, uptime real e persistence driver', latencyMs: 4, authRequired: false },
  { method: 'GET', path: '/api/v1/system/contracts', description: 'Contrato de domínio, estados de pedido e apps', latencyMs: 3, authRequired: false },
  { method: 'GET', path: '/api/v1/system/releases', description: 'Manifesto do Release Manager v5.2.1', latencyMs: 3, authRequired: false },
  { method: 'GET', path: '/api/v1/sync/status', description: 'Estado do Sync Engine, capabilities e HLC clock', latencyMs: 5, authRequired: true },
  { method: 'GET', path: '/api/v1/sync/edge/nodes', description: 'Lista nós Edge LAN registrados por loja', latencyMs: 6, authRequired: true },
  { method: 'GET', path: '/api/v1/sync/pull?limit=15', description: 'Delta do Sync Outbox desde HLC', latencyMs: 7, authRequired: true },
  { method: 'GET', path: '/api/v1/admin/backup', description: 'Snapshot JSON integral do Server Core (DEV_OWNER)', latencyMs: 12, authRequired: true },
  { method: 'GET', path: '/api/v1/maps/ibge/states', description: 'Lista oficial IBGE dos estados do Brasil (BR)', latencyMs: 18, authRequired: false },
  { method: 'GET', path: '/api/v1/maps/city-directory?uf=PR&city=Londrina&street=Higienopolis&number=1200', description: 'Diretório territorial (Estado, Cidade, Região, Bairro, Rua, Número, CEP)', latencyMs: 85, authRequired: false },
  { method: 'POST', path: '/api/v1/admin/billing/reconcile', description: 'Reconciliação real de vencimentos e faturas SaaS', latencyMs: 14, authRequired: true },
  { method: 'POST', path: '/api/v1/commerce/orders', description: 'Commit ACID de pedido no CommerceEngine', latencyMs: 18, authRequired: true },
];

export const DEFAULT_SERVER_PAYLOADS: Record<string, string> = {
  '/api/v1/health': '{}',
  '/api/v1/system/contracts': '{}',
  '/api/v1/system/releases': '{}',
  '/api/v1/sync/status': '{}',
  '/api/v1/sync/edge/nodes': '{}',
  '/api/v1/sync/pull?limit=15': '{}',
  '/api/v1/admin/backup': '{}',
  '/api/v1/admin/billing/reconcile': '{}',
  '/api/v1/commerce/orders': JSON.stringify({
    storeId: "store-1",
    customerName: "Mariana Silva",
    channel: "POS",
    deliveryModality: "PICKUP",
    deliveryAddress: "Balcão / Retirada Local",
    paymentMethod: "PIX",
    items: [
      { menuItemId: "item-101", name: "Smash Trufado Single", quantity: 1, price: 32.90 }
    ]
  }, null, 2),
  '/api/v1/store/payment-gateway-config': JSON.stringify({
    storeId: "store-1",
    pixKey: "financeiro@burgerlab.com.br",
    pixKeyType: "CNPJ",
    gatewayProvider: "MERCADO_PAGO_DIRECT",
    autoTransfer: true
  }, null, 2),
  '/api/v1/store/fiscal/emit': JSON.stringify({
    storeId: "store-1",
    nfeId: "nfe-4421",
    amount: 79.70,
    itemsCount: 3
  }, null, 2),
};
