import { IceLayerSourceConfig } from './iceLayerTypes';

export const ICE_LAYER_SOURCES: IceLayerSourceConfig[] = [
  {
    id: 'copernicus-baltic-ice-thickness',
    label: 'Baltic Sea Ice Thickness',
    providerType: 'wmts',
    metricType: 'ice_thickness',
    url: (import.meta.env.VITE_COPERNICUS_ICE_THICKNESS_WMTS_URL || 'https://wmts.example.com/thickness'),
    attribution: 'Copernicus Marine Service / FMI',
    visibleByDefault: false,
    opacity: 0.7,
    metadata: {
      productId: 'SEAICE_BAL_SEAICE_L4_NRT_OBSERVATIONS_011_004',
      sourceName: 'Copernicus Marine',
      region: 'Baltic Sea',
      updateFrequency: 'Daily during Baltic ice season',
      notes: 'Sea ice concentration and thickness charts; 1 km grid for concentration; map services available for thickness/concentration.'
    }
  },
  {
    id: 'copernicus-baltic-ice-concentration',
    label: 'Baltic Sea Ice Concentration',
    providerType: 'wmts',
    metricType: 'ice_concentration',
    url: (import.meta.env.VITE_COPERNICUS_ICE_CONCENTRATION_WMTS_URL || 'https://wmts.example.com/concentration'),
    attribution: 'Copernicus Marine Service / FMI',
    visibleByDefault: false,
    opacity: 0.6,
    metadata: {
      productId: 'SEAICE_BAL_SEAICE_L4_NRT_OBSERVATIONS_011_004',
      sourceName: 'Copernicus Marine',
      region: 'Baltic Sea'
    }
  },
  {
    id: 'noaa-asip-ice-thickness',
    label: 'NOAA ASIP Ice Thickness',
    providerType: 'arcgis-rest',
    metricType: 'ice_thickness',
    url: 'https://mapservices.weather.noaa.gov/vector/rest/services/obs/asip_ice_chart/MapServer/1',
    attribution: 'NOAA / NWS Alaska Sea Ice Program',
    visibleByDefault: false,
    opacity: 0.7,
    metadata: {
      sourceName: 'NOAA ASIP',
      region: 'Alaska',
      notes: 'ArcGIS REST polygon layer. Display field: ICECODE.'
    }
  },
  {
    id: 'noaa-asip-ice-concentration',
    label: 'NOAA ASIP Ice Concentration',
    providerType: 'arcgis-rest',
    metricType: 'ice_concentration',
    url: 'https://mapservices.weather.noaa.gov/vector/rest/services/obs/asip_ice_chart/MapServer/0',
    attribution: 'NOAA / NWS Alaska Sea Ice Program',
    visibleByDefault: false,
    opacity: 0.7,
    metadata: {
      sourceName: 'NOAA ASIP',
      region: 'Alaska',
      notes: 'ArcGIS REST polygon layer. Display field: ICECODE.'
    }
  },
  {
    id: 'derived-ice-class-zones',
    label: 'Derived ICE Class Zones',
    providerType: 'geojson',
    metricType: 'ice_class_zone',
    url: (import.meta.env.VITE_INTERNAL_ICE_DERIVED_GEOJSON_URL || '/api/ice/derived-zones.geojson'),
    attribution: 'Derived from public sea-ice data sources',
    visibleByDefault: true,
    opacity: 0.65,
    metadata: {
      sourceName: 'Internal Derived Layer',
      notes: 'Generated from ice thickness, concentration, temperature, and provider validity time.'
    }
  }
];
