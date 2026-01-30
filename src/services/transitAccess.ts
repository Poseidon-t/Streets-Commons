/**
 * Transit Access Analysis
 * Analyzes public transportation accessibility and car-free feasibility
 * Uses OpenStreetMap data with robust error handling
 */

import { executeOverpassQuery } from './overpassClient';

export interface TransitAccessAnalysis {
  overallScore: number; // 0-100
  nearestStopDistance: number; // meters
  stopsWithin500m: number;
  transitTypes: TransitType[];
  carFreeFeasibility: string; // Excellent/Good/Fair/Poor
  coverage: {
    bus: boolean;
    rail: boolean;
    tram: boolean;
    subway: boolean;
    ferry: boolean;
  };
  recommendations: string[];
}

interface TransitType {
  type: string;
  count: number;
  nearestDistance: number;
}

/**
 * Analyze transit accessibility
 */
export async function analyzeTransitAccess(
  latitude: number,
  longitude: number,
  radius: number = 800
): Promise<TransitAccessAnalysis> {

  const query = `
    [out:json][timeout:30];
    (
      node["public_transport"="stop_position"](around:${radius},${latitude},${longitude});
      node["public_transport"="platform"](around:${radius},${latitude},${longitude});
      node["highway"="bus_stop"](around:${radius},${latitude},${longitude});
      node["railway"="station"](around:${radius},${latitude},${longitude});
      node["railway"="halt"](around:${radius},${latitude},${longitude});
      node["railway"="tram_stop"](around:${radius},${latitude},${longitude});
      node["railway"="subway_entrance"](around:${radius},${latitude},${longitude});
      node["amenity"="ferry_terminal"](around:${radius},${latitude},${longitude});
    );
    out center;
  `.trim();

  try {
    const data = await executeOverpassQuery(query, {
      maxRetries: 3,
      timeout: 30000,
    });

    const stops = data.elements as Array<{
      lat: number;
      lon: number;
      tags?: Record<string, string>;
    }>;

    // Calculate distances
    let nearestDistance = Infinity;
    const transitTypes: Record<string, TransitType> = {};
    let stopsWithin500m = 0;

    for (const stop of stops) {
      const distance = calculateDistance(latitude, longitude, stop.lat, stop.lon);

      if (distance < nearestDistance) {
        nearestDistance = distance;
      }

      if (distance <= 500) {
        stopsWithin500m++;
      }

      // Categorize transit type
      let type = 'Bus';
      if (stop.tags?.railway === 'station' || stop.tags?.railway === 'halt') {
        type = 'Rail';
      } else if (stop.tags?.railway === 'tram_stop') {
        type = 'Tram';
      } else if (stop.tags?.railway === 'subway_entrance') {
        type = 'Subway';
      } else if (stop.tags?.amenity === 'ferry_terminal') {
        type = 'Ferry';
      }

      if (!transitTypes[type]) {
        transitTypes[type] = { type, count: 0, nearestDistance: Infinity };
      }

      transitTypes[type].count++;
      if (distance < transitTypes[type].nearestDistance) {
        transitTypes[type].nearestDistance = Math.round(distance);
      }
    }

    // Coverage
    const coverage = {
      bus: stops.some(s =>
        s.tags?.highway === 'bus_stop' || s.tags?.public_transport === 'platform'),
      rail: stops.some(s =>
        s.tags?.railway === 'station' || s.tags?.railway === 'halt'),
      tram: stops.some(s =>
        s.tags?.railway === 'tram_stop'),
      subway: stops.some(s =>
        s.tags?.railway === 'subway_entrance'),
      ferry: stops.some(s =>
        s.tags?.amenity === 'ferry_terminal')
    };

    // Calculate overall score
    // 100 = excellent transit (stop within 250m, multiple types)
    // 0 = no transit (no stops within 800m)
    let score = 0;

    if (nearestDistance !== Infinity) {
      // Distance scoring (50 points max)
      if (nearestDistance <= 250) score += 50;
      else if (nearestDistance <= 500) score += 40;
      else if (nearestDistance <= 800) score += 25;

      // Coverage scoring (30 points max)
      const typesCount = Object.keys(transitTypes).length;
      score += Math.min(typesCount * 10, 30);

      // Frequency proxy (20 points max) - more stops = higher frequency
      score += Math.min(stopsWithin500m * 4, 20);
    }

    const carFreeFeasibility = categorizeFeasibility(score, nearestDistance);
    const recommendations = generateRecommendations(score, coverage, nearestDistance);

    return {
      overallScore: Math.min(Math.round(score), 100),
      nearestStopDistance: nearestDistance === Infinity ? -1 : Math.round(nearestDistance),
      stopsWithin500m,
      transitTypes: Object.values(transitTypes),
      carFreeFeasibility,
      coverage,
      recommendations
    };

  } catch (error) {
    console.error('Transit access analysis failed:', error);
    return {
      overallScore: 0,
      nearestStopDistance: -1,
      stopsWithin500m: 0,
      transitTypes: [],
      carFreeFeasibility: 'Unknown - Analysis Error',
      coverage: {
        bus: false,
        rail: false,
        tram: false,
        subway: false,
        ferry: false
      },
      recommendations: ['Unable to analyze transit access. Please try again later.']
    };
  }
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
 * Categorize car-free feasibility
 */
function categorizeFeasibility(score: number, nearestDistance: number): string {
  if (score >= 80 && nearestDistance <= 250) {
    return 'Excellent - Car-free lifestyle easily achievable';
  } else if (score >= 60 && nearestDistance <= 500) {
    return 'Good - Car optional for most trips';
  } else if (score >= 40 && nearestDistance <= 800) {
    return 'Fair - Some car dependency likely';
  } else if (nearestDistance === Infinity || nearestDistance < 0) {
    return 'Poor - No transit detected in area';
  } else {
    return 'Poor - Car likely necessary for daily needs';
  }
}

/**
 * Generate recommendations
 */
function generateRecommendations(
  score: number,
  coverage: TransitAccessAnalysis['coverage'],
  nearestDistance: number
): string[] {
  const recommendations: string[] = [];

  if (nearestDistance > 500) {
    recommendations.push('Nearest transit stop is far. Consider advocating for additional bus routes.');
  }

  if (!coverage.bus && !coverage.rail) {
    recommendations.push('No public transit coverage detected. Advocate for basic bus service.');
  }

  if (coverage.bus && !coverage.rail && score < 60) {
    recommendations.push('Limited to bus service. Explore light rail or BRT expansion opportunities.');
  }

  if (score < 40) {
    recommendations.push('Poor transit access significantly limits car-free lifestyle options.');
    recommendations.push('Work with local transit agency to identify service gaps and expansion needs.');
  }

  if (score >= 80) {
    recommendations.push('Excellent transit access! Highlight this for climate-conscious residents.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Moderate transit access. Room for improvement in coverage and frequency.');
  }

  return recommendations;
}
