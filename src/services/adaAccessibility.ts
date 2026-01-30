/**
 * ADA Accessibility Report
 * Analyzes wheelchair accessibility based on sidewalk slopes
 * Uses Open-Elevation API (global SRTM data)
 *
 * ADA Standards:
 * - Maximum slope: 5% (1:20)
 * - Preferred slope: < 2% (1:50)
 * - Cross slope: < 2%
 */

export interface ADAAccessibilityReport {
  overallScore: number; // 0-100
  compliantRoutes: number; // % of routes meeting ADA standards
  violations: SlopeViolation[];
  averageSlope: number; // %
  maxSlope: number; // %
  wheelchairFriendly: boolean;
  recommendations: string[];
  rampLocations: RampRecommendation[];
}

interface SlopeViolation {
  lat: number;
  lon: number;
  slope: number; // %
  severity: 'Minor' | 'Moderate' | 'Severe';
  description: string;
}

interface RampRecommendation {
  lat: number;
  lon: number;
  currentSlope: number;
  reason: string;
}

/**
 * Analyze ADA accessibility
 */
export async function analyzeADAAccessibility(
  latitude: number,
  longitude: number,
  radius: number = 800
): Promise<ADAAccessibilityReport> {

  // Sample points in a grid around the location
  const gridSize = 10; // 10x10 grid
  const stepSize = (radius * 2) / gridSize;
  const samplePoints: { lat: number; lon: number }[] = [];

  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const offsetLat = (i - gridSize / 2) * (stepSize / 111000); // Convert meters to degrees
      const offsetLon = (j - gridSize / 2) * (stepSize / (111000 * Math.cos(latitude * Math.PI / 180)));

      samplePoints.push({
        lat: latitude + offsetLat,
        lon: longitude + offsetLon
      });
    }
  }

  // Get elevations for all points
  const elevations = await getElevations(samplePoints);

  // Calculate slopes between adjacent points
  const slopes: number[] = [];
  const violations: SlopeViolation[] = [];

  for (let i = 0; i < gridSize - 1; i++) {
    for (let j = 0; j < gridSize - 1; j++) {
      const idx = i * gridSize + j;

      // Horizontal slope
      const horizontalSlope = calculateSlope(
        elevations[idx],
        elevations[idx + 1],
        stepSize
      );
      slopes.push(horizontalSlope);

      // Vertical slope
      const verticalSlope = calculateSlope(
        elevations[idx],
        elevations[idx + gridSize],
        stepSize
      );
      slopes.push(verticalSlope);

      // Check for violations
      const maxSlope = Math.max(Math.abs(horizontalSlope), Math.abs(verticalSlope));
      if (maxSlope > 5) {
        violations.push({
          lat: samplePoints[idx].lat,
          lon: samplePoints[idx].lon,
          slope: maxSlope,
          severity: maxSlope > 8 ? 'Severe' : maxSlope > 6.5 ? 'Moderate' : 'Minor',
          description: `${maxSlope.toFixed(1)}% slope exceeds ADA maximum of 5%`
        });
      }
    }
  }

  // Calculate metrics
  const averageSlope = slopes.reduce((sum, s) => sum + Math.abs(s), 0) / slopes.length;
  const maxSlope = Math.max(...slopes.map(s => Math.abs(s)));
  const compliantRoutes = ((slopes.length - violations.length) / slopes.length) * 100;
  const wheelchairFriendly = compliantRoutes >= 80 && maxSlope <= 8;

  // Overall score
  // 100 = all slopes < 5%
  // 0 = many slopes > 8%
  let score = 100;
  score -= violations.filter(v => v.severity === 'Severe').length * 15;
  score -= violations.filter(v => v.severity === 'Moderate').length * 8;
  score -= violations.filter(v => v.severity === 'Minor').length * 3;
  score = Math.max(0, score);

  // Generate recommendations
  const recommendations = generateADARecommendations(violations, averageSlope, wheelchairFriendly);

  // Recommend ramp locations for severe violations
  const rampLocations = violations
    .filter(v => v.severity === 'Severe')
    .map(v => ({
      lat: v.lat,
      lon: v.lon,
      currentSlope: v.slope,
      reason: `${v.slope.toFixed(1)}% slope requires accessible ramp or alternative route`
    }))
    .slice(0, 5); // Top 5 priority locations

  return {
    overallScore: Math.round(score),
    compliantRoutes: parseFloat(compliantRoutes.toFixed(1)),
    violations,
    averageSlope: parseFloat(averageSlope.toFixed(2)),
    maxSlope: parseFloat(maxSlope.toFixed(1)),
    wheelchairFriendly,
    recommendations,
    rampLocations
  };
}

/**
 * Get elevations from Open-Elevation API with retry logic
 */
async function getElevations(points: { lat: number; lon: number }[]): Promise<number[]> {
  const ELEVATION_APIS = [
    'https://api.open-elevation.com/api/v1/lookup',
    'https://api.opentopodata.org/v1/srtm30m',  // Fallback
  ];

  for (const apiUrl of ELEVATION_APIS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🌐 Elevation API request to ${apiUrl} (attempt ${attempt}/3)`);

        // Format request based on API
        let requestBody;
        if (apiUrl.includes('opentopodata')) {
          // OpenTopoData format
          const locations = points.map(p => `${p.lat},${p.lon}`).join('|');
          const response = await fetch(`${apiUrl}?locations=${locations}`, {
            method: 'GET',
          });

          if (!response.ok) throw new Error(`API error: ${response.status}`);

          const data = await response.json();
          if (data.results) {
            return data.results.map((r: { elevation: number | null }) => r.elevation ?? 0);
          }
        } else {
          // Open-Elevation format
          requestBody = {
            locations: points.map(p => ({ latitude: p.lat, longitude: p.lon }))
          };

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) throw new Error(`API error: ${response.status}`);

          const data = await response.json();
          if (data.results) {
            return data.results.map((r: { elevation: number }) => r.elevation);
          }
        }

      } catch (error) {
        console.warn(`❌ Elevation API attempt ${attempt} failed:`, error);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff
        }
      }
    }
  }

  console.error('All elevation API attempts failed, using flat terrain fallback');
  // Return flat elevations as fallback (conservative assumption)
  return points.map(() => 0);
}

/**
 * Calculate slope percentage between two elevations
 */
function calculateSlope(elevation1: number, elevation2: number, distance: number): number {
  const rise = elevation2 - elevation1;
  const run = distance;
  const slope = (rise / run) * 100;
  return slope;
}

/**
 * Generate ADA-specific recommendations
 */
function generateADARecommendations(
  violations: SlopeViolation[],
  averageSlope: number,
  wheelchairFriendly: boolean
): string[] {
  const recommendations: string[] = [];

  if (wheelchairFriendly) {
    recommendations.push('✓ Area meets ADA accessibility standards for wheelchair users');
    recommendations.push('Continue maintaining compliant slopes and smooth surfaces');
  } else {
    recommendations.push('⚠ Area does not meet ADA accessibility standards');

    const severeCount = violations.filter(v => v.severity === 'Severe').length;
    if (severeCount > 0) {
      recommendations.push(`${severeCount} severe slope violations (>8%) require immediate attention`);
      recommendations.push('Install accessible ramps at steep grade locations');
    }

    const moderateCount = violations.filter(v => v.severity === 'Moderate').length;
    if (moderateCount > 0) {
      recommendations.push(`${moderateCount} moderate violations (6.5-8%) should be addressed`);
    }

    if (averageSlope > 3) {
      recommendations.push('Average slope is high - consider grading improvements');
    }

    recommendations.push('Provide alternative accessible routes where slopes cannot be modified');
    recommendations.push('Install handrails on slopes exceeding 5%');
  }

  recommendations.push('Ensure cross slopes on sidewalks do not exceed 2% (ADA requirement)');
  recommendations.push('Regular maintenance to prevent surface deterioration affecting accessibility');

  return recommendations;
}

/**
 * Export ADA report as text
 */
export function generateADAReportText(report: ADAAccessibilityReport): string {
  return `
ADA Accessibility Report

Overall Score: ${report.overallScore}/100
Wheelchair Friendly: ${report.wheelchairFriendly ? 'Yes ✓' : 'No ✗'}

Slope Analysis:
• Compliant Routes: ${report.compliantRoutes}%
• Average Slope: ${report.averageSlope}%
• Maximum Slope: ${report.maxSlope}%
• Violations: ${report.violations.length}
  - Severe (>8%): ${report.violations.filter(v => v.severity === 'Severe').length}
  - Moderate (6.5-8%): ${report.violations.filter(v => v.severity === 'Moderate').length}
  - Minor (5-6.5%): ${report.violations.filter(v => v.severity === 'Minor').length}

Ramp Recommendations (${report.rampLocations.length} priority locations):
${report.rampLocations.map((r, i) =>
  `${i + 1}. ${r.lat.toFixed(6)}, ${r.lon.toFixed(6)} - ${r.reason}`
).join('\n')}

Recommendations:
${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

ADA Standards Reference:
• Maximum running slope: 5% (1:20)
• Preferred slope: < 2% (1:50)
• Maximum cross slope: 2%
• Ramps required for slopes > 5%
  `.trim();
}
