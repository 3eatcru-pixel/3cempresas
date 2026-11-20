import React from 'react';
import { Gift, Sparkles } from 'lucide-react';
import { LoyaltyReward } from '../../types';

interface ConsumerLoyaltyTabProps {
  loyaltyRewards: LoyaltyReward[];
  onRedeemReward: (rewardId: string) => void;
}

export const ConsumerLoyaltyTab: React.FC<ConsumerLoyaltyTabProps> = ({
  loyaltyRewards,
  onRedeemReward,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-8 rounded-3xl text-slate-950 shadow-2xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-black italic uppercase tracking-tight flex items-center gap-2">
            <Gift className="w-6 h-6" /> Hub de Fidelidade 3C Commerce OS
          </h2>
          <span className="px-3 py-1 bg-slate-950 text-amber-400 font-mono font-black text-xs rounded-full">
            340 Pontos Acumulados
          </span>
        </div>
        <p className="text-xs font-bold leading-relaxed max-w-2xl opacity-90">
          A cada pedido realizado no Marketplace ou no balcão das lojas parceiras, você acumula pontos que podem ser trocados por cupons de desconto e sobremesas grátis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {loyaltyRewards.map(rwd => (
              <div key={rwd.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 flex flex-col justify-between shadow-xl">
                <div className="space-y-2">
                  <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{rwd.storeName}</div>
                  <h3 className="font-black text-white text-base leading-snug">{rwd.rewardTitle}</h3>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Requer {rwd.pointsRequired} pontos
                  </div>
                </div>

                {rwd.isRedeemed ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl text-center space-y-1">
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">CUPOM RESGATADO</div>
                    <div className="text-white font-mono font-black text-base">{rwd.couponCode}</div>
                  </div>
                ) : (
                  <button
                    onClick={() => onRedeemReward(rwd.id)}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs shadow-lg transition-transform active:scale-95"
                  >
                    Resgatar Cupom ({rwd.pointsRequired} pts)
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="bg-slate-900/50 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl">
             <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
               <Sparkles className="w-4 h-4 text-amber-500" /> Histórico Recente de Pontos
             </h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] font-mono">
                   <thead className="text-slate-500 uppercase border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-2">Data</th>
                        <th className="py-2 px-2">Loja / Motivo</th>
                        <th className="py-2 px-2 text-right">Pontos</th>
                      </tr>
                   </thead>
                   <tbody className="text-slate-300 divide-y divide-slate-800/50">
                      <tr>
                        <td className="py-2 px-2">11/11/2026</td>
                        <td className="py-2 px-2">Burguer Lab • Pedido #9042</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-bold">+ 45 pts</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">09/11/2026</td>
                        <td className="py-2 px-2">Pizzaria Bella • Pedido #8821</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-bold">+ 72 pts</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">05/11/2026</td>
                        <td className="py-2 px-2">Resgate de Cupom (OFF30)</td>
                        <td className="py-2 px-2 text-right text-rose-400 font-bold">- 150 pts</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-2">02/11/2026</td>
                        <td className="py-2 px-2">Empório Gourmet • Pedido #7710</td>
                        <td className="py-2 px-2 text-right text-emerald-400 font-bold">+ 120 pts</td>
                      </tr>
                   </tbody>
                </table>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-4 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Gift className="w-20 h-20 text-emerald-500" />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-widest italic">3EAT Wallet</h3>
              <div className="space-y-1">
                 <p className="text-[10px] text-slate-500 font-bold uppercase">Créditos Disponíveis</p>
                 <div className="text-3xl font-black text-emerald-400 font-mono">R$ 15,00</div>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">Estes créditos podem ser usados como desconto em qualquer loja da rede.</p>
              <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] uppercase rounded-xl border border-slate-700 transition-all">
                Ver Detalhes do Cashback
              </button>
           </div>

           <div className="bg-gradient-to-br from-amber-500/10 to-slate-950 rounded-3xl border border-amber-500/20 p-6 space-y-4">
              <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">Dica VIP</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">Você está a apenas <strong>160 pontos</strong> de subir para o nível <strong>PLATINUM</strong> e ganhar taxa de entrega grátis em todo o ecossistema!</p>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                 <div className="h-full bg-amber-500 w-[68%]" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
