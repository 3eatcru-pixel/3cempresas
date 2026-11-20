import React from 'react';
import { ShieldCheck, FlaskConical, Eye, Zap } from 'lucide-react';

export type MaturityLevel = 'CORE_REAL' | 'ESTÁVEL_BETA' | 'SANDBOX_SIMULADO' | 'PROTÓTIPO_TELA';

export interface MaturityBadgeProps {
  level: MaturityLevel;
  className?: string;
  showIcon?: boolean;
}

export const MaturityBadge: React.FC<MaturityBadgeProps> = ({ level, className = '', showIcon = true }) => {
  const config = {
    CORE_REAL: {
      label: 'Core Real',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      icon: <ShieldCheck className="w-3 h-3" />,
    },
    ESTÁVEL_BETA: {
      label: 'Estável Beta',
      bg: 'bg-cyan-500/10',
      text: 'text-cyan-400',
      border: 'border-cyan-500/20',
      icon: <Zap className="w-3 h-3" />,
    },
    SANDBOX_SIMULADO: {
      label: 'Sandbox / Simulado',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      icon: <FlaskConical className="w-3 h-3" />,
    },
    PROTÓTIPO_TELA: {
      label: 'Protótipo / Tela',
      bg: 'bg-slate-500/10',
      text: 'text-slate-400',
      border: 'border-slate-500/20',
      icon: <Eye className="w-3 h-3" />,
    },
  }[level];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${config.bg} ${config.text} ${config.border} ${className}`}
    >
      {showIcon && config.icon}
      {config.label}
    </div>
  );
};
