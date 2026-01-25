import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchMapillaryImages, getMapillaryViewerUrl, isMapillaryConfigured } from '../mapillary';

describe('Mapillary Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('isMapillaryConfigured', () => {
    it('should return false when no access token', () => {
      vi.stubEnv('VITE_MAPILLARY_ACCESS_TOKEN', '');
      expect(isMapillaryConfigured()).toBe(false);
    });

    it('should return true when access token exists', () => {
      vi.stubEnv('VITE_MAPILLARY_ACCESS_TOKEN', 'MLY|test|token');
      expect(isMapillaryConfigured()).toBe(true);
    });
  });

  describe('getMapillaryViewerUrl', () => {
    it('should generate correct viewer URL', () => {
      const imageId = '123456789';
      const url = getMapillaryViewerUrl(imageId);
      expect(url).toBe('https://www.mapillary.com/app/?pKey=123456789');
    });

    it('should handle empty image ID', () => {
      const url = getMapillaryViewerUrl('');
      expect(url).toBe('https://www.mapillary.com/app/?pKey=');
    });
  });

  describe('fetchMapillaryImages', () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    beforeEach(() => {
      mockFetch.mockClear();
      vi.stubEnv('VITE_MAPILLARY_ACCESS_TOKEN', 'MLY|test|token');
    });

    it('should return empty array when no access token', async () => {
      vi.stubEnv('VITE_MAPILLARY_ACCESS_TOKEN', '');
      const images = await fetchMapillaryImages(40.7589, -73.9851);
      expect(images).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch images successfully', async () => {
      const mockData = {
        data: [
          {
            id: 'img1',
            geometry: { coordinates: [-73.9851, 40.7589] },
            captured_at: 1609459200000,
            compass_angle: 90,
            sequence: 'seq1',
            thumb_256_url: 'https://example.com/thumb256.jpg',
            thumb_1024_url: 'https://example.com/thumb1024.jpg',
            thumb_2048_url: 'https://example.com/thumb2048.jpg',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      });

      const images = await fetchMapillaryImages(40.7589, -73.9851, 800);

      expect(images).toHaveLength(1);
      expect(images[0]).toEqual({
        id: 'img1',
        lat: 40.7589,
        lon: -73.9851,
        capturedAt: 1609459200000,
        compassAngle: 90,
        sequenceId: 'seq1',
        thumb256Url: 'https://example.com/thumb256.jpg',
        thumb1024Url: 'https://example.com/thumb1024.jpg',
        thumb2048Url: 'https://example.com/thumb2048.jpg',
      });
    });

    it('should return empty array when API returns no data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const images = await fetchMapillaryImages(40.7589, -73.9851);
      expect(images).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      });

      const images = await fetchMapillaryImages(40.7589, -73.9851);
      expect(images).toEqual([]);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const images = await fetchMapillaryImages(40.7589, -73.9851);
      expect(images).toEqual([]);
    });

    it('should reduce radius if bbox too large', async () => {
      // Mock recursive call behavior
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      // Use very large radius to trigger bbox size check
      const images = await fetchMapillaryImages(0, 0, 1000);
      expect(images).toEqual([]);
    });

    it('should construct proper bbox from lat/lon and radius', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await fetchMapillaryImages(40.7589, -73.9851, 800);

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('bbox=');
      expect(callUrl).toContain('fields=');
      expect(callUrl).toContain('access_token=');
    });
  });
});
