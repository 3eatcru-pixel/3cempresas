import React from 'react';
import { Bot } from 'lucide-react';

interface FloatingAiButtonProps {
  onClick: () => void;
}

export const FloatingAiButton: React.FC<FloatingAiButtonProps> = ({ onClick }) => {
  return (
    <button 
      onClick={onClick}
      className="fixed bottom-6 right-6 z-[1000] p-4 bg-gradient-to-tr from-amber-500 to-orange-500 text-slate-950 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all group overflow-hidden"
    >
      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
      <Bot size={28} className="relative z-10" />
    </button>
  );
};
