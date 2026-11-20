import React from 'react';

interface ShowcaseTableBannerProps {
  storeName: string;
  currentTable: number;
  onManageTable: () => void;
}

export const ShowcaseTableBanner: React.FC<ShowcaseTableBannerProps> = ({
  storeName,
  currentTable,
  onManageTable,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-lg animate-fadeIn">
      <div>
        <div className="font-black uppercase tracking-wider flex items-center gap-2">
          <span>Autoatendimento na Mesa {String(currentTable).padStart(2, '0')}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Seus pedidos são transmitidos diretamente para a cozinha de <strong>{storeName}</strong> (sem taxa de entrega).
        </p>
      </div>
      <button
        type="button"
        onClick={onManageTable}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-xl tracking-wider transition-all cursor-pointer shadow-md"
      >
        Gerenciar Mesa
      </button>
    </div>
  );
};
