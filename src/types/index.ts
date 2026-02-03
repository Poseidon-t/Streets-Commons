export interface Location {
  lat: number;
  lon: number;
  displayName: string;
  city?: string;
  country?: string;
}

export interface WalkabilityMetrics {
  // OSM metrics (crowdsourced but well-mapped)
  crossingDensity: number; // OSM highway=crossing nodes
  networkEfficiency: number; // OSM street grid geometry
  destinationAccess: number; // OSM amenity/shop/leisure POIs
  // Satellite/elevation data metrics
  slope: number; // From NASADEM elevation data
  treeCanopy: number; // From Sentinel-2 NDVI data
  surfaceTemp: number; // From NASA POWER temperature data
  airQuality: number; // From OpenAQ monitoring stations
  heatIsland: number; // From Sentinel-2 SWIR heat island analysis
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
  // Air Quality
  pm25?: number;              // µg/m³
  aqiCategory?: string;       // "Good", "Moderate", etc.

  // Surface Temperature
  temperature?: number;       // °C

  // Heat Island
  urbanTemp?: number;         // °C
  vegetationTemp?: number;    // °C
  heatDifference?: number;    // °C

  // Slope
  slopeDegrees?: number;      // degrees

  // Tree Canopy
  ndvi?: number;              // 0-1 scale

  // OSM metrics (estimated, not direct measurements)
  crossingCount?: number;     // count
  streetLength?: number;      // km
  poiCount?: number;          // count
}
