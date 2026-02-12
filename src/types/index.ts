export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
  countryCode?: string; // ISO 3166-1 alpha-2 (e.g. "us", "fr")
}

export interface WalkabilityMetrics {
  // Safety metrics (OSM infrastructure)
  crossingSafety: number; // Crossing density weighted by protection level
  sidewalkCoverage: number; // Percentage of streets with sidewalk tags
  speedExposure: number; // Traffic speed + lane count danger score (inverted: high = safe)
  destinationAccess: number; // OSM amenity/shop/leisure POIs
  nightSafety: number; // Street lighting coverage from OSM lit tags
  // Comfort metrics (satellite/elevation)
  slope: number; // From NASADEM elevation data
  treeCanopy: number; // From Sentinel-2 NDVI data
  thermalComfort: number; // Consolidated surfaceTemp + heatIsland
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

export type CrossSectionElementType = 'building' | 'sidewalk' | 'tree' | 'curb' | 'parking' | 'bikelane' | 'travel_lane';

export interface CrossSectionElement {
  type: CrossSectionElementType;
  width: number;
  label?: string;
  isEstimated: boolean;
}

export interface CrossSectionConfig {
  elements: CrossSectionElement[];
  totalWidth: number;
  streetName: string;
  highwayType: string;
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
