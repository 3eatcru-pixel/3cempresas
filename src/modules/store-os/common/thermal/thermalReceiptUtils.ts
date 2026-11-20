import { Store } from '../../../../types';

interface OrderData {
  code: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    variantLabel?: string;
    serialNumber?: string;
  }[];
  subtotal: number;
  deliveryFee?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  createdAt?: string;
  notes?: string;
  tableNumber?: number;
  scheduledDeliveryDate?: string;
  scheduledDeliveryPeriod?: string;
  assemblyRequired?: boolean;
}

export const generateWhatsAppReceiptText = (
  order: OrderData,
  store: Store,
  orderDate: string,
  pixKey: string
): string => {
  const lines = [
    `🧾 *COMPROVANTE DE PEDIDO*`,
    `*${store.name.toUpperCase()}*`,
    `Pedido: *${order.code}*`,
    `Data: ${orderDate}`,
    `Cliente: ${order.customerName}`,
    order.deliveryAddress
      ? `Endereço: ${order.deliveryAddress}`
      : order.tableNumber
      ? `Mesa: #${order.tableNumber}`
      : `Balcão`,
    order.scheduledDeliveryDate
      ? `Entrega Agendada: ${order.scheduledDeliveryDate} (${order.scheduledDeliveryPeriod || 'TARDE'})${order.assemblyRequired ? ' + Montagem' : ''}`
      : null,
    `--------------------------------`,
    `*ITENS:*`,
    ...order.items.map(
      (i) =>
        `• ${i.quantity}x ${i.name} - R$ ${(i.price * i.quantity).toFixed(2)}${
          i.variantLabel ? ` [${i.variantLabel}]` : ''
        }${i.serialNumber ? ` | S/N: ${i.serialNumber}` : ''}${
          i.notes ? ` (${i.notes})` : ''
        }`
    ),
    `--------------------------------`,
    `Subtotal: R$ ${order.subtotal.toFixed(2)}`,
    order.deliveryFee ? `Taxa Entrega: R$ ${order.deliveryFee.toFixed(2)}` : null,
    order.discount ? `Desconto: -R$ ${order.discount.toFixed(2)}` : null,
    `*TOTAL: R$ ${order.total.toFixed(2)}*`,
    `Pagamento: ${order.paymentMethod}`,
    `Chave PIX da loja: ${pixKey}`,
    `--------------------------------`,
    `Agradecemos a preferência! 💛`,
  ].filter(Boolean);

  return encodeURIComponent(lines.join('\n'));
};
