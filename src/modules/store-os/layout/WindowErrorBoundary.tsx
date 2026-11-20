import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';

interface WindowErrorBoundaryProps {
  appId: string;
  onClose?: () => void;
  children: ReactNode;
}

interface WindowErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class WindowErrorBoundary extends Component<
  WindowErrorBoundaryProps,
  WindowErrorBoundaryState
> {
  constructor(props: WindowErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WindowErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[WindowErrorBoundary] Erro na janela "${this.props.appId}":`, error, errorInfo);
  }

  componentDidUpdate(prevProps: WindowErrorBoundaryProps) {
    if (prevProps.appId !== this.props.appId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const danger = STATUS_COLORS.DANGER;
      const surface = SURFACE_TOKENS.dark;

      return (
        <div className={`h-full flex flex-col items-center justify-center p-6 text-center space-y-4 ${surface.canvasBg} text-slate-100`}>
          <div className={`p-4 rounded-2xl ${danger.bgClass} border ${danger.borderClass} text-rose-400`}>
            <AlertCircle className="w-8 h-8 mx-auto" />
          </div>

          <div className="space-y-1 max-w-sm">
            <h4 className="text-base font-black text-white uppercase italic tracking-tight">
              Falha no Módulo ({this.props.appId})
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ocorreu uma instabilidade nesta janela. O restante do Store OS e os outros módulos continuam operando normalmente.
            </p>
          </div>

          {this.state.error?.message && (
            <div className={`max-w-md w-full p-3 rounded-xl border ${danger.borderClass} ${danger.bgClass} text-left text-[11px] font-mono text-rose-300 break-words`}>
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recarregar
            </button>
            {this.props.onClose && (
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <X className="w-3.5 h-3.5" /> Fechar Janela
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
