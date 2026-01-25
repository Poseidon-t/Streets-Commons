import { describe, it, expect } from 'vitest';
import { calculateMetrics } from '../metrics';
import type { OSMData } from '../../types';

describe('calculateMetrics', () => {
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
      { id: 20, tags: { highway: 'residential' } },
      { id: 21, tags: { highway: 'residential' } },
      { id: 22, tags: { highway: 'tertiary' } },
    ],
    pois: [
      { id: 30, tags: { amenity: 'school' } },
      { id: 31, tags: { shop: 'convenience' } },
      { id: 32, tags: { amenity: 'restaurant' } },
      { id: 33, tags: { leisure: 'park' } },
      { id: 34, tags: { natural: 'tree' } },
    ],
    nodes: new Map(),
  };

  it('should calculate all metrics', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

    expect(metrics).toHaveProperty('crossingGaps');
    expect(metrics).toHaveProperty('treeCanopy');
    expect(metrics).toHaveProperty('surfaceTemp');
    expect(metrics).toHaveProperty('networkEfficiency');
    expect(metrics).toHaveProperty('slope');
    expect(metrics).toHaveProperty('destinationAccess');
    expect(metrics).toHaveProperty('overallScore');
    expect(metrics).toHaveProperty('label');
  });

  it('should return scores between 0 and 10', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

    expect(metrics.crossingGaps).toBeGreaterThanOrEqual(0);
    expect(metrics.crossingGaps).toBeLessThanOrEqual(10);
    expect(metrics.treeCanopy).toBeGreaterThanOrEqual(0);
    expect(metrics.treeCanopy).toBeLessThanOrEqual(10);
    expect(metrics.networkEfficiency).toBeGreaterThanOrEqual(0);
    expect(metrics.networkEfficiency).toBeLessThanOrEqual(10);
    expect(metrics.destinationAccess).toBeGreaterThanOrEqual(0);
    expect(metrics.destinationAccess).toBeLessThanOrEqual(10);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(10);
  });

  it('should return correct label for excellent score', () => {
    // Mock data that should give high scores
    const excellentData: OSMData = {
      crossings: Array(20).fill(null).map((_, i) => ({
        id: i,
        lat: 18.788 + i * 0.001,
        lon: 98.985 + i * 0.001,
        tags: { highway: 'crossing' },
      })),
      sidewalks: Array(10).fill(null).map((_, i) => ({ id: i, tags: { footway: 'sidewalk' } })),
      streets: Array(10).fill(null).map((_, i) => ({ id: i, tags: { highway: 'residential' } })),
      pois: [
        { tags: { amenity: 'school' } },
        { tags: { shop: 'supermarket' } },
        { tags: { amenity: 'restaurant' } },
        { tags: { leisure: 'park' } },
        { tags: { amenity: 'hospital' } },
        { tags: { railway: 'station' } },
      ],
      nodes: new Map(),
    };

    const metrics = calculateMetrics(excellentData, 18.7888, 98.9858);
    expect(['Excellent', 'Good']).toContain(metrics.label);
  });

  it('should handle empty data gracefully', () => {
    const emptyData: OSMData = {
      crossings: [],
      sidewalks: [],
      streets: [],
      pois: [],
      nodes: new Map(),
    };

    const metrics = calculateMetrics(emptyData, 18.7888, 98.9858);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.label).toBeDefined();
  });

  it('should calculate destination access correctly', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
    // We have 5 destination categories represented
    expect(metrics.destinationAccess).toBeGreaterThan(0);
  });
});
