/**
 * Prerender script — generates static HTML for each route after vite build.
 * This ensures social crawlers (Facebook, Twitter, LinkedIn) and non-JS search engines
 * can see per-page meta tags, OG tags, and JSON-LD structured data.
 *
 * Run: node scripts/prerender.js
 * Requires: playwright (already in devDependencies)
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');

// All routes to prerender — matches sitemap.xml
const ROUTES = [
  '/',
  '/walkability',
  '/walkability/new-york',
  '/walkability/san-francisco',
  '/walkability/chicago',
  '/walkability/boston',
  '/walkability/philadelphia',
  '/walkability/washington-dc',
  '/walkability/seattle',
  '/walkability/portland',
  '/walkability/los-angeles',
  '/walkability/denver',
  '/walkability/minneapolis',
  '/walkability/miami',
  '/walkability/austin',
  '/walkability/atlanta',
  '/walkability/nashville',
  '/walkability/dallas',
  '/walkability/houston',
  '/walkability/phoenix',
  '/walkability/detroit',
  '/walkability/pittsburgh',
  '/blog',
  '/blog/pedestrian-safety-crisis-america',
  '/blog/walkable-neighborhoods-home-value-premium',
  '/blog/what-is-15-minute-city',
  '/blog/how-to-improve-walkability-your-neighborhood',
  '/blog/satellite-data-urban-planning',
  '/blog/how-barcelonas-superblocks-are-saving-lives-and-reclaiming',
  '/blog/indias-pedestrian-crisis-29000-deaths-and-what-must-change',
];

/**
 * Simple static file server for the dist directory
 */
function startServer(port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

      // SPA fallback — serve index.html for non-file routes
      if (!existsSync(filePath) || !filePath.includes('.')) {
        filePath = join(DIST_DIR, 'index.html');
      }

      try {
        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop();
        const types = {
          html: 'text/html',
          js: 'application/javascript',
          css: 'text/css',
          png: 'image/png',
          svg: 'image/svg+xml',
          json: 'application/json',
          woff2: 'font/woff2',
          woff: 'font/woff',
          ttf: 'font/ttf',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => resolve(server));
  });
}

async function prerender() {
  const port = 4173;
  console.log(`Starting static server on port ${port}...`);
  const server = await startServer(port);

  const browser = await chromium.launch();
  const context = await browser.newContext();

  let rendered = 0;
  const total = ROUTES.length;

  for (const route of ROUTES) {
    const page = await context.newPage();

    try {
      await page.goto(`http://localhost:${port}${route}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });

      // Wait a tick for React 19 meta tag hoisting to complete
      await page.waitForTimeout(500);

      // Get the full rendered HTML
      const html = await page.content();

      // Write to the correct path in dist/
      const outputDir = route === '/'
        ? DIST_DIR
        : join(DIST_DIR, ...route.split('/').filter(Boolean));

      mkdirSync(outputDir, { recursive: true });
      writeFileSync(join(outputDir, 'index.html'), html);

      rendered++;
      console.log(`  [${rendered}/${total}] ${route}`);
    } catch (err) {
      console.error(`  FAILED: ${route} — ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  server.close();

  console.log(`\nPrerendered ${rendered}/${total} routes.`);
}

prerender().catch((err) => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
