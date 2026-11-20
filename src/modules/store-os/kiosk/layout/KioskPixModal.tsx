import React, { useMemo, useState } from 'react';
import { Clock, QrCode, Copy, Check, AlertTriangle } from 'lucide-react';
import { LocalQrCode } from '../../../../components/common/LocalQrCode';
import { generateEmvCoPixPayload } from '../../../../utils/pix';

interface KioskPixModalProps {
  pixKey: string;
  merchantName?: string;
  merchantCity?: string;
  orderCompletedCode: string | null;
  totalAmount: number;
  savedOffline?: boolean;
  onReset: () => void;
}

export const KioskPixModal: React.FC<KioskPixModalProps> = ({
  pixKey,
  merchantName,
  merchantCity,
  orderCompletedCode,
  totalAmount,
  savedOffline = false,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const trimmedKey = (pixKey || '').trim();

  const pixPayload = useMemo(() => {
    if (!trimmedKey) return '';
    return generateEmvCoPixPayload({
      pixKey: trimmedKey,
      amount: totalAmount,
      merchantName: merchantName || 'ESTABELECIMENTO',
      merchantCity: merchantCity || 'BRASIL',
      txid: (orderCompletedCode || 'KIOSK').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25),
      description: `Totem ${orderCompletedCode || 'KIOSK'}`,
    });
  }, [trimmedKey, merchantName, merchantCity, totalAmount, orderCompletedCode]);

  const handleCopyPixCode = async () => {
    if (!pixPayload) return;
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in restricted iframe
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-5 text-center shadow-2xl animate-scaleIn">
        <div className="space-y-1">
          <div className="text-[11px] font-mono text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> PIX Banco Central · BR Code Oficial
          </div>
          <h3 className="text-lg font-bold text-white">
            {trimmedKey ? 'Aponte a câmera do seu banco' : 'Chave PIX não configurada'}
          </h3>
          {trimmedKey ? (
            <p className="text-xs text-slate-400">
              Chave da loja: <span className="text-slate-200 font-mono">{trimmedKey}</span> · 0% de taxa
            </p>
          ) : (
            <p className="text-xs text-amber-300">
              Dirija-se ao balcão para efetuar o pagamento com a senha abaixo.
            </p>
          )}
        </div>

        {trimmedKey && pixPayload ? (
          <>
            <div className="bg-white p-4 rounded-xl mx-auto w-52 h-52 flex flex-col items-center justify-center border border-slate-700">
              <LocalQrCode
                value={pixPayload}
                size={168}
                darkColor="#020617"
                lightColor="#ffffff"
                alt="QR Code PIX Autoatendimento"
                className="w-44 h-44 rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={handleCopyPixCode}
              className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Código PIX Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Copiar Código PIX (Copia e Cola)</span>
                </>
              )}
            </button>
          </>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 text-left">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Nenhuma chave PIX está cadastrada para esta unidade. Configure em Configurações &gt; Perfil e PIX.
            </span>
          </div>
        )}

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono tabular-nums space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Senha do Pedido</span>
            <span className="text-amber-400 font-bold text-sm">{orderCompletedCode}</span>
          </div>
          <div className="flex justify-between text-white font-bold">
            <span>Valor Total</span>
            <span className="text-emerald-400">
              R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {savedOffline
              ? 'Modo offline: pedido salvo na fila local e será sincronizado automaticamente.'
              : 'Aguardando confirmação do PIX para liberação na cozinha e retirada.'}
          </span>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
        >
          Concluir e Iniciar Novo Pedido
        </button>
      </div>
    </div>
  );
};

