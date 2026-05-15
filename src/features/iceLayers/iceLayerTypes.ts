
export type IceLayerProviderType =
  | 'wmts'
  | 'wms'
  | 'arcgis-rest'
  | 'geojson'
  | 'vector-tile';

export type IceMetricType =
  | 'ice_thickness'
  | 'ice_concentration'
  | 'surface_temperature'
  | 'ice_class_zone';

export interface IceLayerSourceConfig {
  id: string;
  label: string;
  providerType: IceLayerProviderType;
  metricType: IceMetricType;
  url: string;
  attribution: string;
  visibleByDefault?: boolean;
  minZoom?: number;
  maxZoom?: number;
  opacity?: number;
  metadata?: {
    productId?: string;
    sourceName?: string;
    region?: string;
    updateFrequency?: string;
    notes?: string;
  };
}

export interface IceFeatureMetadata {
  id: string;
  source: string;
  validTime?: string;
  iceThicknessM?: number | null;
  iceConcentrationPct?: number | null;
  surfaceTemperatureC?: number | null;
  iceCode?: string | null;
  derivedIceClass?: DerivedIceClass | null;
  confidence?: 'low' | 'medium' | 'high';
  rawProperties?: Record<string, unknown>;
  geometry?: any;
}

export type DerivedIceClass =
  | 'open_water'
  | 'ice_class_ic'
  | 'ice_class_ib'
  | 'ice_class_ia'
  | 'ice_class_ia_super'
  | 'unknown';
