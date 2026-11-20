import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { FinancialRecord } from '../../../../types';

interface FinanceNewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  tenantId?: string;
  onCreateRecord: (record: Omit<FinancialRecord, 'id'>) => Promise<void>;
}

const DEFAULT_CATEGORIES: Record<'PAYABLE' | 'RECEIVABLE', string[]> = {
  PAYABLE: ['FORNECEDOR', 'ALUGUEL', 'ENERGIA / AGUA', 'FOLHA / EQUIPE', 'IMPOSTOS', 'OUTROS'],
  RECEIVABLE: ['VENDAS AVULSAS', 'EVENTO / CATERING', 'REEMBOLSO', 'OUTRAS RECEITAS'],
};

export const FinanceNewRecordModal: React.FC<FinanceNewRecordModalProps> = ({
  isOpen,
  onClose,
  storeId,
  tenantId,
  onCreateRecord,
}) => {
  const [type, setType] = useState<'PAYABLE' | 'RECEIVABLE'>('PAYABLE');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('FORNECEDOR');
  const [entityName, setEntityName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<'PENDING' | 'PAID'>('PENDING');
  const [paymentMethod, setPaymentMethod] = useState('PIX');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSwitchType = (nextType: 'PAYABLE' | 'RECEIVABLE') => {
    setType(nextType);
    setCategory(DEFAULT_CATEGORIES[nextType][0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number.parseFloat(amount.replace(',', '.'));
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    setSubmitting(true);
    try {
      await onCreateRecord({
        storeId,
        tenantId,
        type,
        description: description.trim(),
        category,
        entityName: entityName.trim() || (type === 'PAYABLE' ? 'Fornecedor' : 'Cliente'),
        amount: Math.round(numericAmount * 100) / 100,
        dueDate,
        status,
        paymentMethod,
        createdAt: new Date().toISOString(),
      });
      setDescription('');
      setEntityName('');
      setAmount('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PlusCircle className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-tight">
              Novo Lançamento (Contas a Pagar / Receber)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSwitchType('PAYABLE')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                type === 'PAYABLE'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Conta a Pagar (Saída)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchType('RECEIVABLE')}
              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                type === 'RECEIVABLE'
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Conta a Receber (Entrada)
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Descrição</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'PAYABLE' ? 'Ex: Compra de insumos - Distribuidora' : 'Ex: Evento corporativo 30 pessoas'}
              className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs text-white outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                {DEFAULT_CATEGORIES[type].map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">
                {type === 'PAYABLE' ? 'Fornecedor / Favorecido' : 'Cliente / Pagador'}
              </label>
              <input
                type="text"
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                placeholder="Nome da contraparte"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Valor (R$)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Vencimento</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-slate-400">Situação</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'PENDING' | 'PAID')}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="PENDING">Em Aberto</option>
                <option value="PAID">Já Quitado</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Meio de Liquidação</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
            >
              <option value="PIX">PIX</option>
              <option value="BANK_TRANSFER">Transferência / TED</option>
              <option value="BOLETO">Boleto Bancário</option>
              <option value="CASH">Dinheiro</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="DEBIT_CARD">Cartão de Débito</option>
            </select>
          </div>
        </div>

        <div className="px-5 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            {submitting ? 'Salvando...' : 'Registrar Título'}
          </button>
        </div>
      </form>
    </div>
  );
};
