import { CreditCard, FileText, Landmark, Link2, QrCode } from 'lucide-react';
import { SaasPspProvider } from '../../../../types';

export const PSP_PROVIDER_OPTIONS: { id: SaasPspProvider; label: string; hint: string }[] = [
  {
    id: 'DIRECT_PIX',
    label: 'PIX Direto / Recebimento Próprio',
    hint: 'QR Code EMV-Co + conta bancária própria com baixa manual ou webhook.',
  },
  {
    id: 'ASAAS',
    label: 'Asaas (PIX / Boleto / Cartão / Link)',
    hint: 'Cobrança recorrente completa + webhook HMAC.',
  },
  {
    id: 'MERCADO_PAGO',
    label: 'Mercado Pago',
    hint: 'Checkout recorrente + carteiras digitais + notificações assinadas.',
  },
  {
    id: 'STRIPE',
    label: 'Stripe Billing',
    hint: 'Assinaturas com cartão nacional e internacional.',
  },
  {
    id: 'PAGARME',
    label: 'Pagar.me / Stone',
    hint: 'Gateway brasileiro completo para SaaS.',
  },
  {
    id: 'CUSTOM',
    label: 'Gateway Customizado / ERP',
    hint: 'Integração via webhook assinado do Server Core.',
  },
];

export const PAYMENT_METHOD_CARDS = [
  {
    key: 'pixEnabled' as const,
    title: 'PIX Instantâneo (EMV-Co)',
    desc: 'QR Code e Copia e Cola com a chave oficial da plataforma.',
    icon: QrCode,
  },
  {
    key: 'creditCardEnabled' as const,
    title: 'Cartão de Crédito',
    desc: 'Assinatura recorrente ou parcelada no checkout configurado.',
    icon: CreditCard,
  },
  {
    key: 'debitCardEnabled' as const,
    title: 'Cartão de Débito',
    desc: 'Pagamento à vista no débito online pelo portal PSP.',
    icon: CreditCard,
  },
  {
    key: 'boletoEnabled' as const,
    title: 'Boleto Bancário',
    desc: 'Emissão de boleto/fatura corporativa para empresas.',
    icon: FileText,
  },
  {
    key: 'bankTransferEnabled' as const,
    title: 'Transferência (TED / DOC)',
    desc: 'Exibe dados bancários oficiais (banco, agência e conta) ao lojista.',
    icon: Landmark,
  },
  {
    key: 'paymentLinkEnabled' as const,
    title: 'Link de Pagamento / Carteiras',
    desc: 'Portal externo (Asaas, Mercado Pago, PagBank, PicPay, Stripe).',
    icon: Link2,
  },
];
