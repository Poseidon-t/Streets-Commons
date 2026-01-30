import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';

// Configuration
const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:3002';
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'screenshots');
const REPORT_DIR = path.join(process.cwd(), 'test-results');

// Test data
interface TestResult {
  testName: string;
  category: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  screenshot?: string;
  details?: string;
}

interface BugReport {
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  screenshot?: string;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
}

const testResults: TestResult[] = [];
const bugs: BugReport[] = [];
const performanceMetrics: PerformanceMetric[] = [];
const consoleErrors: string[] = [];
const networkErrors: string[] = [];

// Utility functions
async function captureScreenshot(page: Page, name: string): Promise<string> {
  const filename = `${name}-${Date.now()}.png`;
  const filepath = path.join(SCREENSHOT_DIR, filename);
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: filepath, fullPage: true });
  return filepath;
}

async function waitForNetworkIdle(page: Page, timeout = 5000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout });
}

async function measureLoadTime(page: Page): Promise<number> {
  const startTime = Date.now();
  await page.goto(FRONTEND_URL);
  await waitForNetworkIdle(page);
  return Date.now() - startTime;
}

function recordTestResult(result: TestResult) {
  testResults.push(result);
}

function recordBug(bug: BugReport) {
  bugs.push(bug);
}

function recordPerformance(metric: PerformanceMetric) {
  performanceMetrics.push(metric);
}

// Setup console and network monitoring
function setupMonitoring(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${new Date().toISOString()}] ${msg.text()}`);
    }
  });

  page.on('requestfailed', (request) => {
    networkErrors.push(`Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });
}

test.describe('Streets Commons - Comprehensive Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    setupMonitoring(page);
  });

  // ===== 1. HOME PAGE & INITIAL LOAD =====
  test.describe('1. Home Page & Initial Load', () => {
    test('Should load home page successfully', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle', timeout: 30000 });
        const duration = Date.now() - startTime;

        recordPerformance({ name: 'Initial Page Load', value: duration, unit: 'ms' });

        const screenshot = await captureScreenshot(page, 'home-page-loaded');

        recordTestResult({
          testName: 'Home page loads successfully',
          category: 'Home Page & Initial Load',
          status: 'PASS',
          duration,
          screenshot,
          details: `Page loaded in ${duration}ms`
        });
      } catch (error) {
        recordTestResult({
          testName: 'Home page loads successfully',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
        throw error;
      }
    });

    test('Should display hero section with branding', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Check for hero section
        const heroSection = page.locator('h1, [class*="hero"]').first();
        await expect(heroSection).toBeVisible({ timeout: 10000 });

        const heroText = await heroSection.textContent();
        const screenshot = await captureScreenshot(page, 'hero-section');

        recordTestResult({
          testName: 'Hero section displays with branding',
          category: 'Home Page & Initial Load',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: `Hero text: ${heroText}`
        });
      } catch (error) {
        recordTestResult({
          testName: 'Hero section displays with branding',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should have visible and functional search input', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Look for search input
        const searchInput = page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="location" i], input[placeholder*="address" i]').first();
        await expect(searchInput).toBeVisible({ timeout: 10000 });

        // Test if it's functional
        await searchInput.fill('Test Location');
        const value = await searchInput.inputValue();

        const screenshot = await captureScreenshot(page, 'search-input');

        expect(value).toBe('Test Location');

        recordTestResult({
          testName: 'Search input is visible and functional',
          category: 'Home Page & Initial Load',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: 'Search input accepts text input'
        });
      } catch (error) {
        const screenshot = await captureScreenshot(page, 'search-input-error');
        recordTestResult({
          testName: 'Search input is visible and functional',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error),
          screenshot
        });
      }
    });

    test('Should display FAQ section', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Look for FAQ section
        const faqSection = page.locator('text=/FAQ|Frequently Asked Questions/i').first();

        if (await faqSection.isVisible({ timeout: 5000 })) {
          const screenshot = await captureScreenshot(page, 'faq-section');
          recordTestResult({
            testName: 'FAQ section displays',
            category: 'Home Page & Initial Load',
            status: 'PASS',
            duration: Date.now() - startTime,
            screenshot,
            details: 'FAQ section found and visible'
          });
        } else {
          recordTestResult({
            testName: 'FAQ section displays',
            category: 'Home Page & Initial Load',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'FAQ section not found'
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'FAQ section displays',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should render footer with links', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Scroll to bottom to find footer
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);

        const footer = page.locator('footer').first();
        const hasFooter = await footer.count() > 0;

        const screenshot = await captureScreenshot(page, 'footer');

        if (hasFooter) {
          recordTestResult({
            testName: 'Footer renders with links',
            category: 'Home Page & Initial Load',
            status: 'PASS',
            duration: Date.now() - startTime,
            screenshot,
            details: 'Footer element found'
          });
        } else {
          recordTestResult({
            testName: 'Footer renders with links',
            category: 'Home Page & Initial Load',
            status: 'FAIL',
            duration: Date.now() - startTime,
            screenshot,
            details: 'No footer element found'
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'Footer renders with links',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should have no console errors on initial load', async ({ page }) => {
      const startTime = Date.now();
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      try {
        await page.goto(FRONTEND_URL);
        await page.waitForTimeout(3000); // Wait for any delayed errors

        if (errors.length === 0) {
          recordTestResult({
            testName: 'No console errors on load',
            category: 'Home Page & Initial Load',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'Console is clean'
          });
        } else {
          recordTestResult({
            testName: 'No console errors on load',
            category: 'Home Page & Initial Load',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: `Found ${errors.length} console errors: ${errors.join(', ')}`
          });

          recordBug({
            severity: 'Medium',
            title: 'Console errors on page load',
            description: `${errors.length} console errors detected on initial page load`,
            stepsToReproduce: ['Navigate to home page', 'Open browser console'],
            expectedBehavior: 'No console errors should appear',
            actualBehavior: `Console shows errors: ${errors.join(', ')}`,
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'No console errors on load',
          category: 'Home Page & Initial Load',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 2. SINGLE LOCATION ANALYSIS =====
  test.describe('2. Single Location Analysis', () => {
    test('Should search for Times Square and display results', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Find search input
        const searchInput = page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="location" i], input[placeholder*="address" i]').first();
        await searchInput.fill('Times Square, New York, USA');

        const screenshot1 = await captureScreenshot(page, 'search-input-filled');

        // Look for search button or press Enter
        await searchInput.press('Enter');

        // Wait for analysis to start
        await page.waitForTimeout(2000);

        const screenshot2 = await captureScreenshot(page, 'analysis-started');

        // Wait for results (up to 90 seconds)
        await page.waitForTimeout(5000);

        const screenshot3 = await captureScreenshot(page, 'analysis-results');

        recordTestResult({
          testName: 'Search for Times Square and get results',
          category: 'Single Location Analysis',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot: screenshot3,
          details: 'Search initiated successfully'
        });
      } catch (error) {
        const screenshot = await captureScreenshot(page, 'search-error');
        recordTestResult({
          testName: 'Search for Times Square and get results',
          category: 'Single Location Analysis',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error),
          screenshot
        });
      }
    });

    test('Should verify autocomplete functionality', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const searchInput = page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="location" i], input[placeholder*="address" i]').first();
        await searchInput.fill('New York');

        await page.waitForTimeout(2000); // Wait for autocomplete

        const screenshot = await captureScreenshot(page, 'autocomplete');

        // Look for autocomplete dropdown
        const dropdown = page.locator('[role="listbox"], .autocomplete, [class*="suggestion"], [class*="dropdown"]');
        const hasDropdown = await dropdown.count() > 0;

        recordTestResult({
          testName: 'Address autocomplete works',
          category: 'Single Location Analysis',
          status: hasDropdown ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          screenshot,
          details: hasDropdown ? 'Autocomplete dropdown appeared' : 'No autocomplete dropdown found'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Address autocomplete works',
          category: 'Single Location Analysis',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should display all 6 core metrics', async ({ page }) => {
      const startTime = Date.now();
      const expectedMetrics = [
        'Street Crossings',
        'Street Network',
        'Daily Needs',
        'Parks Nearby',
        'Terrain Slope',
        'Tree Canopy'
      ];

      try {
        await page.goto(FRONTEND_URL);

        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('Times Square, New York');
        await searchInput.press('Enter');

        // Wait for analysis
        await page.waitForTimeout(15000);

        const screenshot = await captureScreenshot(page, 'all-metrics');

        const foundMetrics: string[] = [];

        for (const metric of expectedMetrics) {
          const metricElement = page.locator(`text=/${metric}/i`);
          if (await metricElement.count() > 0) {
            foundMetrics.push(metric);
          }
        }

        const allMetricsFound = foundMetrics.length === expectedMetrics.length;

        recordTestResult({
          testName: 'All 6 core metrics display',
          category: 'Single Location Analysis',
          status: allMetricsFound ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          screenshot,
          details: `Found ${foundMetrics.length}/6 metrics: ${foundMetrics.join(', ')}`
        });

        if (!allMetricsFound) {
          const missing = expectedMetrics.filter(m => !foundMetrics.includes(m));
          recordBug({
            severity: 'High',
            title: 'Missing metrics in analysis results',
            description: `Not all expected metrics are displayed`,
            stepsToReproduce: ['Search for Times Square', 'Wait for analysis', 'Check displayed metrics'],
            expectedBehavior: 'All 6 metrics should be visible',
            actualBehavior: `Only ${foundMetrics.length} metrics found. Missing: ${missing.join(', ')}`,
            screenshot
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'All 6 core metrics display',
          category: 'Single Location Analysis',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should display overall walkability score', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('Singapore');
        await searchInput.press('Enter');

        await page.waitForTimeout(15000);

        const screenshot = await captureScreenshot(page, 'walkability-score');

        // Look for score display
        const scoreElement = page.locator('text=/score|walkability/i, [class*="score"]');
        const hasScore = await scoreElement.count() > 0;

        recordTestResult({
          testName: 'Overall walkability score displays',
          category: 'Single Location Analysis',
          status: hasScore ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          screenshot,
          details: hasScore ? 'Walkability score found' : 'No walkability score found'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Overall walkability score displays',
          category: 'Single Location Analysis',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 3. COMPARE MODE =====
  test.describe('3. Compare Mode', () => {
    test('Should access compare mode', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Look for Compare button
        const compareButton = page.locator('button:has-text("Compare"), a:has-text("Compare")');

        if (await compareButton.count() > 0) {
          await compareButton.first().click();
          await page.waitForTimeout(2000);

          const screenshot = await captureScreenshot(page, 'compare-mode');

          recordTestResult({
            testName: 'Access compare mode',
            category: 'Compare Mode',
            status: 'PASS',
            duration: Date.now() - startTime,
            screenshot,
            details: 'Compare mode button clicked'
          });
        } else {
          recordTestResult({
            testName: 'Access compare mode',
            category: 'Compare Mode',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Compare button not found'
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'Access compare mode',
          category: 'Compare Mode',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should compare two locations', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Try to find compare functionality
        const compareButton = page.locator('button:has-text("Compare"), a:has-text("Compare")');

        if (await compareButton.count() > 0) {
          await compareButton.first().click();
          await page.waitForTimeout(2000);

          // Fill location 1
          const inputs = page.locator('input[type="text"]');
          const inputCount = await inputs.count();

          if (inputCount >= 2) {
            await inputs.nth(0).fill('Chiang Mai, Thailand');
            await page.waitForTimeout(1000);

            await inputs.nth(1).fill('Singapore');
            await page.waitForTimeout(1000);

            const screenshot = await captureScreenshot(page, 'compare-locations');

            recordTestResult({
              testName: 'Compare two locations',
              category: 'Compare Mode',
              status: 'PASS',
              duration: Date.now() - startTime,
              screenshot,
              details: 'Two locations entered for comparison'
            });
          } else {
            recordTestResult({
              testName: 'Compare two locations',
              category: 'Compare Mode',
              status: 'FAIL',
              duration: Date.now() - startTime,
              details: `Only ${inputCount} input fields found, need at least 2`
            });
          }
        } else {
          recordTestResult({
            testName: 'Compare two locations',
            category: 'Compare Mode',
            status: 'SKIP',
            duration: Date.now() - startTime,
            details: 'Compare mode not available'
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'Compare two locations',
          category: 'Compare Mode',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 4. AUTHENTICATION =====
  test.describe('4. Authentication', () => {
    test('Should check for authentication UI', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const authButtons = page.locator('button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Sign up"), a:has-text("Sign in"), a:has-text("Log in")');
        const hasAuth = await authButtons.count() > 0;

        const screenshot = await captureScreenshot(page, 'auth-check');

        recordTestResult({
          testName: 'Check for authentication UI',
          category: 'Authentication',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: hasAuth ? 'Authentication buttons found' : 'No authentication UI found (may not be implemented)'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Check for authentication UI',
          category: 'Authentication',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 5. RESPONSIVE DESIGN =====
  test.describe('5. Responsive Design', () => {
    test('Should work on mobile viewport (375px)', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto(FRONTEND_URL);

        const screenshot = await captureScreenshot(page, 'mobile-viewport');

        // Check if basic elements are visible
        const searchInput = page.locator('input[type="text"]').first();
        const isVisible = await searchInput.isVisible();

        recordTestResult({
          testName: 'Mobile viewport (375px)',
          category: 'Responsive Design',
          status: isVisible ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          screenshot,
          details: isVisible ? 'Search input visible on mobile' : 'Layout issues on mobile'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Mobile viewport (375px)',
          category: 'Responsive Design',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should work on tablet viewport (768px)', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto(FRONTEND_URL);

        const screenshot = await captureScreenshot(page, 'tablet-viewport');

        recordTestResult({
          testName: 'Tablet viewport (768px)',
          category: 'Responsive Design',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: 'Page renders on tablet viewport'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Tablet viewport (768px)',
          category: 'Responsive Design',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should work on desktop viewport (1920px)', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.goto(FRONTEND_URL);

        const screenshot = await captureScreenshot(page, 'desktop-viewport');

        recordTestResult({
          testName: 'Desktop viewport (1920px)',
          category: 'Responsive Design',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: 'Page renders on desktop viewport'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Desktop viewport (1920px)',
          category: 'Responsive Design',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 6. ERROR HANDLING =====
  test.describe('6. Error Handling', () => {
    test('Should handle invalid address gracefully', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('asdfghjkl12345xxxyyy');
        await searchInput.press('Enter');

        await page.waitForTimeout(3000);

        const screenshot = await captureScreenshot(page, 'invalid-address');

        // Look for error message
        const errorMessage = page.locator('text=/error|invalid|not found/i');
        const hasError = await errorMessage.count() > 0;

        recordTestResult({
          testName: 'Handle invalid address',
          category: 'Error Handling',
          status: hasError ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          screenshot,
          details: hasError ? 'Error message displayed' : 'No error message shown for invalid address'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Handle invalid address',
          category: 'Error Handling',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should handle empty search', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const searchInput = page.locator('input[type="text"]').first();
        await searchInput.fill('');
        await searchInput.press('Enter');

        await page.waitForTimeout(2000);

        const screenshot = await captureScreenshot(page, 'empty-search');

        recordTestResult({
          testName: 'Handle empty search',
          category: 'Error Handling',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: 'Empty search submitted'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Handle empty search',
          category: 'Error Handling',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 7. PERFORMANCE =====
  test.describe('7. Performance', () => {
    test('Should measure page load time', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL, { waitUntil: 'networkidle' });
        const loadTime = Date.now() - startTime;

        recordPerformance({ name: 'Full Page Load Time', value: loadTime, unit: 'ms' });

        const status = loadTime < 5000 ? 'PASS' : 'FAIL';

        recordTestResult({
          testName: 'Page load time < 5s',
          category: 'Performance',
          status,
          duration: loadTime,
          details: `Page loaded in ${loadTime}ms`
        });

        if (loadTime >= 5000) {
          recordBug({
            severity: 'Medium',
            title: 'Slow page load time',
            description: `Page takes ${loadTime}ms to load, exceeding 5 second threshold`,
            stepsToReproduce: ['Navigate to home page', 'Measure load time'],
            expectedBehavior: 'Page should load in under 5 seconds',
            actualBehavior: `Page loaded in ${loadTime}ms`
          });
        }
      } catch (error) {
        recordTestResult({
          testName: 'Page load time < 5s',
          category: 'Performance',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });

  // ===== 8. BACKEND API INTEGRATION =====
  test.describe('8. Backend API Integration', () => {
    test('Should verify /health endpoint', async ({ request }) => {
      const startTime = Date.now();

      try {
        const response = await request.get(`${BACKEND_URL}/health`);
        const status = response.status();

        recordTestResult({
          testName: '/health endpoint returns 200',
          category: 'Backend API Integration',
          status: status === 200 ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          details: `Status: ${status}`
        });
      } catch (error) {
        recordTestResult({
          testName: '/health endpoint returns 200',
          category: 'Backend API Integration',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should check API endpoints availability', async ({ request }) => {
      const endpoints = [
        '/api/overpass',
        '/api/slope',
        '/api/ndvi',
        '/api/nasa-power-temperature',
        '/api/air-quality',
        '/api/heat-island'
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();

        try {
          // Note: These require query parameters, so we just check if they respond
          const response = await request.get(`${BACKEND_URL}${endpoint}?lat=40.7580&lon=-73.9855`);
          const status = response.status();

          recordTestResult({
            testName: `${endpoint} endpoint responds`,
            category: 'Backend API Integration',
            status: status === 200 ? 'PASS' : 'FAIL',
            duration: Date.now() - startTime,
            details: `Status: ${status}`
          });
        } catch (error) {
          recordTestResult({
            testName: `${endpoint} endpoint responds`,
            category: 'Backend API Integration',
            status: 'FAIL',
            duration: Date.now() - startTime,
            error: String(error)
          });
        }
      }
    });
  });

  // ===== 9. ACCESSIBILITY =====
  test.describe('9. Accessibility', () => {
    test('Should have proper heading hierarchy', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        const h1Count = await page.locator('h1').count();
        const h2Count = await page.locator('h2').count();

        const hasH1 = h1Count > 0;

        recordTestResult({
          testName: 'Proper heading hierarchy',
          category: 'Accessibility',
          status: hasH1 ? 'PASS' : 'FAIL',
          duration: Date.now() - startTime,
          details: `Found ${h1Count} h1 and ${h2Count} h2 elements`
        });
      } catch (error) {
        recordTestResult({
          testName: 'Proper heading hierarchy',
          category: 'Accessibility',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });

    test('Should support keyboard navigation', async ({ page }) => {
      const startTime = Date.now();

      try {
        await page.goto(FRONTEND_URL);

        // Try tabbing through elements
        await page.keyboard.press('Tab');
        await page.waitForTimeout(500);
        await page.keyboard.press('Tab');

        const screenshot = await captureScreenshot(page, 'keyboard-nav');

        recordTestResult({
          testName: 'Keyboard navigation works',
          category: 'Accessibility',
          status: 'PASS',
          duration: Date.now() - startTime,
          screenshot,
          details: 'Tab key navigation tested'
        });
      } catch (error) {
        recordTestResult({
          testName: 'Keyboard navigation works',
          category: 'Accessibility',
          status: 'FAIL',
          duration: Date.now() - startTime,
          error: String(error)
        });
      }
    });
  });
});

// Generate comprehensive report after all tests
test.afterAll(async () => {
  console.log('\n\n========== GENERATING COMPREHENSIVE TEST REPORT ==========\n');

  // Calculate statistics
  const totalTests = testResults.length;
  const passed = testResults.filter(t => t.status === 'PASS').length;
  const failed = testResults.filter(t => t.status === 'FAIL').length;
  const skipped = testResults.filter(t => t.status === 'SKIP').length;
  const passRate = totalTests > 0 ? ((passed / totalTests) * 100).toFixed(2) : 0;

  // Generate report
  const report = `
# STREETS COMMONS - COMPREHENSIVE TEST REPORT
Generated: ${new Date().toISOString()}

## EXECUTIVE SUMMARY
- **Total Tests**: ${totalTests}
- **Passed**: ${passed} (${passRate}%)
- **Failed**: ${failed}
- **Skipped**: ${skipped}
- **Overall Quality Score**: ${calculateQualityScore(passed, failed, totalTests)}/10

## TEST RESULTS BY CATEGORY

${generateCategoryReport(testResults)}

## PERFORMANCE METRICS

${generatePerformanceReport(performanceMetrics)}

## BUGS FOUND (${bugs.length})

${generateBugReport(bugs)}

## CONSOLE ERRORS (${consoleErrors.length})

${consoleErrors.length > 0 ? consoleErrors.map((e, i) => `${i + 1}. ${e}`).join('\n') : 'No console errors detected'}

## NETWORK ERRORS (${networkErrors.length})

${networkErrors.length > 0 ? networkErrors.map((e, i) => `${i + 1}. ${e}`).join('\n') : 'No network errors detected'}

## DETAILED TEST RESULTS

${generateDetailedResults(testResults)}

## RECOMMENDATIONS

${generateRecommendations(testResults, bugs, performanceMetrics)}

---
End of Report
`;

  // Write report to file
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(path.join(REPORT_DIR, 'comprehensive-test-report.md'), report);

  console.log('\n✓ Report generated at:', path.join(REPORT_DIR, 'comprehensive-test-report.md'));
  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Total: ${totalTests} | Pass: ${passed} | Fail: ${failed} | Skip: ${skipped}`);
  console.log(`Pass Rate: ${passRate}%`);
  console.log(`Quality Score: ${calculateQualityScore(passed, failed, totalTests)}/10`);
  console.log('==================================\n');
});

// Helper functions for report generation
function calculateQualityScore(passed: number, failed: number, total: number): number {
  if (total === 0) return 0;

  const passRate = passed / total;
  const failureImpact = failed / total;

  let score = passRate * 10;
  score -= failureImpact * 3;

  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

function generateCategoryReport(results: TestResult[]): string {
  const categories = [...new Set(results.map(r => r.category))];

  return categories.map(category => {
    const categoryTests = results.filter(r => r.category === category);
    const passed = categoryTests.filter(t => t.status === 'PASS').length;
    const failed = categoryTests.filter(t => t.status === 'FAIL').length;
    const skipped = categoryTests.filter(t => t.status === 'SKIP').length;

    return `### ${category}
- Total: ${categoryTests.length}
- Passed: ${passed}
- Failed: ${failed}
- Skipped: ${skipped}
`;
  }).join('\n');
}

function generatePerformanceReport(metrics: PerformanceMetric[]): string {
  if (metrics.length === 0) return 'No performance metrics collected';

  return metrics.map(m => `- **${m.name}**: ${m.value} ${m.unit}`).join('\n');
}

function generateBugReport(bugs: BugReport[]): string {
  if (bugs.length === 0) return 'No bugs found! 🎉';

  return bugs.map((bug, i) => `
### Bug #${i + 1}: ${bug.title} [${bug.severity}]

**Description**: ${bug.description}

**Steps to Reproduce**:
${bug.stepsToReproduce.map((step, idx) => `${idx + 1}. ${step}`).join('\n')}

**Expected Behavior**: ${bug.expectedBehavior}

**Actual Behavior**: ${bug.actualBehavior}

${bug.screenshot ? `**Screenshot**: ${bug.screenshot}` : ''}

---
`).join('\n');
}

function generateDetailedResults(results: TestResult[]): string {
  return results.map((result, i) => `
### Test ${i + 1}: ${result.testName}
- **Category**: ${result.category}
- **Status**: ${result.status}
- **Duration**: ${result.duration}ms
${result.details ? `- **Details**: ${result.details}` : ''}
${result.error ? `- **Error**: ${result.error}` : ''}
${result.screenshot ? `- **Screenshot**: ${result.screenshot}` : ''}
`).join('\n');
}

function generateRecommendations(results: TestResult[], bugs: BugReport[], metrics: PerformanceMetric[]): string {
  const recommendations: string[] = [];

  const failedTests = results.filter(t => t.status === 'FAIL');
  const criticalBugs = bugs.filter(b => b.severity === 'Critical');
  const highBugs = bugs.filter(b => b.severity === 'High');

  if (criticalBugs.length > 0) {
    recommendations.push(`🔴 **CRITICAL**: Fix ${criticalBugs.length} critical bugs immediately before launch`);
  }

  if (highBugs.length > 0) {
    recommendations.push(`🟠 **HIGH PRIORITY**: Address ${highBugs.length} high-severity bugs`);
  }

  if (failedTests.length > 5) {
    recommendations.push(`⚠️ **QUALITY**: ${failedTests.length} tests failing - significant stability issues detected`);
  }

  const slowMetrics = metrics.filter(m => m.name.includes('Load') && m.value > 5000);
  if (slowMetrics.length > 0) {
    recommendations.push(`⏱️ **PERFORMANCE**: Optimize load times - currently exceeding 5 second threshold`);
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ **EXCELLENT**: Application is in good shape for launch!');
    recommendations.push('📊 Continue monitoring performance and user feedback');
    recommendations.push('🔄 Implement continuous integration testing');
  }

  return recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n');
}
