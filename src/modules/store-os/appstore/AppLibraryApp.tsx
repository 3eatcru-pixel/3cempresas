import React, { useEffect, useMemo, useState } from 'react';
import { AppWindow, RotateCcw, Search } from 'lucide-react';
import { useEcosystem } from '../../../context/EcosystemContext';
import { getDefaultEnabledModulesForCategory } from '../../../utils/storeDomain';
import {
  AppStoreModule,
  buildModulesList,
  CATEGORY_TABS,
  ModuleCategoryGroup,
} from './moduleCatalog';
import { AppLibraryModuleCard } from './AppLibraryModuleCard';

export type { AppStoreModule } from './moduleCatalog';

export const AppLibraryApp: React.FC = () => {
  const {
    currentStore,
    showNotification,
    updateEnabledModules,
    updateStoreOperationalSettings,
  } = useEcosystem();

  const resolveEnabledIds = () =>
    currentStore.enabledModules && currentStore.enabledModules.length > 0
      ? currentStore.enabledModules
      : getDefaultEnabledModulesForCategory(
          currentStore.category,
          currentStore.operationalSettings?.darkKitchenMode
        );

  const [modules, setModules] = useState<AppStoreModule[]>(() =>
    buildModulesList(resolveEnabledIds(), currentStore.operationalSettings)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<ModuleCategoryGroup>('ALL');

  useEffect(() => {
    setModules(buildModulesList(resolveEnabledIds(), currentStore.operationalSettings));
  }, [
    currentStore.id,
    currentStore.category,
    currentStore.enabledModules,
    currentStore.operationalSettings,
  ]);

  const toggleModule = async (mod: AppStoreModule) => {
    const nextEnabled = !mod.isEnabled;
    const updatedModules = modules.map((m) =>
      m.id === mod.id ? { ...m, isEnabled: nextEnabled } : m
    );
    setModules(updatedModules);

    if (mod.kind === 'APP_MODULE') {
      const enabledAppIds = updatedModules
        .filter((m) => m.kind === 'APP_MODULE' && m.isEnabled)
        .map((m) => m.id);
      await updateEnabledModules(currentStore.id, enabledAppIds);
    }

    if (mod.operationalKey) {
      await updateStoreOperationalSettings(currentStore.id, {
        [mod.operationalKey]: nextEnabled,
      });
    }

    showNotification(`${mod.name} ${nextEnabled ? 'ativado' : 'desativado'} na unidade.`);
  };

  const handleApplySegmentPreset = async () => {
    const recommendedIds = getDefaultEnabledModulesForCategory(
      currentStore.category,
      currentStore.operationalSettings?.darkKitchenMode
    );
    setModules(buildModulesList(recommendedIds, currentStore.operationalSettings));
    await updateEnabledModules(currentStore.id, recommendedIds);
    showNotification(`Módulos recomendados para "${currentStore.category}" ativados!`);
  };

  const visibleModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return modules.filter((m) => {
      if (activeGroup !== 'ALL' && m.group !== activeGroup) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    });
  }, [modules, activeGroup, searchQuery]);

  const activeCount = modules.filter((m) => m.isEnabled).length;

  return (
    <div className="space-y-5 h-full overflow-y-auto pr-2 custom-scrollbar text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
            <AppWindow className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase italic tracking-tighter">
              Central de Módulos &amp; Recursos do Store OS
            </h3>
            <p className="text-xs text-slate-400">
              Ative aplicativos no desktop da loja e recursos operacionais conforme o seu segmento.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void handleApplySegmentPreset()}
            className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preset ({currentStore.category})</span>
          </button>
          <span className="text-[11px] font-mono tabular-nums font-bold bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-amber-400">
            {activeCount}/{modules.length} ativos • {currentStore.name}
          </span>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveGroup(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                activeGroup === tab.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar módulo ou recurso..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleModules.map((mod) => (
          <AppLibraryModuleCard
            key={mod.id}
            module={mod}
            onToggle={(m) => void toggleModule(m)}
          />
        ))}
      </div>

      {visibleModules.length === 0 && (
        <div className="py-12 text-center text-xs text-slate-500">
          Nenhum módulo encontrado para &quot;{searchQuery}&quot;.
        </div>
      )}
    </div>
  );
};
