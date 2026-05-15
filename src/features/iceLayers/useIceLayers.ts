import { useState, useEffect, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { IceLayerSourceConfig, IceFeatureMetadata } from './iceLayerTypes';
import { ICE_LAYER_SOURCES } from './iceLayerSources';
import { fetchArcGisLayerAsGeoJson, normalizeIceFeatureMetadata } from './iceLayerService';
import { ICE_CLASS_COLORS } from './iceClassification';

export function useIceLayers() {
  const map = useMap();
  const [layers, setLayers] = useState<IceLayerSourceConfig[]>(ICE_LAYER_SOURCES);
  const [visibleLayerIds, setVisibleLayerIds] = useState<string[]>(
    ICE_LAYER_SOURCES.filter(l => l.visibleByDefault).map(l => l.id)
  );
  const [loadingLayerIds, setLoadingLayerIds] = useState<string[]>([]);
  const [errorByLayerId, setErrorByLayerId] = useState<Record<string, string>>({});
  const [selectedIceFeature, setSelectedIceFeature] = useState<IceFeatureMetadata | null>(null);
  
  // Track active leaflet layers to clean them up
  const [activeLeafletLayers, setActiveLeafletLayers] = useState<Record<string, L.Layer>>({});

  const toggleLayer = useCallback((layerId: string, visible: boolean) => {
    setVisibleLayerIds(prev => 
      visible ? [...prev, layerId] : prev.filter(id => id !== layerId)
    );
  }, []);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity } : l));
    
    // Update live layer if it exists
    const leafletLayer = activeLeafletLayers[layerId];
    if (leafletLayer) {
      if ('setOpacity' in leafletLayer) {
        (leafletLayer as any).setOpacity(opacity);
      } else if ('setStyle' in leafletLayer) {
        (leafletLayer as any).setStyle({ fillOpacity: opacity });
      }
    }
  }, [activeLeafletLayers]);

  useEffect(() => {
    const layerToProcess = layers.find(l => visibleLayerIds.includes(l.id) && !activeLeafletLayers[l.id]);
    const layerToRemove = Object.keys(activeLeafletLayers).find(id => !visibleLayerIds.includes(id));

    if (layerToRemove) {
      const layer = activeLeafletLayers[layerToRemove];
      map.removeLayer(layer);
      setActiveLeafletLayers(prev => {
        const next = { ...prev };
        delete next[layerToRemove];
        return next;
      });
    }

    if (layerToProcess) {
      const config = layerToProcess;
      const abortController = new AbortController();

      const loadLayer = async () => {
        setLoadingLayerIds(prev => [...prev, config.id]);
        setErrorByLayerId(prev => {
          const next = { ...prev };
          delete next[config.id];
          return next;
        });

        try {
          let leafletLayer: L.Layer | null = null;

          if (config.providerType === 'wmts' || config.providerType === 'wms') {
             // For simplify, we treat both as TileLayer in this implementation
             leafletLayer = L.tileLayer(config.url, {
               attribution: config.attribution,
               opacity: config.opacity ?? 0.7
             });
          } else if (config.providerType === 'geojson' || config.providerType === 'arcgis-rest') {
            let data: GeoJSON.FeatureCollection;
            
            if (config.providerType === 'arcgis-rest') {
              data = await fetchArcGisLayerAsGeoJson(config.url, undefined, abortController.signal);
            } else {
              // Internal geojson
              const response = await fetch(config.url, { signal: abortController.signal });
              if (!response.ok) throw new Error('Failed to load internal GeoJSON');
              data = await response.json();
            }

            leafletLayer = L.geoJSON(data, {
              style: (feature) => {
                const metadata = normalizeIceFeatureMetadata(feature as any, config.label);
                return {
                  fillColor: ICE_CLASS_COLORS[metadata.derivedIceClass || 'unknown'],
                  fillOpacity: config.opacity ?? 0.65,
                  color: '#333',
                  weight: 1
                };
              },
              onEachFeature: (feature, layer) => {
                layer.on('click', (e) => {
                  L.DomEvent.stopPropagation(e);
                  const metadata = normalizeIceFeatureMetadata(feature as any, config.label);
                  setSelectedIceFeature(metadata);
                });
              }
            });
          }

          if (leafletLayer && !abortController.signal.aborted) {
            leafletLayer.addTo(map);
            setActiveLeafletLayers(prev => ({ ...prev, [config.id]: leafletLayer! }));
          }
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            setErrorByLayerId(prev => ({ ...prev, [config.id]: err.message }));
          }
        } finally {
          setLoadingLayerIds(prev => prev.filter(id => id !== config.id));
        }
      };

      loadLayer();
      return () => abortController.abort();
    }
  }, [visibleLayerIds, layers, map, activeLeafletLayers]);

  return {
    layers,
    visibleLayerIds,
    loadingLayerIds,
    errorByLayerId,
    selectedIceFeature,
    toggleLayer,
    setLayerOpacity,
    clearSelectedIceFeature: () => setSelectedIceFeature(null)
  };
}
