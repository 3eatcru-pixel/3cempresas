import React, { useState } from 'react';
import {
  X,
  Tablet,
  QrCode,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Server,
  Store as StoreIcon,
  User,
} from 'lucide-react';
import { PILLAR_THEMES, STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import { useAuth } from '../../context/AuthContext';
import { syncEngine } from '../../core/sync/SyncEngine';

interface WaiterDeviceAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStoreId?: string;
  onSuccess?: (info: { storeId?: string; storeName?: string; mode: 'PDQ' | 'PIN' }) => void;
}

export const WaiterDeviceAccessModal: React.FC<WaiterDeviceAccessModalProps> = ({
  isOpen,
  onClose,
  defaultStoreId = '',
  onSuccess,
}) => {
  const { loginStoreDevice, loginWaiterWithPin } = useAuth();
  const [mode, setMode] = useState<'PDQ' | 'PIN'>('PDQ');

  // PDQ / Store-Owned Hardware fields
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  // QR / PIN Salon fields
  const [qrRaw, setQrRaw] = useState('');
  const [storeIdInput, setStoreIdInput] = useState(defaultStoreId);
  const [pinInput, setPinInput] = useState('');
  const [edgeLanUrl, setEdgeLanUrl] = useState('');

  // Shared optional operator name
  const [operatorName, setOperatorName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const theme = PILLAR_THEMES.waiter;
  const surface = SURFACE_TOKENS.dark;
  const danger = STATUS_COLORS.DANGER;

  const handleQrPasteChange = (raw: string) => {
    setQrRaw(raw);
    setErrorMsg(null);
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.storeId === 'string' && parsed.storeId.trim()) {
          setStoreIdInput(parsed.storeId.trim());
        }
        if (parsed.pin) {
          setPinInput(String(parsed.pin));
        }
        if (typeof parsed.edgeBaseUrl === 'string' && parsed.edgeBaseUrl.trim()) {
          setEdgeLanUrl(parsed.edgeBaseUrl.trim());
        }
      }
    } catch {
      // Allow partial paste while typing
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'PDQ') {
        if (!deviceIdentifier.trim() || !pairingCode.trim()) {
          setErrorMsg('Informe o ID do dispositivo/PDQ e o código de pareamento emitido no painel do estabelecimento.');
          return;
        }
        const res = await loginStoreDevice({
          deviceIdentifier: deviceIdentifier.trim(),
          pairingCode: pairingCode.trim().toUpperCase(),
          operatorName: operatorName.trim() || undefined,
        });
        onSuccess?.({
          storeId: res.store?.id,
          storeName: res.store?.name,
          mode: 'PDQ',
        });
        onClose();
        return;
      }

      const pinDigits = pinInput.replace(/\D/g, '');
      const hasQrJson = qrRaw.trim().startsWith('{');
      if (!hasQrJson && (!storeIdInput.trim() || pinDigits.length !== 6)) {
        setErrorMsg('Informe o ID/Slug da loja e o PIN de 6 dígitos (ou cole o payload do QR Code).');
        return;
      }

      const res = await loginWaiterWithPin({
        storeId: storeIdInput.trim() || undefined,
        pin: pinDigits || undefined,
        qrPayload: hasQrJson ? qrRaw.trim() : undefined,
        operatorName: operatorName.trim() || undefined,
      });

      if (edgeLanUrl.trim() && res.store?.id) {
        try {
          await syncEngine.pairEdgeNode({
            storeId: res.store.id,
            storeName: res.store.name || res.store.id,
            edgeBaseUrl: edgeLanUrl.trim(),
            hostname: `waiter-${(operatorName.trim() || 'terminal').toLowerCase().replace(/\s+/g, '-')}`,
            preferLan: true,
          });
        } catch {
          // Non-blocking: cloud token is already active
        }
      }

      onSuccess?.({
        storeId: res.store?.id,
        storeName: res.store?.name,
        mode: 'PIN',
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível parear este dispositivo com a loja.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className={`relative w-full max-w-md ${surface.elevatedBg} border ${surface.border} rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar`}>
        <div className={`flex items-center justify-between p-5 border-b ${surface.border} bg-slate-950/60`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${theme.badgeClass} flex items-center justify-center ${theme.accentTextClass}`}>
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase italic tracking-tight">
                Dispositivo / PDQ da Loja
              </h2>
              <p className="text-[11px] text-slate-400">
                Acesso direto para terminais próprios ou pareamento rápido no salão
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`grid grid-cols-2 border-b ${surface.border} p-1.5 bg-slate-950/30`}>
          <button
            type="button"
            onClick={() => {
              setMode('PDQ');
              setErrorMsg(null);
            }}
            className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'PDQ'
                ? `${theme.accentBgClass} text-slate-950 shadow-lg`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" /> PDQ / Tablet
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('PIN');
              setErrorMsg(null);
            }}
            className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === 'PIN'
                ? `${theme.accentBgClass} text-slate-950 shadow-lg`
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> QR / PIN Salão
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className={`p-3 ${danger.bgClass} border ${danger.borderClass} rounded-xl flex items-center gap-2.5 text-xs ${danger.textClass} font-medium`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {mode === 'PDQ' ? (
            <>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                Para lojas com PDQs, maquininhas Android ou tablets próprios: use o <strong className="text-white">ID do Dispositivo</strong> e o <strong className="text-white">Código de Pareamento</strong> gerados em <span className="text-slate-200 font-semibold">Painel da Loja → Minha Assinatura → Dispositivos</span>.
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  ID do Dispositivo / PDQ
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={deviceIdentifier}
                    onChange={(e) => setDeviceIdentifier(e.target.value)}
                    placeholder="Ex: TAB-BGL-04 ou POS-BGL-01"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-pink-500"
                  />
                  <Tablet className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Código de Pareamento (3C-...)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={pairingCode}
                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                    placeholder="Ex: 3C-A1B2C3D4"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-9 py-2.5 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider focus:outline-none focus:border-pink-500"
                  />
                  <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Dados do QR Code (opcional)
                </label>
                <textarea
                  rows={2}
                  value={qrRaw}
                  onChange={(e) => handleQrPasteChange(e.target.value)}
                  placeholder='Cole aqui o texto JSON do QR Code do estabelecimento para preencher automaticamente...'
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                    <StoreIcon className="w-3 h-3 text-slate-400" /> Loja (ID ou Slug)
                  </label>
                  <input
                    type="text"
                    required
                    value={storeIdInput}
                    onChange={(e) => setStoreIdInput(e.target.value)}
                    placeholder="Ex: store-1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    PIN do Salão (6 dígitos)
                  </label>
                  <input
                    type="text"
                    required
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="000-000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-400 tracking-wider text-center focus:outline-none focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                  <Server className="w-3 h-3 text-emerald-400" /> Edge Node LAN (opcional)
                </label>
                <input
                  type="url"
                  value={edgeLanUrl}
                  onChange={(e) => setEdgeLanUrl(e.target.value)}
                  placeholder="http://192.168.1.50:3300"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" /> Identificação do Atendente / Turno (opcional)
            </label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="Ex: Garçom Lucas ou PDQ Salão 01"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 ${theme.accentBgClass} hover:brightness-110 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer`}
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {mode === 'PDQ' ? 'Ativar Terminal / PDQ no Salão' : 'Conectar com PIN da Loja'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
