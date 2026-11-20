import React, { useState } from 'react';
import { User, Wallet, Star, HelpCircle, Settings, Info, LogOut, ChevronRight, QrCode, AlertTriangle } from 'lucide-react';
import { Driver } from '../../../types';

interface DriverProfileMenuProps {
  currentDriver: Driver;
  hasActiveDelivery?: boolean;
  onOpenPersonalData?: () => void;
  onOpenPixConfig?: () => void;
  onOpenQrPairing?: () => void;
  onOpenSupport: () => void;
  onOpenSettings: () => void;
  onShowNotification: (msg: string) => void;
  onLogout?: () => void;
}

export const DriverProfileMenu: React.FC<DriverProfileMenuProps> = ({
  currentDriver,
  hasActiveDelivery = false,
  onOpenPersonalData,
  onOpenPixConfig,
  onOpenQrPairing,
  onOpenSupport,
  onOpenSettings,
  onShowNotification,
  onLogout,
}) => {
  const [confirmLogout, setConfirmLogout] = useState(false);

  return (
    <div className="bg-[#111922] border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 text-xs">
      <button
        type="button"
        onClick={() =>
          onOpenPersonalData
            ? onOpenPersonalData()
            : onShowNotification('Conta de entregador ativa e verificada.')
        }
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <User className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold">Meus Dados &amp; Veículo</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </button>

      <button
        type="button"
        onClick={() =>
          onOpenPixConfig
            ? onOpenPixConfig()
            : onShowNotification('Repasses PIX integrados diretamente à sua carteira digital.')
        }
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Wallet className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold">Dados Bancários &amp; Chave PIX</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </button>

      {onOpenQrPairing && (
        <button
          type="button"
          onClick={onOpenQrPairing}
          className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-teal-300 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <QrCode className="w-4 h-4 text-[#00CCBC]" />
            <span className="font-bold">Parear Frota Própria (QR Code / PIN)</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </button>
      )}

      <button
        type="button"
        onClick={() =>
          onShowNotification(
            `Sua nota média é ${currentDriver.rating.toFixed(1)} em ${currentDriver.totalDeliveries} entregas concluídas.`
          )
        }
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="font-bold">Desempenho & Entregas</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-amber-400 font-bold tabular-nums">
          <span>{currentDriver.rating.toFixed(1)}</span>
          <ChevronRight className="w-4 h-4 text-slate-500" />
        </div>
      </button>

      <button
        type="button"
        onClick={onOpenSupport}
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold">Ajuda e Suporte ao Motorista</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Settings className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold">Configurações do App</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-500" />
      </button>

      <button
        type="button"
        onClick={() => onShowNotification('App 3C Driver — Logística integrada para frota própria e rede aberta.')}
        className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-slate-800/60 transition-all text-slate-200 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Info className="w-4 h-4 text-[#00CCBC]" />
          <span className="font-bold">Sobre o App 3C Motorista</span>
        </div>
        <span className="text-slate-400 font-mono text-[10px]">5.2.1</span>
      </button>

      {onLogout && (
        confirmLogout ? (
          <div className="p-4 bg-rose-500/10 space-y-2.5">
            <div className="flex items-start gap-2 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-bold">
                {hasActiveDelivery
                  ? 'Você possui uma entrega em andamento! Deseja realmente sair da sua conta agora?'
                  : 'Deseja realmente encerrar sua sessão no aplicativo do motorista?'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogout(false)}
                className="min-h-[40px] flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLogout(false);
                  onLogout();
                }}
                className="min-h-[40px] flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl cursor-pointer transition-colors"
              >
                Confirmar Saída
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="min-h-[48px] w-full p-4 flex items-center justify-between hover:bg-rose-500/10 transition-all text-rose-400 font-bold cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-4 h-4" />
              <span>Sair da Conta</span>
            </div>
          </button>
        )
      )}
    </div>
  );
};
