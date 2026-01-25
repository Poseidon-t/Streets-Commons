import { describe, it, expect } from 'vitest';
import { calculateDemographics } from '../demographics';

describe('calculateDemographics', () => {
  it('should return demographic estimates', () => {
    const demographics = calculateDemographics();

    expect(demographics).toHaveProperty('totalPopulation');
    expect(demographics).toHaveProperty('children');
    expect(demographics).toHaveProperty('elderly');
    expect(demographics).toHaveProperty('dailyVisitors');
  });

  it('should return positive numbers', () => {
    const demographics = calculateDemographics();

    expect(demographics.totalPopulation).toBeGreaterThan(0);
    expect(demographics.children).toBeGreaterThan(0);
    expect(demographics.elderly).toBeGreaterThan(0);
    expect(demographics.dailyVisitors).toBeGreaterThan(0);
  });

  it('should have children less than total population', () => {
    const demographics = calculateDemographics();

    expect(demographics.children).toBeLessThan(demographics.totalPopulation);
    expect(demographics.elderly).toBeLessThan(demographics.totalPopulation);
  });

  it('should return reasonable estimates for 800m radius', () => {
    const demographics = calculateDemographics();

    // 800m radius = ~2km² area, urban density ~7k/km² = ~14k people
    expect(demographics.totalPopulation).toBeGreaterThan(10000);
    expect(demographics.totalPopulation).toBeLessThan(20000);
  });
});
