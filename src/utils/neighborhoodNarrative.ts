/**
 * Generates intelligent narrative commentary from neighborhood intelligence data.
 * Replaces bullet-point stats with readable, contextual paragraphs.
 */

import type { NeighborhoodIntelligence, WalkabilityMetrics } from '../types';

interface NarrativeInput {
  ni: NeighborhoodIntelligence;
  locationName: string;
  overallScore: number;
  metrics: WalkabilityMetrics;
}

/**
 * Produce 2-4 short narrative paragraphs from neighborhood intelligence data.
 * Each paragraph covers a theme: mobility, daily life, economics, health/safety.
 */
export function generateNeighborhoodNarrative({ ni, locationName, overallScore, metrics }: NarrativeInput): string[] {
  const paragraphs: string[] = [];
  const name = locationName.split(',')[0].trim(); // "Hayes Valley, San Francisco" → "Hayes Valley"

  // ── Paragraph 1: Getting Around ──
  if (ni.commute || ni.transit) {
    const parts: string[] = [];

    if (ni.commute) {
      const alt = (ni.commute as any).altModePct ?? (ni.commute.walkPct + ni.commute.bikePct + ni.commute.transitPct);
      if (alt >= 40) {
        parts.push(`${name} is a strong car-optional neighborhood where ${alt}% of residents commute by walking, biking, or transit`);
      } else if (alt >= 20) {
        parts.push(`${name} offers solid alternatives to driving, with ${alt}% of residents commuting by walking, biking, or transit`);
      } else if (alt >= 10) {
        parts.push(`In ${name}, about ${alt}% of residents commute without a car, a modest but growing share`);
      } else {
        parts.push(`${name} is primarily car-dependent, with only ${alt}% of residents using alternatives to driving`);
      }

      // Highlight the dominant mode
      const modes = [
        { mode: 'walking', pct: ni.commute.walkPct },
        { mode: 'biking', pct: ni.commute.bikePct },
        { mode: 'transit', pct: ni.commute.transitPct },
      ].sort((a, b) => b.pct - a.pct);

      const dominant = modes[0];
      if (dominant.pct >= 10) {
        parts.push(`${capitalize(dominant.mode)} is the most popular alternative at ${dominant.pct}%`);
      }
    }

    if (ni.transit && ni.transit.totalStops > 0) {
      const stops: string[] = [];
      if (ni.transit.busStops > 0) stops.push(`${ni.transit.busStops} bus stop${ni.transit.busStops !== 1 ? 's' : ''}`);
      if (ni.transit.railStations > 0) stops.push(`${ni.transit.railStations} rail station${ni.transit.railStations !== 1 ? 's' : ''}`);
      parts.push(`Public transit is ${ni.transit.totalStops >= 10 ? 'readily' : 'reasonably'} accessible with ${stops.join(' and ')} within walking distance`);
    }

    if (parts.length > 0) {
      paragraphs.push(parts.join('. ') + '.');
    }
  }

  // ── Paragraph 2: Daily Life ──
  if (ni.parks || ni.food) {
    const parts: string[] = [];

    if (ni.food) {
      if (ni.food.isFoodDesert) {
        parts.push(`Grocery access is a concern because there are no supermarkets within walking distance, which qualifies this area as a food desert`);
      } else if (ni.food.supermarkets >= 3) {
        parts.push(`Residents have excellent grocery access with ${ni.food.supermarkets} supermarkets nearby`);
        if (ni.food.groceryStores > 0) parts[parts.length - 1] += `, plus ${ni.food.groceryStores} specialty grocery store${ni.food.groceryStores !== 1 ? 's' : ''}`;
      } else if (ni.food.supermarkets >= 1) {
        const total = ni.food.supermarkets + ni.food.groceryStores;
        parts.push(`Daily errands are manageable with ${total} grocery option${total !== 1 ? 's' : ''} in the area`);
      }
    }

    if (ni.parks) {
      if (ni.parks.totalGreenSpaces >= 5) {
        parts.push(`Green space is abundant, with ${ni.parks.totalGreenSpaces} parks and recreational areas within reach${ni.parks.nearestParkMeters != null ? `, the closest just ${ni.parks.nearestParkMeters}m away` : ''}`);
      } else if (ni.parks.totalGreenSpaces >= 2) {
        parts.push(`The area has ${ni.parks.totalGreenSpaces} green spaces nearby${ni.parks.nearestParkMeters != null ? `, with the nearest ${ni.parks.nearestParkMeters}m away` : ''}`);
      } else if (ni.parks.totalGreenSpaces === 1) {
        parts.push(`There is one green space nearby${ni.parks.nearestParkMeters != null ? `, about ${ni.parks.nearestParkMeters}m away` : ''}`);
      } else {
        parts.push(`Green space is limited in the immediate area`);
      }
    }

    if (parts.length > 0) {
      paragraphs.push(parts.join('. ') + '.');
    }
  }

  // ── Paragraph 3: Economics ──
  if (ni.economics && (ni.economics.medianIncome || ni.economics.medianHomeValue)) {
    const parts: string[] = [];

    if (ni.economics.medianIncome && ni.economics.medianHomeValue) {
      const incomeStr = formatDollar(ni.economics.medianIncome);
      const homeStr = formatDollar(ni.economics.medianHomeValue);
      const ratio = ni.economics.medianHomeValue / ni.economics.medianIncome;

      parts.push(`The median household income here is ${incomeStr}, with home values around ${homeStr}`);

      if (ratio > 12) {
        parts.push(`At ${ratio.toFixed(1)}x income-to-home-value, this is a premium market where walkability and neighborhood character command significant price premiums`);
      } else if (ratio > 8) {
        parts.push(`The ${ratio.toFixed(1)}x income-to-home-value ratio reflects strong demand for this area's location and lifestyle amenities`);
      } else if (ratio < 4) {
        parts.push(`Housing here is relatively affordable at ${ratio.toFixed(1)}x the median income`);
      }
    } else if (ni.economics.medianIncome) {
      parts.push(`The median household income in this census tract is ${formatDollar(ni.economics.medianIncome)}`);
    } else if (ni.economics.medianHomeValue) {
      parts.push(`The median home value in this area is ${formatDollar(ni.economics.medianHomeValue)}`);
    }

    // Walkability value premium tie-in
    if (ni.economics.medianHomeValue && overallScore >= 6) {
      const premiumPerPoint = 2000; // midpoint of $700-$3,250 range
      const estimatedPremium = Math.round(overallScore * premiumPerPoint);
      parts.push(`Research suggests each walkability point adds $700 to $3,250 to home value, and this neighborhood's ${overallScore.toFixed(1)}/10 score translates to an estimated ${formatDollar(estimatedPremium)} walkability premium`);
    }

    if (parts.length > 0) {
      paragraphs.push(parts.join('. ') + '.');
    }
  }

  // ── Paragraph 4: Health & Safety ──
  if (ni.health || ni.flood) {
    const parts: string[] = [];

    if (ni.health) {
      const activeRate = ni.health.physicalInactivity != null ? (100 - ni.health.physicalInactivity) : null;

      if (activeRate != null) {
        if (activeRate >= 80) {
          parts.push(`This is a notably active community where ${activeRate.toFixed(0)}% of residents meet physical activity guidelines`);
        } else if (activeRate >= 70) {
          parts.push(`The community is reasonably active, with ${activeRate.toFixed(0)}% of residents meeting physical activity guidelines`);
        } else {
          parts.push(`Physical activity levels are below average, with only ${activeRate.toFixed(0)}% of residents meeting recommended activity guidelines`);
        }
      }

      if (ni.health.obesity != null) {
        if (ni.health.obesity < 25) {
          parts.push(`The area's ${ni.health.obesity}% obesity rate is below the national average of 42%`);
        } else if (ni.health.obesity < 35) {
          parts.push(`The ${ni.health.obesity}% obesity rate is moderate`);
        } else {
          parts.push(`The ${ni.health.obesity}% obesity rate is above average and may reflect limited walkability or food access`);
        }
      }
    }

    if (ni.flood) {
      if (ni.flood.isHighRisk) {
        parts.push(`This area falls in FEMA flood zone ${ni.flood.floodZone}, indicating elevated flood risk, so buyers should factor in flood insurance costs`);
      } else {
        parts.push(`The area has minimal flood risk (FEMA Zone ${ni.flood.floodZone})`);
      }
    }

    if (parts.length > 0) {
      paragraphs.push(parts.join('. ') + '.');
    }
  }

  return paragraphs;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDollar(n: number): string {
  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  return `$${n.toLocaleString()}`;
}
