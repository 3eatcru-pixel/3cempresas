import React, { useCallback, useEffect, useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../core/api/apiClient';
import { ReleaseDistributionConfig } from '../../types';
import { RELEASE_PRODUCT_ORDER, ReleaseArtifactsResponse } from './downloads/types';
import { HqDownloadsKpiStrip } from './downloads/HqDownloadsKpiStrip';
import { HqDownloadsConfigForm } from './downloads/HqDownloadsConfigForm';
import { HqDownloadsArtifactsList } from './downloads/HqDownloadsArtifactsList';

export const HqDownloadsTab: React.FC = () => {
  const { profile } = useAuth();
  const { governance, updateGovernanceSettings, showNotification } = useEcosystem();
  const isDevOwner = profile?.role === 'DEV_OWNER';

  const [manifest, setManifest] = useState<ReleaseArtifactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const [draft, setDraft] = useState<ReleaseDistributionConfig>(() => ({
    releaseBaseUrl: governance?.releaseConfig?.releaseBaseUrl || '',
    channel: governance?.releaseConfig?.channel || 'stable',
    minSupportedVersionOverride: governance?.releaseConfig?.minSupportedVersionOverride || '',
    releaseNotesOverride: governance?.releaseConfig?.releaseNotesOverride || '',
    disabledProducts: governance?.releaseConfig?.disabledProducts || [],
    artifactSignatures: governance?.releaseConfig?.artifactSignatures || {},
  }));

  useEffect(() => {
    if (governance?.releaseConfig) {
      setDraft({
        releaseBaseUrl: governance.releaseConfig.releaseBaseUrl || '',
        channel: governance.releaseConfig.channel || 'stable',
        minSupportedVersionOverride: governance.releaseConfig.minSupportedVersionOverride || '',
        releaseNotesOverride: governance.releaseConfig.releaseNotesOverride || '',
        disabledProducts: Array.isArray(governance.releaseConfig.disabledProducts)
          ? governance.releaseConfig.disabledProducts
          : [],
        artifactSignatures: governance.releaseConfig.artifactSignatures || {},
      });
    }
  }, [governance?.releaseConfig]);

  const loadArtifacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiClient.getReleaseArtifacts()) as ReleaseArtifactsResponse;
      setManifest(data);
    } catch (err: any) {
      showNotification(err?.message || 'Erro ao carregar manifesto de downloads.');
    } finally {
      setLoading(false);
    }
  }, [showNotification]);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDevOwner || saving) return;
    setSaving(true);
    try {
      await updateGovernanceSettings({ releaseConfig: draft });
      await loadArtifacts();
    } finally {
      setSaving(false);
    }
  };

  const toggleProductVisibility = (appId: string) => {
    if (!isDevOwner) return;
    setDraft((prev) => {
      const exists = prev.disabledProducts.includes(appId);
      return {
        ...prev,
        disabledProducts: exists
          ? prev.disabledProducts.filter((p) => p !== appId)
          : [...prev.disabledProducts, appId],
      };
    });
  };

  const copyCommand = async (cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      showNotification('Comando de build copiado.');
      setTimeout(() => setCopiedCmd(null), 2000);
    } catch {
      showNotification('Não foi possível copiar para a área de transferência.');
    }
  };

  const orderedProducts = manifest
    ? RELEASE_PRODUCT_ORDER.map((id) => manifest.products[id]).filter(Boolean)
    : [];

  const allBinaryArtifacts = orderedProducts.flatMap((p) =>
    p.artifacts.filter((a) => a.platform !== 'web' && a.platform !== 'docker')
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      <HqDownloadsKpiStrip
        manifest={manifest}
        fallbackChannel={draft.channel}
        publishedCount={allBinaryArtifacts.filter((a) => a.available).length}
        totalBinaryCount={allBinaryArtifacts.length}
        unpublishedCount={allBinaryArtifacts.filter((a) => a.source === 'UNPUBLISHED').length}
        disabledCount={allBinaryArtifacts.filter((a) => a.source === 'DISABLED_BY_HQ').length}
        loading={loading}
        onRefresh={() => void loadArtifacts()}
      />

      <HqDownloadsConfigForm
        draft={draft}
        isDevOwner={isDevOwner}
        saving={saving}
        onChangeDraft={setDraft}
        onToggleProduct={toggleProductVisibility}
        onSubmit={handleSaveConfig}
      />

      <HqDownloadsArtifactsList
        products={orderedProducts}
        copiedCmd={copiedCmd}
        onCopyCommand={(cmd) => void copyCommand(cmd)}
      />
    </div>
  );
};
