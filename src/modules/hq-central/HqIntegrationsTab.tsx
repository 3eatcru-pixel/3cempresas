import React, { useEffect, useState } from 'react';
import { Globe, Layers, Plus, RefreshCw } from 'lucide-react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { HqAddIntegrationModal, NewIntegrationDraft } from './integrations/HqAddIntegrationModal';
import { HqIntegrationCard } from './integrations/HqIntegrationCard';
import { HqProviderTierCards } from './integrations/HqProviderTierCards';
import { HqFirebaseServicesGrid } from './integrations/HqFirebaseServicesGrid';
import { HqFirebaseFirestoreCorePanel } from './integrations/HqFirebaseFirestoreCorePanel';
import { HqSupabaseServicesGrid } from './integrations/HqSupabaseServicesGrid';
import { getFirebaseRuntimeMetadata } from '../../services/firebaseClient';
import { getSupabaseRuntimeMetadata } from '../../services/supabaseClient';
import {
  IntegrationProviderDescriptor,
  providerManager,
} from '../../infrastructure/providers/ProviderManager';
import { PlatformGovernance } from '../../types';

const INITIAL_INTEGRATION_DRAFT: NewIntegrationDraft = {
  name: '',
  category: 'API',
  apiKey: '',
  endpointUrl: '',
  lastSync: 'Pendente de validação',
  status: 'CONFIGURED',
};

export const HqIntegrationsTab: React.FC = () => {
  const { profile } = useAuth();
  const {
    governance,
    toggleFeatureFlag,
    integrations,
    addIntegration,
    deleteIntegration,
    testIntegration,
    dispatchIntegrationWebhookTest,
    suspendIntegration,
  } = useEcosystem();

  const [isAddingInteg, setIsAddingInteg] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);
  const [isProbingProviders, setIsProbingProviders] = useState(false);
  const [providerDescriptors, setProviderDescriptors] = useState<IntegrationProviderDescriptor[]>(() => {
    providerManager.syncGovernance(governance);
    return providerManager.getProviderDescriptors();
  });
  const [newInteg, setNewInteg] = useState<NewIntegrationDraft>(INITIAL_INTEGRATION_DRAFT);

  const isDevOwner = profile?.role === 'DEV_OWNER';
  const firebaseEnabled = governance?.featureFlags?.firebaseEnabled !== false;
  const firebaseFirestoreEnabled =
    firebaseEnabled && governance?.featureFlags?.firebaseFirestoreEnabled !== false;
  const supabaseEnabled = governance?.featureFlags?.supabaseEnabled !== false;
  const firebaseMeta = getFirebaseRuntimeMetadata();
  const supabaseMeta = getSupabaseRuntimeMetadata();

  useEffect(() => {
    providerManager.syncGovernance(governance);
    setProviderDescriptors(providerManager.getProviderDescriptors());
  }, [governance]);

  const handleToggleFlag = async (flagKey: keyof PlatformGovernance['featureFlags']) => {
    if (!isDevOwner || togglingFlag) return;
    setTogglingFlag(String(flagKey));
    try {
      await toggleFeatureFlag(flagKey);
    } finally {
      setTogglingFlag(null);
    }
  };

  const handleProbeProviderLayer = async () => {
    if (isProbingProviders) return;
    setIsProbingProviders(true);
    try {
      providerManager.syncGovernance(governance);
      const res = await providerManager.probeAllProviders();
      setProviderDescriptors(res.descriptors);
    } finally {
      setIsProbingProviders(false);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInteg.name.trim()) return;
    await addIntegration({
      name: newInteg.name.trim(),
      category: newInteg.category,
      apiKey: newInteg.apiKey.trim() || undefined,
      endpointUrl: newInteg.endpointUrl.trim() || undefined,
      apiKeyMasked: newInteg.apiKey.trim() ? `${newInteg.apiKey.trim().slice(0, 4)}••••••••` : 'NÃO CONFIGURADO',
      lastSync: newInteg.lastSync,
      status: 'CONFIGURED',
    } as any);
    setIsAddingInteg(false);
    setNewInteg(INITIAL_INTEGRATION_DRAFT);
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      await testIntegration(id);
    } finally {
      setTestingId(null);
    }
  };

  const primaryDescriptor = providerDescriptors.find((d) => d.id === 'PRIMARY_SERVER_CORE');
  const secondaryDescriptor = providerDescriptors.find((d) => d.id === 'SECONDARY_FIREBASE_PROVIDER');
  const supabaseDescriptor = providerDescriptors.find((d) => d.id === 'SECONDARY_SUPABASE_PROVIDER');

  return (
    <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6 animate-fadeIn">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2 uppercase tracking-tight">
            <Layers className="w-5 h-5 text-amber-400" />
            Integrations Manager — Camada de Conexão (Provider Adapter)
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl mt-1">
            Gerencia provedores primários e secundários, conexões, sincronização e disponibilidade. O{' '}
            <strong className="text-cyan-300">Server Core próprio é a autoridade única dos dados comerciais</strong>,
            enquanto Firebase e Supabase operam como adaptadores secundários opcionais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleProbeProviderLayer()}
            disabled={isProbingProviders}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isProbingProviders ? 'animate-spin' : ''}`} />
            {isProbingProviders ? 'Testando Provedores...' : 'Testar Conexões (Primary + Secondary)'}
          </button>
          {isDevOwner && (
            <button
              type="button"
              onClick={() => setIsAddingInteg(true)}
              className="px-4 py-2 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> NOVA INTEGRAÇÃO
            </button>
          )}
        </div>
      </div>

      <HqProviderTierCards
        primaryDescriptor={primaryDescriptor}
        secondaryDescriptor={secondaryDescriptor}
        supabaseDescriptor={supabaseDescriptor}
        firebaseEnabled={firebaseEnabled}
        firebaseProjectId={firebaseMeta.projectId}
        supabaseEnabled={supabaseEnabled}
        supabaseUrl={governance?.runtimePolicy?.supabaseUrl || supabaseMeta.url}
        isDevOwner={isDevOwner}
        togglingFlag={togglingFlag}
        onToggleFirebaseEnabled={() => void handleToggleFlag('firebaseEnabled')}
        onToggleSupabaseEnabled={() => void handleToggleFlag('supabaseEnabled')}
      />

      <HqSupabaseServicesGrid
        governance={governance}
        supabaseEnabled={supabaseEnabled}
        statusDetail={supabaseDescriptor?.statusDetail}
        isDevOwner={isDevOwner}
        togglingFlag={togglingFlag}
        onToggleFlag={(key) => void handleToggleFlag(key)}
      />

      <HqFirebaseServicesGrid
        governance={governance}
        firebaseEnabled={firebaseEnabled}
        statusDetail={secondaryDescriptor?.statusDetail}
        isDevOwner={isDevOwner}
        togglingFlag={togglingFlag}
        onToggleFlag={(key) => void handleToggleFlag(key)}
      />

      <HqFirebaseFirestoreCorePanel
        firebaseEnabled={firebaseEnabled}
        firebaseFirestoreEnabled={firebaseFirestoreEnabled}
        isDevOwner={isDevOwner}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            Gateways de Pagamento, Mensageria, Fiscal &amp; Webhooks ({integrations.length})
          </h3>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {integrations.map((integ) => (
            <HqIntegrationCard
              key={integ.id}
              integration={integ}
              isDevOwner={isDevOwner}
              isTesting={testingId === integ.id}
              onTest={handleTest}
              onWebhookTest={dispatchIntegrationWebhookTest}
              onSuspend={suspendIntegration}
              onDelete={deleteIntegration}
            />
          ))}
        </div>
      </div>

      {isAddingInteg && (
        <HqAddIntegrationModal
          newInteg={newInteg}
          setNewInteg={setNewInteg}
          onClose={() => setIsAddingInteg(false)}
          onSubmit={handleAddSubmit}
        />
      )}
    </div>
  );
};
