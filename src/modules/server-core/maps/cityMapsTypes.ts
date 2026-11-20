export interface IbgeStateItem {
  id: number;
  uf: string;
  name: string;
  region: string;
}

export interface IbgeCityItem {
  id: number;
  name: string;
  uf: string;
  mesorregiao?: string;
  microrregiao?: string;
}

export interface CityDirectoryRow {
  id: string;
  country: string;
  countryCode: string;
  stateUf: string;
  stateName: string;
  city: string;
  region: string;
  neighborhood: string;
  street: string;
  houseNumber: string;
  numberRange: string;
  cep: string;
  lat: number | null;
  lng: number | null;
  siglonQuadraLote: string | null;
  source: 'CITY_INDEX' | 'STORE_DB' | 'VIACEP_RANGE' | 'SIGLON_LONDRINA' | string;
  rangeMatchesNumber?: boolean;
  label?: string;
}

export type SourceFilter =
  | 'ALL'
  | 'CITY_INDEX'
  | 'STORE_DB'
  | 'VIACEP_RANGE'
  | 'SIGLON_LONDRINA';
