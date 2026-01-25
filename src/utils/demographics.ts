import type { Demographics } from '../types';
import { ANALYSIS_RADIUS } from '../constants';

/**
 * Estimate population within analysis radius
 * Uses global average urban density: ~7,000 people/km²
 * More accurate version would use WorldPop API
 */
export function calculateDemographics(): Demographics {
  const areaKm2 = (Math.PI * Math.pow(ANALYSIS_RADIUS / 1000, 2));
  const urbanDensity = 7000; // people per km²

  const totalPopulation = Math.round(areaKm2 * urbanDensity);
  const children = Math.round(totalPopulation * 0.18); // ~18% children 0-14
  const elderly = Math.round(totalPopulation * 0.12); // ~12% elderly 65+
  const dailyVisitors = Math.round(totalPopulation * 0.3); // Estimate 30% additional daily traffic

  return {
    totalPopulation,
    children,
    elderly,
    dailyVisitors,
  };
}
