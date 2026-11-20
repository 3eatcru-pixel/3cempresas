import React from 'react';
import { Smartphone, CheckCircle2, KeyRound, Server, ClipboardPaste } from 'lucide-react';
import { Store } from '../../../types';

interface WaiterPinClientFormProps {
  currentStore: Store;
  waiterNameInput: string;
  setWaiterNameInput: (val: string) => void;
  manualCode: string;
  setManualCode: (val: string) => void;
  edgeLanUrl: string;
  setEdgeLanUrl: (val: string) => void;
  pairError: string | null;
  verifying: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

const formatPinDigits = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 6);
  if (digits.length > 3) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return digits;
};

export const WaiterPinClientForm: React.FC<WaiterPinClientFormProps> = ({
  currentStore,
  waiterNameInput,
  setWaiterNameInput,
  manualCode,
  setManualCode,
  edgeLanUrl,
  setEdgeLanUrl,
  pairError,
  verifying,
  onSubmit,
}) => {
  const handlePasteQrClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        const parsed = JSON.parse(trimmed);
        if (parsed?.pin) {
          setManualCode(formatPinDigits(String(parsed.pin)));
        }
        if (typeof parsed?.edgeBaseUrl === 'string' && parsed.edgeBaseUrl.trim()) {
          setEdgeLanUrl(parsed.edgeBaseUrl.trim());
        }
      } else {
        setManualCode(formatPinDigits(trimmed));
      }
    } catch {
      // Clipboard read permission denied or invalid JSON
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
          <Smartphone className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-white tracking-tight">Conectar Smartphone ao Salão</h3>
        <p className="text-xs text-slate-400">
          Digite o PIN de 6 dígitos exibido na tela do caixa ({currentStore.name}).
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-slate-300">Seu Nome / Identificação</label>
          <input
            type="text"
            required
            value={waiterNameInput}
            onChange={(e) => setWaiterNameInput(e.target.value)}
            placeholder="Ex: Garçom Carlos"
            className="w-full mt-1 bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">Código PIN de 6 dígitos</label>
            <button
              type="button"
              onClick={handlePasteQrClipboard}
              className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <ClipboardPaste className="w-3 h-3" /> Colar QR / PIN Copiado
            </button>
          </div>
          <div className="relative mt-1">
            <input
              type="text"
              required
              maxLength={7}
              placeholder="000-000"
              value={manualCode}
              onChange={(e) => setManualCode(formatPinDigits(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 text-sm font-mono font-bold text-amber-400 p-3 rounded-xl focus:outline-none focus:border-amber-500 tracking-wider text-center"
            />
            <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-3.5" />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" /> Endpoint 3C Edge Node LAN (opcional)
          </label>
          <input
            type="url"
            placeholder="http://192.168.1.50:3300"
            value={edgeLanUrl}
            onChange={(e) => setEdgeLanUrl(e.target.value)}
            className="w-full mt-1 bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 p-3 rounded-xl focus:outline-none focus:border-emerald-500"
          />
        </div>

        {pairError && <p className="text-xs text-rose-400 font-semibold text-center">{pairError}</p>}

        <button
          type="submit"
          disabled={verifying}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{verifying ? 'Verificando PIN...' : 'Confirmar Conexão'}</span>
        </button>
      </div>
    </form>
  );
};
