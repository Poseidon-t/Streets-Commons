/**
 * Generate og-image.png using Playwright
 * Run: node scripts/generate-og-image.js
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px;
    height: 630px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f8f6f1 0%, #eef5f0 50%, #f0ebe0 100%);
    font-family: system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }
  .container {
    text-align: center;
    padding: 60px;
  }
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin-bottom: 40px;
  }
  .logo-icon {
    width: 64px;
    height: 64px;
  }
  .logo-text {
    font-size: 48px;
    font-weight: 700;
    color: #e07850;
  }
  h1 {
    font-size: 52px;
    font-weight: 700;
    color: #2a3a2a;
    line-height: 1.2;
    margin-bottom: 24px;
    max-width: 900px;
  }
  p {
    font-size: 24px;
    color: #5a6a5a;
    max-width: 700px;
    margin: 0 auto 32px;
  }
  .badges {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .badge {
    background: rgba(224, 120, 80, 0.12);
    color: #e07850;
    padding: 8px 20px;
    border-radius: 100px;
    font-size: 16px;
    font-weight: 600;
  }
  .corner-tl, .corner-br {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    opacity: 0.06;
  }
  .corner-tl {
    top: -60px;
    left: -60px;
    background: #e07850;
  }
  .corner-br {
    bottom: -60px;
    right: -60px;
    background: #5a8a5a;
  }
</style>
</head>
<body>
  <div class="corner-tl"></div>
  <div class="corner-br"></div>
  <div class="container">
    <div class="logo">
      <svg class="logo-icon" viewBox="0 0 44 44">
        <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
        <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
        <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
        <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
      </svg>
      <span class="logo-text">SafeStreets</span>
    </div>
    <h1>Walkability Score for Any Address</h1>
    <p>Free satellite-powered analysis using NASA, Sentinel-2 & OpenStreetMap data</p>
    <div class="badges">
      <span class="badge">Sidewalks</span>
      <span class="badge">Tree Canopy</span>
      <span class="badge">Crash Data</span>
      <span class="badge">Air Quality</span>
      <span class="badge">15-Min City</span>
      <span class="badge">Slope</span>
    </div>
  </div>
</body>
</html>
`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  await page.screenshot({
    path: join(__dirname, '..', 'public', 'og-image.png'),
    type: 'png',
  });
  await browser.close();
  console.log('Generated public/og-image.png (1200x630)');
}

main().catch(console.error);
