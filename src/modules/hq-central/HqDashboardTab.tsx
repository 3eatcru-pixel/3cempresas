import React, { useState } from 'react';
import { useEcosystem } from '../../context/EcosystemContext';
import { useAuth } from '../../context/AuthContext';
import { DEFAULT_PLATFORM_GOVERNANCE } from '../../constants/platformDefaults';

// Modular Layout Components
import { HqOperationalAlertsBanner } from './layout/HqOperationalAlertsBanner';
import { HqDevOnboardingCard } from './layout/HqDevOnboardingCard';
import { HqMetricCards } from './layout/HqMetricCards';
import { HqCostRadar } from './layout/HqCostRadar';
import { HqInfrastructureCosts } from './layout/HqInfrastructureCosts';
import { HqFeatureFlags } from './layout/HqFeatureFlags';
import { HqEcosystemCustomizer } from './layout/HqEcosystemCustomizer';
import { HqRegionalGovernance } from './layout/HqRegionalGovernance';
import { HqClusterPulse } from './layout/HqClusterPulse';
import { HqEngineeringHub } from './layout/HqEngineeringHub';
import type { HqTabId } from './layout/HqSidebar';

interface HqDashboardTabProps {
  onNavigateTab?: (tab: HqTabId) => void;
}

export const HqDashboardTab: React.FC<HqDashboardTabProps> = ({ onNavigateTab }) => {
  const { profile } = useAuth();
  const {
    governance: rawGovernance,
    stores,
    orders,
    drivers,
    integrations,
    deviceLicenses,
    financialRecords,
    toggleFeatureFlag,
    updateGovernanceSettings,
    systemHealth,
    eventLogs,
  } = useEcosystem();
  const isDevOwner = profile?.role === 'DEV_OWNER';
  const governance = rawGovernance || DEFAULT_PLATFORM_GOVERNANCE;
  const activeStores = stores.filter((s) => s.tenantStatus !== 'SUSPENDED');
  const suspendedStoresCount = stores.length - activeStores.length;
  const totalSaaSRevenue = activeStores.reduce((acc, s) => acc + (s.saasMonthlyFee || 0), 0);
  const paidSaaSRevenue = activeStores
    .filter((s) => s.saasPaymentStatus === 'PAID')
    .reduce((acc, s) => acc + (s.saasMonthlyFee || 0), 0);
  const liveNonCancelledOrders = orders.filter((o) => o.status !== 'CANCELLED');
  const featureFlags = governance.featureFlags || DEFAULT_PLATFORM_GOVERNANCE.featureFlags;

  const [selectedHqRegion, setSelectedHqRegion] = useState<string>('ALL');

  const infraExpenses = financialRecords.filter(
    (r) =>
      (!r.storeId || r.storeId === 'HQ_PLATFORM') &&
      r.type === 'PAYABLE' &&
      ['INFRA', 'CLOUD', 'MAPS', 'SMS', 'COURIER_SUBSIDY'].includes(String(r.category || '').toUpperCase())
  );
  const sumCategory = (cat: string) =>
    Number(
      infraExpenses
        .filter((r) => String(r.category || '').toUpperCase() === cat)
        .reduce((a, r) => a + (Number(r.amount) || 0), 0)
        .toFixed(2)
    );

  const infrastructureCosts = {
    openFreeMaps: sumCategory('MAPS'),
    autonomousEngine: sumCategory('INFRA') + sumCategory('CLOUD'),
    platformCouriers: sumCategory('COURIER_SUBSIDY'),
    smsWhatsappApi: sumCategory('SMS'),
  };
  const totalCosts = Object.values(infrastructureCosts).reduce((a, b) => a + b, 0);
  const netPlatformProfit = totalSaaSRevenue - totalCosts;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <HqOperationalAlertsBanner
        stores={stores}
        orders={orders}
        deviceLicenses={deviceLicenses}
        systemHealth={systemHealth}
      />

      {isDevOwner && (
        <HqDevOnboardingCard
          profile={profile}
          systemHealth={systemHealth}
          stores={stores}
          integrations={integrations}
          deviceLicenses={deviceLicenses}
          drivers={drivers}
          orders={orders}
          onNavigateTab={onNavigateTab}
        />
      )}

      {isDevOwner && <HqClusterPulse systemHealth={systemHealth} />}

      <HqMetricCards
        totalSaaSRevenue={totalSaaSRevenue}
        paidSaaSRevenue={paidSaaSRevenue}
        totalCosts={totalCosts}
        netPlatformProfit={netPlatformProfit}
        storesCount={activeStores.length}
        suspendedStoresCount={suspendedStoresCount}
        deviceLicensesCount={deviceLicenses.length}
      />

      <HqCostRadar
        totalSaaSRevenue={totalSaaSRevenue}
        totalCosts={totalCosts}
        storesCount={stores.length}
        persistenceDriver={systemHealth?.persistenceDriver || 'json-memory'}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <HqInfrastructureCosts
          infrastructureCosts={infrastructureCosts}
          activeConnections={systemHealth?.activeConnections ?? 0}
          persistenceDriver={systemHealth?.persistenceDriver || 'json-memory'}
        />
        <HqFeatureFlags
          featureFlags={featureFlags}
          canToggle={isDevOwner}
          onToggleFlag={toggleFeatureFlag}
        />
      </div>

      <HqEcosystemCustomizer
        governance={governance}
        canEdit={isDevOwner}
        onSaveGovernance={updateGovernanceSettings}
      />

      <HqRegionalGovernance
        selectedHqRegion={selectedHqRegion}
        setSelectedHqRegion={setSelectedHqRegion}
        stores={stores}
        orders={liveNonCancelledOrders}
      />

      {isDevOwner && (
        <HqEngineeringHub
          eventLogs={eventLogs}
          systemHealth={systemHealth}
        />
      )}
    </div>
  );
};
