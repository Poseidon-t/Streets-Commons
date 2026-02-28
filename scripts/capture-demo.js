import { chromium } from '@playwright/test';

const SITE_URL = 'https://safestreets.streetsandcommons.com';
// White House coordinates — navigate directly to results
const RESULTS_URL = `${SITE_URL}/?lat=38.8977&lon=-77.0365&name=${encodeURIComponent('White House, 1600 Pennsylvania Avenue NW, Washington, DC')}`;

async function captureDemo() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // 1. Landing page
  console.log('1. Capturing landing page...');
  await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'docs/demo-landing.png', fullPage: false });
  console.log('   Saved: docs/demo-landing.png');

  // 2. Navigate directly to analysis results
  console.log('2. Loading analysis results...');
  await page.goto(RESULTS_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for metrics to load (they come from multiple APIs)
  console.log('3. Waiting for metrics to load (20s)...');
  await page.waitForTimeout(20000);

  // Take the score overview screenshot
  await page.screenshot({ path: 'docs/demo-analysis.png', fullPage: false });
  console.log('   Saved: docs/demo-analysis.png');

  // Scroll down to metric cards
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/demo-metrics.png', fullPage: false });
  console.log('   Saved: docs/demo-metrics.png');

  // Scroll to map
  await page.evaluate(() => window.scrollBy(0, 600));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'docs/demo-map.png', fullPage: false });
  console.log('   Saved: docs/demo-map.png');

  // Full page
  await page.screenshot({ path: 'docs/demo-full.png', fullPage: true });
  console.log('   Saved: docs/demo-full.png');

  await browser.close();
  console.log('Done!');
}

captureDemo().catch(console.error);
