import React from 'react';
import { Activity, BarChart3, Bell, Bug, Database, KeyRound } from 'lucide-react';
import { PlatformGovernance } from '../../../types';

interface ComplementaryFirebaseService {
  id: string;
  flagKey?: keyof PlatformGovernance['featureFlags'];
  title: string;
  serviceName: string;
  utilization: string;
  implemented: boolean;
  defaultEnabled: boolean;
  icon: React.FC<{ className?: string }>;
}

const COMPLEMENTARY_FIREBASE_SERVICES: ComplementaryFirebaseService[] = [
  {
    id: 'firebase-auth',
    flagKey: 'firebaseAuthEnabled',
    title: 'Firebase Authentication',
    serviceName: 'src/services/firebase/firebaseAuthCore.ts',
    utilization:
      'Login Google OAuth verificado por RS256 no Server Core com isolamento estrito por produto e tenant',
    implemented: true,
    defaultEnabled: true,
    icon: KeyRound,
  },
  {
    id: 'firestore-cores',
    flagKey: 'firebaseFirestoreEnabled',
    title: 'Firestore Cores (Perfil, Prefs & Admins)',
    serviceName: 'firebasePreferencesCore + firebaseAdminsCore',
    utilization:
      'Health probe, perfil (/users), preferências multi-dispositivo (/cloud_preferences) e governança (/admins) sob firestore.rules Zero-Trust',
    implemented: true,
    defaultEnabled: true,
    icon: Database,
  },
  {
    id: 'firebase-fcm',
    title: 'Firebase Cloud Messaging',
    serviceName: 'notification.interface',
    utilization: 'Push móvel complementar (atualmente entregue exclusivamente via Server Core / SSE)',
    implemented: false,
    defaultEnabled: false,
    icon: Bell,
  },
  {
    id: 'firebase-analytics',
    title: 'Firebase Analytics',
    serviceName: 'analytics.interface',
    utilization: 'Telemetria externa de funil (atualmente auditada localmente no Server Core)',
    implemented: false,
    defaultEnabled: false,
    icon: BarChart3,
  },
  {
    id: 'firebase-crashlytics',
    title: 'Firebase Crashlytics',
    serviceName: 'crash.interface',
    utilization: 'Captura nativa de crashes Android (aguardando build Gradle com SDK nativo)',
    implemented: false,
    defaultEnabled: false,
    icon: Bug,
  },
];

interface HqFirebaseServicesGridProps {
  governance: PlatformGovernance;
  firebaseEnabled: boolean;
  statusDetail?: string;
  isDevOwner: boolean;
  togglingFlag: string | null;
  onToggleFlag: (flagKey: keyof PlatformGovernance['featureFlags']) => void;
}

export const HqFirebaseServicesGrid: React.FC<HqFirebaseServicesGridProps> = ({
  governance,
  firebaseEnabled,
  statusDetail,
  isDevOwner,
  togglingFlag,
  onToggleFlag,
}) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            Serviços Complementares do Provedor Secundário (Firebase Cores)
          </h3>
          <p className="text-[11px] text-slate-400">
            Ative ou desative cada serviço individualmente sem afetar a autoridade comercial do Server Core.
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          Status: {statusDetail || 'Pronto'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {COMPLEMENTARY_FIREBASE_SERVICES.map((svc) => {
          const Icon = svc.icon;
          const rawFlag = svc.flagKey ? governance?.featureFlags?.[svc.flagKey] : undefined;
          const isSvcEnabled =
            svc.implemented &&
            firebaseEnabled &&
            (rawFlag !== undefined ? Boolean(rawFlag) : svc.defaultEnabled);
          const isTogglingThis = Boolean(svc.flagKey && togglingFlag === String(svc.flagKey));

          return (
            <div
              key={svc.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                isSvcEnabled
                  ? 'bg-slate-900/90 border-emerald-500/30'
                  : 'bg-slate-950/60 border-slate-800/80 opacity-75'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                      !svc.implemented
                        ? 'bg-slate-900 text-slate-500 border border-slate-800'
                        : isSvcEnabled
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {!svc.implemented ? 'NÃO INTEGRADO' : isSvcEnabled ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
                <h4 className="text-xs font-black text-white leading-tight">{svc.title}</h4>
                <p className="text-[10px] font-mono text-cyan-400 break-all">{svc.serviceName}</p>
                <p className="text-[10px] text-slate-400 leading-snug">{svc.utilization}</p>
              </div>

              {svc.implemented && svc.flagKey ? (
                <button
                  type="button"
                  disabled={!isDevOwner || !firebaseEnabled || isTogglingThis}
                  onClick={() => onToggleFlag(svc.flagKey!)}
                  className={`w-full py-1.5 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isSvcEnabled
                      ? 'bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700'
                      : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isTogglingThis ? 'Salvando...' : isSvcEnabled ? 'Desativar Serviço' : 'Ativar Serviço'}
                </button>
              ) : svc.implemented ? (
                <div className="w-full py-1.5 px-2.5 rounded-lg text-[10px] font-mono text-center bg-slate-900 text-slate-400 border border-slate-800">
                  Controlado pela chave mestra
                </div>
              ) : (
                <div className="w-full py-1.5 px-2.5 rounded-lg text-[10px] font-mono text-center bg-slate-950 text-slate-500 border border-slate-800/80">
                  Roadmap (Server Core ativo)
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
