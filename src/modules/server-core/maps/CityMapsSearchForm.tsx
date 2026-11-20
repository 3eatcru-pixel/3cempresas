import React from 'react';
import { Globe2, Loader2, Navigation, Plus, RotateCcw, Search } from 'lucide-react';
import { IbgeCityItem, IbgeStateItem } from './cityMapsTypes';

interface CityMapsSearchFormProps {
  country: string;
  states: IbgeStateItem[];
  cities: IbgeCityItem[];
  selectedUf: string;
  onSelectUf: (uf: string) => void;
  selectedCity: string;
  onSelectCity: (city: string) => void;
  selectedRegion: string;
  onSelectRegion: (region: string) => void;
  neighborhood: string;
  onChangeNeighborhood: (val: string) => void;
  street: string;
  onChangeStreet: (val: string) => void;
  houseNumber: string;
  onChangeHouseNumber: (val: string) => void;
  cep: string;
  onChangeCep: (val: string) => void;
  availableRegions: string[];
  availableNeighborhoods: string[];
  currentStateObj?: IbgeStateItem;
  currentCityObj?: IbgeCityItem;
  isLoadingStates: boolean;
  isLoadingCities: boolean;
  isQueryingDirectory: boolean;
  isGeocodingPin: boolean;
  isSavingIndex: boolean;
  onResetFilters: () => void;
  onSaveToCityIndex: () => void;
  onFetchCityDirectory: () => void;
  onLocateOnMap: () => void;
}

export const CityMapsSearchForm: React.FC<CityMapsSearchFormProps> = ({
  country,
  states,
  cities,
  selectedUf,
  onSelectUf,
  selectedCity,
  onSelectCity,
  selectedRegion,
  onSelectRegion,
  neighborhood,
  onChangeNeighborhood,
  street,
  onChangeStreet,
  houseNumber,
  onChangeHouseNumber,
  cep,
  onChangeCep,
  availableRegions,
  availableNeighborhoods,
  currentStateObj,
  currentCityObj,
  isLoadingStates,
  isLoadingCities,
  isQueryingDirectory,
  isGeocodingPin,
  isSavingIndex,
  onResetFilters,
  onSaveToCityIndex,
  onFetchCityDirectory,
  onLocateOnMap,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Globe2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Server Core</span>
            <span aria-hidden="true">/</span>
            <span className="text-slate-200 font-medium">City Maps Data</span>
          </div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            Base Territorial e Endereços Municipais
          </h2>
          <p className="text-xs text-slate-400">
            Brasil · IBGE Localidades · Correios ViaCEP (faixas por número) · OpenStreetMap · SIGLON Londrina
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onResetFilters}
            className="px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-slate-600 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpar Filtros</span>
          </button>
          <button
            type="button"
            onClick={onSaveToCityIndex}
            disabled={isSavingIndex}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            {isSavingIndex ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Salvar no Índice</span>
          </button>
        </div>
      </div>

      {/* Country -> Estado -> Cidade -> Região -> Bairro -> Rua -> Número -> CEP */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLocateOnMap();
        }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">País (Country)</label>
          <input
            type="text"
            readOnly
            value={`${country} (BR)`}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Estado {isLoadingStates ? '(Carregando...)' : ''}
          </label>
          <select
            value={selectedUf}
            onChange={(e) => onSelectUf(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {states.length === 0 ? (
              <option value="PR">PR - Paraná</option>
            ) : (
              states.map((st) => (
                <option key={st.uf} value={st.uf}>
                  {st.uf} - {st.name} ({st.region})
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Cidade{' '}
            {isLoadingCities
              ? '(Carregando IBGE...)'
              : currentCityObj?.mesorregiao
              ? `· ${currentCityObj.mesorregiao}`
              : ''}
          </label>
          <select
            value={selectedCity}
            onChange={(e) => onSelectCity(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {cities.length === 0 ? (
              <option value={selectedCity}>{selectedCity}</option>
            ) : (
              cities.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Região</label>
          <select
            value={selectedRegion}
            onChange={(e) => onSelectRegion(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="">Todas as regiões</option>
            {availableRegions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Bairro</label>
          <input
            type="text"
            list="city-maps-neighborhoods"
            value={neighborhood}
            onChange={(e) => onChangeNeighborhood(e.target.value)}
            placeholder="Ex: Centro, Jardim Higienópolis"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <datalist id="city-maps-neighborhoods">
            {availableNeighborhoods.map((nb) => (
              <option key={nb} value={nb} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Rua / Logradouro</label>
          <input
            type="text"
            value={street}
            onChange={(e) => onChangeStreet(e.target.value)}
            placeholder="Ex: Avenida Higienópolis, Rua Sergipe"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Número Predial</label>
          <input
            type="text"
            value={houseNumber}
            onChange={(e) => onChangeHouseNumber(e.target.value)}
            placeholder="Ex: 1200, 427, 850"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono tabular-nums placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">CEP</label>
          <input
            type="text"
            value={cep}
            onChange={(e) => onChangeCep(e.target.value)}
            placeholder="Ex: 86015-010"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono tabular-nums placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{country}</span>
            <span aria-hidden="true">·</span>
            <span>{currentStateObj ? `${currentStateObj.name} (${selectedUf})` : selectedUf}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-200">{selectedCity}</span>
            {selectedRegion && (
              <>
                <span aria-hidden="true">·</span>
                <span>Região {selectedRegion}</span>
              </>
            )}
            {currentCityObj?.id && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-500">IBGE {currentCityObj.id}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onFetchCityDirectory}
              disabled={isQueryingDirectory}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:border-slate-500 text-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {isQueryingDirectory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Consultar Faixas &amp; Ruas</span>
            </button>
            <button
              type="submit"
              disabled={isGeocodingPin}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              {isGeocodingPin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
              <span>Localizar Número no Mapa</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
