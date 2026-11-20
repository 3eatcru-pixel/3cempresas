import React from 'react';
import { QrCode, Wifi, RefreshCw, Loader2, Copy } from 'lucide-react';
import { Store } from '../../../types';
import { LocalQrCode } from '../../../components/common/LocalQrCode';

interface WaiterQrHostViewProps {
  currentStore: Store;
  qrPayload: string;
  pinLoading: boolean;
  pairingPin: string;
  pairError: string | null;
  copiedPayload: boolean;
  pairedEdgeBaseUrl?: string | null;
  onRegeneratePin: () => void;
  onCopyPayload: () => void;
}

export const WaiterQrHostView: React.FC<WaiterQrHostViewProps> = ({
  currentStore,
  qrPayload,
  pinLoading,
  pairingPin,
  pairError,
  copiedPayload,
  pairedEdgeBaseUrl,
  onRegeneratePin,
  onCopyPayload,
}) => {
  return (
    <div className="text-center space-y-4">
      <div className="inline-flex p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
        <QrCode className="w-8 h-8" />
      </div>

      <div>
        <h3 className="text-lg font-black text-white tracking-tight">Parear Smartphone do Garçom (BYOD)</h3>
        <p className="text-xs text-slate-400 mt-1">
          Escaneie o QR Code abaixo no smartphone do garçom para conectar ao salão de{' '}
          <strong className="text-amber-400">{currentStore.name}</strong>.
        </p>
      </div>

      {/* Offline-Safe Local QR Code Container */}
      <div className="bg-gradient-to-b from-amber-500 to-amber-600 p-4 rounded-3xl shadow-xl inline-block border-4 border-slate-950 my-2">
        <LocalQrCode
          value={qrPayload}
          size={192}
          darkColor="#020617"
          lightColor="#f59e0b"
          alt="QR Code Pareamento Garçom"
          className="w-48 h-48 rounded-xl mx-auto shadow-md"
        />
      </div>

      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
        <div className="text-[10px] text-slate-400 font-mono">
          Loja ID: <span className="text-white font-bold">{currentStore.id}</span>
        </div>
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest block">
          PIN Dinâmico da Loja
        </span>
        <span className="text-2xl font-black font-mono text-amber-400 tracking-wider block">
          {pinLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-400" /> : pairingPin}
        </span>
        <div className="flex items-center justify-center gap-4 pt-1">
          <button
            type="button"
            onClick={onRegeneratePin}
            disabled={pinLoading}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-amber-400 uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${pinLoading ? 'animate-spin' : ''}`} /> Gerar Novo PIN
          </button>
          <button
            type="button"
            onClick={onCopyPayload}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-emerald-400 uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" /> {copiedPayload ? 'QR Copiado!' : 'Copiar Dados QR'}
          </button>
        </div>
        {pairError && <p className="text-[11px] text-amber-300/90 font-medium pt-1">{pairError}</p>}
      </div>

      <div className="flex items-center justify-center gap-2 text-[10px] text-slate-400 font-mono">
        <Wifi className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span>
          {pairedEdgeBaseUrl
            ? `Terminal Local LAN (${pairedEdgeBaseUrl}) Ativo`
            : 'Conexão Cloud em Tempo Real Ativa'}
        </span>
      </div>
    </div>
  );
};
