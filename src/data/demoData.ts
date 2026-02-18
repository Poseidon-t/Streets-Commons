/**
 * Pre-baked demo data for Portland, OR
 * Used by Demo Mode to show all features without API calls
 */

import type {
  Location,
  WalkabilityMetrics,
  WalkabilityScoreV2,
  DataQuality,
  LocalCrashData,
  USCensusData,
  RawMetricData,
  OSMData,
} from '../types';

export const DEMO_LOCATION: Location = {
  lat: 45.5231,
  lon: -122.6765,
  displayName: 'Downtown Portland, OR, USA',
  city: 'Portland',
  country: 'United States',
  countryCode: 'us',
};

export const DEMO_METRICS: WalkabilityMetrics = {
  crossingSafety: 7.2,
  sidewalkCoverage: 6.8,
  speedExposure: 5.9,
  destinationAccess: 8.4,
  nightSafety: 6.1,
  slope: 7.8,
  treeCanopy: 5.2,
  thermalComfort: 4.6,
  overallScore: 6.5,
  label: 'Good',
};

export const DEMO_COMPOSITE_SCORE: WalkabilityScoreV2 = {
  overallScore: 68,
  grade: 'B',
  components: {
    networkDesign: {
      label: 'Network Design',
      score: 74,
      weight: 0.35,
      metrics: [
        { name: 'Intersection Density', score: 78, rawValue: '142 per km²', weight: 0.3 },
        { name: 'Average Block Length', score: 72, rawValue: '118m', weight: 0.25 },
        { name: 'Network Density', score: 76, rawValue: '18.4 km/km²', weight: 0.25 },
        { name: 'Dead-End Ratio', score: 70, rawValue: '8%', weight: 0.2 },
      ],
    },
    environmentalComfort: {
      label: 'Environmental Comfort',
      score: 56,
      weight: 0.25,
      metrics: [
        { name: 'Tree Canopy', score: 52, rawValue: 'NDVI 0.34', weight: 0.3 },
        { name: 'Thermal Comfort', score: 46, rawValue: '28.3°C surface', weight: 0.3 },
        { name: 'Slope', score: 78, rawValue: '2.1°', weight: 0.2 },
        { name: 'Air Quality', score: 61, rawValue: 'AQI 42 (Good)', weight: 0.2 },
      ],
    },
    safety: {
      label: 'Safety',
      score: 65,
      weight: 0.25,
      metrics: [
        { name: 'Crossing Safety', score: 72, rawValue: '34 crossings', weight: 0.3 },
        { name: 'Night Safety', score: 61, rawValue: '64% lit', weight: 0.25 },
        { name: 'Speed Exposure', score: 59, rawValue: '28 mph avg', weight: 0.25 },
        { name: 'Crash History', score: 55, rawValue: '12 crashes (5yr)', weight: 0.2 },
      ],
    },
    densityContext: {
      label: 'Density Context',
      score: 79,
      weight: 0.15,
      metrics: [
        { name: 'Destination Access', score: 84, rawValue: '156 POIs', weight: 0.4 },
        { name: 'Population Density', score: 72, rawValue: '4,850/km²', weight: 0.35 },
        { name: 'Transit Proximity', score: 81, rawValue: '8 stops nearby', weight: 0.25 },
      ],
    },
  },
  confidence: 82,
  legacy: {
    crossingSafety: 7.2,
    sidewalkCoverage: 6.8,
    speedExposure: 5.9,
    destinationAccess: 8.4,
    nightSafety: 6.1,
    slope: 7.8,
    treeCanopy: 5.2,
    thermalComfort: 4.6,
    overallScore: 6.5,
    label: 'Good',
  },
};

export const DEMO_DATA_QUALITY: DataQuality = {
  crossingCount: 34,
  streetCount: 187,
  sidewalkCount: 142,
  poiCount: 156,
  confidence: 'high',
};

export const DEMO_CRASH_DATA: LocalCrashData = {
  type: 'local',
  totalCrashes: 12,
  totalFatalities: 2,
  yearRange: { from: 2019, to: 2023 },
  yearlyBreakdown: [
    { year: 2019, crashes: 3, fatalities: 1 },
    { year: 2020, crashes: 1, fatalities: 0 },
    { year: 2021, crashes: 2, fatalities: 0 },
    { year: 2022, crashes: 4, fatalities: 1 },
    { year: 2023, crashes: 2, fatalities: 0 },
  ],
  nearestCrash: { distance: 180, year: 2022, fatalities: 0, road: 'SW Morrison St' },
  radiusMeters: 800,
  dataSource: 'NHTSA FARS',
};

export const DEMO_DEMOGRAPHIC_DATA: USCensusData = {
  type: 'us',
  tractFips: '41051010600',
  medianHouseholdIncome: 62450,
  medianHomeValue: 485000,
  unemploymentRate: 4.2,
  povertyRate: 12.8,
  medianAge: 36.4,
  bachelorOrHigherPct: 58.3,
  dataSource: 'US Census Bureau ACS 5-Year',
  year: 2022,
};

export const DEMO_RAW_METRIC_DATA: RawMetricData = {
  temperature: 28.3,
  heatDifference: 3.1,
  slopeDegrees: 2.1,
  ndvi: 0.34,
  crossingCount: 34,
  streetLength: 14.8,
  poiCount: 156,
  avgSpeedLimit: 28,
  avgLanes: 2.4,
  highSpeedStreetPct: 18,
  litStreetPct: 64,
  sidewalkPct: 72,
};

// Simplified OSM data for map rendering (crossings + POIs with lat/lon)
export const DEMO_OSM_DATA: Pick<OSMData, 'crossings' | 'sidewalks' | 'streets' | 'pois'> = {
  crossings: [
    { id: 1, lat: 45.5225, lon: -122.6780, tags: { crossing: 'traffic_signals' } },
    { id: 2, lat: 45.5235, lon: -122.6755, tags: { crossing: 'marked' } },
    { id: 3, lat: 45.5218, lon: -122.6740, tags: { crossing: 'traffic_signals' } },
    { id: 4, lat: 45.5242, lon: -122.6770, tags: { crossing: 'marked' } },
    { id: 5, lat: 45.5228, lon: -122.6800, tags: { crossing: 'traffic_signals' } },
    { id: 6, lat: 45.5250, lon: -122.6745, tags: { crossing: 'marked' } },
    { id: 7, lat: 45.5215, lon: -122.6760, tags: { crossing: 'traffic_signals' } },
    { id: 8, lat: 45.5238, lon: -122.6790, tags: { crossing: 'marked' } },
  ],
  sidewalks: [],
  streets: [],
  pois: [
    { lat: 45.5230, lon: -122.6770, tags: { amenity: 'cafe', name: 'Stumptown Coffee' } },
    { lat: 45.5222, lon: -122.6758, tags: { amenity: 'restaurant', name: 'Portland City Grill' } },
    { lat: 45.5240, lon: -122.6750, tags: { amenity: 'pharmacy', name: 'Walgreens' } },
    { lat: 45.5218, lon: -122.6780, tags: { amenity: 'library', name: 'Central Library' } },
    { lat: 45.5248, lon: -122.6765, tags: { amenity: 'school', name: 'Portland Elem.' } },
    { lat: 45.5235, lon: -122.6795, tags: { shop: 'supermarket', name: "Trader Joe's" } },
    { lat: 45.5212, lon: -122.6745, tags: { amenity: 'hospital', name: 'OHSU Clinic' } },
    { lat: 45.5245, lon: -122.6735, tags: { leisure: 'park', name: 'Pioneer Square' } },
    { lat: 45.5226, lon: -122.6810, tags: { amenity: 'bus_station', name: 'Transit Mall' } },
    { lat: 45.5255, lon: -122.6760, tags: { amenity: 'bank', name: 'US Bank' } },
    { lat: 45.5220, lon: -122.6725, tags: { shop: 'books', name: "Powell's Books" } },
    { lat: 45.5238, lon: -122.6780, tags: { amenity: 'fast_food', name: 'Voodoo Doughnut' } },
    { lat: 45.5208, lon: -122.6770, tags: { amenity: 'theatre', name: 'Arlene Schnitzer' } },
    { lat: 45.5252, lon: -122.6740, tags: { amenity: 'dentist', name: 'Pearl Dental' } },
    { lat: 45.5232, lon: -122.6820, tags: { shop: 'convenience', name: 'Plaid Pantry' } },
    { lat: 45.5242, lon: -122.6715, tags: { amenity: 'bar', name: 'Departure' } },
  ],
};

// All satellite data source keys that should appear as "loaded" in demo
export const DEMO_SATELLITE_SOURCES = [
  'slope', 'ndvi', 'surfaceTemp', 'airQuality', 'heatIsland', 'populationDensity',
];
