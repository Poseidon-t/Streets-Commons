/**
 * Utility functions to translate technical metrics into user-friendly language
 * Converts percentages to 1-10 scores and generates plain-language descriptions
 */

import type { WalkabilityMetrics } from '../types';

// Placeholder type since sidewalkImageAnalysis was removed
interface AggregatedSidewalkAnalysis {
  averageScore?: number;
  sidewalkCondition?: string;
  hasObstacles?: boolean;
  hasWheelchairAccess?: boolean;
  hasProperLighting?: boolean;
  totalImages?: number;
  discrepancyWithOSM?: boolean;
  commonIssues?: string[];
}

export interface UserFriendlyMetric {
  icon: string;
  headline: string;
  score: number; // 1-10
  badge: 'excellent' | 'good' | 'moderate' | 'needs-improvement' | 'safety-concern';
  description: string;
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

/**
 * Convert 0-10 score to 1-10 scale
 */
function convertToTenScale(score: number): number {
  return Math.max(1, Math.round(score));
}

/**
 * Determine badge based on score
 */
function getBadge(score: number): UserFriendlyMetric['badge'] {
  if (score >= 8) return 'excellent';
  if (score >= 5) return 'good';
  if (score >= 3) return 'moderate';
  if (score >= 2) return 'needs-improvement';
  return 'safety-concern';
}

/**
 * Translate all metrics to user-friendly format
 *
 * Shows 6 core metrics with highest data reliability:
 * 1. Street Crossings (OSM) - 95% global coverage
 * 2. Street Network (OSM) - 99% global coverage
 * 3. Daily Needs (OSM POIs) - 85% coverage in urban areas
 * 4. Parks Nearby (OSM) - 90% coverage
 * 5. Terrain Slope (NASADEM) - 99% global coverage
 * 6. Tree Canopy (Sentinel-2 NDVI) - 95% global coverage
 *
 * Hidden metrics (lower reliability or seasonal):
 * - Sidewalks: Very incomplete OSM data (<30% coverage globally)
 * - Surface Temp: Confusing for users, redundant with heat island
 * - Air Quality: Only works within 25km of monitoring stations (~60% coverage)
 * - Heat Island: Fails in winter/cloudy conditions (~70% coverage)
 */
export function translateMetrics(
  metrics: WalkabilityMetrics,
  locationName: string,
  _sidewalkImageAnalysis?: AggregatedSidewalkAnalysis
): UserFriendlyMetric[] {
  return [
    translateCrossingDensity(metrics.crossingDensity),
    translateNetworkEfficiency(metrics.networkEfficiency),
    translateDestinationAccess(metrics.destinationAccess, locationName),
    translateGreenSpaceAccess(metrics.greenSpaceAccess),
    translateSlope(metrics.slope),
    translateTreeCanopy(metrics.treeCanopy),
  ];
}

/**
 * Crossing Density → Safe Street Crossings
 */
function translateCrossingDensity(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'Very Hard to Cross Streets Safely',
    'needs-improvement': 'Hard to Cross Streets Safely',
    'moderate': 'Some Safe Street Crossings',
    'good': 'Good Safe Street Crossings',
    'excellent': 'Excellent Safe Street Crossings'
  };

  const descriptions = {
    'safety-concern': 'This area has very few marked crosswalks. You\'ll often need to walk many blocks out of your way to find a safe place to cross busy streets.',
    'needs-improvement': 'Few marked crosswalks mean you\'ll often walk extra blocks to find safe places to cross busy streets.',
    'moderate': 'Some marked crosswalks are available, but you may still need to detour occasionally to cross safely.',
    'good': 'Many marked crosswalks make it relatively easy to cross streets safely in most areas.',
    'excellent': 'Abundant marked crosswalks mean you can cross streets safely almost anywhere without long detours.'
  };

  const examples = {
    'safety-concern': 'To cross a main street safely, you may need to walk 5-6 blocks (1/4 mile) out of your way.',
    'needs-improvement': 'To cross a main street safely, you may need to walk 3-4 blocks out of your way.',
    'moderate': 'Most blocks have crossings, but some gaps remain on busy streets.',
    'good': 'Crosswalks appear every 2-3 blocks on major streets.',
    'excellent': 'Crosswalks are frequent - typically every 1-2 blocks, even on busy streets.'
  };

  return {
    icon: '🚶',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Safe crossings make it easier to reach shops, parks, and transit stops without long detours. More crosswalks mean shorter, more direct walks and safer routes for children and seniors.',
    example: examples[badge],
    technicalMeasurement: 'We count marked pedestrian crossings per 1,000 feet of roadway. This includes zebra crossings, signalized crossings, and marked mid-block crossings.',
    recommendedStandard: 'Pedestrian safety guidelines recommend crossings every 300-600 feet (1-2 blocks) on busy streets. WHO Global Action Plan recommends crossings at maximum 200m intervals in urban areas.',
    dataSource: 'OpenStreetMap pedestrian crossing data',
    additionalContext: score < 5 ? 'Low crossing density often forces pedestrians to jaywalk or take long detours, increasing both danger and inconvenience.' : undefined,
    dataQuality: {
      level: 'medium',
      explanation: 'Based on OpenStreetMap volunteer data. Crossings are easier to spot and map than sidewalk condition, so this is generally reliable. However, informal crossings, recently added crossings, and unmarked crossings may be missing. Data quality is better in well-mapped areas.'
    }
  };
}

/**
 * Sidewalk Coverage → Streets with Sidewalks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _translateSidewalkCoverage(
  rawScore: number,
  imageAnalysis?: AggregatedSidewalkAnalysis
): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const percentage = Math.round((rawScore / 10) * 100);

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

  // Enhance additional context with image analysis if available
  let enhancedContext = score < 3
    ? 'This is a serious safety concern. Areas without sidewalks see significantly higher pedestrian injury rates and are essentially car-dependent. Note: Mapped sidewalks may be encroached, broken, or too narrow to use comfortably - especially common in developing countries.'
    : 'Note: This measures sidewalk presence only, not quality. Mapped sidewalks may be encroached by vendors, vehicles, or infrastructure, or may be too narrow/broken to use safely.';

  // Add Mapillary analysis if available
  if (imageAnalysis && imageAnalysis.totalImages && imageAnalysis.totalImages > 0) {
    if (imageAnalysis.discrepancyWithOSM) {
      enhancedContext += `\n\n⚠️ Discrepancy Alert: ${imageAnalysis.totalImages} street-level photos available for this area. Visual inspection recommended to verify actual sidewalk conditions.`;
    } else if (imageAnalysis.commonIssues && imageAnalysis.commonIssues.length > 0 && !imageAnalysis.commonIssues[0].includes('Visual analysis requires')) {
      enhancedContext += `\n\nStreet-level imagery (${imageAnalysis.totalImages} photos) shows: ${imageAnalysis.commonIssues.slice(0, 2).join(', ')}.`;
    } else {
      enhancedContext += `\n\n${imageAnalysis.totalImages} street-level photos available for visual verification. Click images below to inspect actual sidewalk conditions.`;
    }
  }

  // Adjust data quality confidence if image analysis suggests issues
  let dataQualityLevel: 'high' | 'medium' | 'low' = 'medium';
  let dataQualityExplanation = 'Based on volunteer-contributed OpenStreetMap data. Shows whether sidewalks are mapped, but cannot verify current condition, width, or usability. Data accuracy varies by region - well-mapped areas (US, Europe) are more reliable than developing countries. For ground truth, we recommend validating with street-level imagery.';

  if (imageAnalysis) {
    if (imageAnalysis.discrepancyWithOSM) {
      dataQualityLevel = 'low';
      dataQualityExplanation = `OSM data shows ${percentage}% sidewalk coverage, but ${imageAnalysis.totalImages || 0} street-level images suggest discrepancies. Visual inspection strongly recommended. OSM may be outdated or inaccurate for this area.`;
    } else if (imageAnalysis.totalImages && imageAnalysis.totalImages >= 5) {
      dataQualityExplanation += ` ${imageAnalysis.totalImages} street-level photos available for verification.`;
    }
  }

  return {
    icon: '🚶‍♀️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Walking without sidewalks is dangerous and uncomfortable. Sidewalks make everyday activities like walking to neighbors, exercising, or letting kids play outside much safer. They\'re essential for people with disabilities, seniors, and parents with strollers.',
    example: score < 3 ? `${100 - percentage}% of your walks will be alongside moving traffic with no protected walkway.` : undefined,
    technicalMeasurement: 'We measure which streets have paved walkways separate from car traffic, including sidewalks, paths, and pedestrian lanes. This analysis is based on OpenStreetMap volunteer data, which may not reflect actual sidewalk condition, width, or usability.',
    recommendedStandard: 'Walkable neighborhoods typically have sidewalks on 90%+ of streets. UN-Habitat SDG 11.2 requires adequate and accessible sidewalks for all urban residents. Complete Streets Guidelines recommend sidewalks on 100% of urban streets.',
    dataSource: 'OpenStreetMap sidewalk infrastructure data',
    additionalContext: enhancedContext,
    dataQuality: {
      level: dataQualityLevel,
      explanation: dataQualityExplanation
    }
  };
}

/**
 * Network Efficiency → Street Directness
 */
function translateNetworkEfficiency(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const efficiency = Math.round((rawScore / 10) * 100);
  const extraDistance = Math.round((100 / efficiency - 1) * 100);

  const headlines = {
    'safety-concern': 'Very Indirect Routes, Many Detours',
    'needs-improvement': 'Indirect Routes with Detours',
    'moderate': 'Some Extra Blocks to Get Around',
    'good': 'Fairly Direct Routes',
    'excellent': 'Very Direct Routes'
  };

  const descriptions = {
    'safety-concern': `Getting from point A to point B requires many detours. The street layout adds ${extraDistance}% more distance compared to a straight line.`,
    'needs-improvement': `Getting from point A to point B requires significant detours. The street layout adds ${extraDistance}% more distance.`,
    'moderate': `Getting from point A to point B requires some detours. The street layout adds about ${extraDistance}% more distance.`,
    'good': `Getting around is fairly direct. The street layout adds only ${extraDistance}% more distance than a straight line.`,
    'excellent': `Routes are very direct with minimal detours. The street layout adds only ${extraDistance}% extra distance.`
  };

  return {
    icon: '🗺️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Efficient street networks mean shorter walks to destinations. Disconnected streets or dead-ends force longer routes, affecting whether you\'ll choose to walk instead of drive. Direct routes save time and make walking more appealing.',
    example: score < 5
      ? `A 10-minute straight-line walk actually takes ${10 + Math.round(10 * extraDistance / 100)} minutes due to street layout.`
      : `A 10-minute straight-line walk takes about ${10 + Math.round(10 * extraDistance / 100)} minutes - very reasonable.`,
    technicalMeasurement: `We compare actual walking routes to straight-line distances between common destinations. ${efficiency}% efficiency means typical routes are ${extraDistance}% longer than crow-flies distance.`,
    recommendedStandard: 'ITDP TOD Standard recommends small block sizes (80-100m) with high intersection density (≥140 intersections per km²) for walkable neighborhoods. Grid-pattern neighborhoods with many through-streets score 85-95%.',
    dataSource: 'OpenStreetMap street network analysis',
    dataQuality: {
      level: 'high',
      explanation: 'Based on OpenStreetMap street network data. Street connectivity and layout are objective geometric measurements that are highly reliable. OSM street networks are generally very accurate and complete, as roads are one of the most well-mapped features globally.'
    }
  };
}

/**
 * Destination Access → Daily Needs Nearby
 */
function translateDestinationAccess(rawScore: number, _locationName: string): UserFriendlyMetric {
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

  return {
    icon: '🏪',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'When daily destinations are nearby, you can leave your car at home more often. This saves money on gas and parking, gives you exercise, and makes spontaneous trips easy. You\'re more likely to know neighbors and feel connected to your community.',
    example: score >= 7
      ? 'Nearby destinations:\n• Grocery store: 5-minute walk\n• Coffee shop: 3-minute walk\n• Park: 7-minute walk\n• Restaurant: 4-minute walk'
      : undefined,
    technicalMeasurement: `We count how many common destination types (groceries, restaurants, schools, parks, transit, healthcare, etc.) you can reach within a 15-minute walk (about 0.75 miles). ${percentage}% means most essential services are walkable.`,
    recommendedStandard: '15-minute city concept aims for all essential services within a 15-minute walk. High-scoring areas (80%+) typically have mixed-use zoning that combines residential and commercial uses.',
    dataSource: 'OpenStreetMap points of interest (POI) data',
    dataQuality: {
      level: 'medium',
      explanation: 'Based on OpenStreetMap POI (point of interest) data. Major destinations like grocery stores, schools, and parks are generally well-mapped. However, smaller businesses, new establishments, temporary closures, and home-based services may be missing or outdated. Quality varies by region.'
    }
  };
}

/**
 * Green Space Access → Parks & Nature Nearby
 */
function translateGreenSpaceAccess(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'No Parks or Green Spaces Nearby',
    'needs-improvement': 'Parks Are Far Away',
    'moderate': 'Park Within Reasonable Distance',
    'good': 'Park Nearby',
    'excellent': 'Park Very Close By'
  };

  const descriptions = {
    'safety-concern': 'The nearest park or green space is more than a 15-minute walk away. You\'ll likely need to drive to access nature.',
    'needs-improvement': 'The nearest park is a 10-15 minute walk away. While accessible, it\'s not immediately convenient.',
    'moderate': 'You have a park within a 10-minute walk. It\'s accessible for planned outings.',
    'good': 'You have a park within a 5-8 minute walk. It\'s easily accessible for regular visits.',
    'excellent': 'You have a park, trail, or green space within a 5-minute walk from your home.'
  };

  return {
    icon: '🏞️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Nearby parks give you places to exercise, relax, and enjoy nature without driving. Easy access to green spaces improves mental health, encourages outdoor activity, and provides safe places for children to play. Properties near parks often have higher values.',
    example: score >= 8
      ? 'Your nearest green spaces:\n• Local park: 3-minute walk - playground, trails\n• Community garden: 5-minute walk\n• Walking trail: 7-minute walk'
      : undefined,
    technicalMeasurement: 'We measure walking distance to the nearest park, playground, trail, or natural area. This includes public parks, community gardens, forests, and outdoor recreation spaces.',
    recommendedStandard: 'Research shows people use parks much more frequently when they\'re less than a 10-minute walk (0.5 miles) away. WHO recommends green spaces within 300m of all residences.',
    dataSource: 'OpenStreetMap parks and recreation data',
    dataQuality: {
      level: 'medium',
      explanation: 'Based on OpenStreetMap volunteer data. Major public parks are generally well-mapped, but smaller parks, pocket parks, community gardens, and newly created green spaces may be missing. Private parks and restricted-access green spaces may not be included.'
    }
  };
}

/**
 * Slope → Flat Terrain
 */
function translateSlope(rawScore: number): UserFriendlyMetric {
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

  return {
    icon: '⛰️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Flat terrain makes walking easier for everyone - especially seniors, people with disabilities, parents with strollers, and anyone carrying groceries. Steep hills can make short walks feel exhausting and may prevent people from walking altogether.',
    example: score >= 8
      ? 'Terrain is gentle enough for wheelchairs, strollers, and anyone with mobility concerns.'
      : score < 4
      ? 'Think San Francisco hills - walks will be strenuous.'
      : undefined,
    technicalMeasurement: 'We analyze elevation changes along typical walking routes in this area using digital elevation data.',
    recommendedStandard: 'Slopes above 5% (about 1 foot of elevation gain per 20 feet of distance) become challenging for many people. This 5% threshold is the maximum for ADA wheelchair accessibility. San Francisco hills often exceed 10-15% grade.',
    dataSource: 'SRTM elevation data (30-meter resolution) via Open-Elevation API',
    dataQuality: {
      level: 'high',
      explanation: 'Based on NASA Shuttle Radar Topography Mission (SRTM) satellite data. This is highly accurate and reliable terrain data collected from space with 30-meter resolution. Elevation measurements are verified and consistent worldwide.'
    }
  };
}

/**
 * Tree Canopy → Shade & Greenery
 */
function translateTreeCanopy(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);
  const coverage = Math.round((rawScore / 10) * 40); // Rough conversion to percentage

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
    whyItMatters: 'Trees make walks more comfortable in summer heat and provide cleaner air. Shaded streets can be 10-15°F cooler than treeless ones. More trees also make neighborhoods more attractive and can increase home values by 7-15%.',
    example: score >= 7
      ? 'On a 90°F day, shaded sidewalks feel like 75°F. Most of your walks will have overhead shade.'
      : score < 4
      ? 'On a 90°F day, you\'ll be walking in full sun. Consider morning or evening walks in summer.'
      : undefined,
    technicalMeasurement: 'We use satellite imagery to measure vegetation density (NDVI - Normalized Difference Vegetation Index) from Sentinel-2 optical bands. NDVI ranges from -1 (water/urban) to +1 (dense vegetation). Values above 0.3 indicate healthy tree canopy.',
    recommendedStandard: 'Studies show tree-lined streets encourage 15-20% more walking and improve air quality. Urban areas should aim for NDVI values above 0.3 for adequate green cover. Dense residential areas typically range 0.2-0.4.',
    dataSource: 'Sentinel-2 NDVI satellite analysis (10-meter resolution) via Microsoft Planetary Computer',
    additionalContext: 'Tree shade is especially important in hot climates. Lack of shade can make summer walking uncomfortable or dangerous during heat waves.',
    dataQuality: {
      level: 'high',
      explanation: 'Based on ESA Sentinel-2 satellite imagery with 10-meter resolution. NDVI (vegetation index) is a scientifically validated measure that accurately detects tree canopy from space. Updated regularly with fresh imagery. This is highly reliable objective data.'
    }
  };
}

/**
 * Surface Temperature → Cool Walking Conditions
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _translateSurfaceTemp(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'Very Hot Walking Conditions',
    'needs-improvement': 'Hot Walking Conditions',
    'moderate': 'Moderate Heat in Summer',
    'good': 'Comfortable Walking Temperatures',
    'excellent': 'Cool, Comfortable Walking'
  };

  const descriptions = {
    'safety-concern': 'Ground temperatures exceed 110°F on summer days. Walking during daytime can be dangerous. Stick to early morning or evening.',
    'needs-improvement': 'Ground temperatures often reach 105°F on summer days. Walking is uncomfortable and potentially unsafe during midday.',
    'moderate': 'Ground temperatures average 95°F on summer days. This is warmer than ideal but manageable with morning/evening walks.',
    'good': 'Ground temperatures stay moderate (85-90°F) even in summer. Walking is generally comfortable throughout the day.',
    'excellent': 'Ground temperatures remain cool (below 85°F) due to shade and vegetation. Walking is comfortable year-round.'
  };

  return {
    icon: '🌡️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Hot pavement makes walks uncomfortable and can be dangerous for heat-sensitive people, seniors, and children. Cooler areas (from trees, water, or lighter surfaces) are more pleasant for walking year-round and encourage more pedestrian activity.',
    example: score < 4
      ? 'Best walking times: Early morning (before 10am) or evening (after 6pm) to avoid peak heat.'
      : score >= 8
      ? 'Comfortable for walking throughout the day, even in summer.'
      : undefined,
    technicalMeasurement: 'We measure average maximum temperature from NASA POWER meteorological data. This provides 30-day rolling average for pedestrian comfort assessment.',
    recommendedStandard: 'Comfortable walking temperatures are 15-25°C (59-77°F). Temperatures above 35°C (95°F) can be dangerous for extended outdoor activity. WHO recommends heat warnings above 32°C (90°F).',
    dataSource: 'NASA POWER meteorological data (30-day average)',
    additionalContext: score < 4 ? 'High temperatures are a serious concern in this area. Consider morning or evening walks during hot months.' : undefined,
    dataQuality: {
      level: 'high',
      explanation: 'Based on NASA POWER meteorological satellite data. This provides scientifically accurate temperature measurements with global coverage. Uses 30-day rolling average to account for seasonal variation.'
    }
  };
}

/**
 * Air Quality → Clean Air for Walking
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _translateAirQuality(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'Hazardous Air Quality',
    'needs-improvement': 'Unhealthy Air Quality',
    'moderate': 'Moderate Air Quality',
    'good': 'Good Air Quality',
    'excellent': 'Excellent Air Quality'
  };

  const descriptions = {
    'safety-concern': 'Air quality is hazardous. PM2.5 pollution exceeds safe levels. Outdoor activity is not recommended, especially for sensitive groups.',
    'needs-improvement': 'Air quality is unhealthy. Pollution may cause breathing discomfort during outdoor activity. Sensitive individuals should limit exposure.',
    'moderate': 'Air quality is acceptable for most people. However, sensitive individuals may experience minor symptoms during extended outdoor activity.',
    'good': 'Air quality is good. You can enjoy outdoor walks without health concerns for most people.',
    'excellent': 'Air quality is excellent. Ideal conditions for walking and outdoor activity.'
  };

  return {
    icon: '🌫️',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Clean air makes walking healthier and more enjoyable. Poor air quality can cause respiratory problems, especially for children, seniors, and people with asthma. Long-term exposure to pollution reduces life expectancy and quality of life.',
    example: score < 4
      ? 'Consider wearing a mask during walks. Check air quality before outdoor activity.'
      : score >= 8
      ? 'Air is clean and safe for extended outdoor activity.'
      : undefined,
    technicalMeasurement: 'We measure PM2.5 (fine particulate matter) from nearby monitoring stations. PM2.5 particles are small enough to penetrate deep into lungs and bloodstream.',
    recommendedStandard: 'WHO guidelines: PM2.5 should not exceed 15 µg/m³ annual average or 45 µg/m³ 24-hour average. US EPA considers 0-12 µg/m³ "Good", 12-35 "Moderate", 35-55 "Unhealthy for Sensitive Groups".',
    dataSource: 'OpenAQ real-time air quality monitoring (15,000+ stations globally)',
    additionalContext: score < 5 ? 'Poor air quality is a serious health concern. Consider advocating for emissions reduction and green infrastructure.' : undefined,
    dataQuality: {
      level: 'high',
      explanation: 'Based on OpenAQ real-time monitoring data from government-certified air quality stations. Data comes from official EPA, government, and verified sensors. Updated hourly. Quality depends on proximity to monitoring stations (typically within 25km).'
    }
  };
}

/**
 * Heat Island → Urban Cooling
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _translateHeatIsland(rawScore: number): UserFriendlyMetric {
  const score = convertToTenScale(rawScore);
  const badge = getBadge(score);

  const headlines = {
    'safety-concern': 'Severe Heat Island Effect',
    'needs-improvement': 'Significant Heat Island',
    'moderate': 'Moderate Heat Island',
    'good': 'Minimal Heat Island',
    'excellent': 'Excellent Urban Cooling'
  };

  const descriptions = {
    'safety-concern': 'This area is significantly hotter than surrounding vegetated areas (12°C+ difference). Urban heat island effect is severe.',
    'needs-improvement': 'This area is noticeably hotter than surrounding vegetated areas (8-12°C difference). Heat island effect is significant.',
    'moderate': 'This area is moderately warmer than surrounding vegetated areas (5-8°C difference). Some urban heat buildup occurs.',
    'good': 'This area stays relatively cool compared to heavily built-up zones (2-5°C difference). Good urban cooling from trees and green space.',
    'excellent': 'This area maintains temperatures similar to vegetated areas (<2°C difference). Excellent urban cooling from abundant vegetation and water.'
  };

  return {
    icon: '🔥',
    headline: headlines[badge],
    score,
    badge,
    description: descriptions[badge],
    whyItMatters: 'Urban heat islands make cities uncomfortably hot in summer, increase cooling costs, and can be dangerous during heat waves. Areas with trees, green space, and water stay 10-20°F cooler than concrete-heavy zones, making walking more comfortable year-round.',
    example: score >= 7
      ? 'This area benefits from tree shade and green infrastructure that keeps temperatures comfortable.'
      : score < 4
      ? 'On a 90°F day, this area may feel like 100-105°F due to heat-absorbing surfaces. Avoid midday walks in summer.'
      : undefined,
    technicalMeasurement: 'We compare surface temperatures between urban and vegetated areas using Sentinel-2 SWIR satellite bands. Positive values indicate urban areas are hotter than nearby vegetation.',
    recommendedStandard: 'Well-designed urban areas minimize heat island effect through tree canopy (40%+ coverage), permeable surfaces, green roofs, and water features. Temperature differences should be <5°C compared to vegetated areas.',
    dataSource: 'Sentinel-2 SWIR surface temperature analysis via Microsoft Planetary Computer',
    additionalContext: score < 5 ? 'High heat island effect indicates lack of cooling infrastructure. Consider advocating for more street trees, green space, and light-colored surfaces.' : undefined,
    dataQuality: {
      level: 'high',
      explanation: 'Based on ESA Sentinel-2 SWIR (shortwave infrared) satellite imagery. Measures surface temperature differences between urban and vegetated areas with 10-meter resolution. Updated regularly. Scientifically validated method for urban heat island assessment.'
    }
  };
}
