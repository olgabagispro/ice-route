import { IceFeatureMetadata, DerivedIceClass } from './iceLayerTypes';
import { deriveIceClassZone } from './iceClassification';

export async function fetchArcGisLayerAsGeoJson(
  layerUrl: string,
  bbox?: [number, number, number, number],
  signal?: AbortSignal
): Promise<GeoJSON.FeatureCollection> {
  const url = new URL(`${layerUrl}/query`);
  url.searchParams.set('where', '1=1');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('outSR', '4326');

  if (bbox) {
    url.searchParams.set('geometry', bbox.join(','));
    url.searchParams.set('geometryType', 'esriGeometryEnvelope');
    url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  }

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    throw new Error(`Failed to fetch ArcGIS layer: ${response.statusText}`);
  }

  return await response.json();
}

export function normalizeIceFeatureMetadata(
  feature: GeoJSON.Feature,
  source: string
): IceFeatureMetadata {
  const props = feature.properties || {};
  
  // Attempt to extract metrics from typical NOAA/Copernicus fields
  const iceThicknessM = props.thickness ?? props.iceThickness ?? props.avgThickness ?? null;
  const iceConcentrationPct = props.concentration ?? props.iceConcentration ?? props.totalConcentration ?? null;
  const surfaceTemperatureC = props.temperature ?? props.surfaceTemperature ?? null;
  const iceCode = props.ICECODE ?? props.ice_code ?? null;
  
  const derivedIceClass = deriveIceClassZone({
    iceThicknessM,
    iceConcentrationPct,
    surfaceTemperatureC
  });

  return {
    id: feature.id?.toString() || Math.random().toString(36).substr(2, 9),
    source,
    validTime: props.validTime || props.timestamp || props.vld_time || null,
    iceThicknessM,
    iceConcentrationPct,
    surfaceTemperatureC,
    iceCode,
    derivedIceClass: props.derivedIceClass || derivedIceClass,
    confidence: props.confidence || 'medium',
    rawProperties: props,
    geometry: feature.geometry
  };
}
