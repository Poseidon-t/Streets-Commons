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

async function waitForAnalysis(page, timeout = 120000) {
  // Wait for metric cards to appear (Street Grid, Terrain, etc.)
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

async function clickSuggestion(page) {
  // The autocomplete suggestions are <button> elements inside a dropdown div
  await page.waitForTimeout(2000);
  const btn = page.locator('div.absolute button').first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log('  📍 Clicking suggestion button...');
    await btn.click();
    return true;
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });

  // ── Screenshot 1: Search bar with autocomplete ──
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
  console.log('  ✅ step-1-search.png');

  // ── Screenshot 2: Full analysis results ──
  console.log('📸 Step 2: Running analysis...');
  const page2 = await context.newPage();
  await page2.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
  await page2.waitForSelector('input', { timeout: 10000 });
  const input2 = page2.locator('input').first();
  await input2.click();
  await input2.fill('Hayes Valley, San Francisco');

  const clicked = await clickSuggestion(page2);
  if (!clicked) {
    console.log('  📍 Fallback: pressing Enter...');
    await input2.press('Enter');
  }

  console.log('  ⏳ Waiting for analysis to complete...');
  const loaded = await waitForAnalysis(page2);
  if (loaded) {
    console.log('  ✅ Analysis loaded!');
    // Extra time for all data to finish populating
    await page2.waitForTimeout(10000);
  } else {
    console.log('  ⚠️ Analysis may not have fully loaded');
  }

  // Scroll to show the results area nicely
  await page2.evaluate(() => {
    // Scroll down past the search bar to show the score + metrics
    window.scrollTo({ top: 300, behavior: 'instant' });
  });
  await page2.waitForTimeout(1000);

  await page2.screenshot({
    path: path.join(outDir, 'step-2-analysis.png'),
    clip: { x: 0, y: 0, width: 1280, height: 900 },
  });
  console.log('  ✅ step-2-analysis.png');

  // ── Screenshot 3: Compare mode with results ──
  console.log('📸 Step 3: Compare mode...');
  const page3 = await context.newPage();
  await page3.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });

  // Click "Compare Two Locations" button
  await page3.evaluate(() => window.scrollTo(0, 2000));
  await page3.waitForTimeout(500);
  const compareBtn = page3.getByText('Compare Two Locations').first();
  if (await compareBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await compareBtn.click();
    await page3.waitForTimeout(2000);
    await page3.evaluate(() => window.scrollTo(0, 0));
  }

  // Fill Location 1
  const inputs3 = page3.locator('input');
  const input3a = inputs3.nth(0);
  await input3a.click();
  await input3a.fill('Hayes Valley, San Francisco');
  const clicked1 = await clickSuggestion(page3);
  if (!clicked1) await input3a.press('Enter');

  console.log('  ⏳ Waiting for Location 1 analysis...');
  await waitForAnalysis(page3, 90000);
  await page3.waitForTimeout(5000);

  // Fill Location 2
  const input3b = inputs3.nth(1);
  await input3b.click();
  await input3b.fill('Williamsburg, Brooklyn');
  const clicked2 = await clickSuggestion(page3);
  if (!clicked2) await input3b.press('Enter');

  console.log('  ⏳ Waiting for Location 2 analysis...');
  // Wait for a second set of results
  await page3.waitForTimeout(40000);

  // Scroll to show compare results
  await page3.evaluate(() => window.scrollTo({ top: 150, behavior: 'instant' }));
  await page3.waitForTimeout(1000);

  await page3.screenshot({
    path: path.join(outDir, 'step-3-compare.png'),
    clip: { x: 0, y: 0, width: 1280, height: 900 },
  });
  console.log('  ✅ step-3-compare.png');

  await browser.close();
  console.log('\n🎉 All screenshots saved to public/screenshots/');
}

main().catch(err => {
  console.error('Screenshot failed:', err);
  process.exit(1);
});
