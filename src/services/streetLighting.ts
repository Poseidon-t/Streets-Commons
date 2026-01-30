/**
 * Street Lighting Safety Analysis
 * Analyzes street lighting coverage for nighttime pedestrian safety
 * Uses OpenStreetMap lighting tags with robust error handling
 *
 * Safety Standards:
 * - Residential streets: min 5 lux
 * - Main streets: min 10 lux
 * - Pedestrian zones: min 20 lux
 */

import { executeOverpassQuery } from './overpassClient';

export interface StreetLightingAnalysis {
  overallScore: number; // 0-100
  litStreets: number; // count
  unlitStreets: number; // count
  coveragePercent: number; // %
  nighttimeSafetyScore: number; // 0-100
  lightingDensity: number; // lights per km
  darkSpots: DarkSpot[];
  recommendations: string[];
}

interface DarkSpot {
  lat: number;
  lon: number;
  streetName: string;
  length: number; // meters
  severity: 'High' | 'Medium' | 'Low';
}

/**
 * Analyze street lighting coverage
 */
export async function analyzeStreetLighting(
  latitude: number,
  longitude: number,
  radius: number = 800
): Promise<StreetLightingAnalysis> {

  const query = `
    [out:json][timeout:30];
    (
      way["highway"]["highway"!="motorway"]["highway"!="motorway_link"](around:${radius},${latitude},${longitude});
      node["highway"="street_lamp"](around:${radius},${latitude},${longitude});
    );
    out geom;
  `.trim();

  try {
    const data = await executeOverpassQuery(query, {
      maxRetries: 3,
      timeout: 35000,
    });

    // Separate streets and lamps
    const streets = (data.elements as Array<{
      type: string;
      tags?: Record<string, string>;
      geometry?: Array<{ lat: number; lon: number }>;
    }>).filter(e => e.type === 'way');

    const lamps = (data.elements as Array<{
      type: string;
    }>).filter(e => e.type === 'node');

    let litStreets = 0;
    let unlitStreets = 0;
    let totalStreetLength = 0;
    const darkSpots: DarkSpot[] = [];

    // Analyze each street
    for (const street of streets) {
      const hasLighting = street.tags?.lit === 'yes' ||
                         street.tags?.['lit:by'] ||
                         street.tags?.lighting === 'yes';

      const streetLength = calculateWayLength(street.geometry || []);
      totalStreetLength += streetLength;

      if (hasLighting) {
        litStreets++;
      } else {
        unlitStreets++;

        // Check if it's a major street (should be lit)
        const isMainStreet = ['primary', 'secondary', 'tertiary', 'residential'].includes(
          street.tags?.highway || ''
        );

        if (isMainStreet && streetLength > 50) {
          darkSpots.push({
            lat: street.geometry?.[0]?.lat || 0,
            lon: street.geometry?.[0]?.lon || 0,
            streetName: street.tags?.name || 'Unnamed street',
            length: Math.round(streetLength),
            severity: streetLength > 200 ? 'High' : streetLength > 100 ? 'Medium' : 'Low'
          });
        }
      }
    }

    const totalStreets = litStreets + unlitStreets;
    const coveragePercent = totalStreets > 0 ? (litStreets / totalStreets) * 100 : 0;

    // Calculate lighting density (lamps per km of street)
    const lightingDensity = totalStreetLength > 0
      ? (lamps.length / (totalStreetLength / 1000))
      : 0;

    // Nighttime safety score
    // Based on: coverage %, lighting density, and absence of dark spots
    let safetyScore = 0;
    safetyScore += Math.min(coveragePercent, 50); // Max 50 points for coverage
    safetyScore += Math.min(lightingDensity * 3, 30); // Max 30 points for density
    safetyScore += Math.max(20 - darkSpots.length * 2, 0); // Max 20 points, -2 per dark spot

    // Overall score (simpler metric)
    const overallScore = Math.min(coveragePercent + (lightingDensity * 5), 100);

    const recommendations = generateLightingRecommendations(
      coveragePercent,
      darkSpots,
      lightingDensity
    );

    return {
      overallScore: Math.round(overallScore),
      litStreets,
      unlitStreets,
      coveragePercent: parseFloat(coveragePercent.toFixed(1)),
      nighttimeSafetyScore: Math.round(safetyScore),
      lightingDensity: parseFloat(lightingDensity.toFixed(1)),
      darkSpots: darkSpots.slice(0, 10), // Top 10 priority locations
      recommendations
    };

  } catch (error) {
    console.error('Street lighting analysis failed:', error);
    return {
      overallScore: 0,
      litStreets: 0,
      unlitStreets: 0,
      coveragePercent: 0,
      nighttimeSafetyScore: 0,
      lightingDensity: 0,
      darkSpots: [],
      recommendations: ['Unable to analyze street lighting. Please try again later.']
    };
  }
}

/**
 * Calculate length of a way (street) in meters
 */
function calculateWayLength(geometry: { lat: number; lon: number }[]): number {
  if (geometry.length < 2) return 0;

  let totalLength = 0;
  for (let i = 0; i < geometry.length - 1; i++) {
    totalLength += calculateDistance(
      geometry[i].lat,
      geometry[i].lon,
      geometry[i + 1].lat,
      geometry[i + 1].lon
    );
  }

  return totalLength;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate lighting recommendations
 */
function generateLightingRecommendations(
  coveragePercent: number,
  darkSpots: DarkSpot[],
  lightingDensity: number
): string[] {
  const recommendations: string[] = [];

  if (coveragePercent >= 80) {
    recommendations.push('✓ Excellent street lighting coverage for nighttime safety');
  } else if (coveragePercent >= 60) {
    recommendations.push('Good lighting coverage, but some gaps remain');
  } else if (coveragePercent >= 40) {
    recommendations.push('⚠ Moderate lighting coverage - many streets lack lighting');
  } else {
    recommendations.push('⚠ Poor lighting coverage - significant safety concern');
  }

  const highPriorityDarkSpots = darkSpots.filter(d => d.severity === 'High');
  if (highPriorityDarkSpots.length > 0) {
    recommendations.push(
      `${highPriorityDarkSpots.length} high-priority dark spots identified (>${200}m unlit streets)`
    );
    recommendations.push(
      `Priority locations: ${highPriorityDarkSpots.slice(0, 3).map(d => d.streetName).join(', ')}`
    );
  }

  if (lightingDensity < 5) {
    recommendations.push('Lighting density is low - consider adding more street lamps');
    recommendations.push('Target: 8-12 lamps per km for residential streets');
  } else if (lightingDensity >= 8) {
    recommendations.push('✓ Good lighting density for pedestrian safety');
  }

  if (coveragePercent < 70) {
    recommendations.push('Install LED street lights on unlit streets (energy-efficient)');
    recommendations.push('Focus on streets with high pedestrian traffic first');
    recommendations.push('Consider solar-powered lights for areas without electrical infrastructure');
  }

  recommendations.push('Regular maintenance to keep lights functional');
  recommendations.push('Community reporting system for broken lights');

  return recommendations;
}

/**
 * Export street lighting report as text
 */
export function generateLightingReportText(analysis: StreetLightingAnalysis): string {
  return `
Street Lighting Safety Report

Overall Score: ${analysis.overallScore}/100
Nighttime Safety Score: ${analysis.nighttimeSafetyScore}/100

Coverage Analysis:
• Lit Streets: ${analysis.litStreets}
• Unlit Streets: ${analysis.unlitStreets}
• Coverage: ${analysis.coveragePercent}%
• Lighting Density: ${analysis.lightingDensity} lamps/km

Dark Spots (${analysis.darkSpots.length} identified):
${analysis.darkSpots.map((spot, i) =>
  `${i + 1}. ${spot.streetName} (${spot.length}m) - ${spot.severity} Priority`
).join('\n')}

Recommendations:
${analysis.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Safety Impact:
Good street lighting reduces:
• Crime by 20-30% (studies)
• Pedestrian crashes by 35%
• Fear of walking at night by 50%
  `.trim();
}
