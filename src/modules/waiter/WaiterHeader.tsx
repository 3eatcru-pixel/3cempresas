import React from 'react';
import { QrCode, Smartphone, LogOut, Tablet } from 'lucide-react';
import { BrandMark } from '../../components/common/BrandLogo';
import { Store } from '../../types';
import { UserProfile } from '../../context/AuthContext';

interface WaiterHeaderProps {
  currentStore: Store;
  waiterName: string;
  setWaiterName: (name: string) => void;
  profile?: UserProfile | null;
  onOpenQrPairing?: () => void;
  onLogout?: () => void;
}

export const WaiterHeader: React.FC<WaiterHeaderProps> = ({
  currentStore,
  waiterName,
  setWaiterName,
  profile,
  onOpenQrPairing,
  onLogout,
}) => {
  const isPdqSession = profile?.authProvider === 'STORE_DEVICE_PDQ';
  const isPinSession = profile?.authProvider === 'WAITER_PIN_TERMINAL';

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-fadeIn">
      <div className="flex items-center gap-3">
        <BrandMark id="waiter" size="md" />
        <div>
          <h1 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
            <span>
              3C <span className="text-pink-400">Waiter</span> · Terminal do Garçom
            </span>
            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/30 font-mono">
              REALTIME KDS
            </span>
            {isPdqSession ? (
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono inline-flex items-center gap-1">
                <Tablet className="w-2.5 h-2.5" /> PDQ: {profile?.deviceId}
              </span>
            ) : isPinSession ? (
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/30 font-mono">
                Terminal Salão (PIN)
              </span>
            ) : profile?.email ? (
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                {profile.email}
              </span>
            ) : null}
          </h1>
          <p className="text-xs text-slate-400">
            Salão ({currentStore.name}) • Atendente: <span className="text-pink-400 font-semibold">{waiterName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {onOpenQrPairing && (
          <button
            type="button"
            onClick={onOpenQrPairing}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Parear smartphone via QR Code"
          >
            <QrCode className="w-4 h-4" />
            <span>Parear QR Code</span>
          </button>
        )}

        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
          <Smartphone className="w-3.5 h-3.5 text-slate-500 ml-2" />
          <input
            type="text"
            value={waiterName}
            onChange={e => setWaiterName(e.target.value)}
            placeholder="Nome do Garçom"
            className="bg-transparent text-xs text-white px-2 py-1 focus:outline-none w-32 font-bold"
          />
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-rose-300 rounded-xl border border-slate-800 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Trocar conta ou desconectar terminal"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </div>
  );
};
