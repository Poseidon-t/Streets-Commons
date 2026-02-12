// Analysis parameters
export const ANALYSIS_RADIUS = 800; // meters
export const MAX_CROSSING_GAP = 200; // meters

// API endpoints
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
export const USER_AGENT = 'SafeStreets/2.0';

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

export const DEBOUNCE_MS = 400;

// Economic calculation factors
export const ECONOMIC_FACTORS = {
  retailUpliftPercent: 20,
  propertyPremiumPercent: 5,
  jobsPer1M: 12.5,
  roiYears: 10,
};
