import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed } from 'lucide-react';
import { HqTabId } from '../HqSidebar';
import { OnboardingStep } from './hqDevOnboardingConstants';

interface HqOnboardingStepsGridProps {
  steps: OnboardingStep[];
  onNavigateTab?: (tab: HqTabId) => void;
}

export const HqOnboardingStepsGrid: React.FC<HqOnboardingStepsGridProps> = ({
  steps,
  onNavigateTab,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
      {steps.map((step) => {
        const StepIcon = step.icon;
        return (
          <div
            key={step.id}
            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 ${
              step.completed
                ? 'bg-emerald-500/5 border-emerald-500/25'
                : step.warningOnly
                ? 'bg-slate-950/80 border-amber-500/25'
                : 'bg-slate-950/90 border-rose-500/30'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StepIcon
                    className={`w-4 h-4 shrink-0 ${
                      step.completed
                        ? 'text-emerald-400'
                        : step.warningOnly
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  />
                  <h4 className="text-xs font-bold text-white truncate">{step.title}</h4>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold shrink-0 ${
                    step.completed
                      ? 'text-emerald-400'
                      : step.warningOnly
                      ? 'text-amber-300'
                      : 'text-rose-300'
                  }`}
                >
                  {step.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : step.warningOnly ? (
                    <CircleDashed className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {step.statusLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">{step.description}</p>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/70">
              <div className="flex flex-wrap gap-1">
                {step.envHints.map((envName) => (
                  <code
                    key={envName}
                    className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[9px] font-mono text-slate-400"
                  >
                    {envName}
                  </code>
                ))}
              </div>
              {step.targetTab && onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab(step.targetTab!)}
                  className="text-[10px] font-black uppercase tracking-wider text-indigo-300 hover:text-white inline-flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>{step.actionLabel || 'Abrir'}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
