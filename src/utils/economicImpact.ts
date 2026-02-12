import { ECONOMIC_FACTORS } from '../constants';
import type { DemographicData, EconomicImpact } from '../types';

export function calculateEconomicImpact(
  demographics: DemographicData | null,
  walkabilityScore: number,
): EconomicImpact {
  const scoreRatio = walkabilityScore / 100;

  // Property value premium from walkability
  let propertyValuePremium: number | null = null;
  if (demographics?.type === 'us' && demographics.medianHomeValue) {
    propertyValuePremium = Math.round(
      demographics.medianHomeValue * (ECONOMIC_FACTORS.propertyPremiumPercent / 100) * scoreRatio
    );
  } else if (demographics?.type === 'international' && demographics.gdpPerCapita) {
    // Rough proxy: typical property = ~5x GDP per capita
    const estimatedPropertyValue = demographics.gdpPerCapita * 5;
    propertyValuePremium = Math.round(
      estimatedPropertyValue * (ECONOMIC_FACTORS.propertyPremiumPercent / 100) * scoreRatio
    );
  }

  // Retail uplift potential
  const retailUpliftPercent = Math.round(
    ECONOMIC_FACTORS.retailUpliftPercent * scoreRatio
  );

  // Jobs potential per $10M walkability investment
  const estimatedJobsPotential = demographics
    ? Math.round(ECONOMIC_FACTORS.jobsPer1M * scoreRatio * 10)
    : null;

  // Healthcare savings (CDC benchmark: $1,200/person/year at max walkability)
  const healthcareSavingsPerPerson = Math.round(1200 * scoreRatio);

  return {
    propertyValuePremium,
    retailUpliftPercent,
    estimatedJobsPotential,
    healthcareSavingsPerPerson,
    walkScore: walkabilityScore,
  };
}
