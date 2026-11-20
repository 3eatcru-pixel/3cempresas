import React from 'react';
import {
  ShieldCheck,
  Store,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  Server,
} from 'lucide-react';
import { PILLAR_THEMES } from '@3c/design-system';
import type { BrandLogoId } from '@3c/design-system';
import { AuthModalContextId } from '../../../context/AuthContext';
import { EcosystemSessionRole } from '../../../types';

export interface AuthContextMeta {
  brandId: BrandLogoId;
  title: string;
  subtitle: string;
  theme: (typeof PILLAR_THEMES)[keyof typeof PILLAR_THEMES];
  allowSignup: boolean;
  lockedSignupRole?: EcosystemSessionRole;
  signupLabel?: string;
  loginPlaceholder: string;
  provisioningNote?: string;
}

export const AUTH_CONTEXT_META: Record<AuthModalContextId, AuthContextMeta> = {
  'store-os': {
    brandId: 'store-os',
    title: 'Store OS · Lojista e Equipe Comercial',
    subtitle: 'Painel da Loja, PDV, KDS, Estoque e Financeiro',
    theme: PILLAR_THEMES['store-os'],
    allowSignup: true,
    lockedSignupRole: 'STORE_OWNER',
    signupLabel: 'Criar Loja (7 dias grátis)',
    loginPlaceholder: 'lojista@empresa.com',
  },
  marketplace: {
    brandId: 'marketplace',
    title: '3C Marketplace · Área do Consumidor',
    subtitle: 'Pedidos, endereços salvos e compras online',
    theme: PILLAR_THEMES.marketplace,
    allowSignup: true,
    lockedSignupRole: 'CUSTOMER',
    signupLabel: 'Criar Conta de Consumidor',
    loginPlaceholder: 'consumidor@email.com',
  },
  driver: {
    brandId: 'driver',
    title: '3C Driver · Aplicativo do Entregador',
    subtitle: 'Rotas, despachos e acompanhamento de entregas',
    theme: PILLAR_THEMES.driver,
    allowSignup: false,
    loginPlaceholder: 'entregador@empresa.com',
    provisioningNote:
      'Contas de entregador são habilitadas pelo Lojista ou pela administração logística 3C.',
  },
  waiter: {
    brandId: 'waiter',
    title: '3C Waiter · Terminal do Garçom',
    subtitle: 'Atendimento de mesas, comandas e salão',
    theme: PILLAR_THEMES.waiter,
    allowSignup: false,
    loginPlaceholder: 'garcom@sualoja.com',
    provisioningNote:
      'Sem conta pessoal? Conecte com o PIN da mesa ou o Pareamento de PDQ da loja sem necessidade de e-mail.',
  },
  hq: {
    brandId: 'hq',
    title: 'HQ Central · Governança da Plataforma',
    subtitle: 'Acesso do Dono da Plataforma e Governança Master',
    theme: PILLAR_THEMES.hq,
    allowSignup: false,
    loginPlaceholder: '3eatcru@gmail.com',
    provisioningNote:
      'Acesso administrativo restrito à governança global do ecossistema. O HQ Central governa planos, integrações e a plataforma.',
  },
  'server-core': {
    brandId: 'server-core',
    title: 'Server Core · Console de Infraestrutura',
    subtitle: 'Kernel REST e backbone do ecossistema',
    theme: PILLAR_THEMES['server-core'],
    allowSignup: false,
    loginPlaceholder: '3eatcru@gmail.com',
    provisioningNote:
      'Acesso exclusivo do Dev Owner da plataforma.',
  },
  portal: {
    brandId: 'portal',
    title: '3C Corp · Autenticação',
    subtitle: 'Escolha o tipo de acesso para entrar ou cadastrar',
    theme: PILLAR_THEMES['store-os'],
    allowSignup: true,
    signupLabel: 'Criar Conta',
    loginPlaceholder: 'exemplo@empresa.com',
  },
};

