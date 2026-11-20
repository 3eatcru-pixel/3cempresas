import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldCheck, Store } from 'lucide-react';
import { PILLAR_THEMES, PillarId, STATUS_COLORS, SURFACE_TOKENS } from '@3c/design-system';
import { MainSectionId } from '../../types';
import { getActiveClientAppId } from '../../core/platform/PlatformAdapter';
import { isDynamicImportError } from '../../utils/lazyWithRetry';

interface PillarErrorBoundaryProps {
  pillarId: PillarId;
  pillarName?: string;
  onNavigateSection?: (sectionId: MainSectionId) => void;
  children: ReactNode;
}

interface PillarErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PillarErrorBoundary extends Component<
  PillarErrorBoundaryProps,
  PillarErrorBoundaryState
> {
  constructor(props: PillarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PillarErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PillarErrorBoundary] Erro capturado no pilar "${this.props.pillarId}":`, error, errorInfo);
  }

  componentDidUpdate(prevProps: PillarErrorBoundaryProps) {
    if (prevProps.pillarId !== this.props.pillarId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    if (isDynamicImportError(this.state.error) && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { pillarId, pillarName, onNavigateSection } = this.props;
      const theme = PILLAR_THEMES[pillarId] || PILLAR_THEMES['store-os'];
      const surface = SURFACE_TOKENS.dark;
      const danger = STATUS_COLORS.DANGER;
      const isUnifiedPortal = getActiveClientAppId() === 'unified-portal';

      return (
        <div className={`min-h-screen ${surface.canvasBg} flex flex-col items-center justify-center p-6 text-slate-100 animate-fadeIn`}>
          <div className={`max-w-lg w-full ${surface.elevatedBg} border ${danger.borderClass} rounded-3xl p-8 shadow-2xl space-y-6 text-center`}>
            <div className={`w-14 h-14 ${danger.bgClass} border ${danger.borderClass} rounded-2xl flex items-center justify-center mx-auto text-rose-400 shadow-lg`}>
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full ${danger.badgeClass}`}>
                Isolamento de Falha • {pillarName || theme.label}
              </span>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tight">
                Instabilidade Temporária no Módulo
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isUnifiedPortal ? (
                  <>
                    O pilar <strong className="text-slate-200">{pillarName || theme.label}</strong> encontrou uma falha de execução, mas o restante do ecossistema 3C Corp (Store OS, HQ Central e Server Core) permanece ativo e protegido.
                  </>
                ) : (
                  <>
                    O módulo <strong className="text-slate-200">{pillarName || theme.label}</strong> encontrou uma falha temporária de execução. Recarregue para continuar sua operação.
                  </>
                )}
              </p>
            </div>

            {this.state.error?.message && (() => {
              let formattedMessage = this.state.error.message;
              const trimmed = formattedMessage.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                  const parsed = JSON.parse(trimmed);
                  if (parsed && typeof parsed.error === 'string' && typeof parsed.operationType === 'string') {
                    formattedMessage = `Firestore [${String(parsed.operationType).toUpperCase()}] em "${parsed.path || 'desconhecido'}": ${parsed.error}`;
                  }
                } catch {
                  // preserve raw message
                }
              }
              return (
                <div className={`${surface.canvasBg} p-3.5 rounded-xl border ${surface.border} text-left`}>
                  <div className="text-[10px] font-mono text-slate-500 uppercase font-bold mb-1">
                    Diagnóstico Técnico
                  </div>
                  <div className="text-xs font-mono text-rose-300 break-words max-h-24 overflow-y-auto">
                    {formattedMessage}
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleRetry}
                className={`flex-1 py-3 px-4 ${theme.accentBgClass} hover:opacity-90 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md`}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Recarregar Módulo
              </button>

              {isUnifiedPortal && onNavigateSection && (
                <button
                  type="button"
                  onClick={() => onNavigateSection('portal')}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5" /> Portal
                </button>
              )}
            </div>

            {isUnifiedPortal && onNavigateSection && pillarId !== 'store-os' && (
              <div className={`pt-3 border-t ${surface.border} flex items-center justify-center gap-4 text-xs font-bold`}>
                <button
                  type="button"
                  onClick={() => onNavigateSection('store-os')}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5" /> Abrir Store OS
                </button>
                <span className="text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => onNavigateSection('hq-central')}
                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Abrir HQ Central
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
