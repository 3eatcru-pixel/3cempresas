import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Database, Flame, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import {
  FirebaseConnectionProbeResult,
  getFirebaseRuntimeMetadata,
  testFirebaseConnection,
} from '../../../services/firebaseClient';

interface ServerFirebaseBackboneCardProps {
  firebaseEnabled: boolean;
  firebaseAuthEnabled?: boolean;
  firebaseFirestoreEnabled?: boolean;
}

export const ServerFirebaseBackboneCard: React.FC<ServerFirebaseBackboneCardProps> = ({
  firebaseEnabled,
  firebaseAuthEnabled = firebaseEnabled,
  firebaseFirestoreEnabled = firebaseEnabled,
}) => {
  const meta = getFirebaseRuntimeMetadata();
  const firestoreActive = firebaseEnabled && firebaseFirestoreEnabled;
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<FirebaseConnectionProbeResult | null>(null);

  const handleProbe = useCallback(async () => {
    if (!firestoreActive) {
      setProbeResult({
        online: false,
        latencyMs: 0,
        projectId: meta.projectId,
        firestoreDatabaseId: meta.firestoreDatabaseId,
        detail: 'Firestore Cores está em modo STANDBY na governança do HQ Central (probe ignorado).',
      });
      return;
    }
    setProbing(true);
    try {
      const result = await testFirebaseConnection();
      setProbeResult(result);
    } finally {
      setProbing(false);
    }
  }, [firestoreActive, meta.projectId, meta.firestoreDatabaseId]);

  useEffect(() => {
    if (firestoreActive) {
      void handleProbe();
    } else {
      setProbeResult(null);
    }
  }, [firestoreActive, handleProbe]);

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-tight">
              Server Core Backbone — Adaptador Opcional Firebase &amp; Firestore
            </h2>
            <p className="text-xs text-slate-400">
              Executa a troca criptográfica RS256 (<code className="text-cyan-300">/api/v1/auth/firebase-exchange</code>) e mantém conectividade Firestore sob governança 1-clique do HQ Central.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
              firebaseEnabled
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {firebaseEnabled ? 'HQ: ATIVO' : 'HQ: DESATIVADO (STANDBY)'}
          </span>
          <button
            type="button"
            disabled={probing || !firestoreActive}
            onClick={() => void handleProbe()}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
            {probing ? 'Testando...' : 'Testar Firestore'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-amber-400" />
            Projeto &amp; Banco Nomeado
          </div>
          <div className="font-mono font-bold text-white truncate">{meta.projectId}</div>
          <div className="text-[11px] font-mono text-slate-400 truncate" title={meta.firestoreDatabaseId}>
            DB: {meta.firestoreDatabaseId} · {firestoreActive ? 'Firestore ATIVO' : 'Firestore STANDBY'}
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Bridge de Identidade Separada
          </div>
          <div className="font-mono font-bold text-cyan-300">POST /api/v1/auth/firebase-exchange</div>
          <div className="text-[11px] text-slate-400">
            Validação RS256 + appId escopado por produto (Marketplace, Store OS, Driver, Waiter, HQ).
          </div>
        </div>

        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Auth Domain &amp; Status
          </div>
          <div className="font-mono font-bold text-white truncate">{meta.authDomain}</div>
          <div className="text-[11px] text-slate-400">
            {firebaseEnabled && firebaseAuthEnabled
              ? 'Login Google ativo nos produtos autorizados.'
              : 'Bloqueado via HTTP 403 até reativação no HQ.'}
          </div>
        </div>
      </div>

      {probeResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
            probeResult.online
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              : 'bg-red-950/30 border-red-500/30 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {probeResult.online ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{probeResult.detail}</span>
          </div>
          <span className="font-mono text-[11px] shrink-0">
            {probeResult.online ? `ONLINE · ${probeResult.latencyMs}ms` : `OFFLINE · ${probeResult.latencyMs}ms`}
          </span>
        </div>
      )}
    </div>
  );
};
