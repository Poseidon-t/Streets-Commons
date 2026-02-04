/**
 * User Journey Tests — 10 Real-World Locations
 *
 * Tests the full analysis pipeline (OSM → metrics → scores → labels)
 * with realistic data fixtures representing diverse global locations.
 * Each location simulates what the app would receive from APIs.
 */

import { describe, it, expect } from 'vitest';
import { calculateMetrics, assessDataQuality } from '../utils/metrics';
import { scoreTreeCanopy } from '../services/treecanopy';
// scoreAirQuality no longer drives a visible metric, but still called for API compat
import { scoreSlopeFromDegrees } from '../services/elevation';
import type { OSMData } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a realistic OSM dataset for testing */
function buildOSM(opts: {
  crossings: number;
  streets: number;
  sidewalks: number;
  pois: { amenity?: string; shop?: string; leisure?: string; railway?: string }[];
  sidewalkTagRatio?: number; // fraction of streets with sidewalk=both
  crossingCoords?: boolean; // whether crossings have lat/lon
  centerLat?: number;
  centerLon?: number;
}): OSMData {
  const lat = opts.centerLat ?? 0;
  const lon = opts.centerLon ?? 0;

  return {
    crossings: Array.from({ length: opts.crossings }, (_, i) => ({
      id: i,
      ...(opts.crossingCoords !== false
        ? { lat: lat + (Math.random() - 0.5) * 0.01, lon: lon + (Math.random() - 0.5) * 0.01 }
        : {}),
      tags: { highway: 'crossing' },
    })),
    sidewalks: Array.from({ length: opts.sidewalks }, (_, i) => ({
      id: 1000 + i,
      tags: { footway: 'sidewalk' },
    })),
    streets: Array.from({ length: opts.streets }, (_, i) => ({
      id: 2000 + i,
      tags: {
        highway: 'residential',
        ...(i / opts.streets < (opts.sidewalkTagRatio ?? 0) ? { sidewalk: 'both' } : {}),
      },
    })),
    pois: opts.pois.map((p, i) => ({ id: 3000 + i, tags: p })),
    nodes: new Map(),
  };
}

// ---------------------------------------------------------------------------
// 10 Global Location Profiles
// ---------------------------------------------------------------------------

interface LocationProfile {
  name: string;
  lat: number;
  lon: number;
  osm: OSMData;
  satellite: {
    slope: number;       // degrees → scoreSlopeFromDegrees
    ndvi: number;        // 0-1 → scoreTreeCanopy
    pm25: number;        // µg/m³ → scoreAirQuality
    surfaceTemp: number; // pre-scored 0-10
    heatIsland: number;  // pre-scored 0-10
  };
  expectations: {
    minOverall: number;
    maxOverall: number;
    label: string[];
    confidence: string;
  };
}

const locations: LocationProfile[] = [
  // 1. Amsterdam — world-class walkability
  // High confidence requires: streets>50, crossings>10, pois>20
  {
    name: 'Amsterdam, Netherlands',
    lat: 52.3676, lon: 4.9041,
    osm: buildOSM({
      crossings: 45, streets: 80, sidewalks: 35,
      pois: [
        ...Array.from({ length: 5 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 5 }, () => ({ shop: 'supermarket' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'hospital' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'restaurant' })),
        ...Array.from({ length: 4 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.85, crossingCoords: true,
      centerLat: 52.3676, centerLon: 4.9041,
    }),
    satellite: { slope: 1, ndvi: 0.52, pm25: 10, surfaceTemp: 8, heatIsland: 7 },
    expectations: { minOverall: 5, maxOverall: 10, label: ['Excellent', 'Good'], confidence: 'high' },
  },

  // 2. Manhattan, NYC — dense grid, good infrastructure
  {
    name: 'Midtown Manhattan, New York',
    lat: 40.7580, lon: -73.9855,
    osm: buildOSM({
      crossings: 60, streets: 90, sidewalks: 40,
      pois: [
        ...Array.from({ length: 5 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 5 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 5 }, () => ({ shop: 'supermarket' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'clinic' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'cafe' })),
        ...Array.from({ length: 3 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.9, crossingCoords: true,
      centerLat: 40.7580, centerLon: -73.9855,
    }),
    satellite: { slope: 1, ndvi: 0.25, pm25: 15, surfaceTemp: 5, heatIsland: 4 },
    expectations: { minOverall: 4, maxOverall: 10, label: ['Excellent', 'Good', 'Fair'], confidence: 'high' },
  },

  // 3. Tokyo, Shibuya — dense, mixed-use
  {
    name: 'Shibuya, Tokyo',
    lat: 35.6595, lon: 139.7004,
    osm: buildOSM({
      crossings: 50, streets: 75, sidewalks: 30,
      pois: [
        ...Array.from({ length: 4 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 4 }, () => ({ railway: 'station' })),
        ...Array.from({ length: 5 }, () => ({ shop: 'convenience' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'pharmacy' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'restaurant' })),
        ...Array.from({ length: 4 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.7, crossingCoords: true,
      centerLat: 35.6595, centerLon: 139.7004,
    }),
    satellite: { slope: 3, ndvi: 0.35, pm25: 18, surfaceTemp: 6, heatIsland: 5 },
    expectations: { minOverall: 4, maxOverall: 10, label: ['Excellent', 'Good', 'Fair'], confidence: 'high' },
  },

  // 4. Barcelona, Eixample — superblocks, good walkability
  {
    name: 'Eixample, Barcelona',
    lat: 41.3874, lon: 2.1686,
    osm: buildOSM({
      crossings: 40, streets: 65, sidewalks: 25,
      pois: [
        ...Array.from({ length: 4 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 5 }, () => ({ shop: 'bakery' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'hospital' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'bar' })),
        ...Array.from({ length: 4 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.75, crossingCoords: true,
      centerLat: 41.3874, centerLon: 2.1686,
    }),
    satellite: { slope: 2, ndvi: 0.42, pm25: 14, surfaceTemp: 6, heatIsland: 5 },
    expectations: { minOverall: 4, maxOverall: 10, label: ['Excellent', 'Good', 'Fair'], confidence: 'high' },
  },

  // 5. Houston, TX — car-dependent suburban sprawl
  {
    name: 'Westchase, Houston',
    lat: 29.7350, lon: -95.5595,
    osm: buildOSM({
      crossings: 3, streets: 40, sidewalks: 4,
      pois: [
        { shop: 'supermarket' }, { amenity: 'restaurant' },
      ],
      sidewalkTagRatio: 0.1, crossingCoords: true,
      centerLat: 29.7350, centerLon: -95.5595,
    }),
    satellite: { slope: 1, ndvi: 0.28, pm25: 22, surfaceTemp: 3, heatIsland: 3 },
    expectations: { minOverall: 1, maxOverall: 6, label: ['Fair', 'Poor', 'Critical'], confidence: 'low' },
  },

  // 6. Lagos, Nigeria — dense but limited infrastructure mapping
  {
    name: 'Lagos Island, Nigeria',
    lat: 6.4541, lon: 3.3947,
    osm: buildOSM({
      crossings: 5, streets: 25, sidewalks: 2,
      pois: [
        { amenity: 'school' }, { shop: 'convenience' }, { amenity: 'restaurant' },
      ],
      sidewalkTagRatio: 0.15, crossingCoords: true,
      centerLat: 6.4541, centerLon: 3.3947,
    }),
    satellite: { slope: 1, ndvi: 0.22, pm25: 45, surfaceTemp: 4, heatIsland: 3 },
    expectations: { minOverall: 1, maxOverall: 6, label: ['Fair', 'Poor', 'Critical'], confidence: 'low' },
  },

  // 7. Singapore — well-planned, hot climate
  {
    name: 'Orchard Road, Singapore',
    lat: 1.3048, lon: 103.8318,
    osm: buildOSM({
      crossings: 30, streets: 55, sidewalks: 20,
      pois: [
        ...Array.from({ length: 4 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 5 }, () => ({ shop: 'department_store' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'clinic' })),
        ...Array.from({ length: 4 }, () => ({ amenity: 'cafe' })),
        ...Array.from({ length: 4 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.65, crossingCoords: true,
      centerLat: 1.3048, centerLon: 103.8318,
    }),
    satellite: { slope: 2, ndvi: 0.55, pm25: 20, surfaceTemp: 5, heatIsland: 4 },
    expectations: { minOverall: 4, maxOverall: 10, label: ['Excellent', 'Good', 'Fair'], confidence: 'high' },
  },

  // 8. New Delhi — high pollution, mixed walkability
  // Medium confidence requires: streets>20, crossings>5, pois>10
  {
    name: 'Connaught Place, New Delhi',
    lat: 28.6315, lon: 77.2167,
    osm: buildOSM({
      crossings: 12, streets: 35, sidewalks: 8,
      pois: [
        ...Array.from({ length: 3 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 2 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 3 }, () => ({ shop: 'convenience' })),
        ...Array.from({ length: 2 }, () => ({ amenity: 'hospital' })),
        ...Array.from({ length: 2 }, () => ({ amenity: 'restaurant' })),
      ],
      sidewalkTagRatio: 0.3, crossingCoords: true,
      centerLat: 28.6315, centerLon: 77.2167,
    }),
    satellite: { slope: 1, ndvi: 0.25, pm25: 120, surfaceTemp: 3, heatIsland: 2 },
    expectations: { minOverall: 1, maxOverall: 6, label: ['Fair', 'Poor', 'Critical'], confidence: 'medium' },
  },

  // 9. San Francisco, Pacific Heights — hilly, good amenities
  {
    name: 'Pacific Heights, San Francisco',
    lat: 37.7925, lon: -122.4382,
    osm: buildOSM({
      crossings: 25, streets: 50, sidewalks: 18,
      pois: [
        ...Array.from({ length: 3 }, () => ({ amenity: 'school' })),
        ...Array.from({ length: 3 }, () => ({ amenity: 'bus_station' })),
        ...Array.from({ length: 3 }, () => ({ shop: 'supermarket' })),
        ...Array.from({ length: 2 }, () => ({ amenity: 'cafe' })),
        ...Array.from({ length: 2 }, () => ({ leisure: 'park' })),
      ],
      sidewalkTagRatio: 0.6, crossingCoords: true,
      centerLat: 37.7925, centerLon: -122.4382,
    }),
    satellite: { slope: 12, ndvi: 0.38, pm25: 12, surfaceTemp: 7, heatIsland: 6 },
    expectations: { minOverall: 3, maxOverall: 8, label: ['Good', 'Fair', 'Poor'], confidence: 'medium' },
  },

  // 10. Rural Kansas — no infrastructure
  {
    name: 'Rural Osborne, Kansas',
    lat: 39.4500, lon: -98.7000,
    osm: buildOSM({
      crossings: 0, streets: 5, sidewalks: 0,
      pois: [],
      sidewalkTagRatio: 0, crossingCoords: false,
      centerLat: 39.4500, centerLon: -98.7000,
    }),
    satellite: { slope: 1, ndvi: 0.32, pm25: 8, surfaceTemp: 7, heatIsland: 8 },
    expectations: { minOverall: 0, maxOverall: 7, label: ['Good', 'Fair', 'Poor', 'Critical'], confidence: 'low' },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('User Journey — 10 Global Locations', () => {
  locations.forEach((loc) => {
    describe(loc.name, () => {
      // Compute scores once per location
      const slopeScore = scoreSlopeFromDegrees(loc.satellite.slope);
      const treeScore = scoreTreeCanopy(loc.satellite.ndvi);
      const metrics = calculateMetrics(
        loc.osm,
        loc.lat,
        loc.lon,
        slopeScore,
        treeScore,
        loc.satellite.surfaceTemp,
        undefined, // airQuality no longer a visible metric
        loc.satellite.heatIsland,
      );
      const quality = assessDataQuality(loc.osm);

      it('should produce an overall score within expected range', () => {
        expect(metrics.overallScore).toBeGreaterThanOrEqual(loc.expectations.minOverall);
        expect(metrics.overallScore).toBeLessThanOrEqual(loc.expectations.maxOverall);
      });

      it('should assign an expected label', () => {
        expect(loc.expectations.label).toContain(metrics.label);
      });

      it('should have correct data confidence', () => {
        expect(quality.confidence).toBe(loc.expectations.confidence);
      });

      it('should keep all metric scores between 0 and 10', () => {
        const fields = [
          'crossingSafety', 'sidewalkCoverage', 'destinationAccess',
          'slope', 'treeCanopy', 'speedExposure', 'nightSafety', 'thermalComfort',
          'overallScore',
        ] as const;
        for (const f of fields) {
          expect(metrics[f], `${f} out of range`).toBeGreaterThanOrEqual(0);
          expect(metrics[f], `${f} out of range`).toBeLessThanOrEqual(10);
        }
      });

      it('should correctly count OSM elements', () => {
        expect(quality.crossingCount).toBe(loc.osm.crossings.length);
        expect(quality.streetCount).toBe(loc.osm.streets.length);
        expect(quality.sidewalkCount).toBe(loc.osm.sidewalks.length);
        expect(quality.poiCount).toBe(loc.osm.pois.length);
      });
    });
  });

  // Cross-location comparisons
  describe('Cross-location comparisons', () => {
    // Compute all metrics upfront
    const results = locations.map((loc) => {
      const slopeScore = scoreSlopeFromDegrees(loc.satellite.slope);
      const treeScore = scoreTreeCanopy(loc.satellite.ndvi);
      return {
        name: loc.name,
        metrics: calculateMetrics(
          loc.osm, loc.lat, loc.lon,
          slopeScore, treeScore, loc.satellite.surfaceTemp, undefined, loc.satellite.heatIsland,
        ),
      };
    });

    const byName = (n: string) => results.find(r => r.name.includes(n))!.metrics;

    it('Amsterdam should outscore Houston', () => {
      expect(byName('Amsterdam').overallScore).toBeGreaterThan(byName('Houston').overallScore);
    });

    it('Manhattan should outscore Rural Kansas', () => {
      expect(byName('Manhattan').overallScore).toBeGreaterThan(byName('Kansas').overallScore);
    });

    it('Tokyo should outscore Lagos (infrastructure mapping)', () => {
      expect(byName('Tokyo').overallScore).toBeGreaterThan(byName('Lagos').overallScore);
    });

    it('Barcelona should outscore New Delhi (air quality + infrastructure)', () => {
      expect(byName('Barcelona').overallScore).toBeGreaterThan(byName('Delhi').overallScore);
    });

    it('Singapore should outscore Houston (walkability planning)', () => {
      expect(byName('Singapore').overallScore).toBeGreaterThan(byName('Houston').overallScore);
    });

    it('well-mapped cities should have higher data confidence than sparse areas', () => {
      const amsterdam = assessDataQuality(locations[0].osm);
      const rural = assessDataQuality(locations[9].osm);
      const levels = { high: 3, medium: 2, low: 1 };
      expect(levels[amsterdam.confidence]).toBeGreaterThan(levels[rural.confidence]);
    });
  });
});
