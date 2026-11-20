import React, { useState, useRef, useEffect } from 'react';
import { X, Minimize2, Maximize2 } from 'lucide-react';

export interface OSWindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isActive: boolean;
  isMaximized: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  initialPosition?: { x: number; y: number };
}

export const OSWindow: React.FC<OSWindowProps> = ({
  id,
  title,
  children,
  isActive,
  isMaximized,
  zIndex,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  initialPosition = { x: 100, y: 50 },
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size] = useState({ width: 900, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    onFocus();
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const windowStyle: React.CSSProperties = isMaximized
    ? {
        top: 0,
        left: 0,
        right: 0,
        bottom: 56,
        width: '100%',
        height: 'calc(100% - 56px)',
        zIndex: 30 + zIndex,
        position: 'absolute',
      }
    : {
        top: position.y,
        left: position.x,
        width: size.width,
        height: size.height,
        zIndex: 30 + zIndex,
        position: 'absolute',
      };

  return (
    <div
      ref={windowRef}
      style={windowStyle}
      onClick={onFocus}
      className={`bg-[#0a0e17] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-scaleIn transition-[top,left,width,height] duration-200 ${
        isMaximized ? 'rounded-none border-none' : 'border-slate-700/80'
      } ${isActive ? 'ring-2 ring-amber-500/60 shadow-amber-500/10' : 'opacity-95'}`}
    >
      <div
        onMouseDown={handleMouseDown}
        className={`bg-slate-900 px-5 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-white shrink-0 select-none ${
          isMaximized ? 'cursor-default' : 'cursor-move active:cursor-grabbing'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="font-mono uppercase tracking-widest text-slate-200">{title}</span>
          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">• Process #{id}</span>
        </div>
        <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={onMinimize}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Minimizar Janela"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMaximize}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title={isMaximized ? 'Restaurar Janela' : 'Maximizar Janela'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Fechar Janela"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto flex-1 bg-[#0a0e17] custom-scrollbar">
        {children}
      </div>
    </div>
  );
};
