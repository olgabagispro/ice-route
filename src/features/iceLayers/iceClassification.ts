import { DerivedIceClass } from './iceLayerTypes';

/**
 * Preliminary visualization rule for deriving ICE class zones.
 * WARNING: Informational only — not certified navigation guidance.
 */
export function deriveIceClassZone(input: {
  iceThicknessM?: number | null;
  iceConcentrationPct?: number | null;
  surfaceTemperatureC?: number | null;
}): DerivedIceClass {
  const thickness = input.iceThicknessM;
  const concentration = input.iceConcentrationPct;

  if (thickness == null && concentration == null) return 'unknown';

  // Open water threshold: < 5cm thickness or < 15% concentration
  if ((thickness ?? 0) <= 0.05 || (concentration ?? 0) < 15) {
    return 'open_water';
  }

  if ((thickness ?? 0) <= 0.15) {
    return 'ice_class_ic';
  }

  if ((thickness ?? 0) <= 0.30) {
    return 'ice_class_ib';
  }

  if ((thickness ?? 0) <= 0.50) {
    return 'ice_class_ia';
  }

  return 'ice_class_ia_super';
}

export const ICE_CLASS_COLORS: Record<DerivedIceClass, string> = {
  'open_water': '#9ecae1',
  'ice_class_ic': '#c7e9b4',
  'ice_class_ib': '#ffffb2',
  'ice_class_ia': '#fecc5c',
  'ice_class_ia_super': '#fd8d3c',
  'unknown': '#bdbdbd'
};

export const ICE_CLASS_LABELS: Record<DerivedIceClass, string> = {
  'open_water': 'Open Water',
  'ice_class_ic': 'Ice Class IC',
  'ice_class_ib': 'Ice Class IB',
  'ice_class_ia': 'Ice Class IA',
  'ice_class_ia_super': 'Ice Class IA Super',
  'unknown': 'Unknown'
};
