import React from 'react';
import { CityMapsSearchForm } from './maps/CityMapsSearchForm';
import { CityMapsViewportCard } from './maps/CityMapsViewportCard';
import { CityMapsDirectoryTable } from './maps/CityMapsDirectoryTable';
import { useCityMapsController } from './maps/useCityMapsController';

export const ServerCityMapsDataTab: React.FC = () => {
  const {
    country,
    states,
    cities,
    selectedUf,
    setSelectedUf,
    selectedCity,
    setSelectedCity,
    selectedRegion,
    setSelectedRegion,
    neighborhood,
    setNeighborhood,
    street,
    setStreet,
    houseNumber,
    setHouseNumber,
    cep,
    setCep,
    availableRegions,
    availableNeighborhoods,
    rows,
    sourceFilter,
    setSourceFilter,
    isLoadingStates,
    isLoadingCities,
    isQueryingDirectory,
    isGeocodingPin,
    isSavingIndex,
    errorMessage,
    resolvedPin,
    setResolvedPin,
    currentStateObj,
    currentCityObj,
    fetchCityDirectory,
    handleLocateOnMap,
    handleSaveToCityIndex,
    handleDeleteIndexRow,
    handleInspectRow,
    handleResetFilters,
    filteredRows,
    mapMarkers,
    mapCenter,
    sourceCounts,
    handleMapClick,
  } = useCityMapsController();

  return (
    <div className="space-y-6 animate-fadeIn">
      <CityMapsSearchForm
        country={country}
        states={states}
        cities={cities}
        selectedUf={selectedUf}
        onSelectUf={setSelectedUf}
        selectedCity={selectedCity}
        onSelectCity={setSelectedCity}
        selectedRegion={selectedRegion}
        onSelectRegion={setSelectedRegion}
        neighborhood={neighborhood}
        onChangeNeighborhood={setNeighborhood}
        street={street}
        onChangeStreet={setStreet}
        houseNumber={houseNumber}
        onChangeHouseNumber={setHouseNumber}
        cep={cep}
        onChangeCep={setCep}
        availableRegions={availableRegions}
        availableNeighborhoods={availableNeighborhoods}
        currentStateObj={currentStateObj}
        currentCityObj={currentCityObj}
        isLoadingStates={isLoadingStates}
        isLoadingCities={isLoadingCities}
        isQueryingDirectory={isQueryingDirectory}
        isGeocodingPin={isGeocodingPin}
        isSavingIndex={isSavingIndex}
        onResetFilters={handleResetFilters}
        onSaveToCityIndex={() => void handleSaveToCityIndex()}
        onFetchCityDirectory={() => void fetchCityDirectory()}
        onLocateOnMap={() => void handleLocateOnMap()}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <CityMapsViewportCard
          mapCenter={mapCenter}
          mapMarkers={mapMarkers}
          selectedCity={selectedCity}
          selectedUf={selectedUf}
          resolvedPin={resolvedPin}
          onLocationFound={(lat, lng, addressName) => {
            setResolvedPin({
              lat,
              lng,
              displayName: addressName,
            });
          }}
          onMapClick={handleMapClick}
        />

        <CityMapsDirectoryTable
          rowsCount={rows.length}
          filteredRows={filteredRows}
          sourceFilter={sourceFilter}
          onChangeSourceFilter={setSourceFilter}
          sourceCounts={sourceCounts}
          errorMessage={errorMessage}
          isQueryingDirectory={isQueryingDirectory}
          onInspectRow={(row) => void handleInspectRow(row)}
          onDeleteIndexRow={(id) => void handleDeleteIndexRow(id)}
        />
      </div>
    </div>
  );
};
