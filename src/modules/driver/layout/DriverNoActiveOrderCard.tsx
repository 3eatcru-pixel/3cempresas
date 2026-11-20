import React from 'react';
import { Navigation } from 'lucide-react';

interface DriverNoActiveOrderCardProps {
  onNavigateToOrders: () => void;
}

export const DriverNoActiveOrderCard: React.FC<DriverNoActiveOrderCardProps> = ({
  onNavigateToOrders,
}) => {
  return (
    <div className="space-y-4 pb-20 animate-fadeIn">
      <div className="bg-[#111922] border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-[#00CCBC]/10 border border-[#00CCBC]/30 text-[#00CCBC] flex items-center justify-center mx-auto">
          <Navigation className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-black text-white">Nenhum Pedido em Rota</h2>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
          Você não possui corridas em andamento no momento. Aceite uma entrega ou despacho da loja para iniciar a navegação GPS.
        </p>
        <button
          type="button"
          onClick={onNavigateToOrders}
          className="h-11 px-6 bg-[#00CCBC] hover:bg-[#00b5a7] text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer"
        >
          Ver Pedidos Disponíveis
        </button>
      </div>
    </div>
  );
};
