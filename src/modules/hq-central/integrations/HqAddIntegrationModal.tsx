import React from 'react';
import { Shield, Lock, Activity, X, Link2 } from 'lucide-react';
import { SystemIntegration } from '../../../types';

export interface NewIntegrationDraft {
  name: string;
  category: SystemIntegration['category'];
  apiKey: string;
  endpointUrl: string;
  lastSync: string;
  status: SystemIntegration['status'];
}

interface HqAddIntegrationModalProps {
  newInteg: NewIntegrationDraft;
  setNewInteg: React.Dispatch<React.SetStateAction<NewIntegrationDraft>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const HqAddIntegrationModal: React.FC<HqAddIntegrationModalProps> = ({
  newInteg,
  setNewInteg,
  onClose,
  onSubmit,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-white text-base flex items-center gap-2 uppercase tracking-tighter italic">
            <Shield className="w-5 h-5 text-amber-400" />
            Configurar Nova API / Provedor
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase">Nome do Provedor</label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Mercado Pago, Pagar.me, Focus NFe..."
              value={newInteg.name}
              onChange={(e) => setNewInteg({ ...newInteg, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Categoria</label>
              <select
                value={newInteg.category}
                onChange={(e) =>
                  setNewInteg({
                    ...newInteg,
                    category: e.target.value as SystemIntegration['category'],
                  })
                }
                className="w-full bg-slate-950 border border-slate-800 text-xs text-white p-3 rounded-xl focus:border-amber-500 outline-none transition-all font-bold cursor-pointer"
              >
                <option value="API">API Externa</option>
                <option value="CLOUD">Cloud Services</option>
                <option value="PAYMENT">Pagamentos</option>
                <option value="MAPS">Mapas &amp; Geo</option>
                <option value="WHATSAPP">WhatsApp API</option>
                <option value="FISCAL_NFE">Fiscal NFC-e / SAT</option>
                <option value="SECURITY">Segurança</option>
                <option value="AI">AI Engine</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase">Chave / Token de Acesso</label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="sk_live_... (mascarado no Core)"
                  value={newInteg.apiKey}
                  onChange={(e) => setNewInteg({ ...newInteg, apiKey: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-[10px] text-white p-3 pr-8 rounded-xl focus:border-amber-500 outline-none transition-all font-mono"
                />
                <Lock className="w-3 h-3 text-slate-500 absolute right-3 top-3.5" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Link2 className="w-3 h-3 text-slate-500" /> Endpoint HTTPS para Health Probe (Opcional)
            </label>
            <input
              type="url"
              placeholder="https://api.provedor.com/health"
              value={newInteg.endpointUrl}
              onChange={(e) => setNewInteg({ ...newInteg, endpointUrl: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-[11px] text-white p-3 rounded-xl focus:border-amber-500 outline-none transition-all font-mono"
            />
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
            <div className="flex items-start gap-2">
              <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                O Server Core mascara o segredo informado antes de persistir e executa validação real ao acionar <strong>Testar</strong> no provedor.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-[2] px-4 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            Salvar Integração
          </button>
        </div>
      </form>
    </div>
  );
};
