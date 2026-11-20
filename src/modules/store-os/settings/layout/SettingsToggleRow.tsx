import React from 'react';

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  activeColor: string;
}

export const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  title,
  description,
  checked,
  onToggle,
  activeColor,
}) => {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800/80">
      <div className="space-y-0.5 max-w-[75%]">
        <div className="text-xs font-bold text-white">{title}</div>
        <div className="text-[10px] text-slate-400">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
          checked ? activeColor : 'bg-slate-800'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
            checked ? 'right-0.5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
};
