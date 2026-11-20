import React, { useState } from 'react';
import { Navigation, ShieldCheck, CheckCircle2, Loader2 } from 'lucide-react';

interface DriverDeliveryConfirmationFormProps {
  routeStarted: boolean;
  submitting?: boolean;
  onStartRoute: () => void;
  onFinishDelivery: (pinCode: string) => Promise<boolean | void> | void;
  onShowNotification: (msg: string) => void;
}

export const DriverDeliveryConfirmationForm: React.FC<DriverDeliveryConfirmationFormProps> = ({
  routeStarted,
  submitting = false,
  onStartRoute,
  onFinishDelivery,
  onShowNotification,
}) => {
  const [pinCode, setPinCode] = useState('');

  if (!routeStarted) {
    return (
      <div className="bg-[#111922] border border-slate-800 rounded-2xl p-4 flex flex-col justify-center">
        <button
          type="button"
          onClick={onStartRoute}
          className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-sm rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Navigation className="w-5 h-5" /> Iniciar Rota de Entrega
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pinCode.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      onShowNotification('Informe o código PIN de 4 dígitos fornecido pelo cliente.');
      return;
    }
    const ok = await onFinishDelivery(cleanPin);
    if (ok !== false) {
      setPinCode('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#111922] border border-slate-800 rounded-2xl p-4 space-y-3">
      <h4 className="text-xs font-bold text-[#00CCBC] flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4" /> Confirmação de Entrega (PIN de 4 dígitos do Cliente)
      </h4>

      <input
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="PIN de 4 dígitos"
        value={pinCode}
        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
        className="w-full bg-[#0B1117] border border-slate-700 text-white font-mono text-base font-bold tracking-[0.35em] text-center rounded-xl p-3 focus:outline-none focus:border-[#00CCBC] tabular-nums"
      />

      <button
        type="submit"
        disabled={submitting || pinCode.trim().length !== 4}
        className="w-full h-12 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Validando PIN no Servidor...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" /> Confirmar Entrega e Receber Repasse
          </>
        )}
      </button>
    </form>
  );
};
