import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react';
import { STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';

interface HqTabErrorBoundaryProps {
  tabId: string;
  tabLabel?: string;
  onGoToDashboard?: () => void;
  children: ReactNode;
}

interface HqTabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class HqTabErrorBoundary extends Component<
  HqTabErrorBoundaryProps,
  HqTabErrorBoundaryState
> {
  constructor(props: HqTabErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): HqTabErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[HqTabErrorBoundary] Erro na aba "${this.props.tabId}":`, error, errorInfo);
  }

  componentDidUpdate(prevProps: HqTabErrorBoundaryProps) {
    if (prevProps.tabId !== this.props.tabId && this.state.hasError) {
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
        <div className={`p-8 rounded-3xl ${surface.elevatedBg} border ${danger.borderClass} space-y-5 text-center max-w-xl mx-auto my-12 animate-fadeIn`}>
          <div className={`w-12 h-12 rounded-2xl ${danger.bgClass} border ${danger.borderClass} text-rose-400 flex items-center justify-center mx-auto shadow-lg`}>
            <AlertTriangle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-black text-white uppercase italic tracking-tight">
              Instabilidade na Aba {this.props.tabLabel || this.props.tabId}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Esta seção do HQ Central encontrou um erro inesperado, mas a governança do cluster, o faturamento e os demais módulos continuam operando normalmente.
            </p>
          </div>

          {this.state.error?.message && (
            <div className={`p-3 rounded-xl ${surface.canvasBg} border ${surface.border} text-left text-[11px] font-mono text-rose-300 break-words`}>
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow-md transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Recarregar Aba
            </button>
            {this.props.onGoToDashboard && this.props.tabId !== 'dashboard' && (
              <button
                type="button"
                onClick={this.props.onGoToDashboard}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all"
              >
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
