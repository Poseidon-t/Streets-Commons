// Analysis parameters
export const ANALYSIS_RADIUS = 800; // meters
export const MAX_CROSSING_GAP = 200; // meters
export const MIN_TREE_CANOPY = 30; // percentage
export const MAX_SURFACE_TEMP = 38; // celsius
export const MAX_DETOUR_FACTOR = 1.3; // ratio
export const MAX_SLOPE = 5; // percentage
export const MIN_DESTINATION_TYPES = 4; // count

// API endpoints
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const USER_AGENT = 'SafeStreets/2.0';

// Satellite data (approximate - would need real API in production)
export const SENTINEL_URL = 'https://services.sentinel-hub.com/ogc/wms';
export const LANDSAT_URL = 'https://landsatlook.usgs.gov/data';

// Design colors
export const COLORS = {
  primary: '#1e3a5f',
  accent: '#f97316',
  excellent: '#22c55e',
  good: '#84cc16',
  fair: '#eab308',
  poor: '#f97316',
  critical: '#ef4444',
  background: '#f8fafc',
};

// Metric weights for overall score
export const METRIC_WEIGHTS = {
  crossingGaps: 0.25,
  treeCanopy: 0.15,
  surfaceTemp: 0.0, // Not yet implemented
  networkEfficiency: 0.15,
  slope: 0.10,
  destinationAccess: 0.15,
  sidewalkCoverage: 0.20, // OSM sidewalk tags
};

// Score labels
export const SCORE_LABELS = {
  excellent: { min: 8, max: 10, label: 'Excellent', color: COLORS.excellent },
  good: { min: 6, max: 7.9, label: 'Good', color: COLORS.good },
  fair: { min: 4, max: 5.9, label: 'Fair', color: COLORS.fair },
  poor: { min: 2, max: 3.9, label: 'Poor', color: COLORS.poor },
  critical: { min: 0, max: 1.9, label: 'Critical', color: COLORS.critical },
};

export const DEBOUNCE_MS = 400;

// Economic calculation factors
export const ECONOMIC_FACTORS = {
  retailUpliftPercent: 20,
  propertyPremiumPercent: 5,
  jobsPer1M: 12.5,
  roiYears: 10,
};
