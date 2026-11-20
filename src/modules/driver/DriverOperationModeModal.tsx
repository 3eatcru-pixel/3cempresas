import React from 'react';
import { Store, Globe, ChevronRight, X, Bike, Lock, QrCode } from 'lucide-react';

interface DriverOperationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: 'STORE' | 'PLATFORM';
  onSelectMode: (mode: 'STORE' | 'PLATFORM') => void;
  storeName?: string;
  canOperatePlatform?: boolean;
  canOperateStore?: boolean;
  onOpenQrPairing?: () => void;
}

export const DriverOperationModeModal: React.FC<DriverOperationModeModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  storeName = 'Loja Vinculada',
  canOperatePlatform = true,
  canOperateStore = true,
  onOpenQrPairing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111922] border border-slate-700 rounded-2xl p-6 max-w-md w-full space-y-5 text-white relative shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/30 text-[#00CCBC] flex items-center justify-center mx-auto">
            <Bike className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-white">Modalidade de Operação</h2>
          <p className="text-xs text-slate-400">
            Um único app para operar na Plataforma Aberta ou atender despachos diretos do estabelecimento.
          </p>
        </div>

        <div className="space-y-3">
          {/* Platform Mode (Deliveroo / iFood / Uber Driver style) */}
          <button
            type="button"
            disabled={!canOperatePlatform}
            onClick={() => {
              onSelectMode('PLATFORM');
              onClose();
            }}
            className={`w-full min-h-[72px] p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 ${
              !canOperatePlatform
                ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                : currentMode === 'PLATFORM'
                ? 'bg-[#00CCBC]/10 border-[#00CCBC] text-white cursor-pointer'
                : 'bg-[#0B1117] border-slate-800 text-slate-300 hover:border-[#00CCBC]/50 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  currentMode === 'PLATFORM' && canOperatePlatform
                    ? 'bg-[#00CCBC] text-slate-950'
                    : 'bg-slate-800 text-[#00CCBC]'
                }`}
              >
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  Plataforma Aberta (Rede)
                  {currentMode === 'PLATFORM' && (
                    <span className="text-[10px] bg-[#00CCBC] text-slate-950 font-black px-2 py-0.5 rounded-md">
                      ATIVO
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Corridas de todos os estabelecimentos disponíveis na rede logística.
                </p>
              </div>
            </div>
            {canOperatePlatform ? (
              <ChevronRight className="w-5 h-5 text-[#00CCBC] shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </button>

          {/* Store Mode (Shared Store OS Fleet) */}
          <button
            type="button"
            disabled={!canOperateStore}
            onClick={() => {
              onSelectMode('STORE');
              onClose();
            }}
            className={`w-full min-h-[72px] p-4 rounded-2xl border transition-all text-left flex items-center justify-between gap-3 ${
              !canOperateStore
                ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-60 cursor-not-allowed'
                : currentMode === 'STORE'
                ? 'bg-[#00CCBC]/10 border-[#00CCBC] text-white cursor-pointer'
                : 'bg-[#0B1117] border-slate-800 text-slate-300 hover:border-[#00CCBC]/50 cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  currentMode === 'STORE' && canOperateStore
                    ? 'bg-[#00CCBC] text-slate-950'
                    : 'bg-slate-800 text-[#00CCBC]'
                }`}
              >
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
                  Frota da Loja ({storeName})
                  {currentMode === 'STORE' && (
                    <span className="text-[10px] bg-[#00CCBC] text-slate-950 font-black px-2 py-0.5 rounded-md">
                      ATIVO
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Entregas despachadas diretamente para os motoristas vinculados à loja.
                </p>
              </div>
            </div>
            {canOperateStore ? (
              <ChevronRight className="w-5 h-5 text-[#00CCBC] shrink-0" />
            ) : (
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </button>
        </div>

        {onOpenQrPairing && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenQrPairing();
            }}
            className="w-full py-3 bg-[#0B1117] hover:bg-slate-900 border border-[#00CCBC]/40 text-[#00CCBC] font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Parear Frota Própria da Loja (QR Code / PIN)
          </button>
        )}

        {(!canOperatePlatform || !canOperateStore) && (
          <p className="text-[11px] text-slate-400 bg-[#0B1117] border border-slate-800 rounded-xl p-3 text-center">
            Use o QR Code ou PIN gerado na loja para habilitar ou trocar o vínculo de Frota Própria.
          </p>
        )}
      </div>
    </div>
  );
};
