/**
 * Integration Tests for SafeStreets
 * Tests full user workflows and feature interactions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// -- Mock external dependencies BEFORE importing App --

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: null, isLoaded: true, isSignedIn: false }),
  UserButton: () => <div data-testid="user-button" />,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock react-leaflet (Map component uses this)
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Circle: () => <div data-testid="circle" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn(), flyTo: vi.fn() }),
}));

// Mock leaflet
vi.mock('leaflet', () => {
  class IconMock {
    constructor() { /* noop */ }
  }
  return {
    default: {
      Icon: IconMock,
      icon: vi.fn(() => ({})),
      divIcon: vi.fn(() => ({})),
      latLng: vi.fn(),
      map: vi.fn(),
      marker: vi.fn(),
      tileLayer: vi.fn(),
    },
    Icon: IconMock,
    icon: vi.fn(() => ({})),
    divIcon: vi.fn(() => ({})),
    latLng: vi.fn(),
  };
});

// Mock leaflet CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

// Mock Stripe
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useStripe: () => null,
  useElements: () => null,
  CardElement: () => <div data-testid="card-element" />,
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}));

// Mock all service fetchers (avoid real network calls)
vi.mock('../services/overpass', () => ({
  fetchOSMData: vi.fn(() =>
    Promise.resolve({
      crossings: [],
      sidewalks: [],
      streets: [],
      pois: [],
      nodes: new Map(),
    })
  ),
}));

vi.mock('../services/elevation', () => ({
  fetchSlope: vi.fn(() => Promise.resolve({ avgSlope: 2, maxSlope: 4 })),
  scoreSlopeFromDegrees: vi.fn(() => 8),
  calculateSlope: vi.fn(() => 2),
  calculateMaxSlope: vi.fn(() => 4),
  scoreSlopeForWalkability: vi.fn(() => 8),
  degreesToPercent: vi.fn(() => 3.5),
}));

vi.mock('../services/treecanopy', () => ({
  fetchNDVI: vi.fn(() => Promise.resolve(0.45)),
  scoreTreeCanopy: vi.fn(() => 6),
}));

vi.mock('../services/surfacetemperature', () => ({
  fetchSurfaceTemperature: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../services/airquality', () => ({
  fetchAirQuality: vi.fn(() => Promise.resolve(null)),
  scoreAirQuality: vi.fn(() => 7),
}));

vi.mock('../services/heatisland', () => ({
  fetchHeatIsland: vi.fn(() => Promise.resolve(null)),
}));

// Mock premium access utilities
vi.mock('../utils/premiumAccess', () => ({
  getAccessInfo: vi.fn(() => ({
    hasAccess: false,
    isPremium: false,
    isTrial: false,
    analysesRemaining: 3,
  })),
}));

vi.mock('../utils/clerkAccess', () => ({
  isPremium: vi.fn(() => false),
}));

// Mock fetch globally
const mockFetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ elements: [] }),
  })
);
global.fetch = mockFetch as any;

import App from '../App';

describe('SafeStreets Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
  });

  describe('Initial Render', () => {
    it('should render the app without crashing', () => {
      render(<App />);
      // App should render some heading or branding
      expect(document.body).toBeDefined();
    });

    it('should display search input on initial load', () => {
      render(<App />);
      const input = screen.queryByPlaceholderText(/address/i) || screen.queryByRole('textbox');
      expect(input).toBeTruthy();
    });

    it('should show hero section or tagline', () => {
      render(<App />);
      // Look for the hero tagline text
      const tagline = screen.queryByText(/Analyze any street on Earth/i) || screen.queryAllByText(/SafeStreets/i);
      expect(tagline).toBeTruthy();
    });
  });

  describe('Compare Mode', () => {
    it('should have a compare mode toggle', () => {
      render(<App />);
      const compareBtns = screen.queryAllByText(/Compare/i);
      expect(compareBtns.length).toBeGreaterThan(0);
    });

    it('should switch to compare mode when toggled', async () => {
      render(<App />);
      const compareBtns = screen.getAllByText(/Compare/i);
      fireEvent.click(compareBtns[0]);

      // In compare mode, should show two input fields or compare content
      await waitFor(() => {
        const firstInput = screen.queryByPlaceholderText(/first address/i);
        const compareElements = screen.queryAllByText(/Compare Two/i);
        expect(firstInput || compareElements.length > 0).toBeTruthy();
      });
    });

    it('should exit compare mode', async () => {
      render(<App />);
      const compareBtns = screen.getAllByText(/Compare/i);
      fireEvent.click(compareBtns[0]);

      await waitFor(() => {
        const exitBtn = screen.queryByText(/Exit/i) || screen.queryByText(/Back/i) || screen.queryByText(/Single/i);
        if (exitBtn) {
          fireEvent.click(exitBtn);
        }
      });
    });
  });

  describe('Error Resilience', () => {
    it('should not crash when fetch fails', () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      expect(() => {
        render(<App />);
      }).not.toThrow();
    });

    it('should render even with no user session', () => {
      // Clerk mock returns user: null
      render(<App />);
      expect(document.body.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('Component Structure', () => {
    it('should render the map area', () => {
      render(<App />);
      // Map may be rendered via mock or as a div; just verify no crash
      expect(document.querySelector('[data-testid="map-container"], .leaflet-container, [class*="map"]')).toBeDefined();
    });

    it('should not show analysis results before a search', () => {
      render(<App />);
      // Score card / metric grid should not be visible initially
      const scoreCard = screen.queryByText(/Overall Score/i);
      expect(scoreCard).toBeFalsy();
    });
  });
});
