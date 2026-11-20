import React from 'react';
import { Order } from '../../types';

interface ConsumerReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

export const ConsumerReceiptModal: React.FC<ConsumerReceiptModalProps> = ({ order, onClose }) => {
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn">
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-black text-white text-base">Comprovante {order.code}</h3>
            <div className="text-xs text-slate-400">{order.storeName}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-2 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            {order.items.map(item => (
              <div key={item.id} className="flex justify-between text-slate-300">
                <span>{item.quantity}x {item.name}</span>
                <span>R$ {(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-slate-400 pt-2 border-t border-slate-800">
            <div className="flex justify-between"><span>Subtotal:</span><span>R$ {order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Entrega:</span><span>R$ {order.deliveryFee.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-white text-sm pt-1 border-t border-slate-800">
              <span>Total Pago:</span>
              <span className="text-emerald-400 font-mono">R$ {order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
