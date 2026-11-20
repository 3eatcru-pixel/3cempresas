import React from 'react';
import { QrCode } from 'lucide-react';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';
import { PILLAR_THEMES, SURFACE_TOKENS } from '@3c/design-system';

interface EdgeQrPairingCardProps {
  payload: string;
}

export const EdgeQrPairingCard: React.FC<EdgeQrPairingCardProps> = ({ payload }) => {
  const coreTheme = PILLAR_THEMES['server-core'];
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className={`${surface.canvasBg} p-4 rounded-2xl border ${surface.border} flex flex-col items-center justify-center text-center space-y-2`}>
      <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${coreTheme.accentTextClass}`}>
        <QrCode className="w-3.5 h-3.5" /> Pareamento Rápido LAN
      </div>
      <div className="bg-white p-2 rounded-xl border-2 border-emerald-500/40">
        <LocalQrCode
          value={payload}
          size={128}
          alt="QR Code Edge LAN"
          fgColor="#020617"
          bgColor="#ffffff"
          className="w-32 h-32 rounded-lg"
        />
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">
        Escaneie no app <strong className="text-white">Waiter</strong> ou{' '}
        <strong className="text-white">Tablet</strong> para vincular ao Edge Node da loja.
      </p>
    </div>
  );
};
