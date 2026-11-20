import React, { useEffect, useState } from 'react';
import { Building2, LogOut, Sparkles } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useEcosystem } from '../../../context/EcosystemContext';
import { BrandLogo } from '../../../components/common/BrandLogo';
import { SAAS_PLAN_TIERS } from '../../../constants/platformDefaults';
import {
  getDefaultBranchesForPlan,
  getDefaultDevicesForPlan,
  getDefaultEnabledModulesForCategory,
} from '../../../utils/storeDomain';
import { getActiveClientAppId, getPlatformAdapters } from '../../../core/platform/PlatformAdapter';
import { geocodeAddressNominatim, isValidLatLng } from '../../../components/common/map/mapUtils';
import {
  StoreOnboardingForm,
  StoreOnboardingFormValues,
} from './onboarding/StoreOnboardingForm';

interface StoreOsOnboardingGateProps {
  onStoreCreated?: (storeId: string) => void;
}

const INITIAL_ONBOARDING_FORM: StoreOnboardingFormValues = {
  storeName: '',
  slug: '',
  category: 'RESTAURANT',
  phone: '',
  stateUf: '',
  city: '',
  neighborhood: '',
  address: '',
  pixKey: '',
  plan: 'FREE',
};

export const StoreOsOnboardingGate: React.FC<StoreOsOnboardingGateProps> = ({
  onStoreCreated,
}) => {
  const { profile, logout } = useAuth();
  const { addStore, setSelectedStoreId, governance, setActiveSection } = useEcosystem();

  const isStoreAdmin = profile?.role === 'STORE_OWNER' || profile?.role === 'STORE_MANAGER';

  const [form, setForm] = useState<StoreOnboardingFormValues>(INITIAL_ONBOARDING_FORM);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!form.stateUf) return;
    let active = true;
    const apiBase = getPlatformAdapters().network.getApiBaseUrl();
    fetch(`${apiBase}/maps/ibge/cities?uf=${encodeURIComponent(form.stateUf)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.cities)) return;
        setCityOptions(data.cities.map((c: any) => String(c.name || '')).filter(Boolean));
      })
      .catch(() => {
        if (active) setCityOptions([]);
      });
    return () => {
      active = false;
    };
  }, [form.stateUf]);

  const updateField = <K extends keyof StoreOnboardingFormValues>(
    key: K,
    value: StoreOnboardingFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNameChange = (val: string) => {
    const generatedSlug = val
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setForm((prev) => ({ ...prev, storeName: val, slug: generatedSlug }));
  };

  const handleStateChange = (nextUf: string) => {
    setForm((prev) => ({
      ...prev,
      stateUf: nextUf,
      city: prev.city.trim().toLowerCase() === 'londrina' && nextUf !== 'PR' ? '' : prev.city,
    }));
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.storeName.trim()) {
      setErrorMsg('Informe o nome comercial da loja.');
      return;
    }
    if (!form.city.trim() || form.city.trim().length < 2) {
      setErrorMsg('Informe a cidade onde sua loja opera.');
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      const customPricing = governance.planPricing?.[form.plan];
      const maxAllowedDevices = customPricing?.maxDevices ?? getDefaultDevicesForPlan(form.plan);
      const maxAllowedBranches = customPricing?.maxBranches ?? getDefaultBranchesForPlan(form.plan);

      const cleanCity = form.city.trim();
      const cleanState = form.stateUf.trim().toUpperCase();
      const cleanNeighborhood = form.neighborhood.trim();
      const cleanAddress = form.address.trim();

      const formattedAddress = [cleanAddress, cleanNeighborhood, `${cleanCity} - ${cleanState}`]
        .filter(Boolean)
        .join(', ');

      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const geoQuery = cleanAddress
          ? `${cleanAddress}, ${cleanNeighborhood ? `${cleanNeighborhood}, ` : ''}${cleanCity}, ${cleanState}, Brasil`
          : `${cleanCity}, ${cleanState}, Brasil`;
        const geo = await geocodeAddressNominatim(geoQuery, { countryCodes: 'br' });
        if (geo && isValidLatLng(geo.lat, geo.lng)) {
          latitude = parseFloat(geo.lat.toFixed(6));
          longitude = parseFloat(geo.lng.toFixed(6));
        }
      } catch {
        // Fallback below if geocoder is temporarily offline
      }

      const isLondrinaStart =
        cleanState === 'PR' &&
        cleanCity
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') === 'londrina';

      if (latitude === undefined && isLondrinaStart) {
        latitude = -23.3105;
        longitude = -51.1628;
      }

      const newStoreId = await addStore({
        name: form.storeName.trim(),
        slug: form.slug.trim() || `loja-${Date.now().toString(36)}`,
        category: form.category,
        rating: 5.0,
        deliveryTimeMin: 35,
        deliveryFee: 6.5,
        minOrder: 25.0,
        logo: '',
        banner: '',
        isOpen: true,
        commissionRate: 0,
        subscriptionPlan: form.plan,
        billingCycle: 'MONTHLY',
        maxAllowedDevices,
        maxAllowedBranches,
        saasMonthlyFee:
          customPricing?.monthlyPrice ??
          SAAS_PLAN_TIERS.find((p) => p.tier === form.plan)?.monthlyPrice ??
          0,
        saasPaymentStatus: form.plan === 'FREE' ? 'TRIAL' : 'PENDING',
        phone: form.phone.trim(),
        address: formattedAddress,
        city: cleanCity,
        state: cleanState,
        ...(cleanNeighborhood ? { neighborhood: cleanNeighborhood } : {}),
        ...(isLondrinaStart ? { region: 'CENTRO' as const } : {}),
        ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
        ...(form.pixKey.trim()
          ? { operationalSettings: { pixKey: form.pixKey.trim() } }
          : {}),
        totalOrders: 0,
        monthlyRevenue: 0,
        tenantStatus: 'ACTIVE',
        enabledModules: getDefaultEnabledModulesForCategory(form.category),
      });

      if (newStoreId) {
        setSelectedStoreId(newStoreId);
        onStoreCreated?.(newStoreId);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao criar loja. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    if (getActiveClientAppId() === 'unified-portal') {
      setActiveSection('portal');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      <header className="border-b border-slate-900 bg-slate-950/95 backdrop-blur px-6 py-4 flex items-center justify-between">
        <BrandLogo id="store-os" size="sm" />
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sair da Conta ({profile?.email})</span>
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-8 animate-fadeIn">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Inicialização de Empresa · Store OS Brasil</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Configure sua primeira loja
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {isStoreAdmin
                ? 'Nenhuma unidade comercial cadastrada foi localizada para a sua conta. Preencha os dados da sua cidade e estabelecimento para desbloquear o PDV, KDS, controle de estoque e a vitrine pública.'
                : 'Sua conta de colaborador não possui nenhuma filial comercial vinculada no momento. Solicite ao gestor da empresa (STORE_OWNER) para associar seu perfil a uma loja ativa.'}
            </p>
          </div>

          {!isStoreAdmin ? (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-4">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-300">Acesso Operacional Pendente</p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Apenas proprietários da conta (`STORE_OWNER`) podem provisionar novas empresas e unidades comerciais.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Trocar de Usuário
              </button>
            </div>
          ) : (
            <StoreOnboardingForm
              form={form}
              cityOptions={cityOptions}
              loading={loading}
              errorMsg={errorMsg}
              onNameChange={handleNameChange}
              onStateChange={handleStateChange}
              onUpdateField={updateField}
              onSubmit={(e) => void handleCreateStore(e)}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-600">
        Store OS · Sistema Operacional Comercial Multi-Empresa · 3C Corp
      </footer>
    </div>
  );
};
