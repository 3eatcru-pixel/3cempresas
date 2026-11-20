import React, { useMemo } from 'react';
import { Store } from '../../../../types';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';
import { generateEmvCoPixPayload } from '../../../../utils/pix';

interface ThermalPaperPreviewProps {
  order: {
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
  };
  store: Store;
  paperWidth: '80mm' | '58mm';
  orderDate: string;
  pixKey: string;
}

export const ThermalPaperPreview: React.FC<ThermalPaperPreviewProps> = ({
  order,
  store,
  paperWidth,
  orderDate,
  pixKey,
}) => {
  const pixPayload = useMemo(
    () =>
      generateEmvCoPixPayload({
        pixKey,
        amount: order.total,
        merchantName: store.name,
        txid: order.code,
        description: `Pedido ${order.code}`,
      }),
    [pixKey, order.total, store.name, order.code]
  );

  const authChecksum = useMemo(() => pixPayload.slice(-8).toUpperCase(), [pixPayload]);

  return (
    <div
      id="thermal-slip-area"
      style={{ width: paperWidth === '80mm' ? '300px' : '230px' }}
      className="bg-[#fafaf8] text-slate-900 p-4 rounded shadow-2xl font-mono text-[11px] leading-tight select-text border border-slate-200 transition-all"
    >
      {/* Store Header */}
      <div className="text-center space-y-1 pb-2 border-b border-dashed border-slate-400">
        <div className="font-extrabold text-sm uppercase tracking-tight text-black">
          {store.name}
        </div>
        <div className="text-[9px] text-slate-600">
          {store.address || (store.city ? `${store.city}${store.state ? ` - ${store.state}` : ''}` : 'Endereço não configurado')}
        </div>
        <div className="text-[9px] text-slate-600">Tel: {store.phone || 'Não informado'}</div>
        <div className="text-[8px] text-slate-500 uppercase">
          {store.operationalSettings?.autoNfce
            ? 'DOCUMENTO AUXILIAR NFC-e'
            : 'EXTRATO NÃO FISCAL DE VENDA'}
        </div>
      </div>

      {/* Order Details */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
        <div className="flex justify-between font-bold">
          <span>PEDIDO: {order.code}</span>
          <span>{orderDate.split(' ')[1] || ''}</span>
        </div>
        <div>DATA: {orderDate.split(' ')[0] || ''}</div>
        <div className="truncate">CLIENTE: {order.customerName}</div>
        {order.tableNumber && <div className="font-bold text-black">MESA: #{order.tableNumber}</div>}
        {order.deliveryAddress && (
          <div className="text-[9px] text-slate-700 leading-snug">
            ENTREGA: {order.deliveryAddress}
          </div>
        )}
        {order.scheduledDeliveryDate && (
          <div className="text-[9px] font-bold text-black leading-snug">
            AGENDAMENTO: {order.scheduledDeliveryDate} ({order.scheduledDeliveryPeriod || 'TARDE'})
            {order.assemblyRequired ? ' • C/ MONTAGEM' : ''}
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1.5">
        <div className="flex justify-between font-bold text-[9px] text-slate-600 uppercase border-b border-slate-300 pb-0.5">
          <span>QTD ITEM</span>
          <span>TOTAL</span>
        </div>
        {order.items.map((it, idx) => (
          <div key={idx} className="space-y-0.5">
            <div className="flex justify-between items-start gap-1">
              <span className="font-semibold leading-tight">
                {it.quantity}x {it.name}
              </span>
              <span className="font-bold shrink-0">
                R$ {(it.price * it.quantity).toFixed(2)}
              </span>
            </div>
            {it.variantLabel && (
              <div className="text-[9px] text-slate-700 pl-3">Variação: {it.variantLabel}</div>
            )}
            {it.serialNumber && (
              <div className="text-[9px] font-bold text-black pl-3">S/N ou IMEI: {it.serialNumber}</div>
            )}
            {it.notes && <div className="text-[9px] text-slate-600 italic pl-3">* {it.notes}</div>}
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[10px]">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>R$ {order.subtotal.toFixed(2)}</span>
        </div>
        {order.deliveryFee ? (
          <div className="flex justify-between">
            <span>Taxa de Entrega:</span>
            <span>R$ {order.deliveryFee.toFixed(2)}</span>
          </div>
        ) : null}
        {order.discount ? (
          <div className="flex justify-between text-slate-600">
            <span>Desconto:</span>
            <span>-R$ {order.discount.toFixed(2)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-black text-xs text-black border-t border-slate-400 pt-1">
          <span>TOTAL A PAGAR:</span>
          <span>R$ {order.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Payment & Fiscal Info */}
      <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[9px]">
        <div className="flex justify-between">
          <span>FORMA PGTO:</span>
          <span className="font-bold">{order.paymentMethod}</span>
        </div>
        <div>CHAVE PIX: {pixKey}</div>
      </div>

      {/* Scannable Offline PIX BR Code QR */}
      <div className="pt-3 text-center space-y-2">
        <div className="mx-auto w-24 h-24 border border-slate-300 bg-white p-1 flex items-center justify-center">
          <LocalQrCode
            value={pixPayload}
            size={88}
            darkColor="#000000"
            lightColor="#ffffff"
            alt={`PIX QR Code Pedido ${order.code}`}
          />
        </div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest">
          PIX EMVCo CRC: {authChecksum}
        </div>
        <div className="text-[9px] font-bold text-black uppercase">
          Obrigado pela preferência!
        </div>
      </div>
    </div>
  );
};
