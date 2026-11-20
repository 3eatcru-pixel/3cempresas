import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CustomerCRM, MenuItem } from '../../../../types';
import { PosCustomerPicker } from '../components/PosCustomerPicker';

interface ServicePosServicesStepProps {
  serviceItems: MenuItem[];
  selectedServices: { menuItem: MenuItem; qty: number }[];
  clientName?: string;
  setClientName?: (name: string) => void;
  customers?: CustomerCRM[];
  selectedCustomer?: CustomerCRM | null;
  onSelectCustomer?: (c: CustomerCRM | null) => void;
  onAddService: (item: MenuItem) => void;
  onBackToProfessional: () => void;
}

export const ServicePosServicesStep: React.FC<ServicePosServicesStepProps> = ({
  serviceItems,
  selectedServices,
  clientName = '',
  setClientName,
  customers = [],
  selectedCustomer = null,
  onSelectCustomer,
  onAddService,
  onBackToProfessional,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">Serviços & Produtos</h2>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            Adicione serviços ou produtos de revenda consumidos
          </p>
        </div>
        <button
          onClick={onBackToProfessional}
          className="text-[10px] font-black text-indigo-400 hover:underline cursor-pointer self-start sm:self-auto"
        >
          ALTERAR PROFISSIONAL
        </button>
      </div>

      {setClientName && onSelectCustomer && (
        <PosCustomerPicker
          customers={customers}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={onSelectCustomer}
          customerName={clientName}
          setCustomerName={setClientName}
          placeholder="Buscar cliente CRM ou informar nome atendido..."
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {serviceItems.map(item => {
          const found = selectedServices.find(s => s.menuItem.id === item.id);
          return (
            <button
              key={item.id}
              onClick={() => onAddService(item)}
              className={`p-4 rounded-2xl border-2 text-left transition-all relative cursor-pointer ${
                found
                  ? 'bg-indigo-500/10 border-indigo-500'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              {found && (
                <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-mono font-black text-indigo-400">
                  {found.qty > 1 && <span>{found.qty}x</span>}
                  <CheckCircle2 size={16} className="text-indigo-500" />
                </span>
              )}
              <p className="text-xs font-black text-white uppercase line-clamp-1 pr-8">{item.name}</p>
              <p className="text-sm font-mono font-black text-emerald-400 mt-1">R$ {item.price.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 uppercase mt-2">
                {item.specs?.durationMinutes || item.prepTimeMin || 30} min aprox.
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
