/**
 * 15-Minute City Score Analysis
 * Analyzes whether essential services are within 15-minute walk (1.2km radius)
 * Uses OpenStreetMap via Overpass API with robust error handling
 *
 * Essential services:
 * - Grocery stores / Supermarkets
 * - Pharmacy / Healthcare
 * - Schools / Education
 * - Parks / Recreation
 * - Transit stops
 * - Restaurants / Cafes
 */

import { executeOverpassQuery } from './overpassClient';

export interface FifteenMinuteCityScore {
  overallScore: number; // 0-100
  serviceScores: {
    grocery: ServiceAvailability;
    healthcare: ServiceAvailability;
    education: ServiceAvailability;
    recreation: ServiceAvailability;
    transit: ServiceAvailability;
    dining: ServiceAvailability;
  };
  missingServices: string[];
  summary: string;
}

interface ServiceAvailability {
  available: boolean;
  count: number;
  nearestDistance: number; // meters
  score: number; // 0-100
}

/**
 * Calculate 15-Minute City Score
 * When prefetchedElements is provided, skips the Overpass API call entirely.
 */
export async function calculate15MinuteCityScore(
  latitude: number,
  longitude: number,
  radius: number = 1200, // 15-minute walk = ~1.2km
  prefetchedElements?: unknown[]
): Promise<FifteenMinuteCityScore> {

  try {
    // Use prefetched data if available (from the main OSM query), otherwise fetch
    let elements: unknown[];
    if (prefetchedElements && prefetchedElements.length > 0) {
      elements = prefetchedElements;
    } else {
      const allServicesQuery = buildAllServicesQuery(latitude, longitude, radius);
      const data = await executeOverpassQuery(allServicesQuery, {
        maxRetries: 3,
        timeout: 30000,
      });
      elements = data.elements;
    }

    // Parse results by category
    const serviceScores = {
      grocery: parseServiceResults(elements, latitude, longitude, ['supermarket', 'convenience', 'grocery', 'greengrocer']),
      healthcare: parseServiceResults(elements, latitude, longitude, ['pharmacy', 'clinic', 'doctors', 'hospital']),
      education: parseServiceResults(elements, latitude, longitude, ['school', 'kindergarten', 'library']),
      recreation: parseServiceResults(elements, latitude, longitude, ['park', 'playground', 'sports_centre', 'fitness_centre']),
      transit: parseServiceResults(elements, latitude, longitude, ['bus_stop', 'station', 'tram_stop', 'subway_entrance', 'stop_position', 'platform']),
      dining: parseServiceResults(elements, latitude, longitude, ['restaurant', 'cafe', 'fast_food', 'bar'])
    };

    // Calculate overall score (0-100)
    const essentialServices = ['grocery', 'healthcare', 'education', 'recreation', 'transit'];
    const essentialScores = essentialServices.map(key => serviceScores[key as keyof typeof serviceScores].score);
    const overallScore = essentialScores.reduce((sum, score) => sum + score, 0) / essentialServices.length;

    // Identify missing services
    const missingServices = essentialServices.filter(
      key => !serviceScores[key as keyof typeof serviceScores].available
    ).map(key => {
      const labels: Record<string, string> = {
        grocery: 'Grocery store',
        healthcare: 'Healthcare facility',
        education: 'School/Library',
        recreation: 'Park/Recreation',
        transit: 'Public transit stop'
      };
      return labels[key];
    });

    // Generate summary
    const summary = generateSummary(overallScore, missingServices);

    return {
      overallScore: Math.round(overallScore),
      serviceScores,
      missingServices,
      summary
    };

  } catch (error) {
    console.error('15-Minute City analysis failed:', error);
    // Return default empty response
    return getDefaultResponse();
  }
}

/**
 * Build a single query for all service categories
 */
function buildAllServicesQuery(lat: number, lon: number, radius: number): string {
  return `
    [out:json][timeout:30];
    (
      // Grocery
      node["shop"="supermarket"](around:${radius},${lat},${lon});
      node["shop"="convenience"](around:${radius},${lat},${lon});
      node["shop"="grocery"](around:${radius},${lat},${lon});
      node["shop"="greengrocer"](around:${radius},${lat},${lon});
      way["shop"="supermarket"](around:${radius},${lat},${lon});

      // Healthcare
      node["amenity"="pharmacy"](around:${radius},${lat},${lon});
      node["amenity"="clinic"](around:${radius},${lat},${lon});
      node["amenity"="doctors"](around:${radius},${lat},${lon});
      node["amenity"="hospital"](around:${radius},${lat},${lon});

      // Education
      node["amenity"="school"](around:${radius},${lat},${lon});
      node["amenity"="kindergarten"](around:${radius},${lat},${lon});
      node["amenity"="library"](around:${radius},${lat},${lon});
      way["amenity"="school"](around:${radius},${lat},${lon});

      // Recreation
      node["leisure"="park"](around:${radius},${lat},${lon});
      node["leisure"="playground"](around:${radius},${lat},${lon});
      node["leisure"="sports_centre"](around:${radius},${lat},${lon});
      node["leisure"="fitness_centre"](around:${radius},${lat},${lon});
      way["leisure"="park"](around:${radius},${lat},${lon});

      // Transit
      node["public_transport"="stop_position"](around:${radius},${lat},${lon});
      node["public_transport"="platform"](around:${radius},${lat},${lon});
      node["highway"="bus_stop"](around:${radius},${lat},${lon});
      node["railway"="station"](around:${radius},${lat},${lon});
      node["railway"="tram_stop"](around:${radius},${lat},${lon});
      node["railway"="subway_entrance"](around:${radius},${lat},${lon});

      // Dining
      node["amenity"="restaurant"](around:${radius},${lat},${lon});
      node["amenity"="cafe"](around:${radius},${lat},${lon});
      node["amenity"="fast_food"](around:${radius},${lat},${lon});
      node["amenity"="bar"](around:${radius},${lat},${lon});
    );
    out center;
  `.trim();
}

/**
 * Parse service results for a specific category
 */
function parseServiceResults(
  elements: unknown[],
  latitude: number,
  longitude: number,
  tagValues: string[]
): ServiceAvailability {
  // Filter elements that match any of the tag values
  const matches = (elements as Array<{
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }>).filter(el => {
    const tags = el.tags || {};
    return tagValues.some(value =>
      Object.values(tags).some(tagValue =>
        tagValue?.toLowerCase() === value.toLowerCase()
      )
    );
  });

  const count = matches.length;

  // Calculate nearest distance
  let nearestDistance = Infinity;
  if (count > 0) {
    for (const element of matches) {
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      if (lat && lon) {
        const distance = calculateDistance(latitude, longitude, lat, lon);
        nearestDistance = Math.min(nearestDistance, distance);
      }
    }
  }

  // Score calculation:
  // 100 points = service within 400m (5-min walk)
  // 75 points = within 800m (10-min walk)
  // 50 points = within 1200m (15-min walk)
  // 0 points = beyond 1200m or not available
  let score = 0;
  if (count > 0) {
    if (nearestDistance <= 400) score = 100;
    else if (nearestDistance <= 800) score = 75;
    else if (nearestDistance <= 1200) score = 50;
    else score = 25; // Exists but far
  }

  return {
    available: count > 0,
    count,
    nearestDistance: nearestDistance === Infinity ? -1 : Math.round(nearestDistance),
    score
  };
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
 * Generate human-readable summary
 */
function generateSummary(score: number, missingServices: string[]): string {
  if (score >= 80) {
    return `Excellent 15-minute city! All essential services are within a comfortable walking distance.`;
  } else if (score >= 60) {
    return `Good walkable access to most services. ${missingServices.length > 0 ? `Missing: ${missingServices.join(', ')}.` : ''}`;
  } else if (score >= 40) {
    return `Moderate walkability. Several essential services are missing or distant: ${missingServices.join(', ')}.`;
  } else {
    return `Low 15-minute city score. Residents likely need a car for daily needs. Missing: ${missingServices.join(', ')}.`;
  }
}

/**
 * Default response when API fails
 */
function getDefaultResponse(): FifteenMinuteCityScore {
  const emptyService: ServiceAvailability = {
    available: false,
    count: 0,
    nearestDistance: -1,
    score: 0
  };

  return {
    overallScore: 0,
    serviceScores: {
      grocery: emptyService,
      healthcare: emptyService,
      education: emptyService,
      recreation: emptyService,
      transit: emptyService,
      dining: emptyService
    },
    missingServices: ['Unable to analyze - API error'],
    summary: 'Analysis could not be completed. Please try again later.'
  };
}
