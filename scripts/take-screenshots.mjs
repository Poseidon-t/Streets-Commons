/**
 * Take screenshots of the live SafeStreets site for the "How It Works" section.
 * Usage: npx playwright install chromium && node scripts/take-screenshots.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'screenshots');

const SITE = 'https://safestreets.streetsandcommons.com';

async function clickSuggestion(page) {
  await page.waitForTimeout(2000);
  const btn = page.locator('div.absolute button').first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  📍 Clicking suggestion...');
    await btn.click();
    return true;
  }
  return false;
}

async function waitForMetrics(page, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes('Street Grid') && text.includes('Terrain') && text.includes('Tree Canopy')) {
      return true;
    }
    await page.waitForTimeout(2000);
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });

  // ── Run analysis first ──
  console.log('📸 Running analysis for Hayes Valley...');
  const page = await context.newPage();
  await page.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 10000 });
  const input = page.locator('input').first();
  await input.click();
  await input.fill('Hayes Valley, San Francisco');
  await clickSuggestion(page);

  console.log('  ⏳ Waiting for analysis...');
  const loaded = await waitForMetrics(page);
  if (loaded) console.log('  ✅ Analysis loaded!');
  await page.waitForTimeout(15000);

  // ── Screenshot 1: Search bar ──
  console.log('📸 Step 1: Search...');
  const page1 = await context.newPage();
  await page1.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
  await page1.waitForSelector('input', { timeout: 10000 });
  const input1 = page1.locator('input').first();
  await input1.click();
  await input1.fill('Hayes Valley, San Francisco');
  await page1.waitForTimeout(2500);
  await page1.screenshot({
    path: path.join(outDir, 'step-1-search.png'),
    clip: { x: 0, y: 0, width: 1280, height: 650 },
  });
  await page1.close();
  console.log('  ✅ step-1-search.png');

  // ── Screenshot 2: Score + map ──
  console.log('📸 Step 2: Score overview...');
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outDir, 'step-2-analysis.png'),
    clip: { x: 0, y: 0, width: 1280, height: 900 },
  });
  console.log('  ✅ step-2-analysis.png');

  // ── Screenshot 3: 6 metric cards ──
  console.log('📸 Step 3: Metric cards...');
  // Click Metrics tab
  const metricsTab = page.getByText('Metrics', { exact: true });
  if (await metricsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await metricsTab.click();
    await page.waitForTimeout(2000);
  }

  // Scroll to position the "What This Means For You" heading at the top of viewport
  const scrollPos = await page.evaluate(() => {
    const headings = [...document.querySelectorAll('h2, h3, h4')];
    const target = headings.find(h => h.textContent?.includes('What This Means'));
    if (target) {
      const rect = target.getBoundingClientRect();
      return window.scrollY + rect.top - 20;
    }
    return 800;
  });
  console.log(`  📍 Scrolling to ${scrollPos}px`);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollPos);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(outDir, 'step-3-metrics.png'),
    clip: { x: 0, y: 0, width: 1280, height: 650 },
  });
  console.log('  ✅ step-3-metrics.png');

  await browser.close();
  console.log('\n🎉 All screenshots saved to public/screenshots/');
}

main().catch(err => {
  console.error('Screenshot failed:', err);
  process.exit(1);
});
