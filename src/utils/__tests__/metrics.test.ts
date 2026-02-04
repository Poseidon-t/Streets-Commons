import { describe, it, expect } from 'vitest';
import { calculateMetrics, assessDataQuality } from '../metrics';
import type { OSMData } from '../../types';

// -- Test data fixtures --

const mockOSMData: OSMData = {
  crossings: [
    { id: 1, lat: 18.7883, lon: 98.9853, tags: { highway: 'crossing' } },
    { id: 2, lat: 18.7893, lon: 98.9863, tags: { highway: 'crossing' } },
    { id: 3, lat: 18.7903, lon: 98.9873, tags: { highway: 'crossing' } },
  ],
  sidewalks: [
    { id: 10, tags: { footway: 'sidewalk' } },
    { id: 11, tags: { footway: 'sidewalk' } },
  ],
  streets: [
    { id: 20, tags: { highway: 'residential', sidewalk: 'both' } },
    { id: 21, tags: { highway: 'residential', sidewalk: 'left' } },
    { id: 22, tags: { highway: 'tertiary' } },
  ],
  pois: [
    { id: 30, tags: { amenity: 'school' } },
    { id: 31, tags: { shop: 'convenience' } },
    { id: 32, tags: { amenity: 'restaurant' } },
    { id: 33, tags: { leisure: 'park' } },
  ],
  nodes: new Map(),
};

const emptyOSMData: OSMData = {
  crossings: [],
  sidewalks: [],
  streets: [],
  pois: [],
  nodes: new Map(),
};

const richOSMData: OSMData = {
  crossings: Array.from({ length: 20 }, (_, i) => ({
    id: i,
    lat: 18.7883 + i * 0.001,
    lon: 98.9853 + i * 0.001,
    tags: { highway: 'crossing' },
  })),
  sidewalks: Array.from({ length: 15 }, (_, i) => ({
    id: 100 + i,
    tags: { footway: 'sidewalk' },
  })),
  streets: Array.from({ length: 60 }, (_, i) => ({
    id: 200 + i,
    tags: {
      highway: 'residential',
      ...(i < 40 ? { sidewalk: 'both' } : {}),
    },
  })),
  pois: Array.from({ length: 25 }, (_, i) => ({
    id: 300 + i,
    tags: { amenity: ['school', 'bus_station', 'hospital', 'restaurant', 'cafe'][i % 5], shop: i % 3 === 0 ? 'supermarket' : undefined, leisure: i % 4 === 0 ? 'park' : undefined },
  })),
  nodes: new Map(),
};

// -- calculateMetrics tests --

describe('calculateMetrics', () => {
  describe('basic structure', () => {
    it('should return all 8 metrics + overall score + label', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

      expect(metrics).toHaveProperty('crossingSafety');
      expect(metrics).toHaveProperty('sidewalkCoverage');
      expect(metrics).toHaveProperty('destinationAccess');
      expect(metrics).toHaveProperty('slope');
      expect(metrics).toHaveProperty('treeCanopy');
      expect(metrics).toHaveProperty('speedExposure');
      expect(metrics).toHaveProperty('nightSafety');
      expect(metrics).toHaveProperty('thermalComfort');
      expect(metrics).toHaveProperty('overallScore');
      expect(metrics).toHaveProperty('label');
    });

    it('should return all scores between 0 and 10', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

      const scoreFields = [
        'crossingSafety', 'sidewalkCoverage', 'destinationAccess',
        'slope', 'treeCanopy', 'speedExposure', 'nightSafety', 'thermalComfort',
        'overallScore',
      ] as const;

      for (const field of scoreFields) {
        expect(metrics[field]).toBeGreaterThanOrEqual(0);
        expect(metrics[field]).toBeLessThanOrEqual(10);
      }
    });

    it('should return a valid label', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(['Excellent', 'Good', 'Fair', 'Poor', 'Critical']).toContain(metrics.label);
    });
  });

  describe('OSM metric calculation', () => {
    it('should calculate crossing safety > 0 when crossings and streets exist', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(metrics.crossingSafety).toBeGreaterThan(0);
    });

    it('should calculate sidewalk coverage > 0 when streets have sidewalk tags', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(metrics.sidewalkCoverage).toBeGreaterThan(0);
    });

    it('should calculate destination access based on POI diversity', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      // 4 POIs covering education, shopping, food, recreation = 4/6 categories
      expect(metrics.destinationAccess).toBeGreaterThan(0);
    });

    it('should give higher destination score with all 6 POI categories', () => {
      const partialMetrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      const fullMetrics = calculateMetrics(richOSMData, 18.7888, 98.9858);
      expect(fullMetrics.destinationAccess).toBeGreaterThanOrEqual(partialMetrics.destinationAccess);
    });
  });

  describe('empty data handling', () => {
    it('should return 0 for all OSM metrics when data is empty', () => {
      const metrics = calculateMetrics(emptyOSMData, 18.7888, 98.9858);
      expect(metrics.crossingSafety).toBe(0);
      expect(metrics.sidewalkCoverage).toBe(0);
      expect(metrics.destinationAccess).toBe(0);
    });

    it('should still return a valid overall score and label for empty data', () => {
      const metrics = calculateMetrics(emptyOSMData, 18.7888, 98.9858);
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.label).toBeDefined();
    });
  });

  describe('satellite metric injection', () => {
    it('should use provided satellite scores directly', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8, 7, 6, undefined, 4);
      expect(metrics.slope).toBe(8);
      expect(metrics.treeCanopy).toBe(7);
      // thermalComfort = avg(surfaceTemp=6, heatIsland=4) = 5
      expect(metrics.thermalComfort).toBe(5);
    });

    it('should default satellite scores to 0 when not provided', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(metrics.slope).toBe(0);
      expect(metrics.treeCanopy).toBe(0);
      expect(metrics.thermalComfort).toBe(0);
    });

    it('should incorporate satellite scores into overall when satellite provided', () => {
      const osmOnly = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      const withSatellite = calculateMetrics(mockOSMData, 18.7888, 98.9858, 10, 10, 10, undefined, 10);
      expect(withSatellite.overallScore).toBeGreaterThan(osmOnly.overallScore);
    });

    it('should handle partial satellite data', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8, undefined, undefined, undefined, undefined);
      expect(metrics.slope).toBe(8);
      expect(metrics.treeCanopy).toBe(0);
      expect(metrics.overallScore).toBeGreaterThan(0);
    });
  });

  describe('score label mapping', () => {
    it('should label excellent for scores >= 8', () => {
      const metrics = calculateMetrics(richOSMData, 18.7888, 98.9858, 10, 10, 10, undefined, 10);
      if (metrics.overallScore >= 8) {
        expect(metrics.label).toBe('Excellent');
      }
    });

    it('should label critical for scores < 2', () => {
      const metrics = calculateMetrics(emptyOSMData, 18.7888, 98.9858);
      if (metrics.overallScore < 2) {
        expect(metrics.label).toBe('Critical');
      }
    });
  });

  describe('weighting system', () => {
    it('should use weighted formula when satellite available', () => {
      // Safety 55% + Comfort 35% with satellite at 10
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 10, 10, 10, undefined, 10);
      expect(metrics.overallScore).toBeGreaterThan(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(10);
    });

    it('should average 5 OSM metrics when no satellite available', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      const avgOSM = (metrics.crossingSafety + metrics.sidewalkCoverage + metrics.speedExposure + metrics.nightSafety + metrics.destinationAccess) / 5;
      expect(metrics.overallScore).toBeCloseTo(avgOSM, 0);
    });
  });
});

// -- assessDataQuality tests --

describe('assessDataQuality', () => {
  it('should return high confidence for rich data', () => {
    const quality = assessDataQuality(richOSMData);
    expect(quality.confidence).toBe('high');
    expect(quality.streetCount).toBe(60);
    expect(quality.crossingCount).toBe(20);
    expect(quality.poiCount).toBe(25);
  });

  it('should return low confidence for empty data', () => {
    const quality = assessDataQuality(emptyOSMData);
    expect(quality.confidence).toBe('low');
    expect(quality.crossingCount).toBe(0);
    expect(quality.streetCount).toBe(0);
  });

  it('should return medium confidence for moderate data', () => {
    const moderateData: OSMData = {
      crossings: Array.from({ length: 8 }, (_, i) => ({ id: i, tags: {} })),
      sidewalks: Array.from({ length: 5 }, (_, i) => ({ id: 10 + i, tags: {} })),
      streets: Array.from({ length: 30 }, (_, i) => ({ id: 20 + i, tags: {} })),
      pois: Array.from({ length: 15 }, (_, i) => ({ id: 30 + i, tags: {} })),
      nodes: new Map(),
    };
    const quality = assessDataQuality(moderateData);
    expect(quality.confidence).toBe('medium');
  });

  it('should count all data types correctly', () => {
    const quality = assessDataQuality(mockOSMData);
    expect(quality.crossingCount).toBe(3);
    expect(quality.streetCount).toBe(3);
    expect(quality.sidewalkCount).toBe(2);
    expect(quality.poiCount).toBe(4);
  });
});
