import { describe, it, expect } from 'vitest';
import { scoreAirQuality } from '../airquality';

describe('Air Quality Service - Pure Functions', () => {
  describe('scoreAirQuality (PM2.5 scoring)', () => {
    it('should return 10 for good air quality (PM2.5 <= 12)', () => {
      expect(scoreAirQuality(0)).toBe(10);
      expect(scoreAirQuality(5)).toBe(10);
      expect(scoreAirQuality(12)).toBe(10);
    });

    it('should return 8 for moderate air quality (PM2.5 12-35)', () => {
      expect(scoreAirQuality(20)).toBe(8);
      expect(scoreAirQuality(35)).toBe(8);
    });

    it('should return 6 for unhealthy for sensitive groups (PM2.5 35-55)', () => {
      expect(scoreAirQuality(40)).toBe(6);
      expect(scoreAirQuality(55)).toBe(6);
    });

    it('should return 4 for unhealthy air quality (PM2.5 55-150)', () => {
      expect(scoreAirQuality(80)).toBe(4);
      expect(scoreAirQuality(150)).toBe(4);
    });

    it('should return 2 for very unhealthy (PM2.5 150-250)', () => {
      expect(scoreAirQuality(200)).toBe(2);
      expect(scoreAirQuality(250)).toBe(2);
    });

    it('should return 0 for hazardous (PM2.5 > 250)', () => {
      expect(scoreAirQuality(300)).toBe(0);
      expect(scoreAirQuality(500)).toBe(0);
    });

    it('should decrease monotonically with increasing PM2.5', () => {
      const values = [5, 20, 40, 80, 200, 300];
      const scores = values.map(scoreAirQuality);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });
});
