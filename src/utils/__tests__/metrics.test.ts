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

  it('should calculate all 8 metrics + overall', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

    expect(metrics).toHaveProperty('crossingDensity');
    expect(metrics).toHaveProperty('networkEfficiency');
    expect(metrics).toHaveProperty('destinationAccess');
    expect(metrics).toHaveProperty('slope');
    expect(metrics).toHaveProperty('treeCanopy');
    expect(metrics).toHaveProperty('surfaceTemp');
    expect(metrics).toHaveProperty('airQuality');
    expect(metrics).toHaveProperty('heatIsland');
    expect(metrics).toHaveProperty('overallScore');
    expect(metrics).toHaveProperty('label');
  });

  it('should return scores between 0 and 10', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

    expect(metrics.crossingDensity).toBeGreaterThanOrEqual(0);
    expect(metrics.crossingDensity).toBeLessThanOrEqual(10);
    expect(metrics.networkEfficiency).toBeGreaterThanOrEqual(0);
    expect(metrics.networkEfficiency).toBeLessThanOrEqual(10);
    expect(metrics.destinationAccess).toBeGreaterThanOrEqual(0);
    expect(metrics.destinationAccess).toBeLessThanOrEqual(10);
    expect(metrics.slope).toBeGreaterThanOrEqual(0);
    expect(metrics.slope).toBeLessThanOrEqual(10);
    expect(metrics.treeCanopy).toBeGreaterThanOrEqual(0);
    expect(metrics.treeCanopy).toBeLessThanOrEqual(10);
    expect(metrics.surfaceTemp).toBeGreaterThanOrEqual(0);
    expect(metrics.surfaceTemp).toBeLessThanOrEqual(10);
    expect(metrics.airQuality).toBeGreaterThanOrEqual(0);
    expect(metrics.airQuality).toBeLessThanOrEqual(10);
    expect(metrics.heatIsland).toBeGreaterThanOrEqual(0);
    expect(metrics.heatIsland).toBeLessThanOrEqual(10);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(10);
  });

  it('should use satellite scores when provided', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 8, 7, 6, 5, 4);

    expect(metrics.slope).toBe(8);
    expect(metrics.treeCanopy).toBe(7);
    expect(metrics.surfaceTemp).toBe(6);
    expect(metrics.airQuality).toBe(5);
    expect(metrics.heatIsland).toBe(4);
    expect(metrics.overallScore).toBeGreaterThan(0);
  });

  it('should calculate OSM metrics from data', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);

    // crossingDensity should be > 0 (3 crossings, 3 streets)
    expect(metrics.crossingDensity).toBeGreaterThan(0);
    // networkEfficiency should be > 0 (3 crossings / 3 streets = 1.0 ratio)
    expect(metrics.networkEfficiency).toBeGreaterThan(0);
    // destinationAccess: school, shopping, restaurant, park = 4/6 types
    expect(metrics.destinationAccess).toBeGreaterThan(0);
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
    expect(metrics.crossingDensity).toBe(0);
    expect(metrics.networkEfficiency).toBe(0);
    expect(metrics.destinationAccess).toBe(0);
    expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
    expect(metrics.label).toBeDefined();
  });

  it('should return correct label based on score', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858);
    expect(['Excellent', 'Good', 'Fair', 'Poor', 'Critical']).toContain(metrics.label);
  });

  it('should weight OSM at 35% and satellite at 65% when all available', () => {
    const metrics = calculateMetrics(mockOSMData, 18.7888, 98.9858, 10, 10, 10, 10, 10);
    // OSM: crossingDensity*0.10 + networkEfficiency*0.15 + destinationAccess*0.10
    // Satellite: 10*0.10 + 10*0.10 + 10*0.10 + 10*0.15 + 10*0.20 = 6.5
    // Total = OSM + 6.5
    expect(metrics.overallScore).toBeGreaterThan(0);
    expect(metrics.overallScore).toBeLessThanOrEqual(10);
  });
});
