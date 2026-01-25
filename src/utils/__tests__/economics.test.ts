import { describe, it, expect } from 'vitest';
import { calculateEconomicProjections } from '../economics';
import type { OSMData } from '../../types';

describe('calculateEconomicProjections', () => {
  const mockOSMData: OSMData = {
    crossings: [],
    sidewalks: [],
    streets: [
      { id: 1, tags: { highway: 'residential' } },
      { id: 2, tags: { highway: 'residential' } },
      { id: 3, tags: { highway: 'tertiary' } },
    ],
    pois: [
      { id: 10, tags: { shop: 'convenience' } },
      { id: 11, tags: { amenity: 'restaurant' } },
      { id: 12, tags: { amenity: 'cafe' } },
    ],
    nodes: new Map(),
  };

  it('should calculate all economic projections', () => {
    const projections = calculateEconomicProjections(mockOSMData);

    expect(projections).toHaveProperty('retailUplift');
    expect(projections).toHaveProperty('propertyValue');
    expect(projections).toHaveProperty('healthSavings');
    expect(projections).toHaveProperty('jobsCreated');
    expect(projections).toHaveProperty('roi');
    expect(projections).toHaveProperty('currency');
  });

  it('should return positive values', () => {
    const projections = calculateEconomicProjections(mockOSMData);

    expect(projections.retailUplift).toBeGreaterThan(0);
    expect(projections.propertyValue).toBeGreaterThan(0);
    expect(projections.healthSavings).toBeGreaterThan(0);
    expect(projections.jobsCreated).toBeGreaterThan(0);
    expect(projections.roi).toBeGreaterThan(0);
  });

  it('should use provided currency', () => {
    const projections = calculateEconomicProjections(mockOSMData, 'THB');

    expect(projections.currency).toBe('THB');
  });

  it('should default to USD', () => {
    const projections = calculateEconomicProjections(mockOSMData);

    expect(projections.currency).toBe('USD');
  });

  it('should scale with retail count', () => {
    const smallData: OSMData = {
      ...mockOSMData,
      pois: [{ tags: { shop: 'convenience' } }],
    };

    const largeData: OSMData = {
      ...mockOSMData,
      pois: Array(10).fill(null).map(() => ({ tags: { shop: 'convenience' } })),
    };

    const smallProjections = calculateEconomicProjections(smallData);
    const largeProjections = calculateEconomicProjections(largeData);

    expect(largeProjections.retailUplift).toBeGreaterThan(smallProjections.retailUplift);
  });
});
