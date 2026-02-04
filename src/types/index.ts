export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
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
}

export interface Analysis {
  id: string;
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality: DataQuality;
  timestamp: Date;
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
