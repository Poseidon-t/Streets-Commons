export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. "us", "fr")
}

export interface WalkabilityMetrics {
  destinationAccess: number; // OSM amenity/shop/leisure POIs (density + proximity)
  slope: number; // From NASADEM elevation data
  treeCanopy: number; // From Sentinel-2 NDVI data
  overallScore: number;
  label: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
}

export interface DataQuality {
  crossingCount: number;
  streetCount: number;
  sidewalkCount: number;
  poiCount: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface OSMData {
  crossings: any[];
  sidewalks: any[];
  streets: any[];
  pois: any[];
  nodes: Map<string, { lat: number; lon: number }>;
  networkGraph?: NetworkGraph;
  rawElements?: any[];
}

// --- Network Graph (computed from OSM way topology) ---

export interface IntersectionNode {
  id: string;
  lat: number;
  lon: number;
  degree: number; // number of ways meeting at this node
}

export interface NetworkGraph {
  intersections: IntersectionNode[];
  deadEnds: IntersectionNode[];
  totalStreetLengthKm: number;
  areaKm2: number;
  averageBlockLengthM: number;
}

// --- 4-Component Scoring System (0-100 + A-F) ---

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface SubMetric {
  name: string;
  score: number;       // 0-100
  rawValue?: string;   // human-readable raw value
  weight: number;      // 0-1 within the component
}

export interface ComponentScore {
  label: string;       // e.g. "Network Design"
  score: number;       // 0-100
  weight: number;      // 0-1 (how much it counts toward overall)
  metrics: SubMetric[];
}

export interface WalkabilityScoreV2 {
  overallScore: number;    // 0-100
  grade: LetterGrade;
  components: {
    networkDesign: ComponentScore;
    environmentalComfort: ComponentScore;
    safety: ComponentScore;
    densityContext: ComponentScore;
  };
  confidence: number;      // 0-100 confidence
  legacy: WalkabilityMetrics; // backward compat
}

export interface StreetAttributes {
  name: string;
  nameEn?: string;
  highway: 'primary' | 'secondary' | 'tertiary' | 'residential' | 'living_street';
  lanes?: number;
  width?: number;
  cycleway?: string;
  cyclewayLeft?: string;
  cyclewayRight?: string;
  surface?: string;
  maxspeed?: number;
  parkingLeft?: string;
  parkingRight?: string;
  sidewalk?: string;
  oneway?: boolean;
  lit?: boolean;
  osmId?: number;
}

// --- Crash / fatality data ---

/** US street-level crash data from NHTSA FARS */
export interface LocalCrashData {
  type: 'local';
  totalCrashes: number;
  totalFatalities: number;
  yearRange: { from: number; to: number };
  yearlyBreakdown: { year: number; crashes: number; fatalities: number }[];
  nearestCrash?: { distance: number; year: number; fatalities: number; road: string };
  radiusMeters: number;
  dataSource: 'NHTSA FARS';
}

/** International country-level data from WHO */
export interface CountryCrashData {
  type: 'country';
  deathRatePer100k: number;
  totalDeaths: number;
  countryName: string;
  year: number;
  dataSource: 'WHO Global Health Observatory';
}

export type CrashData = LocalCrashData | CountryCrashData;

// --- Raw metric data ---

export interface RawMetricData {
  // Thermal Comfort (consolidated)
  temperature?: number;       // °C (from NASA POWER)
  heatDifference?: number;    // °C (urban vs vegetation)

  // Slope
  slopeDegrees?: number;      // degrees

  // Tree Canopy
  ndvi?: number;              // 0-1 scale

  // OSM metrics
  crossingCount?: number;     // count
  streetLength?: number;      // km
  poiCount?: number;          // count

  // Speed Exposure
  avgSpeedLimit?: number;     // mph
  avgLanes?: number;          // count
  highSpeedStreetPct?: number; // percentage of streets >= 35mph

  // Night Safety
  litStreetPct?: number;      // percentage of lit streets

  // Sidewalk Coverage
  sidewalkPct?: number;       // percentage
}

// --- Demographic / Economic Data ---

/** US Census ACS tract-level data */
export interface USCensusData {
  type: 'us';
  tractFips: string;
  medianHouseholdIncome: number | null;
  medianHomeValue: number | null;
  unemploymentRate: number | null;
  povertyRate: number | null;
  medianAge: number | null;
  bachelorOrHigherPct: number | null;
  dataSource: 'US Census Bureau ACS 5-Year';
  year: number;
}

/** International World Bank country-level data */
export interface InternationalDemographicData {
  type: 'international';
  countryCode: string;
  countryName: string;
  gdpPerCapita: number | null;
  unemploymentRate: number | null;
  urbanPopulationPct: number | null;
  dataSource: 'World Bank Open Data';
  year: number;
}

export type DemographicData = USCensusData | InternationalDemographicData;

// --- Neighborhood Intelligence Data ---

/** Census ACS commute mode data (tract-level) */
export interface CommuteData {
  totalWorkers: number;
  walkPct: number;
  bikePct: number;
  transitPct: number;
  carpoolPct: number;
  wfhPct: number;
  zeroCar: number;        // % of households with 0 vehicles
  totalHouseholds: number;
}

/** CDC PLACES tract-level health outcomes */
export interface CDCHealthData {
  tractFips: string;
  obesity: number | null;
  diabetes: number | null;
  physicalInactivity: number | null;
  mentalHealth: number | null;
  asthma: number | null;
  dataYear: number;
  dataSource: 'CDC PLACES';
}

/** FEMA National Flood Hazard Layer */
export interface FloodRiskData {
  floodZone: string;
  isHighRisk: boolean;
  description: string;
  dataSource: 'FEMA NFHL';
}

/** Transit access computed from OSM data */
export interface TransitAccessData {
  busStops: number;
  railStations: number;
  totalStops: number;
  score: number;
}

/** Park/green space access computed from OSM data */
export interface ParkAccessData {
  parks: number;
  playgrounds: number;
  gardens: number;
  totalGreenSpaces: number;
  nearestParkMeters: number | null;
  score: number;
}

/** Food access computed from OSM data */
export interface FoodAccessData {
  supermarkets: number;
  groceryStores: number;
  convenienceStores: number;
  totalFoodStores: number;
  nearestSupermarketMeters: number | null;
  isFoodDesert: boolean;
  score: number;
}

/** Aggregated neighborhood intelligence */
export interface NeighborhoodIntelligence {
  commute: CommuteData | null;
  transit: TransitAccessData | null;
  parks: ParkAccessData | null;
  food: FoodAccessData | null;
  health: CDCHealthData | null;
  flood: FloodRiskData | null;
}

/** Computed economic impact estimates */
export interface EconomicImpact {
  propertyValuePremium: number | null;
  retailUpliftPercent: number;
  estimatedJobsPotential: number | null;
  healthcareSavingsPerPerson: number;
  walkScore: number;
}
