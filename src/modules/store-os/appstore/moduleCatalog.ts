import {
  Barcode,
  Calendar,
  ChefHat,
  DollarSign,
  FileText,
  Gift,
  Laptop,
  MessageSquare,
  Package,
  Scissors,
  ShoppingCart,
  Sparkles,
  Truck,
  Users,
  Utensils,
} from 'lucide-react';
import { StoreOperationalSettings } from '../../../types';

export type ModuleCategoryGroup = 'ALL' | 'SALES' | 'OPERATIONS' | 'MANAGEMENT' | 'MARKETING';

export interface AppStoreModule {
  id: string;
  name: string;
  category: string;
  group: Exclude<ModuleCategoryGroup, 'ALL'>;
  kind: 'APP_MODULE' | 'OPERATIONAL_FLAG';
  operationalKey?: keyof StoreOperationalSettings;
  description: string;
  icon: any;
  isEnabled: boolean;
  priceTag: string;
}

export const CATEGORY_TABS: Array<{ id: ModuleCategoryGroup; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'SALES', label: 'Vendas & Balcão' },
  { id: 'OPERATIONS', label: 'Operação & Salão' },
  { id: 'MANAGEMENT', label: 'Gestão & Financeiro' },
  { id: 'MARKETING', label: 'Marketing & Logística' },
];

export const buildModulesList = (
  enabledIds: string[],
  opSettings?: StoreOperationalSettings
): AppStoreModule[] => [
  {
    id: 'pdv',
    name: 'Frente de Caixa (PDV Balcão)',
    category: 'Vendas & Balcão',
    group: 'SALES',
    kind: 'APP_MODULE',
    description:
      'Caixa rápido com grid visual de produtos, ideal para gastronomia, padarias e lanchonetes.',
    icon: ShoppingCart,
    isEnabled: enabledIds.includes('pdv'),
    priceTag: 'App Desktop',
  },
  {
    id: 'pdv-retail',
    name: 'PDV Gôndola (Varejo Avançado)',
    category: 'Vendas & Balcão',
    group: 'SALES',
    kind: 'APP_MODULE',
    description:
      'Frente de caixa focado em código de barras, SKU e lista densa para mercados e varejo.',
    icon: Barcode,
    isEnabled: enabledIds.includes('pdv-retail'),
    priceTag: 'App Desktop',
  },
  {
    id: 'pdv-service',
    name: 'PDV Serviços & Agendamento',
    category: 'Vendas & Balcão',
    group: 'SALES',
    kind: 'APP_MODULE',
    description:
      'PDV para salões, clínicas e barbearias com seleção de profissional e check-in.',
    icon: Scissors,
    isEnabled: enabledIds.includes('pdv-service'),
    priceTag: 'App Desktop',
  },
  {
    id: 'kiosk',
    name: 'Totem de Autoatendimento (Kiosk)',
    category: 'Vendas & Balcão',
    group: 'SALES',
    kind: 'APP_MODULE',
    operationalKey: 'kioskSelfService',
    description:
      'Modo touch de autoatendimento para o cliente pedir e pagar direto no balcão.',
    icon: Laptop,
    isEnabled: enabledIds.includes('kiosk') || Boolean(opSettings?.kioskSelfService),
    priceTag: 'App + Flag',
  },
  {
    id: 'kds',
    name: 'Monitor de Cozinha (KDS)',
    category: 'Operação & Salão',
    group: 'OPERATIONS',
    kind: 'APP_MODULE',
    description:
      'Fila de preparo em tempo real para cozinha com resumo All-Day e alertas de atraso.',
    icon: ChefHat,
    isEnabled: enabledIds.includes('kds'),
    priceTag: 'App Desktop',
  },
  {
    id: 'tables',
    name: 'Gestão de Mesas & Salão',
    category: 'Operação & Salão',
    group: 'OPERATIONS',
    kind: 'APP_MODULE',
    description:
      'Mapa de mesas, QR Codes de comanda, fechamento de conta com divisão e pareamento do Garçom.',
    icon: Utensils,
    isEnabled: enabledIds.includes('tables'),
    priceTag: 'App Desktop',
  },
  {
    id: 'appointments',
    name: 'Reservas & Agendamentos',
    category: 'Operação & Salão',
    group: 'OPERATIONS',
    kind: 'APP_MODULE',
    description:
      'Gestão de horários reservados para mesas, salões, clínicas e prestadores de serviços.',
    icon: Calendar,
    isEnabled: enabledIds.includes('appointments'),
    priceTag: 'App Desktop',
  },
  {
    id: 'inventory',
    name: 'Estoque por Lotes & Fornecedores',
    category: 'Gestão & Financeiro',
    group: 'MANAGEMENT',
    kind: 'APP_MODULE',
    description:
      'Controle de insumos, lotes, alerta de estoque mínimo, ficha técnica e fornecedores.',
    icon: Package,
    isEnabled: enabledIds.includes('inventory'),
    priceTag: 'App Desktop',
  },
  {
    id: 'shared-inventory',
    name: 'Estoque Hub Central (Multi-Marca)',
    category: 'Gestão & Financeiro',
    group: 'MANAGEMENT',
    kind: 'APP_MODULE',
    operationalKey: 'sharedWarehouseMode',
    description:
      'Compartilhe o mesmo estoque físico entre múltiplas marcas ou unidades da rede.',
    icon: Package,
    isEnabled: enabledIds.includes('shared-inventory') || Boolean(opSettings?.sharedWarehouseMode),
    priceTag: 'App + Flag',
  },
  {
    id: 'finance',
    name: 'Financeiro, Caixa & Relatório Z',
    category: 'Gestão & Financeiro',
    group: 'MANAGEMENT',
    kind: 'APP_MODULE',
    description:
      'Abertura/fechamento de turno com conferência, sangrias, suprimentos e contas a pagar/receber.',
    icon: DollarSign,
    isEnabled: enabledIds.includes('finance'),
    priceTag: 'App Desktop',
  },
  {
    id: 'fiscal',
    name: 'Emissão Fiscal NFC-e Automática',
    category: 'Gestão & Financeiro',
    group: 'MANAGEMENT',
    kind: 'OPERATIONAL_FLAG',
    operationalKey: 'autoNfce',
    description:
      'Ativa emissão automática de comprovante fiscal NFC-e a cada venda finalizada no PDV.',
    icon: FileText,
    isEnabled: Boolean(opSettings?.autoNfce),
    priceTag: 'Recurso Operacional',
  },
  {
    id: 'crm',
    name: 'CRM & Base de Clientes',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'APP_MODULE',
    description:
      'Histórico de pedidos por cliente, cupons promocionais e segmentação de recorrência.',
    icon: Users,
    isEnabled: enabledIds.includes('crm'),
    priceTag: 'App Desktop',
  },
  {
    id: 'whatsapp-marketing',
    name: 'WhatsApp Marketing & Gatilhos',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'APP_MODULE',
    description:
      'Campanhas e notificações de status de pedido via wa.me zero-custo ou conector API/Webhook.',
    icon: MessageSquare,
    isEnabled: enabledIds.includes('whatsapp-marketing'),
    priceTag: 'App Desktop',
  },
  {
    id: 'cashback',
    name: 'Programa de Fidelidade & Cashback',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'APP_MODULE',
    description:
      'Configure percentual de cashback e valor mínimo de pedido para estimular recompra.',
    icon: Gift,
    isEnabled: enabledIds.includes('cashback'),
    priceTag: 'App Desktop',
  },
  {
    id: 'drivers',
    name: 'Frota & Monitor Logístico',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'APP_MODULE',
    description:
      'Despacho de entregadores, pareamento de frota própria e acompanhamento de entregas.',
    icon: Truck,
    isEnabled: enabledIds.includes('drivers'),
    priceTag: 'App Desktop',
  },
  {
    id: 'shared-fleets',
    name: 'Pool de Frota Compartilhada',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'OPERATIONAL_FLAG',
    operationalKey: 'sharedNeighborhoodFleet',
    description:
      'Permite que entregadores da rede atendam pedidos da sua loja em horários de pico.',
    icon: Users,
    isEnabled: Boolean(opSettings?.sharedNeighborhoodFleet),
    priceTag: 'Recurso Operacional',
  },
  {
    id: 'ai-assistant',
    name: 'Assistente de Catálogo',
    category: 'Marketing & Logística',
    group: 'MARKETING',
    kind: 'OPERATIONAL_FLAG',
    operationalKey: 'aiMenuAssistantEnabled',
    description:
      'Habilita sugestões assistidas de descrições e apoio na organização do catálogo.',
    icon: Sparkles,
    isEnabled: Boolean(opSettings?.aiMenuAssistantEnabled),
    priceTag: 'Recurso Operacional',
  },
];
