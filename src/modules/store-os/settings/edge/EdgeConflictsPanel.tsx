import React from 'react';
import { STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';

interface EdgeConflictsPanelProps {
  conflictsCount: number;
  conflicts: any[];
  onClearAll: () => Promise<void> | void;
  onDismiss: (id: string) => Promise<void> | void;
}

export const EdgeConflictsPanel: React.FC<EdgeConflictsPanelProps> = ({
  conflictsCount,
  conflicts,
  onClearAll,
  onDismiss,
}) => {
  if (conflictsCount <= 0) return null;

  const danger = STATUS_COLORS.DANGER;
  const surface = SURFACE_TOKENS.dark;

  return (
    <div className={`${danger.bgClass} border ${danger.borderClass} rounded-xl p-3 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-mono uppercase font-black ${danger.textClass}`}>
          {conflictsCount} Conflito(s) / Rejeição(ões) de Sync Preservados
        </span>
        <button
          type="button"
          onClick={() => void onClearAll()}
          className={`text-[10px] font-bold ${danger.textClass} hover:text-white underline cursor-pointer`}
        >
          Limpar Todos
        </button>
      </div>
      <div className="space-y-1.5 max-h-28 overflow-y-auto">
        {conflicts.slice(0, 5).map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between gap-2 text-[10px] font-mono ${surface.canvasBg} px-2.5 py-1.5 rounded-lg border ${danger.borderClass}`}
          >
            <span className="truncate text-slate-200">
              [{c.kind}] {c.entity}/{c.entityId} — {c.reason}
            </span>
            <button
              type="button"
              onClick={() => void onDismiss(c.id)}
              className="text-slate-400 hover:text-white shrink-0 cursor-pointer"
            >
              Dispensar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
