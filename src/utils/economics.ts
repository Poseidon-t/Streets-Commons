import type { EconomicProjections, OSMData } from '../types';
import { ECONOMIC_FACTORS } from '../constants';

/**
 * Calculate economic projections for walkability improvements
 * Based on research from urban economics literature
 */
export function calculateEconomicProjections(
  data: OSMData,
  currency: string = 'USD'
): EconomicProjections {
  // Count retail/commercial POIs
  const retailCount = data.pois.filter(
    p => p.tags?.shop || p.tags?.amenity === 'restaurant' || p.tags?.amenity === 'cafe'
  ).length;

  // Count residential streets (proxy for property count)
  const residentialCount = data.streets.filter(
    s => s.tags?.highway === 'residential' || s.tags?.highway === 'living_street'
  ).length;

  // Estimates (would be more accurate with local economic data)
  const avgRetailRevenue = 500000; // Annual revenue per retail business
  const avgPropertyValue = 300000; // Average property value
  const interventionCost = 250000; // Cost to implement improvements

  // Calculations
  const retailUplift = Math.round(
    retailCount * avgRetailRevenue * (ECONOMIC_FACTORS.retailUpliftPercent / 100)
  );

  const propertyValue = Math.round(
    residentialCount * 10 * avgPropertyValue * (ECONOMIC_FACTORS.propertyPremiumPercent / 100)
  );

  const healthSavings = Math.round(
    (residentialCount * 50) * 300 // Estimate 50 people per street, $300/person/year health savings
  );

  const jobsCreated = Math.round(
    (interventionCost / 1000000) * ECONOMIC_FACTORS.jobsPer1M
  );

  const totalBenefits = (retailUplift + healthSavings) * ECONOMIC_FACTORS.roiYears + propertyValue;
  const roi = Math.round((totalBenefits / interventionCost) * 10) / 10;

  return {
    retailUplift,
    propertyValue,
    healthSavings,
    jobsCreated,
    roi,
    currency,
  };
}
