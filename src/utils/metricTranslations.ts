/**
 * Utility functions to translate technical metrics into user-friendly language
 * Converts percentages to 1-10 scores and generates plain-language descriptions
 */

import type { WalkabilityMetrics, RawMetricData } from '../types';

export interface UserFriendlyMetric {
  icon: string;
  headline: string;
  score: number; // 1-10
  badge: 'excellent' | 'good' | 'moderate' | 'needs-improvement' | 'safety-concern';
  description: string;
  rawValue?: string;
  whyItMatters: string;
  example?: string;
  technicalMeasurement: string;
  recommendedStandard: string;
  dataSource: string;
  additionalContext?: string;
  dataQuality?: {
    level: 'high' | 'medium' | 'low';
    explanation: string;
  };
}

function convertToTenScale(score: number): number {
  return Math.max(1, Math.round(score));
}

function getBadge(score: number): UserFriendlyMetric['badge'] {
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good';
  if (score >= 3) return 'moderate';
  if (score >= 2) return 'needs-improvement';
  return 'safety-concern';
}

/**
 * 3 metrics shown on the frontend:
 * 1. Daily Needs Nearby (OSM POIs)
 * 2. Flat Terrain (NASA SRTM)
 * 3. Shade & Greenery (Sentinel-2 NDVI)
 */
export function translateMetrics(
  metrics: WalkabilityMetrics,
  locationName: string,
  rawData?: RawMetricData
): UserFriendlyMetric[] {
  return [
    translateDestinationAccess(metrics.destinationAccess, locationName, rawData),
    translateSlope(metrics.slope, rawData),
    translateTreeCanopy(metrics.treeCanopy, rawData),
  ];
}

/**
 * Destination Access → Daily Needs Nearby
 */
function translateDestinationAccess(rawScore: number, _locationName: string, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const percentage = Math.round((rawScore / 10) * 100);

  const headlines = {
    'safety-concern': 'Few Daily Needs Within Walking Distance',
    'needs-improvement': 'Some Daily Needs Require Driving',
    'moderate': 'Many Daily Needs Within Walking Distance',
    'good': 'Most Daily Needs Within Walking Distance',
    'excellent': 'Excellent Access to Daily Needs'
  };

  const descriptions = {
    'safety-concern': 'Very few everyday places are within walking distance. You\'ll need to drive for most groceries, restaurants, and services.',
    'needs-improvement': 'Some everyday places are within walking distance, but you\'ll still need to drive for many daily needs.',
    'moderate': 'You can walk to several everyday places like restaurants and parks, though some services like grocery stores may require driving.',
    'good': 'You can walk to most everyday places - grocery stores, restaurants, schools, and parks are all close by.',
    'excellent': 'You can walk to nearly all everyday places. Grocery stores, restaurants, schools, parks, and services are all within easy reach.'
  };

  let rawValue: string | undefined;
  if (raw?.poiCount !== undefined) {
    rawValue = `~${raw.poiCount} destinations nearby`;
  }

  return {
    icon: '🏪',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Nearby shops, restaurants, and services mean you can walk instead of drive. That saves money, gives you exercise, and makes spontaneous trips easy.',
    example: score >= 7
      ? 'Nearby destinations:\n• Grocery store: 5-minute walk\n• Coffee shop: 3-minute walk\n• Park: 7-minute walk\n• Restaurant: 4-minute walk'
      : undefined,
    technicalMeasurement: `Counts destination types (groceries, restaurants, schools, parks, transit, healthcare) within a 15-min walk. ${percentage}% of essential services are walkable.`,
    recommendedStandard: '15-minute city standard: all essential services within a 15-min walk. Requires mixed-use zoning (residential + commercial).',
    dataSource: 'OpenStreetMap points of interest (POI) data',
    dataQuality: {
      level: 'medium',
      explanation: 'OpenStreetMap POI data. Major destinations are well-mapped; smaller businesses and new establishments may be missing.'
    }
  };
}

/**
 * Slope → Flat Terrain
 */
function translateSlope(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const flatPercentage = Math.round((rawScore / 10) * 100);

  const headlines = {
    'safety-concern': 'Very Steep Hills',
    'needs-improvement': 'Steep Hills Common',
    'moderate': 'Some Hills, Mixed Terrain',
    'good': 'Mostly Flat with Gentle Hills',
    'excellent': 'Very Flat, Easy Walking'
  };

  const descriptions = {
    'safety-concern': 'This area has very steep hills. Many walks will be challenging, especially for seniors, people with disabilities, or anyone carrying items.',
    'needs-improvement': 'This area has frequent steep hills that make many walks difficult.',
    'moderate': `About ${flatPercentage}% of routes have gentle slopes. You'll encounter some hills but many routes remain accessible.`,
    'good': `${flatPercentage}% of routes are flat or gently sloped. Most walks are comfortable, with only occasional hills.`,
    'excellent': `This area is very flat. ${flatPercentage}% of walks have gentle inclines comfortable for everyone.`
  };

  let rawValue: string | undefined;
  if (raw?.slopeDegrees !== undefined) {
    rawValue = `Average slope: ${raw.slopeDegrees.toFixed(1)}°`;
  }

  return {
    icon: '⛰️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Flat terrain makes walking accessible for everyone — seniors, wheelchair users, parents with strollers. Steep hills turn short walks into exhausting treks.',
    example: score >= 8
      ? 'Terrain is gentle enough for wheelchairs, strollers, and anyone with mobility concerns.'
      : score < 4
      ? 'Think San Francisco hills - walks will be strenuous.'
      : undefined,
    technicalMeasurement: 'Elevation changes along walking routes using satellite terrain data.',
    recommendedStandard: 'ADA max: 5% grade. Slopes above 5% are challenging for many people. San Francisco hills exceed 10-15%.',
    dataSource: 'SRTM elevation data (30-meter resolution) via Open-Elevation API',
    dataQuality: {
      level: 'high',
      explanation: 'NASA SRTM satellite data — 30m resolution, verified and consistent worldwide.'
    }
  };
}

/**
 * Tree Canopy → Shade & Greenery
 */
function translateTreeCanopy(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  let rawValue: string | undefined;
  if (raw?.ndvi !== undefined) {
    const pct = (raw.ndvi * 100).toFixed(0);
    rawValue = `Vegetation: ${pct}% (NDVI: ${raw.ndvi.toFixed(2)})`;
  }
  const coverage = Math.round((rawScore / 10) * 40);

  const headlines = {
    'safety-concern': 'Very Little Tree Shade',
    'needs-improvement': 'Limited Tree Shade',
    'moderate': 'Moderate Tree Shade',
    'good': 'Good Tree Shade for Summer Walks',
    'excellent': 'Excellent Tree Shade'
  };

  const descriptions = {
    'safety-concern': 'Very few trees provide shade on streets. Summer walks will be hot and uncomfortable.',
    'needs-improvement': `Limited tree coverage (about ${coverage}%) means most streets lack shade. Summer walks may be uncomfortable.`,
    'moderate': `About ${coverage}% of streets have some tree shade. You can find shaded routes but many streets are exposed.`,
    'good': `About ${coverage}% of streets have tree shade. You'll find shaded routes for hot days, though some streets lack coverage.`,
    'excellent': `Abundant tree coverage (${coverage}%+) provides shade on most streets. Summer walks stay comfortable.`
  };

  return {
    icon: '🌳',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Shaded streets are 10-15°F cooler than treeless ones. Trees also clean the air and boost home values by 7-15%.',
    example: score >= 7
      ? 'On a 90°F day, shaded sidewalks feel like 75°F. Most of your walks will have overhead shade.'
      : score < 4
      ? 'On a 90°F day, you\'ll be walking in full sun. Consider morning or evening walks in summer.'
      : undefined,
    technicalMeasurement: 'Sentinel-2 satellite NDVI (vegetation index). Values above 0.3 = healthy tree canopy.',
    recommendedStandard: 'Tree-lined streets see 15-20% more walking. Target: NDVI above 0.3. Dense residential areas typically range 0.2-0.4.',
    dataSource: 'Sentinel-2 NDVI satellite analysis (10-meter resolution) via Microsoft Planetary Computer',
    additionalContext: 'Tree shade is especially important in hot climates. Lack of shade can make summer walking uncomfortable or dangerous during heat waves.',
    dataQuality: {
      level: 'high',
      explanation: 'ESA Sentinel-2 satellite imagery, 10m resolution. NDVI is a scientifically validated vegetation measure, updated regularly.'
    }
  };
}

