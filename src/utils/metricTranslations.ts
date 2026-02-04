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
 * 8 metrics: 5 safety/access (OSM) + 3 comfort (satellite):
 * 1. Crossing Safety (OSM crossings weighted by type)
 * 2. Sidewalk Coverage (OSM sidewalk tags)
 * 3. Traffic Speed Safety (OSM maxspeed + lanes)
 * 4. Daily Needs Nearby (OSM POIs)
 * 5. Night Safety (OSM lit tags)
 * 6. Flat Terrain (NASA SRTM)
 * 7. Shade & Greenery (Sentinel-2 NDVI)
 * 8. Thermal Comfort (NASA POWER + Sentinel-2 SWIR consolidated)
 */
export function translateMetrics(
  metrics: WalkabilityMetrics,
  locationName: string,
  rawData?: RawMetricData
): UserFriendlyMetric[] {
  return [
    translateCrossingSafety(metrics.crossingSafety, rawData),
    translateSidewalkCoverage(metrics.sidewalkCoverage, rawData),
    translateSpeedExposure(metrics.speedExposure, rawData),
    translateDestinationAccess(metrics.destinationAccess, locationName, rawData),
    translateNightSafety(metrics.nightSafety, rawData),
    translateSlope(metrics.slope, rawData),
    translateTreeCanopy(metrics.treeCanopy, rawData),
    translateThermalComfort(metrics.thermalComfort, rawData),
  ];
}

/**
 * Crossing Safety → Safe Street Crossings
 */
function translateCrossingSafety(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'Dangerous or Missing Street Crossings',
    'needs-improvement': 'Few Protected Street Crossings',
    'moderate': 'Some Safe Street Crossings',
    'good': 'Good Protected Street Crossings',
    'excellent': 'Excellent Protected Crossings'
  };

  const descriptions = {
    'safety-concern': 'This area has very few safe, signalized crossings. Most crosswalks are unprotected — meaning you cross multi-lane roads without traffic signals or refuge islands.',
    'needs-improvement': 'Few crossings have traffic signals or other protection. You\'ll often cross busy roads with only paint markings — or no markings at all.',
    'moderate': 'Some crossings have traffic signals, but many are unprotected or unmarked. Safety varies by street.',
    'good': 'Many crossings have traffic signals or marked crosswalks. Most streets can be crossed safely.',
    'excellent': 'Most crossings are signalized or well-marked with good pedestrian infrastructure. Crossing streets is safe and convenient.'
  };

  let rawValue: string | undefined;
  if (raw?.crossingCount !== undefined) {
    rawValue = `~${raw.crossingCount} crossings in area`;
  }

  return {
    icon: '🚦',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Signalized crossings reduce pedestrian fatalities by 40-60% compared to unprotected crosswalks. On multi-lane, high-speed roads, an unprotected crosswalk can be more dangerous than no crosswalk at all.',
    example: score < 4
      ? 'Crossing a 6-lane road with no signal means waiting for gaps in 45mph traffic — one of the most dangerous things a pedestrian can do.'
      : score >= 8
      ? 'Traffic signals and marked crosswalks make crossing safe at most intersections.'
      : undefined,
    technicalMeasurement: 'Pedestrian crossings per km, weighted by protection level: signalized (full credit), marked/zebra (70%), refuge island (60%), uncontrolled (30%), unmarked (10%).',
    recommendedStandard: 'WHO recommends crossings every 200m max. NACTO recommends signalized crossings on all roads above 35mph or 4+ lanes.',
    dataSource: 'OpenStreetMap pedestrian crossing data with type classification',
    additionalContext: score < 5 ? 'Unprotected crosswalks on high-speed roads are a leading cause of pedestrian deaths. Advocacy for signalized crossings and refuge islands can save lives.' : undefined,
    dataQuality: {
      level: 'medium',
      explanation: 'OpenStreetMap crossing data with type tags. Crossing locations are well-mapped; crossing type (signalized vs unmarked) may be incomplete in some areas.'
    }
  };
}

/**
 * Sidewalk Coverage → Streets with Sidewalks
 */
function translateSidewalkCoverage(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const percentage = raw?.sidewalkPct !== undefined ? Math.round(raw.sidewalkPct) : Math.round((rawScore / 10) * 100);

  const headlines = {
    'safety-concern': 'Most Streets Have No Sidewalk',
    'needs-improvement': 'Many Streets Lack Sidewalks',
    'moderate': 'Some Streets Have Sidewalks',
    'good': 'Most Streets Have Sidewalks',
    'excellent': 'Nearly All Streets Have Sidewalks'
  };

  const descriptions = {
    'safety-concern': `Only ${percentage}% of streets have sidewalks. Most of the time, you'll be walking in the road with cars.`,
    'needs-improvement': `About ${percentage}% of streets have sidewalks. You'll often need to walk in the road with traffic.`,
    'moderate': `${percentage}% of streets have sidewalks. Some routes have protected walkways, but others require walking in traffic.`,
    'good': `${percentage}% of streets have sidewalks. Most routes have protected walkways, though some gaps remain.`,
    'excellent': `${percentage}% of streets have sidewalks. You can walk safely separated from traffic almost everywhere.`
  };

  return {
    icon: '🚶‍♀️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Walking without sidewalks is dangerous. Streets without sidewalks see pedestrian injury rates 2-3x higher. Sidewalks are essential for people with disabilities, seniors, and parents with strollers.',
    example: score < 3 ? `${100 - percentage}% of your walks will be alongside moving traffic with no protected walkway.` : undefined,
    technicalMeasurement: 'Percentage of streets with paved walkways separate from car traffic, based on OpenStreetMap sidewalk tags.',
    recommendedStandard: 'Walkable neighborhoods have sidewalks on 90%+ of streets. Complete Streets Guidelines recommend sidewalks on 100% of urban streets.',
    dataSource: 'OpenStreetMap sidewalk infrastructure data',
    additionalContext: score < 3
      ? 'This is a serious safety concern. Areas without sidewalks are essentially car-dependent.'
      : 'This measures sidewalk presence, not quality. Mapped sidewalks may be narrow, broken, or obstructed.',
    dataQuality: {
      level: 'medium',
      explanation: 'Based on OpenStreetMap data. Shows whether sidewalks are mapped, but cannot verify condition, width, or usability.'
    }
  };
}

/**
 * Speed Exposure → Traffic Speed Safety
 */
function translateSpeedExposure(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  let rawValue: string | undefined;
  if (raw?.avgSpeedLimit !== undefined) {
    rawValue = `Avg speed: ${Math.round(raw.avgSpeedLimit)} mph`;
    if (raw?.avgLanes !== undefined) {
      rawValue += `, ${raw.avgLanes.toFixed(1)} lanes`;
    }
  }

  const headlines = {
    'safety-concern': 'High-Speed, Multi-Lane Roads',
    'needs-improvement': 'Fast Traffic on Wide Roads',
    'moderate': 'Mixed Speed Environment',
    'good': 'Low-Speed, Walkable Streets',
    'excellent': 'Very Safe, Slow-Speed Streets'
  };

  const descriptions = {
    'safety-concern': 'Streets in this area are designed for fast-moving traffic — wide, multi-lane roads with speed limits of 40-55mph. A pedestrian struck at these speeds has an 85% chance of dying.',
    'needs-improvement': 'Many streets have high speed limits and multiple lanes. Crossing these roads is dangerous, and walking alongside them is uncomfortable.',
    'moderate': 'Mix of high-speed arterials and slower residential streets. Safety depends heavily on which streets you walk along.',
    'good': 'Most streets have moderate speed limits (25-30mph) and fewer lanes. Walking feels safe on most routes.',
    'excellent': 'Streets are designed for people, not just cars. Low speeds (15-25mph) and narrow roads create a safe, walkable environment.'
  };

  return {
    icon: '🚗',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Vehicle speed is the #1 predictor of pedestrian fatality. At 20mph, 5% of struck pedestrians die. At 40mph, 85% die. Wide, multi-lane roads amplify the danger by increasing crossing time and exposure.',
    example: score < 4
      ? 'Walking along a 6-lane, 45mph road with no buffer — this is one of the most dangerous pedestrian environments in America.'
      : score >= 8
      ? 'Narrow, slow streets where cars naturally drive at safe speeds. Comfortable for walking and crossing.'
      : undefined,
    technicalMeasurement: 'Average traffic speed and lane count from OpenStreetMap data. Speed inferred from road classification when not tagged. Danger score combines speed (squared) with lane multiplier.',
    recommendedStandard: 'NACTO recommends 20-25mph on urban streets. Vision Zero targets 20mph in residential areas. Roads above 35mph with no pedestrian infrastructure should not be in walkable areas.',
    dataSource: 'OpenStreetMap road classification, speed limit, and lane data',
    additionalContext: score < 5 ? 'High-speed, multi-lane roads ("stroads") are the most dangerous environments for pedestrians. Speed reduction and road diets save lives.' : undefined,
    dataQuality: {
      level: 'medium',
      explanation: 'Speed limits from OpenStreetMap where tagged. Where not tagged, speed is inferred from road type (primary=45mph, residential=25mph). Lane counts may be incomplete.'
    }
  };
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
 * Night Safety → Well-Lit Streets
 */
function translateNightSafety(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  let rawValue: string | undefined;
  if (raw?.litStreetPct !== undefined) {
    rawValue = `${Math.round(raw.litStreetPct)}% of streets lit`;
  }

  const headlines = {
    'safety-concern': 'Dark, Unlit Streets at Night',
    'needs-improvement': 'Many Streets Lack Lighting',
    'moderate': 'Some Streets Are Lit at Night',
    'good': 'Most Streets Well-Lit at Night',
    'excellent': 'Excellent Street Lighting'
  };

  const descriptions = {
    'safety-concern': 'Most streets lack adequate lighting. Walking after dark is unsafe — poor visibility for both pedestrians and drivers.',
    'needs-improvement': 'Many streets are poorly lit. Walking after dark is uncomfortable and potentially unsafe on unlit streets.',
    'moderate': 'Some streets have lighting, but coverage is inconsistent. Stick to main roads after dark.',
    'good': 'Most streets are well-lit. Walking after dark is generally safe and comfortable.',
    'excellent': 'Streets are well-lit throughout the area. Walking after dark is safe and comfortable on nearly all routes.'
  };

  return {
    icon: '💡',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Nearly half of pedestrian fatalities occur at night. Good street lighting reduces pedestrian crashes by 42%. Lighting also increases perceived safety, encouraging more walking.',
    example: score < 4
      ? 'Walking home from a bus stop after sunset means navigating dark, unlit streets — a major safety and comfort concern.'
      : score >= 8
      ? 'Well-lit streets make evening walks, dog walks, and late commutes safe and pleasant.'
      : undefined,
    technicalMeasurement: 'Percentage of streets with lighting based on OpenStreetMap lit=yes/no tags. Where tag coverage is low, lighting is inferred from road type.',
    recommendedStandard: 'Complete Streets standards require lighting on all pedestrian routes. IES recommends minimum 5 lux on sidewalks.',
    dataSource: 'OpenStreetMap street lighting data',
    additionalContext: score < 5 ? 'Poor street lighting is a major barrier to walking, especially for women and seniors. Advocacy for pedestrian-scale lighting improves safety and walkability.' : undefined,
    dataQuality: {
      level: 'low',
      explanation: 'OpenStreetMap lit tags have limited coverage. Many streets lack this tag. Where data is sparse, lighting is estimated from road type (major roads assumed lit, residential partially).'
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

/**
 * Thermal Comfort → Walking Comfort (consolidated surfaceTemp + heatIsland)
 */
function translateThermalComfort(rawScore: number, raw?: RawMetricData): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  let rawValue: string | undefined;
  const parts: string[] = [];
  if (raw?.temperature !== undefined) {
    parts.push(`Temp: ${raw.temperature.toFixed(1)}°C`);
  }
  if (raw?.heatDifference !== undefined) {
    const sign = raw.heatDifference >= 0 ? '+' : '';
    parts.push(`Heat island: ${sign}${raw.heatDifference.toFixed(1)}°C`);
  }
  if (parts.length > 0) rawValue = parts.join(' | ');

  const headlines = {
    'safety-concern': 'Dangerously Hot Walking Conditions',
    'needs-improvement': 'Hot and Uncomfortable for Walking',
    'moderate': 'Warm but Manageable',
    'good': 'Comfortable Walking Temperature',
    'excellent': 'Cool, Comfortable Walking'
  };

  const descriptions = {
    'safety-concern': 'Extreme heat from high temperatures and urban heat island effect. Outdoor walking is dangerous during summer days — risk of heat stroke.',
    'needs-improvement': 'Hot conditions with significant urban heat buildup. Summer walking is uncomfortable and potentially unsafe during midday.',
    'moderate': 'Moderately warm conditions. Walking is manageable but consider morning or evening in summer months.',
    'good': 'Comfortable temperatures with minimal heat island effect. Walking is pleasant throughout most of the day.',
    'excellent': 'Cool, comfortable conditions with excellent urban cooling from vegetation and design. Walking is pleasant year-round.'
  };

  return {
    icon: '🌡️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    rawValue,
    whyItMatters: 'Heat is the leading weather-related cause of death. Urban areas can be 10-20°F hotter than surrounding areas due to concrete and asphalt. Trees, green space, and reflective surfaces reduce dangerous heat.',
    example: score < 4
      ? 'Best walking times: Early morning (before 10am) or evening (after 6pm) to avoid peak heat.'
      : score >= 8
      ? 'Comfortable for walking throughout the day, even in summer.'
      : undefined,
    technicalMeasurement: 'Combines NASA POWER surface temperature (30-day average) with Sentinel-2 SWIR urban heat island analysis.',
    recommendedStandard: 'Comfortable walking: 15-25°C (59-77°F). Heat island difference should be <5°C. WHO recommends heat warnings above 32°C.',
    dataSource: 'NASA POWER temperature data + Sentinel-2 SWIR heat island analysis',
    additionalContext: score < 5 ? 'High temperatures combined with urban heat buildup make this area uncomfortable for walking. More trees and green infrastructure would help.' : undefined,
    dataQuality: {
      level: 'high',
      explanation: 'Combines NASA POWER meteorological data with Sentinel-2 SWIR satellite analysis. Both are scientifically validated with global coverage.'
    }
  };
}
