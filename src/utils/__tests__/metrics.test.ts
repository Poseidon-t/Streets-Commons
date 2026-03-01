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
    { id: 30, lat: 18.7885, lon: 98.9855, tags: { amenity: 'school' } },
    { id: 31, lat: 18.7886, lon: 98.9856, tags: { shop: 'convenience' } },
    { id: 32, lat: 18.7887, lon: 98.9857, tags: { amenity: 'restaurant' } },
    { id: 33, lat: 18.7889, lon: 98.9859, tags: { leisure: 'park' } },
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
    lat: 18.7885 + i * 0.0002,
    lon: 98.9855 + i * 0.0002,
    tags: { amenity: ['school', 'bus_station', 'hospital', 'restaurant', 'cafe'][i % 5], shop: i % 3 === 0 ? 'supermarket' : undefined, leisure: i % 4 === 0 ? 'park' : undefined },
  })),
  nodes: new Map(),
};

// -- calculateMetrics tests --

describe('calculateMetrics', () => {
  describe('basic structure', () => {
    it('should return 3 metrics + overall score + label', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

      expect(metrics).toHaveProperty('destinationAccess');
      expect(metrics).toHaveProperty('slope');
      expect(metrics).toHaveProperty('treeCanopy');
      expect(metrics).toHaveProperty('overallScore');
      expect(metrics).toHaveProperty('label');
    });

    it('should return all scores between 0 and 10', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

      const scoreFields = ['destinationAccess', 'slope', 'treeCanopy', 'overallScore'] as const;

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

  describe('destination access', () => {
    it('should calculate destination access > 0 when POIs exist', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(metrics.destinationAccess).toBeGreaterThan(0);
    });

    it('should give higher score with more POI categories', () => {
      const partialMetrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      const fullMetrics = calculateMetrics(richOSMData, 18.7888, 98.9858);
      expect(fullMetrics.destinationAccess).toBeGreaterThanOrEqual(partialMetrics.destinationAccess);
    });

    it('should return 0 destination access for empty data', () => {
      const metrics = calculateMetrics(emptyOSMData, 18.7888, 98.9858);
      expect(metrics.destinationAccess).toBe(0);
    });
  });

  describe('satellite metric injection', () => {
    it('should use provided satellite scores directly', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8, 7);
      expect(metrics.slope).toBe(8);
      expect(metrics.treeCanopy).toBe(7);
    });

    it('should default satellite scores to 0 when not provided', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      expect(metrics.slope).toBe(0);
      expect(metrics.treeCanopy).toBe(0);
    });

    it('should incorporate satellite scores into overall', () => {
      const osmOnly = calculateMetrics(mockOSMData, 18.7888, 98.9858);
      const withSatellite = calculateMetrics(mockOSMData, 18.7888, 98.9858, 10, 10);
      expect(withSatellite.overallScore).toBeGreaterThan(osmOnly.overallScore);
    });

    it('should handle partial satellite data', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8);
      expect(metrics.slope).toBe(8);
      expect(metrics.treeCanopy).toBe(0);
      expect(metrics.overallScore).toBeGreaterThan(0);
    });
  });

  describe('score label mapping', () => {
    it('should label excellent for scores >= 8', () => {
      const metrics = calculateMetrics(richOSMData, 18.7888, 98.9858, 10, 10);
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

  describe('overall score', () => {
    it('should average available metrics', () => {
      const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8, 6);
      // destinationAccess > 0, slope = 8, treeCanopy = 6 → average of 3
      const expected = (metrics.destinationAccess + 8 + 6) / 3;
      expect(metrics.overallScore).toBeCloseTo(expected, 0);
    });

    it('should return valid score and label for empty data', () => {
      const metrics = calculateMetrics(emptyOSMData, 18.7888, 98.9858);
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.label).toBeDefined();
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
