/**
 * SafeStreets API - Free Data Sources
 *
 * This backend provides access to:
 * - NASA POWER meteorological data (temperature)
 * - NASADEM elevation data via Microsoft Planetary Computer
 * - OpenStreetMap infrastructure via Overpass API
 * - NHTSA FARS fatal crash data (US)
 * - WHO road traffic death rates (international)
 * - Sentinel-2 NDVI + heat island data
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fromUrl } from 'geotiff';
import Stripe from 'stripe';
import helmet from 'helmet';

import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (project root)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// PDF parsing function using pdfjs-dist (proper ESM support)
async function parsePDF(buffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';

  // Extract text from each page
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return { text: fullText, numpages: pdfDoc.numPages };
}

// Configure multer for file uploads (in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Stripe (only if key is configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const app = express();
const PORT = process.env.PORT || 3002;

// In-memory cache for Overpass responses (30-minute TTL, max 1000 entries)
const overpassCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — OSM data rarely changes
const CACHE_MAX = 1000;

function getCacheKey(query) {
  // Simple hash: use first 200 chars + length as key
  return query.slice(0, 200) + ':' + query.length;
}

function getFromCache(key) {
  const entry = overpassCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    overpassCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  // Evict oldest if at capacity
  if (overpassCache.size >= CACHE_MAX) {
    const oldest = overpassCache.keys().next().value;
    overpassCache.delete(oldest);
  }
  overpassCache.set(key, { data, time: Date.now() });
}

// ─── Built-in Analytics ──────────────────────────────────────────────────────
import { createHash } from 'crypto';
import fs from 'fs';

const ANALYTICS_FILE = process.env.ANALYTICS_FILE || '/data/analytics.json';
const ANALYTICS_SECRET = process.env.ANALYTICS_SECRET || (process.env.STRIPE_SECRET_KEY?.slice(0, 16) || 'dev-secret-key');

function requireAdminKey(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== ANALYTICS_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// In-memory analytics store
const analyticsStore = {
  daily: {},  // { "2026-02-05": { pageViews: 0, ... } }
  allTime: { pageViews: 0, analyses: 0, firstSeen: null },
};

// Track which IPs we've seen today (hashed, for unique visitor count)
const todayVisitors = new Set();
let lastVisitorReset = new Date().toDateString();

// Load analytics from disk on startup
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf-8'));
      Object.assign(analyticsStore, data);
      console.log('📊 Analytics loaded from disk');
    }
  } catch (err) {
    console.warn('⚠️ Could not load analytics:', err.message);
  }
}

// Save analytics to disk
function saveAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analyticsStore, null, 2));
  } catch (err) {
    // Silently fail if no volume mounted — analytics still works in-memory
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Could not save analytics:', err.message);
    }
  }
}

// Get today's date key
function getToday() {
  return new Date().toISOString().split('T')[0];
}

// Ensure today's entry exists
function ensureTodayExists() {
  const today = getToday();
  if (!analyticsStore.daily[today]) {
    analyticsStore.daily[today] = {
      pageViews: 0,
      uniqueVisitors: 0,
      analyses: 0,
      chatMessages: 0,
      pdfUploads: 0,
      advocacyLetters: 0,
      payments: 0,
      topCountries: {},
      topReferrers: {},
      utmSources: {},
      utmMediums: {},
      utmCampaigns: {},
      shareClicks: 0,
      sharePlatforms: {},
      emailsCaptured: 0,
    };
  }
  // Reset visitor tracking at midnight
  const todayStr = new Date().toDateString();
  if (todayStr !== lastVisitorReset) {
    todayVisitors.clear();
    lastVisitorReset = todayStr;
  }
  if (!analyticsStore.allTime.firstSeen) {
    analyticsStore.allTime.firstSeen = today;
  }
  return analyticsStore.daily[today];
}

// Hash IP for privacy (never store raw IP)
function hashIP(ip) {
  return createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

// Extract country from Accept-Language header (rough approximation)
function guessCountry(req) {
  const lang = req.get('accept-language') || '';
  const match = lang.match(/[a-z]{2}-([A-Z]{2})/);
  return match ? match[1] : 'XX';
}

// Extract domain from referrer
function getReferrerDomain(referrer) {
  if (!referrer) return 'direct';
  try {
    return new URL(referrer).hostname.replace('www.', '');
  } catch {
    return 'direct';
  }
}

// Track an event
function trackEvent(eventType, req, extra = {}) {
  const today = ensureTodayExists();

  // Track UTM attribution if present (applies to any event type)
  if (extra.utm) {
    if (extra.utm.utm_source) {
      today.utmSources = today.utmSources || {};
      today.utmSources[extra.utm.utm_source] = (today.utmSources[extra.utm.utm_source] || 0) + 1;
    }
    if (extra.utm.utm_medium) {
      today.utmMediums = today.utmMediums || {};
      today.utmMediums[extra.utm.utm_medium] = (today.utmMediums[extra.utm.utm_medium] || 0) + 1;
    }
    if (extra.utm.utm_campaign) {
      today.utmCampaigns = today.utmCampaigns || {};
      today.utmCampaigns[extra.utm.utm_campaign] = (today.utmCampaigns[extra.utm.utm_campaign] || 0) + 1;
    }
  }

  switch (eventType) {
    case 'pageview': {
      today.pageViews++;
      analyticsStore.allTime.pageViews++;

      // Track unique visitors
      const ipHash = hashIP(req.ip || req.headers['x-forwarded-for']);
      if (!todayVisitors.has(ipHash)) {
        todayVisitors.add(ipHash);
        today.uniqueVisitors++;
        analyticsStore.allTime.uniqueVisitors = (analyticsStore.allTime.uniqueVisitors || 0) + 1;
      }

      // Track country
      const country = guessCountry(req);
      today.topCountries[country] = (today.topCountries[country] || 0) + 1;

      // Track referrer
      const referrer = getReferrerDomain(extra.referrer);
      today.topReferrers[referrer] = (today.topReferrers[referrer] || 0) + 1;
      break;
    }
    case 'analysis':
      today.analyses++;
      analyticsStore.allTime.analyses++;
      break;
    case 'analysis_complete':
      today.analyses++;
      analyticsStore.allTime.analyses++;
      break;
    case 'share_click':
      today.shareClicks = (today.shareClicks || 0) + 1;
      if (extra.platform) {
        today.sharePlatforms = today.sharePlatforms || {};
        today.sharePlatforms[extra.platform] = (today.sharePlatforms[extra.platform] || 0) + 1;
      }
      break;
    case 'email_captured':
      today.emailsCaptured = (today.emailsCaptured || 0) + 1;
      break;
    case 'chat':
      today.chatMessages++;
      break;
    case 'pdf':
      today.pdfUploads++;
      break;
    case 'advocacy':
      today.advocacyLetters++;
      break;
    case 'payment':
      today.payments++;
      break;
  }
}

// Flush to disk every 60 seconds
loadAnalytics();
setInterval(saveAnalytics, 60 * 1000);

// Also save on shutdown
process.on('SIGTERM', () => {
  console.log('📊 Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

// Middleware

// Security headers (Helmet.js)
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Plausible Analytics
  crossOriginEmbedderPolicy: false, // Allow external resources
}));

// CORS: Restrict to your domain only
app.use(cors({
  origin: process.env.FRONTEND_URL || [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
  ],
  credentials: true,
}));

// Rate limiting: 300 requests per minute per IP
// (one analysis = ~6 API calls; supports ~50 analyses/min per user)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' },
});
app.use('/api/', apiLimiter);

// Parse JSON for all routes EXCEPT Stripe webhook (needs raw body for signature verification)
// Limit body size to prevent DoS attacks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe-webhook') {
    return next();
  }
  express.json({ limit: '1mb' })(req, res, next);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      nasaPower: 'available',
      openaq: process.env.OPENAQ_API_KEY ? 'configured' : 'missing key',
      overpass: 'available',
      nasadem: 'available (placeholder)',
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── Analytics Endpoints ─────────────────────────────────────────────────────

// Frontend beacon — track events with UTM attribution
app.post('/api/track', (req, res) => {
  const { event, referrer, utm, platform } = req.body || {};
  switch (event) {
    case 'pageview':
      trackEvent('pageview', req, { referrer, utm });
      break;
    case 'analysis_complete':
      trackEvent('analysis_complete', req, { utm });
      break;
    case 'share_click':
      trackEvent('share_click', req, { platform, utm });
      break;
  }
  res.status(204).end();
});

// ─── Email Capture ──────────────────────────────────────────────────────────

const EMAILS_FILE = process.env.EMAILS_FILE || '/data/emails.json';

function loadEmails() {
  try {
    if (fs.existsSync(EMAILS_FILE)) {
      return JSON.parse(fs.readFileSync(EMAILS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load emails:', err.message);
  }
  return { emails: [], count: 0 };
}

function saveEmails(data) {
  try {
    const dir = path.dirname(EMAILS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EMAILS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Could not save emails:', err.message);
    }
  }
}

// ─── Contact Inquiries Storage ──────────────────────────────────────────────
const INQUIRIES_FILE = process.env.INQUIRIES_FILE || '/data/contact-inquiries.json';

function loadInquiries() {
  try {
    if (fs.existsSync(INQUIRIES_FILE)) {
      return JSON.parse(fs.readFileSync(INQUIRIES_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load inquiries:', err.message);
  }
  return { inquiries: [], count: 0 };
}

function saveInquiry(inquiry) {
  try {
    const data = loadInquiries();
    data.inquiries.push(inquiry);
    data.count = data.inquiries.length;
    const dir = path.dirname(INQUIRIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Could not save inquiry:', err.message);
  }
}

// ─── Editorial Calendar Storage ─────────────────────────────────────────────
const EDITORIAL_CALENDAR_FILE = process.env.EDITORIAL_CALENDAR_FILE || '/data/editorial-calendar.json';

function loadEditorialCalendar() {
  try {
    if (fs.existsSync(EDITORIAL_CALENDAR_FILE)) {
      return JSON.parse(fs.readFileSync(EDITORIAL_CALENDAR_FILE, 'utf-8'));
    }
    // Try local dev path (relative to server.js -> parent/data/)
    const localPath = path.join(__dirname, '..', 'data', 'editorial-calendar.json');
    if (fs.existsSync(localPath)) {
      return JSON.parse(fs.readFileSync(localPath, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load editorial calendar:', err.message);
  }
  return { posts: [], metadata: {}, tracking: {} };
}

function saveEditorialCalendar(calendar) {
  try {
    const dir = path.dirname(EDITORIAL_CALENDAR_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(EDITORIAL_CALENDAR_FILE, JSON.stringify(calendar, null, 2));
  } catch (err) {
    // Try local dev path (relative to server.js -> parent/data/)
    try {
      const localPath = path.join(__dirname, '..', 'data', 'editorial-calendar.json');
      fs.writeFileSync(localPath, JSON.stringify(calendar, null, 2));
    } catch (e) {
      console.warn('Could not save editorial calendar:', e.message);
    }
  }
}

// ─── Blog Post Storage ──────────────────────────────────────────────────────
const BLOG_POSTS_FILE = process.env.BLOG_POSTS_FILE || '/data/blog-posts.json';

function loadBlogPosts() {
  try {
    if (fs.existsSync(BLOG_POSTS_FILE)) {
      return JSON.parse(fs.readFileSync(BLOG_POSTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load blog posts:', err.message);
  }
  return [];
}

function saveBlogPosts(posts) {
  try {
    const dir = path.dirname(BLOG_POSTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(BLOG_POSTS_FILE, JSON.stringify(posts, null, 2));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Could not save blog posts:', err.message);
    }
  }
}

function calculateReadTime(htmlContent) {
  const text = htmlContent.replace(/<[^>]*>/g, '');
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const emailCaptureLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again later.' },
});

app.post('/api/capture-email', emailCaptureLimiter, (req, res) => {
  const { email, source, locationAnalyzed, lat, lon, score, utm } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const ipHash = hashIP(req.ip || req.headers['x-forwarded-for']);
  const country = guessCountry(req);

  const entry = {
    email: email.toLowerCase().trim(),
    source: source || 'unknown',
    locationAnalyzed: locationAnalyzed || null,
    coordinates: lat && lon ? { lat, lon } : null,
    score: score || null,
    utm: utm && Object.keys(utm).length > 0 ? utm : null,
    country,
    ipHash,
    capturedAt: new Date().toISOString(),
    locations: locationAnalyzed ? [locationAnalyzed] : [],
    analysisCount: 1,
  };

  const emailDB = loadEmails();
  const existing = emailDB.emails.find(e => e.email === entry.email);

  if (existing) {
    existing.lastSeen = entry.capturedAt;
    existing.analysisCount = (existing.analysisCount || 1) + 1;
    if (entry.locationAnalyzed) {
      existing.locations = existing.locations || [];
      if (!existing.locations.includes(entry.locationAnalyzed)) {
        existing.locations.push(entry.locationAnalyzed);
      }
    }
  } else {
    emailDB.emails.push(entry);
    emailDB.count = emailDB.emails.length;
  }

  saveEmails(emailDB);
  trackEvent('email_captured', req, { source });

  console.log(`📧 Email captured: ${entry.email} (${entry.source}) — ${entry.locationAnalyzed || 'no location'}`);

  const reportUrl = lat && lon
    ? `https://safestreets.streetsandcommons.com/?lat=${lat}&lon=${lon}&name=${encodeURIComponent(locationAnalyzed || '')}`
    : 'https://safestreets.streetsandcommons.com/';

  res.json({ success: true, reportUrl });
});

// ─── Public Blog API ────────────────────────────────────────────────────────

app.get('/api/blog/posts', (req, res) => {
  const posts = loadBlogPosts();
  const published = posts
    .filter(p => p.status === 'published')
    .map(({ content, ...meta }) => meta)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  res.json(published);
});

app.get('/api/blog/posts/:slug', (req, res) => {
  const posts = loadBlogPosts();
  const post = posts.find(p => p.slug === req.params.slug && p.status === 'published');
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

// ─── Admin API ──────────────────────────────────────────────────────────────

app.get('/api/admin/stats', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  ensureTodayExists();
  res.json(analyticsStore);
});

app.get('/api/admin/emails', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const emailData = loadEmails();
    res.json(emailData);
  } catch {
    res.json({ emails: [], count: 0 });
  }
});

app.get('/api/admin/inquiries', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  try {
    const data = loadInquiries();
    res.json(data);
  } catch {
    res.json({ inquiries: [], count: 0 });
  }
});

app.get('/api/admin/blog/posts', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const posts = loadBlogPosts();
  const list = posts
    .map(({ content, ...meta }) => meta)
    .sort((a, b) => new Date(b.updatedAt || b.date).getTime() - new Date(a.updatedAt || a.date).getTime());
  res.json(list);
});

app.get('/api/admin/blog/posts/:slug', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const posts = loadBlogPosts();
  const post = posts.find(p => p.slug === req.params.slug);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.post('/api/admin/blog/posts', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const posts = loadBlogPosts();
  const { title, content, category, tags, metaTitle, metaDescription, excerpt, author, date, status } = req.body || {};

  if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

  const slug = req.body.slug || generateSlug(title);
  if (posts.find(p => p.slug === slug)) {
    return res.status(409).json({ error: 'A post with this slug already exists' });
  }

  const now = new Date().toISOString();
  const post = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    slug,
    title,
    metaTitle: metaTitle || title,
    metaDescription: metaDescription || excerpt || '',
    date: date || now.split('T')[0],
    author: author || 'Streets & Commons',
    category: category || 'General',
    readTime: calculateReadTime(content),
    excerpt: excerpt || '',
    content,
    tags: Array.isArray(tags) ? tags : [],
    status: status || 'draft',
    createdAt: now,
    updatedAt: now,
  };

  posts.push(post);
  saveBlogPosts(posts);
  console.log(`📝 Blog post created: "${post.title}" [${post.status}]`);
  res.status(201).json(post);
});

app.put('/api/admin/blog/posts/:slug', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const posts = loadBlogPosts();
  const index = posts.findIndex(p => p.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: 'Post not found' });

  const existing = posts[index];
  const updates = req.body || {};

  if (updates.slug && updates.slug !== existing.slug) {
    if (posts.find(p => p.slug === updates.slug)) {
      return res.status(409).json({ error: 'A post with this slug already exists' });
    }
  }

  const updated = {
    ...existing,
    ...updates,
    id: existing.id,
    createdAt: existing.createdAt,
    readTime: updates.content ? calculateReadTime(updates.content) : existing.readTime,
    updatedAt: new Date().toISOString(),
  };

  posts[index] = updated;
  saveBlogPosts(posts);
  console.log(`📝 Blog post updated: "${updated.title}" [${updated.status}]`);
  res.json(updated);
});

app.delete('/api/admin/blog/posts/:slug', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const posts = loadBlogPosts();
  const index = posts.findIndex(p => p.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: 'Post not found' });

  const removed = posts.splice(index, 1)[0];
  saveBlogPosts(posts);
  console.log(`🗑️ Blog post deleted: "${removed.title}"`);
  res.status(204).end();
});

// ═══════════════════════════════════════════════
// AI Blog Post Generation (uses Anthropic Claude)
// ═══════════════════════════════════════════════

// Curated Unsplash image bank — sourced from top urbanism photographers
// Featured: Marek Lumi (@mareklumi), Joshua Colah (@zoshuacolah), Alain R (@alainr), and others
const BLOG_IMAGE_BANK = {
  pedestrian: [
    { url: 'https://images.unsplash.com/photo-1533826418470-0cef7eb8bdaa?w=1200&q=80&fit=crop', alt: 'Pedestrians crossing a busy urban crosswalk', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1465815367149-ca149851a3a9?w=1200&q=80&fit=crop', alt: 'People waiting at a pedestrian crossing', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1571754947519-10e7388da6ff?w=1200&q=80&fit=crop', alt: 'Crowds crossing at a busy city intersection', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1717339701000-990a1682f200?w=1200&q=80&fit=crop', alt: 'City street with painted crosswalk markings', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1495549014838-6a652bd8e06b?w=1200&q=80&fit=crop', alt: 'Pedestrian navigating a city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1736083821029-665b513718f9?w=1200&q=80&fit=crop', alt: 'Group of people walking across a crosswalk', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1758754113538-db868274199f?w=1200&q=80&fit=crop', alt: 'Person walking across a striped crosswalk', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1763027850730-775742560f41?w=1200&q=80&fit=crop', alt: 'Cars at a busy city intersection with crosswalk', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1762439183800-049f31d25891?w=1200&q=80&fit=crop', alt: 'Pedestrians crossing a street at night', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1587613552674-134b268886b3?w=1200&q=80&fit=crop', alt: 'Pedestrians crossing at a busy Osaka intersection', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1626363743036-4a7da1ba7b62?w=1200&q=80&fit=crop', alt: 'Person walking on crosswalk at night', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1642761502976-3c4c1fc344d1?w=1200&q=80&fit=crop', alt: 'Pedestrians crossing a zebra crossing', credit: 'Unsplash' },
  ],
  cycling: [
    { url: 'https://images.unsplash.com/photo-1485381771061-e2cbd5317d9c?w=1200&q=80&fit=crop', alt: 'Protected bicycle lane in a city', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1700730025710-58ff304c1c8b?w=1200&q=80&fit=crop', alt: 'Cyclist riding on a city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1567158753851-2407cc0f6e2f?w=1200&q=80&fit=crop', alt: 'People biking on a dedicated cycling path', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1693993942340-45013057cfb3?w=1200&q=80&fit=crop', alt: 'Cyclist riding past tall buildings on a city street', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1694005997743-e6e9f2a14159?w=1200&q=80&fit=crop', alt: 'Row of bikes parked along a city road', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1694000406432-0122a1fe454c?w=1200&q=80&fit=crop', alt: 'Bicycle parked on a European city sidewalk', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1606636667096-3db2169f3207?w=1200&q=80&fit=crop', alt: 'Bike lane marked on a city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1764532435628-391ae9adc2af?w=1200&q=80&fit=crop', alt: 'Two cyclists riding on a sunny road under an overpass', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1765273558959-3c150903f313?w=1200&q=80&fit=crop', alt: 'Bicycle street in Berne with cycling infrastructure', credit: 'Alain R / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1763463119338-44d4fa52cd39?w=1200&q=80&fit=crop', alt: 'Red bike lane with white markings at intersection', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1764756843213-645c6b98a278?w=1200&q=80&fit=crop', alt: 'Copenhagen cycling and pedestrian bridge infrastructure', credit: 'Alain R / Unsplash' },
  ],
  walkable: [
    { url: 'https://images.unsplash.com/photo-1763462893307-c01adea64082?w=1200&q=80&fit=crop', alt: 'People walking down a modern city street with planters', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1764756982229-cd1c9c863578?w=1200&q=80&fit=crop', alt: 'Copenhagen waterfront with pedestrian zone and cycling path', credit: 'Alain R / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1634985492349-8589a9255cbe?w=1200&q=80&fit=crop', alt: 'People walking on a wide European pedestrian street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1653303927150-8878c51a7d5a?w=1200&q=80&fit=crop', alt: 'Busy downtown Porto street near S\u00e3o Bento station', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1730346057283-886fc2c458fc?w=1200&q=80&fit=crop', alt: 'Bustling pedestrian streets of Milan', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1690266606474-22f02dbdb4ac?w=1200&q=80&fit=crop', alt: 'People walking through a vibrant European city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1693997296239-e6b152d70e29?w=1200&q=80&fit=crop', alt: 'Cobblestone street in a charming European city', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1769328728541-dcabb8925bed?w=1200&q=80&fit=crop', alt: 'Tree-lined walkable city boulevard with pedestrians', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1764756720033-20b931a95ca5?w=1200&q=80&fit=crop', alt: 'Copenhagen Vesterbro neighborhood with cyclists and pedestrians', credit: 'Alain R / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1693992689275-08a368ac15d7?w=1200&q=80&fit=crop', alt: 'Street with traffic calming planters and pedestrian space', credit: 'Marek Lumi / Unsplash' },
  ],
  transit: [
    { url: 'https://images.unsplash.com/photo-1744193091837-b9edd24c28dc?w=1200&q=80&fit=crop', alt: 'Urban street with buildings and a public bus', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1694010767280-0280bf4157e9?w=1200&q=80&fit=crop', alt: 'Red and white commuter train passing a station', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1694020369178-0d18379fb8f4?w=1200&q=80&fit=crop', alt: 'Train station platform with arriving train', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1706984946688-0a2177276110?w=1200&q=80&fit=crop', alt: 'Modern train traveling past city buildings', credit: 'Marek Lumi / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1768224768118-939dbdd814da?w=1200&q=80&fit=crop', alt: 'Modern subway entrance on a city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1761907319591-fde7593ce377?w=1200&q=80&fit=crop', alt: 'Modern tram waiting at a station platform', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1765739100076-44310ed3b42d?w=1200&q=80&fit=crop', alt: 'City metro bus at a transit stop', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1601388354919-cd320b26f39b?w=1200&q=80&fit=crop', alt: 'European tram on city street at night', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1674715181278-5154a26cb431?w=1200&q=80&fit=crop', alt: 'Public transit bus on a city street at night', credit: 'Unsplash' },
  ],
  india: [
    { url: 'https://images.unsplash.com/photo-1640558817252-f6139cbd2853?w=1200&q=80&fit=crop', alt: 'Busy city street with traffic at night in India', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1679022586098-766dbfecf22c?w=1200&q=80&fit=crop', alt: 'Busy Indian city street filled with traffic', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1754808881154-a4708f947004?w=1200&q=80&fit=crop', alt: 'Street scene with people and vehicles in India', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1522726832281-362409683a2d?w=1200&q=80&fit=crop', alt: 'Aerial view of an Indian city', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1753805122914-6366c65a4877?w=1200&q=80&fit=crop', alt: 'Vehicles driving on a busy Indian city road', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1760782064110-365c9ac24234?w=1200&q=80&fit=crop', alt: 'Aerial view of Chandni Chowk market with rickshaws', credit: 'Joshua Colah / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1760782065310-ff09c7507bc1?w=1200&q=80&fit=crop', alt: 'Hand-pulled rickshaws on Delhi market streets', credit: 'Joshua Colah / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1760791963163-283dc5b3713e?w=1200&q=80&fit=crop', alt: 'Cycle rickshaws waiting on a Delhi street', credit: 'Joshua Colah / Unsplash' },
    { url: 'https://images.unsplash.com/photo-1760782066069-5b4c33e0573c?w=1200&q=80&fit=crop', alt: 'Bustling Chandni Chowk street with pedestrians', credit: 'Joshua Colah / Unsplash' },
  ],
  urban: [
    { url: 'https://images.unsplash.com/photo-1504494645474-cc4e25299579?w=1200&q=80&fit=crop', alt: 'Aerial view of a green urban neighborhood', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1721081411182-fb841e477468?w=1200&q=80&fit=crop', alt: 'City skyline viewed from a park', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1630381962702-4fbde321a0fb?w=1200&q=80&fit=crop', alt: 'People walking in an urban park with water views', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1731451163974-639ea494d81d?w=1200&q=80&fit=crop', alt: 'Aerial view of a city park surrounded by buildings', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1625235521692-e2d9bfba6234?w=1200&q=80&fit=crop', alt: 'People enjoying a walkable city park', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1764391811842-7fe53915ee1b?w=1200&q=80&fit=crop', alt: 'People relaxing by a fountain in a city square', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1763770447226-6eb1b30c2991?w=1200&q=80&fit=crop', alt: 'People sitting on a bench in a modern city park', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1590253230659-0863d300f57d?w=1200&q=80&fit=crop', alt: 'People walking in a park near high-rise buildings', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1767727816373-cd0e66cb3bf8?w=1200&q=80&fit=crop', alt: 'Park with people enjoying cityscape views', credit: 'Unsplash' },
  ],
  traffic: [
    { url: 'https://images.unsplash.com/photo-1738200984864-cfe24df27e36?w=1200&q=80&fit=crop', alt: 'City street at night with traffic lights', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1669820509947-ecaf3cf52a59?w=1200&q=80&fit=crop', alt: 'Cars waiting in traffic on a city street', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1472070153210-15e27d938957?w=1200&q=80&fit=crop', alt: 'Red traffic light signaling stop', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1622032432572-7943ed0340a6?w=1200&q=80&fit=crop', alt: 'Street light and road infrastructure', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1760278357611-0c06ab1ded5b?w=1200&q=80&fit=crop', alt: 'Suburban street illuminated at night', credit: 'Unsplash' },
    { url: 'https://images.unsplash.com/photo-1708183559528-432746aa781c?w=1200&q=80&fit=crop', alt: 'European city street with traffic and buildings', credit: 'Unsplash' },
  ],
};

// Select relevant images from static bank (used for education posts and as fallback)
function selectStaticImages(category, keywords, region, count = 3) {
  const keywordStr = (keywords || []).join(' ').toLowerCase();
  const cat = (category || '').toLowerCase();
  const reg = (region || '').toLowerCase();

  const pools = [];

  if (reg === 'india' || keywordStr.includes('india') || keywordStr.includes('mumbai') || keywordStr.includes('delhi')) {
    pools.push(...BLOG_IMAGE_BANK.india);
  }
  if (reg === 'europe' || reg === 'oceania') {
    pools.push(...BLOG_IMAGE_BANK.walkable, ...BLOG_IMAGE_BANK.cycling, ...BLOG_IMAGE_BANK.transit);
  }
  if (reg === 'asia') {
    pools.push(...BLOG_IMAGE_BANK.urban, ...BLOG_IMAGE_BANK.pedestrian, ...BLOG_IMAGE_BANK.transit);
  }
  if (reg === 'africa' || reg === 'south_america') {
    pools.push(...BLOG_IMAGE_BANK.pedestrian, ...BLOG_IMAGE_BANK.walkable, ...BLOG_IMAGE_BANK.traffic);
  }
  if (reg === 'north_america') {
    pools.push(...BLOG_IMAGE_BANK.traffic, ...BLOG_IMAGE_BANK.urban, ...BLOG_IMAGE_BANK.transit);
  }
  if (keywordStr.includes('cycl') || keywordStr.includes('bike') || keywordStr.includes('bicycle')) {
    pools.push(...BLOG_IMAGE_BANK.cycling);
  }
  if (keywordStr.includes('pedestrian') || keywordStr.includes('crosswalk') || keywordStr.includes('walking') || cat === 'safety') {
    pools.push(...BLOG_IMAGE_BANK.pedestrian);
  }
  if (keywordStr.includes('urban') || keywordStr.includes('city') || keywordStr.includes('park') || keywordStr.includes('walkab') || cat === 'urban design') {
    pools.push(...BLOG_IMAGE_BANK.urban, ...BLOG_IMAGE_BANK.walkable);
  }
  if (keywordStr.includes('traffic') || keywordStr.includes('speed') || keywordStr.includes('road') || keywordStr.includes('crash') || keywordStr.includes('accident')) {
    pools.push(...BLOG_IMAGE_BANK.traffic);
  }
  if (keywordStr.includes('transit') || keywordStr.includes('bus') || keywordStr.includes('train') || keywordStr.includes('tram') || keywordStr.includes('metro') || keywordStr.includes('subway')) {
    pools.push(...BLOG_IMAGE_BANK.transit);
  }
  if (pools.length === 0) {
    pools.push(...BLOG_IMAGE_BANK.pedestrian, ...BLOG_IMAGE_BANK.urban, ...BLOG_IMAGE_BANK.walkable, ...BLOG_IMAGE_BANK.traffic);
  }

  const shuffled = pools.sort(() => Math.random() - 0.5);
  const unique = [];
  const seen = new Set();
  for (const img of shuffled) {
    if (!seen.has(img.url) && unique.length < count) {
      seen.add(img.url);
      unique.push(img);
    }
  }
  return unique;
}

// ── Unsplash Search API — location-specific images for blog posts ──
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';

// Extract location/city names from title and keywords for targeted image search
function buildImageSearchQueries(title, keywords, count = 3) {
  const queries = [];
  const titleLower = (title || '').toLowerCase();
  const kws = (keywords || []).map(k => k.toLowerCase());

  // Known city/location names to detect in title and keywords
  const CITY_PATTERNS = [
    'seoul', 'cheonggyecheon', 'barcelona', 'paris', 'amsterdam', 'copenhagen',
    'tokyo', 'oslo', 'helsinki', 'vienna', 'london', 'berlin', 'zurich',
    'bogotá', 'bogota', 'curitiba', 'medellín', 'medellin', 'singapore',
    'taipei', 'jakarta', 'manila', 'mumbai', 'delhi', 'bangalore', 'chennai',
    'jaipur', 'pune', 'hyderabad', 'kolkata', 'nairobi', 'addis ababa',
    'melbourne', 'new york', 'nyc', 'san francisco', 'seattle', 'portland',
    'chicago', 'austin', 'detroit', 'minneapolis', 'hoboken', 'cambridge',
    'florida', 'netherlands', 'sweden', 'superblocks', 'strøget',
  ];

  // Find city/location mentioned in title
  const foundCities = CITY_PATTERNS.filter(city =>
    titleLower.includes(city) || kws.some(k => k.includes(city))
  );

  if (foundCities.length > 0) {
    const mainCity = foundCities[0];
    // Primary: city + street/urban context
    queries.push(`${mainCity} street pedestrian urban`);
    // Secondary: city + specific landmark or topic from title
    const topicWords = titleLower
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['that', 'this', 'what', 'when', 'from', 'with', 'have', 'been', 'were', 'most', 'into', 'city', 'america'].includes(w))
      .slice(0, 3);
    if (topicWords.length > 0) {
      queries.push(`${mainCity} ${topicWords.join(' ')}`);
    }
    // Tertiary: city skyline / aerial for variety
    queries.push(`${mainCity} city aerial`);
  } else {
    // No specific city found — use topic-based queries
    const topicTerms = kws.slice(0, 3).join(' ');
    queries.push(`${topicTerms} street city`);
    queries.push(`pedestrian safety urban ${topicTerms}`);
    queries.push(`walkable city street ${topicTerms}`);
  }

  return queries.slice(0, count);
}

// Search Unsplash API for images matching a query
async function searchUnsplash(query, perPage = 3) {
  if (!UNSPLASH_ACCESS_KEY) return [];

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape&content_filter=high`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
    if (!res.ok) {
      console.warn(`⚠️ Unsplash API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results || []).map(photo => ({
      url: `${photo.urls.regular}&w=1200&q=80&fit=crop`,
      alt: photo.alt_description || photo.description || query,
      credit: `${photo.user.name} / Unsplash`,
      unsplashLink: photo.links.html, // for attribution
    }));
  } catch (err) {
    console.warn('⚠️ Unsplash search failed:', err.message);
    return [];
  }
}

// Fetch location-specific images via Unsplash Search API
async function fetchLocationImages(title, keywords, count = 6) {
  const queries = buildImageSearchQueries(title, keywords, 3);
  const perQuery = Math.ceil(count / queries.length);

  console.log(`📸 Searching Unsplash for: ${queries.join(' | ')}`);

  const results = await Promise.all(
    queries.map(q => searchUnsplash(q, perQuery))
  );

  // Flatten, deduplicate, limit
  const seen = new Set();
  const images = [];
  for (const batch of results) {
    for (const img of batch) {
      if (!seen.has(img.url) && images.length < count) {
        seen.add(img.url);
        images.push(img);
      }
    }
  }
  return images;
}

// Select images: dynamic Unsplash search for blog posts, static bank for education
async function selectBlogImages(title, category, keywords, region, postType, count = 6) {
  const isEducation = (postType || '').toLowerCase() === 'education';

  // Education posts use static image bank (generic is fine)
  if (isEducation) {
    console.log('📸 Education post — using static image bank');
    return selectStaticImages(category, keywords, region, count);
  }

  // Try dynamic Unsplash search for location-specific images
  if (UNSPLASH_ACCESS_KEY) {
    const dynamicImages = await fetchLocationImages(title, keywords, count);
    if (dynamicImages.length >= 3) {
      console.log(`📸 Found ${dynamicImages.length} location-specific images from Unsplash`);
      return dynamicImages;
    }
    console.log(`📸 Only ${dynamicImages.length} Unsplash results, supplementing with static bank`);
    // Supplement with static images
    const staticFill = selectStaticImages(category, keywords, region, count - dynamicImages.length);
    return [...dynamicImages, ...staticFill].slice(0, count);
  }

  // No API key — fall back to static bank
  console.log('📸 No Unsplash API key — using static image bank');
  return selectStaticImages(category, keywords, region, count);
}

// Inject images into generated HTML content — targets 6 images distributed across sections
async function injectBlogImages(html, title, category, keywords, region, postType) {
  const images = await selectBlogImages(title, category, keywords, region, postType, 6);
  if (images.length === 0) return html;

  // Find all <h2> positions
  const h2Regex = /<h2[^>]*>/gi;
  const h2Positions = [];
  let match;
  while ((match = h2Regex.exec(html)) !== null) {
    h2Positions.push(match.index);
  }

  if (h2Positions.length < 2) {
    // Not enough sections — inject one image at the start
    const figureHtml = `<figure class="blog-image"><img src="${images[0].url}" alt="${images[0].alt}" loading="lazy" /><figcaption>${images[0].alt} — Photo: ${images[0].credit}</figcaption></figure>`;
    return figureHtml + html;
  }

  let result = '';
  let lastIdx = 0;
  let imgIdx = 0;

  // Place images after sections 1, 2, 3, 4, 5, 6 (every section gets one if enough images)
  // For 7-part structure: image after Hook, each Core Argument sub, Case Study, Possibility
  const maxInserts = Math.min(images.length, h2Positions.length - 1);
  // Distribute evenly: pick section indices
  const insertAfter = [];
  if (h2Positions.length <= maxInserts + 1) {
    // Image after every section except the last
    for (let i = 0; i < h2Positions.length - 1 && insertAfter.length < maxInserts; i++) {
      insertAfter.push(i);
    }
  } else {
    // Spread images evenly across sections
    const step = h2Positions.length / (maxInserts + 1);
    for (let i = 0; i < maxInserts; i++) {
      insertAfter.push(Math.floor(i * step));
    }
  }

  for (let i = 0; i < h2Positions.length && imgIdx < images.length; i++) {
    if (insertAfter.includes(i) && i + 1 < h2Positions.length) {
      const sectionEnd = h2Positions[i + 1];
      const sectionHtml = html.substring(h2Positions[i], sectionEnd);
      const lastP = sectionHtml.lastIndexOf('</p>');
      if (lastP !== -1) {
        const insertPos = h2Positions[i] + lastP + 4;
        result += html.substring(lastIdx, insertPos);
        const img = images[imgIdx++];
        result += `\n<figure class="blog-image"><img src="${img.url}" alt="${img.alt}" loading="lazy" /><figcaption>${img.alt} — Photo: ${img.credit}</figcaption></figure>\n`;
        lastIdx = insertPos;
      }
    }
  }
  result += html.substring(lastIdx);
  return result;
}

const BLOG_CONTENT_SYSTEM_PROMPT = `You are the content engine for SafeStreets — a walkability analysis platform. You write highly visual, scannable, story-driven blog posts about pedestrian safety, walkability, urban planning, and street advocacy.

VOICE & STYLE:
- Direct, clear, evidence-based but human. Observational — show don't preach.
- Principled but not dogmatic. NOT academic, NOT moralistic, NOT product-pushy.
- Active voice 80%+. Paragraphs: 2-3 sentences MAX. Subheadings every 200-300 words.
- Use "pedestrian deaths" not "accidents". Use "traffic violence" not "accidents". Use "street design" not just "infrastructure".
- Never use "jaywalking" (victim-blaming) or "pedestrian error" (system design is the issue).
- Use bold (<strong>) for key phrases and concepts. Use line breaks generously.

CONTENT REQUIREMENTS:
- Every statistic MUST have a credible source cited inline (e.g. "according to NHTSA FARS data" or "WHO reports that...")
- Include at least 5 specific statistics with sources
- Include comparison data (across countries, cities, or time periods)
- Present evidence-based solutions with real-world success stories
- End with concrete, actionable perspective (not preachy)
- Include 2-3 compelling pull quotes as <blockquote> elements
- Use data tables with <table> where comparing interventions or cities
- A visual break (stat-highlight, blockquote, info-box, comparison-box, or image placeholder) should appear every 150-200 words

DATA SOURCES TO REFERENCE:
- NHTSA FARS (US crash data), FHWA (Federal Highway Administration)
- WHO Global Status Report on Road Safety
- MoRTH India (Ministry of Road Transport & Highways)
- NACTO (National Association of City Transportation Officials)
- Smart Growth America "Dangerous by Design"
- Vision Zero Network
- Brookings Institution (walkability & property values)
- CDC pedestrian injury data

TITLE FORMULA:
Use this pattern: "[Reframe], Not [Conventional Wisdom]: [Specific Claim]"
Examples:
- "Infrastructure Failure, Not Careless Walking: Why Pedestrians Die on US Streets"
- "System Design, Not Personal Choice: How Cities Create Traffic Violence"
Or use a strong declarative title under 70 characters.

OUTPUT FORMAT:
Return ONLY a JSON object (no markdown, no code fences) with these fields:
{
  "title": "Post title (under 70 characters, use reframe formula when possible)",
  "metaTitle": "SEO meta title (50-60 characters) — Primary Keyword | SafeStreets Blog",
  "metaDescription": "SEO meta description (150-160 characters, include primary keyword and CTA)",
  "excerpt": "2-3 sentence summary for the blog index (50-75 words)",
  "category": "One of: Safety, Real Estate, Guide, Advocacy, Technology, Urban Design, Street Design, Walkability, Global Standards, Infrastructure Impact, Urban Case Studies",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "content": "<h2>...</h2><p>...</p>... (full HTML content, length matches the target word count specified)"
}

HTML STRUCTURE FOR content:
- Use <h2> for the 7 main sections, <h3> for subsections within them
- Use <p> for paragraphs (2-3 sentences each, never more), <strong> for key terms
- Use <blockquote> for pull quotes (2-3 per post)
- Use <ul>/<ol> for lists
- Use <table><thead><tr><th>...</th></tr></thead><tbody>... for data tables
- Use <a href="URL"> for external source links
- Do NOT include <h1> (the title is rendered separately)
- Do NOT include <img> tags (images are injected automatically after generation — aim for 6-8 image positions)

VISUAL ELEMENTS (use generously — visual break every 150-200 words):

CALLOUT ELEMENTS:
- <div class="stat-highlight"><span class="stat-number">NUMBER</span><span class="stat-label">DESCRIPTION</span><span class="stat-source">Source: SOURCE</span></div> — big standout statistics (3-4 per post)
- <div class="key-takeaway"><strong>Key Takeaway:</strong> TEXT</div> — important callout boxes (2-3 per post)
- <div class="info-box"><strong>INFO_TITLE</strong><p>TEXT</p></div> — tips, context boxes, expert quotes
- <div class="comparison-box"><div class="compare-item bad"><strong>Before</strong><p>TEXT</p></div><div class="compare-item good"><strong>After</strong><p>TEXT</p></div></div> — before/after comparisons (1+ per post)

DATA CHARTS & INFOGRAPHICS (use 2-3 per post to visualize data):
- HORIZONTAL BAR CHART:
  <div class="data-bar-chart"><div class="chart-title">CHART TITLE</div><div class="data-bar-item"><div class="bar-label"><span>LABEL</span><span class="bar-value">VALUE</span></div><div class="bar-track"><div class="bar-fill" style="width: PERCENT%"></div></div></div><!-- more data-bar-items --><div class="chart-source">Source: SOURCE</div></div>
  Use class="bar-fill green" for positive metrics, class="bar-fill blue" for neutral comparisons.

- METRIC CARDS ROW:
  <div class="metric-row"><div class="metric-card"><span class="metric-value danger">VALUE</span><span class="metric-label">LABEL</span></div><div class="metric-card"><span class="metric-value success">VALUE</span><span class="metric-label">LABEL</span></div><div class="metric-card"><span class="metric-value accent">VALUE</span><span class="metric-label">LABEL</span></div></div>
  Use class="danger" for alarming stats, "success" for positive, "accent" for neutral emphasis.

- TIMELINE:
  <div class="timeline-visual"><div class="timeline-item"><span class="timeline-year">YEAR</span><div class="timeline-text">EVENT DESCRIPTION</div></div><!-- more items --></div>
  Great for showing policy history, city transformation timelines, or before/after progressions.

- DONUT STAT:
  <div class="donut-stat"><div class="donut-ring" style="background: conic-gradient(#e07850 0% PERCENT%, #e0dbd0 PERCENT% 100%)">PERCENT%</div><div class="donut-text"><strong>LABEL</strong> — DESCRIPTION</div></div>

MINIMUM VISUAL TARGETS PER POST:
- 3-4 stat-highlight elements
- 2-3 key-takeaway boxes
- 1+ comparison-box
- 2-3 data charts/infographics (bar charts, metric cards, timelines, or donut stats)
- 1+ data table where comparing cities, interventions, or time periods`;

// Universal 7-Part Article Structure adapted per post type
const POST_TYPE_PROMPTS = {
  standard: `Write using the UNIVERSAL 7-PART ARTICLE STRUCTURE:

1. OPENING HOOK (150-200 words)
   - Start with a specific moment/observation that illustrates the larger point
   - 1-2 concrete examples or anecdotes
   - Pivot to thesis statement
   - Clarify what this is REALLY about (reframe conventional wisdom)

2. THE CORE ARGUMENT (300-400 words) — broken into 3 sub-sections:
   A. The System/Pattern — explain the underlying mechanism, show how the cycle works
   B. Who/What It Affects — identify who bears the cost, specific impacts
   C. Hidden Consequences — secondary effects people don't see, quantify with data

3. CASE STUDY / DEEP DIVE (300-400 words)
   - Pick ONE specific example and go deep
   - Historical context (how did we get here?)
   - Current state (what does it look like now?)
   - Comparison (what does good look like?)

4. BROADER CONTEXT (200-300 words)
   - Connect to larger patterns — this isn't unique to one place
   - Global/universal patterns, reference experts
   - Reframe from local issue to systemic pattern

5. THE POSSIBILITY (200-300 words)
   - Concrete examples where things worked
   - Data on positive outcomes
   - Economic/practical case for change

6. LOCAL/SPECIFIC APPLICATION (150-200 words)
   - What's possible here/now
   - Specific, concrete recommendations (not abstract)

7. CLOSING (100-150 words)
   - Reframe the conventional wisdom
   - Call to awareness/new perspective
   - End with possibility, not preachiness

Tone: Informed advocate. Observational — show don't preach.`,

  data_report: `Write a DATA-DRIVEN ANALYSIS using the 7-PART STRUCTURE:

1. OPENING HOOK (150-200 words)
   - Lead with the most striking data point — make it visceral
   - One sentence of context, then immediately into the numbers

2. THE CORE ARGUMENT (300-400 words) — 3 sub-sections:
   A. The Data Pattern — what the numbers show, trend over time
   B. Who Bears the Cost — demographic breakdowns, geographic disparities
   C. Hidden Numbers — secondary metrics, economic costs, underreported data
   Use stat-highlight elements generously. Use a comparison table.

3. DEEP DIVE (300-400 words)
   - Pick ONE city/region/dataset and analyze thoroughly
   - Compare to peers — why is this place different?
   - Use before/after data with comparison-box elements

4. BROADER CONTEXT (200-300 words)
   - How does this fit the global picture?
   - Reference WHO, NHTSA, or MoRTH benchmark data
   - Historical trends

5. THE POSSIBILITY (200-300 words)
   - Cities/regions where numbers improved dramatically
   - Quantify the interventions that worked
   - Cost-benefit data

6. POLICY IMPLICATIONS (150-200 words)
   - Specific, numbered recommendations based on the data
   - Actionable, not abstract

7. CLOSING (100-150 words)
   - The one number readers should remember
   - Reframe the story the data tells

Tone: Analytical. Heavy on data visualizations (stat-highlight, tables, comparison-box). Let the numbers tell the story.`,

  case_study: `Write a CASE STUDY using the 7-PART STRUCTURE:

1. OPENING HOOK (150-200 words)
   - Start with a specific street/intersection/moment BEFORE the change
   - Paint the scene — what did it look like, feel like, how dangerous was it?
   - Thesis: this place transformed, here's how

2. THE CORE ARGUMENT (300-400 words) — 3 sub-sections:
   A. The System — what was broken in the old design
   B. The Human Cost — specific incidents, statistics, community impact
   C. The Turning Point — what triggered the change (crisis, leader, movement)
   Use a comparison-box for before/after.

3. THE INTERVENTION (300-400 words)
   - Exactly what they did — timeline, budget, political challenges
   - Design specifics — not vague, but concrete changes
   - Who drove it — people, not just policy

4. THE RESULTS (200-300 words)
   - Before/after data — deaths, injuries, traffic volume, air quality
   - Qualitative changes — how the community responded
   - Use stat-highlight for the most dramatic improvements

5. WHY IT WORKED (200-300 words)
   - Critical success factors
   - What's replicable vs. context-specific
   - Common objections and how they were overcome

6. LESSONS FOR OTHER CITIES (150-200 words)
   - Concrete, transferable insights
   - What to do first if you want to replicate this

7. CLOSING (100-150 words)
   - Return to the opening scene — what does it look like NOW?
   - End with possibility

Tone: Hopeful, narrative-driven. Before/after is the emotional engine. Show transformation.`,

  explainer: `Write an EXPLAINER using the 7-PART STRUCTURE:

1. OPENING HOOK (150-200 words)
   - Start with a common misconception or surprising fact
   - "Most people think X, but actually Y"
   - Why this concept matters for everyday life

2. THE CORE ARGUMENT (300-400 words) — 3 sub-sections:
   A. What It Actually Is — plain language definition, clear analogies
   B. Why It Matters — real-world impact, who is affected
   C. The Hidden Mechanism — how it works beneath the surface, counter-intuitive aspects

3. DEEP DIVE EXAMPLE (300-400 words)
   - ONE specific, vivid example that makes the concept concrete
   - Walk through it step by step
   - Use before/after or comparison to illustrate

4. BROADER CONTEXT (200-300 words)
   - How this concept connects to larger systems
   - Historical background — how did we get here?
   - Expert perspectives

5. EXAMPLES IN PRACTICE (200-300 words)
   - 3-4 quick real-world examples showing the concept at work
   - Mix of success stories and cautionary tales
   - Different geographies/contexts

6. APPLICATION (150-200 words)
   - How readers can recognize this in their own city/neighborhood
   - Simple things to notice or advocate for

7. CLOSING (100-150 words)
   - Reframe — now you'll never see [X] the same way
   - End with an observation, not a lecture

Tone: Educational but never condescending. Use analogies. Progressive complexity (start simple, add nuance).`,

  education: `Write an EDUCATIONAL GUIDE using the 7-PART STRUCTURE:

1. OPENING HOOK (150-200 words)
   - Start with a relatable observation: "Next time you cross the street, look at..."
   - Pose a question or common misconception
   - Promise: by the end, you'll see streets differently

2. THE CORE CONCEPT (300-400 words) — 3 sub-sections:
   A. Definition — what is this element/concept, plain language
   B. Observable Components — specific physical features to look for
   C. Variations — how it looks in different contexts
   Use comparison-box elements to contrast good vs bad design.

3. HOW TO RECOGNIZE QUALITY (300-400 words)
   - Good vs. bad examples with specific measurements and standards
   - What to look for: dimensions, materials, placement, condition
   - Reference NACTO/WHO standards with specific numbers
   Use stat-highlight for key measurements.

4. WHY IT MATTERS (200-300 words)
   - Safety impact with crash reduction data
   - Accessibility considerations (ADA, universal design)
   - Economic and equity dimensions
   Use metric-card elements for impact data.

5. GLOBAL BEST PRACTICES (200-300 words)
   - What do NACTO, WHO, Vision Zero recommend?
   - Examples from leading cities (Amsterdam, Copenhagen, Tokyo, Bogotá)
   - Common mistakes and why they fail

6. WHAT TO LOOK FOR IN YOUR NEIGHBORHOOD (150-200 words)
   - Observable checklist — specific things readers can assess on their next walk
   - Red flags that indicate poor design
   - Quick wins cities can implement
   Use an info-box for the checklist.

7. CLOSING (100-150 words)
   - "Next time you walk down your street..." observation prompt
   - Encourage active observation and sharing findings
   - Connect to related concepts

Tone: Teaching and empowering. Make readers feel smarter and more observant. Use "you" and "your neighborhood" to make it personal.`,
};

app.post('/api/admin/blog/generate', async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const {
    topic,
    keywords = [],
    postType = 'standard',
    tone = 'informed_advocate',
    region = 'global',
    wordCount = 1500,
  } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  const typePrompt = POST_TYPE_PROMPTS[postType] || POST_TYPE_PROMPTS.standard;

  const userPrompt = `${typePrompt}

TOPIC: ${topic}
${keywords.length ? `TARGET SEO KEYWORDS: ${keywords.join(', ')}` : ''}
GEOGRAPHIC FOCUS: ${region}
TONE: ${tone.replace(/_/g, ' ')}
TARGET WORD COUNT: approximately ${wordCount} words

Write the complete blog post now. Remember: output ONLY a valid JSON object, no markdown code fences.`;

  try {
    console.log(`🤖 Generating blog post: "${topic}" (${postType}, ${region})`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8000,
        temperature: 0.7,
        system: BLOG_CONTENT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: `AI generation failed (${response.status})` });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    // Parse the JSON from Claude's response
    let parsed;
    try {
      // Try direct parse first
      parsed = JSON.parse(text);
    } catch {
      // Try extracting JSON from potential markdown code fences
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error('Failed to parse AI response as JSON:', text.slice(0, 500));
        return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
      }
    }

    // Validate required fields
    if (!parsed.title || !parsed.content) {
      return res.status(500).json({ error: 'AI response missing required fields. Please try again.' });
    }

    // Inject location-specific Unsplash images into the content
    const enrichedContent = await injectBlogImages(parsed.content, parsed.title, parsed.category, keywords, region, postType);
    console.log(`✅ Blog post generated: "${parsed.title}" (${enrichedContent.length} chars, images injected)`);

    res.json({
      title: parsed.title,
      metaTitle: parsed.metaTitle || parsed.title,
      metaDescription: parsed.metaDescription || '',
      excerpt: parsed.excerpt || '',
      category: parsed.category || 'General',
      tags: parsed.tags || keywords,
      content: enrichedContent,
    });
  } catch (err) {
    console.error('Blog generation error:', err);
    res.status(500).json({ error: 'Failed to generate blog post. Please try again.' });
  }
});

// ─── Content Queue (Editorial Calendar) ─────────────────────────────────────

// GET /api/admin/content-queue — list all planned posts
app.get('/api/admin/content-queue', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const calendar = loadEditorialCalendar();
  res.json(calendar);
});

// PUT /api/admin/content-queue/:id — update a single calendar post status
app.put('/api/admin/content-queue/:id', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const id = parseInt(req.params.id, 10);
  const calendar = loadEditorialCalendar();
  const post = calendar.posts.find(p => p.id === id);
  if (!post) return res.status(404).json({ error: 'Calendar post not found' });

  const { status, generatedSlug } = req.body;
  if (status) post.status = status;
  if (generatedSlug) post.generatedSlug = generatedSlug;
  post.updatedAt = new Date().toISOString();

  // Update tracking
  if (status === 'generated' || status === 'published') {
    calendar.tracking.lastGeneratedDate = new Date().toISOString();
    calendar.tracking.lastGeneratedPostId = id;
    calendar.tracking.totalGenerated = calendar.posts.filter(p => p.status === 'generated' || p.status === 'published').length;
    calendar.tracking.totalPublished = calendar.posts.filter(p => p.status === 'published').length;
  }

  saveEditorialCalendar(calendar);
  res.json(post);
});

// POST /api/admin/content-queue/suggest — AI-powered topic idea generator
app.post('/api/admin/content-queue/suggest', async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { region = 'global', postType = '', count = 5 } = req.body;
  const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 10);

  const regionNames = {
    global: 'worldwide / cross-country',
    europe: 'Europe (EU cities, Nordic countries, UK)',
    north_america: 'North America (US and Canada)',
    india: 'India (major Indian cities)',
    asia: 'Asia (East and Southeast Asia — Japan, South Korea, Singapore, Taiwan, Indonesia, Philippines)',
    south_america: 'South America (Colombia, Brazil, Argentina)',
    africa: 'Africa (Kenya, Ethiopia, South Africa, Nigeria)',
    oceania: 'Oceania (Australia, New Zealand)',
  };

  const regionDesc = regionNames[region] || regionNames.global;
  const typeFilter = postType ? `\nPreferred post type: ${postType.replace(/_/g, ' ')}` : '';

  const prompt = `You are a content strategist for SafeStreets, a walkability analysis platform focused on pedestrian safety, walkability, and urban planning.

Suggest ${safeCount} blog post topic ideas focused on: ${regionDesc}${typeFilter}

Topics should be specific, data-driven, and timely. Mix case studies with data reports and explainers.

Return ONLY a JSON array (no markdown code fences) with this structure:
[
  {
    "title": "Compelling blog post title (under 70 chars)",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
    "primaryMessage": "One-sentence summary of the key argument or finding",
    "tone": "informed_advocate|urgent|hopeful|analytical",
    "postType": "standard|data_report|case_study|explainer",
    "dataSources": ["Relevant data source 1", "Source 2"]
  }
]`;

  try {
    console.log(`💡 Suggesting ${safeCount} topics for region: ${region}`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        temperature: 0.9,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: `AI suggestion failed (${response.status})` });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    let suggestions;
    try {
      suggestions = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
      }
    }

    console.log(`✅ Generated ${suggestions.length} topic suggestions`);
    res.json({ suggestions });
  } catch (err) {
    console.error('Topic suggestion error:', err);
    res.status(500).json({ error: 'Failed to generate suggestions. Please try again.' });
  }
});

// POST /api/admin/content-queue/add — add a new post to the editorial calendar
app.post('/api/admin/content-queue/add', (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const { title, region = 'global', keywords = [], dataSources = [], primaryMessage = '', tone = 'informed_advocate', postType = 'standard' } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const calendar = loadEditorialCalendar();

  // Auto-increment ID: find the max ID and add 1
  const maxId = calendar.posts.reduce((max, p) => Math.max(max, p.id), 0);
  const newPost = {
    id: maxId + 1,
    title: title.trim(),
    region,
    targetDate: '',
    keywords,
    dataSources,
    primaryMessage,
    tone,
    postType,
    status: 'pending',
  };

  calendar.posts.push(newPost);
  calendar.metadata.totalPosts = calendar.posts.length;
  saveEditorialCalendar(calendar);

  console.log(`📝 Added calendar post #${newPost.id}: "${newPost.title}"`);
  res.json(newPost);
});

// ═══════════════════════════════════════════════

// Overpass API proxy with caching
app.post('/api/overpass', async (req, res) => {
  // Track analysis (every analysis calls overpass)
  trackEvent('analysis', req);

  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing required parameter: query' });
    }

    // Check cache first
    const cacheKey = getCacheKey(query);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached });
    }

    // Race all mirrors simultaneously — use the first valid JSON response
    const endpoints = [
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://overpass.openstreetmap.ru/cgi/interpreter',
      'https://overpass.openstreetmap.fr/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    ];

    const MIRROR_TIMEOUT = 12000; // 12s per mirror (some are slow)

    // Fire all mirrors at once, resolve with first valid JSON result
    const data = await new Promise((resolve, reject) => {
      let pending = endpoints.length;
      let settled = false;
      const controllers = [];

      endpoints.forEach((endpoint, i) => {
        const controller = new AbortController();
        controllers.push(controller);

        const timer = setTimeout(() => controller.abort(), MIRROR_TIMEOUT);

        fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
        })
          .then(async (response) => {
            clearTimeout(timer);
            if (settled) return;
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const ct = response.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
              await response.text(); // drain body
              throw new Error(`Non-JSON response: ${ct}`);
            }
            return response.json();
          })
          .then((json) => {
            if (settled || !json) return;
            settled = true;
            console.log(`✅ Overpass: ${endpoint} won the race`);
            // Abort remaining mirrors
            controllers.forEach((c, j) => { if (j !== i) c.abort(); });
            resolve(json);
          })
          .catch((err) => {
            clearTimeout(timer);
            pending--;
            if (!settled && pending === 0) {
              reject(new Error('All Overpass mirrors failed'));
            }
          });
      });
    });

    setCache(cacheKey, data);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Overpass error:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to fetch Overpass data',
    });
  }
});

// NASA POWER API - Free meteorological data
app.get('/api/nasa-power-temperature', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`☀️  Fetching NASA POWER temperature for: ${lat}, ${lon}`);

    // Get last 30 days of temperature data
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,T2M_MAX,T2M_MIN&community=RE&longitude=${lon}&latitude=${lat}&start=${formatDate(startDate)}&end=${formatDate(endDate)}&format=JSON`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SafeStreets/1.0' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NASA POWER API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.properties || !data.properties.parameter) {
      throw new Error('Invalid response from NASA POWER API');
    }

    // Calculate average temperature from last 30 days
    const temps = data.properties.parameter.T2M;
    const maxTemps = data.properties.parameter.T2M_MAX;
    const minTemps = data.properties.parameter.T2M_MIN;

    const tempValues = Object.values(temps).filter(v => v !== -999);
    const avgTemp = tempValues.reduce((a, b) => a + b, 0) / tempValues.length;

    const maxTempValues = Object.values(maxTemps).filter(v => v !== -999);
    const avgMaxTemp = maxTempValues.reduce((a, b) => a + b, 0) / maxTempValues.length;

    const minTempValues = Object.values(minTemps).filter(v => v !== -999);
    const avgMinTemp = minTempValues.reduce((a, b) => a + b, 0) / minTempValues.length;

    console.log(`✅ NASA POWER temperature: ${avgTemp.toFixed(1)}°C`);

    res.json({
      success: true,
      data: {
        averageTemperature: Math.round(avgTemp * 10) / 10,
        averageMaxTemperature: Math.round(avgMaxTemp * 10) / 10,
        averageMinTemperature: Math.round(avgMinTemp * 10) / 10,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASA POWER (30-day average)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching NASA POWER temperature:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch NASA POWER temperature',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// OpenAQ Air Quality API - Requires API key (V3)
// NOTE: OpenAQ V2 was deprecated Jan 31, 2025. V3 requires free API key from explore.openaq.org
app.get('/api/air-quality', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Check if API key is configured
    const apiKey = process.env.OPENAQ_API_KEY;
    if (!apiKey) {
      console.log(`🌫️  OpenAQ API key not configured - air quality unavailable`);
      return res.json({
        success: true,
        data: null,
        message: 'Air quality data requires OpenAQ API key. Get free key at explore.openaq.org',
      });
    }

    console.log(`🌫️  Fetching OpenAQ air quality for: ${lat}, ${lon}`);

    // OpenAQ V3 API with API key
    const radiusKm = 25;
    const url = `https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=${radiusKm * 1000}&limit=10`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenAQ API returned ${response.status} - air quality unavailable`);
      return res.json({
        success: true,
        data: null,
        message: 'Air quality data temporarily unavailable',
      });
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No air quality monitoring stations found within 25km',
      });
    }

    // OpenAQ V3: Fetch latest measurements for each location
    const measurementsPromises = data.results.slice(0, 5).map(async (location) => {
      try {
        const latestUrl = `https://api.openaq.org/v3/locations/${location.id}/latest`;
        const latestResponse = await fetch(latestUrl, {
          headers: {
            'X-API-Key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (!latestResponse.ok) return null;
        const latestData = await latestResponse.json();
        return { location, measurements: latestData.results || [] };
      } catch (error) {
        console.warn(`Failed to fetch measurements for location ${location.id}:`, error.message);
        return null;
      }
    });

    const locationsWithMeasurements = (await Promise.all(measurementsPromises)).filter(Boolean);

    if (locationsWithMeasurements.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'No recent air quality measurements available',
      });
    }

    // Aggregate measurements from all stations
    const measurements = {};
    const stationCount = {};

    locationsWithMeasurements.forEach(({ location, measurements: latestMeasurements }) => {
      latestMeasurements.forEach(measurement => {
        // Match sensor ID to parameter name from location.sensors
        const sensor = location.sensors?.find(s => s.id === measurement.sensorsId);
        if (!sensor || !measurement.value) return;

        const paramName = sensor.parameter.name;
        if (!measurements[paramName]) {
          measurements[paramName] = [];
          stationCount[paramName] = 0;
        }
        measurements[paramName].push(measurement.value);
        stationCount[paramName]++;
      });
    });

    // Calculate averages
    const airQuality = {};
    for (const [param, values] of Object.entries(measurements)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      airQuality[param] = {
        value: Math.round(avg * 10) / 10,
        unit: param.includes('ppm') ? 'ppm' : 'µg/m³',
        stationCount: stationCount[param],
      };
    }

    // Calculate AQI score (simplified US EPA formula for PM2.5)
    let aqiScore = null;
    let aqiCategory = null;

    if (airQuality.pm25) {
      const pm25 = airQuality.pm25.value;
      if (pm25 <= 12) {
        aqiScore = 10;
        aqiCategory = 'Good';
      } else if (pm25 <= 35.4) {
        aqiScore = 8;
        aqiCategory = 'Moderate';
      } else if (pm25 <= 55.4) {
        aqiScore = 6;
        aqiCategory = 'Unhealthy for Sensitive Groups';
      } else if (pm25 <= 150.4) {
        aqiScore = 4;
        aqiCategory = 'Unhealthy';
      } else if (pm25 <= 250.4) {
        aqiScore = 2;
        aqiCategory = 'Very Unhealthy';
      } else {
        aqiScore = 0;
        aqiCategory = 'Hazardous';
      }
    }

    console.log(`✅ Air quality: PM2.5 ${airQuality.pm25?.value || 'N/A'} µg/m³`);

    res.json({
      success: true,
      data: {
        measurements: airQuality,
        aqiScore,
        aqiCategory,
        nearestStationDistance: data.results[0]?.distance ? Math.round(data.results[0].distance / 1000) : null,
        stationsFound: data.results.length,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'OpenAQ (live monitoring stations)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching air quality:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch air quality data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// NASADEM Elevation API - Free elevation data from Microsoft Planetary Computer
app.get('/api/elevation', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`⛰️  Fetching NASADEM elevation for: ${lat}, ${lon}`);

    // Create small bounding box around point (100m buffer)
    const buffer = 100 / 111000; // ~111km per degree
    const bbox = [
      parseFloat(lon) - buffer,
      parseFloat(lat) - buffer,
      parseFloat(lon) + buffer,
      parseFloat(lat) + buffer
    ];

    // Search Microsoft Planetary Computer STAC API for NASADEM
    const searchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['nasadem'],
      bbox: bbox,
      limit: 1
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!searchResponse.ok) {
      throw new Error(`STAC search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.features || searchData.features.length === 0) {
      return res.json({
        success: true,
        data: {
          elevation: 0,
          location: { lat: parseFloat(lat), lon: parseFloat(lon) },
          dataSource: 'NASADEM (default: sea level, no data available)',
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Extract elevation asset URL from STAC response
    const feature = searchData.features[0];
    const elevationAsset = feature.assets?.elevation;

    if (!elevationAsset || !elevationAsset.href) {
      throw new Error('No elevation asset found in NASADEM tile');
    }

    // Microsoft Planetary Computer requires signing the URL
    // Use their public SAS signing service
    const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(elevationAsset.href)}`;

    const signResponse = await fetch(signingEndpoint);

    if (!signResponse.ok) {
      throw new Error(`Failed to sign NASADEM URL: ${signResponse.status}`);
    }

    const signedData = await signResponse.json();
    const geotiffUrl = signedData.href;

    console.log(`📡 Fetching signed GeoTIFF...`);

    // Read GeoTIFF and extract pixel value at coordinates
    const tiff = await fromUrl(geotiffUrl);
    const image = await tiff.getImage();

    // Get the bounding box of the GeoTIFF
    const geoBbox = image.getBoundingBox();
    const [minX, minY, maxX, maxY] = geoBbox;

    // Convert lat/lon to pixel coordinates
    const width = image.getWidth();
    const height = image.getHeight();

    const pixelX = Math.floor(((parseFloat(lon) - minX) / (maxX - minX)) * width);
    const pixelY = Math.floor(((maxY - parseFloat(lat)) / (maxY - minY)) * height);

    // Validate pixel coordinates are within bounds
    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
      throw new Error('Coordinates outside GeoTIFF bounds');
    }

    // Read pixel value (elevation in meters)
    const window = [pixelX, pixelY, pixelX + 1, pixelY + 1];
    const data = await image.readRasters({ window });
    const elevation = Math.round(data[0][0]); // NASADEM has single band

    console.log(`✅ NASADEM elevation: ${elevation}m`);

    res.json({
      success: true,
      data: {
        elevation,
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASADEM (Microsoft Planetary Computer)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching NASADEM elevation:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch elevation data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// NASADEM Slope API - Calculate terrain slope from elevation data
app.get('/api/slope', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🏔️  Calculating slope for: ${lat}, ${lon}`);

    // Helper function to get elevation at a point
    async function getElevationAt(latitude, longitude) {
      // Create small bounding box
      const buffer = 100 / 111000;
      const bbox = [
        parseFloat(longitude) - buffer,
        parseFloat(latitude) - buffer,
        parseFloat(longitude) + buffer,
        parseFloat(latitude) + buffer
      ];

      // Search STAC API
      const searchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collections: ['nasadem'], bbox, limit: 1 }),
      });

      if (!searchResponse.ok) throw new Error('STAC search failed');
      const searchData = await searchResponse.json();
      if (!searchData.features || searchData.features.length === 0) return null;

      const feature = searchData.features[0];
      const elevationAsset = feature.assets?.elevation;
      if (!elevationAsset) return null;

      // Sign URL
      const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(elevationAsset.href)}`;
      const signResponse = await fetch(signingEndpoint);
      if (!signResponse.ok) throw new Error('Failed to sign URL');
      const signedData = await signResponse.json();

      // Read GeoTIFF
      const tiff = await fromUrl(signedData.href);
      const image = await tiff.getImage();
      const geoBbox = image.getBoundingBox();
      const [minX, minY, maxX, maxY] = geoBbox;

      const width = image.getWidth();
      const height = image.getHeight();

      const pixelX = Math.floor(((parseFloat(longitude) - minX) / (maxX - minX)) * width);
      const pixelY = Math.floor(((maxY - parseFloat(latitude)) / (maxY - minY)) * height);

      if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) return null;

      const window = [pixelX, pixelY, pixelX + 1, pixelY + 1];
      const data = await image.readRasters({ window });
      return data[0][0];
    }

    // Get elevations at 4 neighboring points (N, S, E, W)
    // Using ~30m offset (NASADEM resolution)
    const offset = 0.0003; // Approximately 30 meters at equator

    const [elevCenter, elevN, elevS, elevE, elevW] = await Promise.all([
      getElevationAt(parseFloat(lat), parseFloat(lon)),
      getElevationAt(parseFloat(lat) + offset, parseFloat(lon)),
      getElevationAt(parseFloat(lat) - offset, parseFloat(lon)),
      getElevationAt(parseFloat(lat), parseFloat(lon) + offset),
      getElevationAt(parseFloat(lat), parseFloat(lon) - offset),
    ]);

    if (elevCenter === null || elevN === null || elevS === null || elevE === null || elevW === null) {
      return res.json({
        success: true,
        data: {
          slope: 0,
          slopeCategory: 'Unknown',
          score: 5,
          location: { lat: parseFloat(lat), lon: parseFloat(lon) },
          dataSource: 'NASADEM (insufficient data)',
        },
      });
    }

    // Calculate slope using elevation differences
    const cellSize = 30; // NASADEM resolution in meters
    const dz_dx = (elevE - elevW) / (2 * cellSize); // Horizontal gradient
    const dz_dy = (elevN - elevS) / (2 * cellSize); // Vertical gradient

    // Calculate slope in degrees
    const slopeRadians = Math.atan(Math.sqrt(dz_dx * dz_dx + dz_dy * dz_dy));
    const slopeDegrees = slopeRadians * (180 / Math.PI);

    // Categorize slope
    let slopeCategory = '';
    let score = 0;

    if (slopeDegrees < 2) {
      slopeCategory = 'Flat';
      score = 10;
    } else if (slopeDegrees < 5) {
      slopeCategory = 'Gentle';
      score = 8;
    } else if (slopeDegrees < 10) {
      slopeCategory = 'Moderate';
      score = 6;
    } else if (slopeDegrees < 15) {
      slopeCategory = 'Steep';
      score = 4;
    } else {
      slopeCategory = 'Very Steep';
      score = 2;
    }

    console.log(`✅ Slope: ${slopeDegrees.toFixed(2)}° (${slopeCategory})`);

    res.json({
      success: true,
      data: {
        slope: Math.round(slopeDegrees * 100) / 100,
        slopeCategory,
        score,
        elevations: {
          center: Math.round(elevCenter),
          north: Math.round(elevN),
          south: Math.round(elevS),
          east: Math.round(elevE),
          west: Math.round(elevW),
        },
        location: { lat: parseFloat(lat), lon: parseFloat(lon) },
        dataSource: 'NASADEM (Microsoft Planetary Computer)',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating slope:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate slope',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Sentinel-2 NDVI API - Calculate vegetation index for tree canopy
app.get('/api/ndvi', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🌳 Calculating NDVI for: ${lat}, ${lon}`);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Define 800m radius bounding box (approximately 0.007 degrees)
    const radius = 0.007;
    const bbox = [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ];

    // Search for recent Sentinel-2 imagery (last 60 days, cloud-free)
    const today = new Date();
    const startDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['sentinel-2-l2a'],
      bbox: bbox,
      datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
      limit: 10,
      query: {
        'eo:cloud_cover': {
          lt: 20, // Less than 20% cloud cover
        },
      },
    };

    console.log(`📡 Searching Sentinel-2 imagery...`);
    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) {
      throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    }

    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No recent Sentinel-2 imagery found');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5, // Default neutral score
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No recent cloud-free satellite imagery available',
        },
      });
    }

    // Get the most recent image
    const mostRecentImage = stacData.features[0];
    console.log(`✅ Found Sentinel-2 image from ${mostRecentImage.properties.datetime}`);

    console.log(`📡 Fetching NIR and Red visual band (lower resolution for speed)...`);

    // Use B8A (Narrow NIR at 20m resolution) and B04 (Red at 10m but we can downsample)
    // to reduce data transfer size
    const b8aAsset = mostRecentImage.assets.B8A; // Narrow NIR at 20m resolution (smaller file)
    const b04Asset = mostRecentImage.assets.B04; // Red at 10m

    if (!b8aAsset || !b04Asset) {
      throw new Error('Missing required spectral bands');
    }

    // Sign the asset URLs
    const signingEndpoint = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

    const [b8aSignedResponse, b04SignedResponse] = await Promise.all([
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b8aAsset.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b04Asset.href)}`),
    ]);

    const b8aSigned = await b8aSignedResponse.json();
    const b04Signed = await b04SignedResponse.json();

    // Read GeoTIFF bands with timeout increase
    const [tiffB8A, tiffB04] = await Promise.all([
      fromUrl(b8aSigned.href),
      fromUrl(b04Signed.href),
    ]);

    const [imageB8A, imageB04] = await Promise.all([
      tiffB8A.getImage(),
      tiffB04.getImage(),
    ]);

    // Get image metadata
    const width = imageB8A.getWidth();
    const height = imageB8A.getHeight();

    // Read a small center sample (100x100 pixels at 20m = 2km x 2km area)
    const sampleSize = 100;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const x0 = Math.max(0, centerX - Math.floor(sampleSize / 2));
    const y0 = Math.max(0, centerY - Math.floor(sampleSize / 2));
    const x1 = Math.min(width, x0 + sampleSize);
    const y1 = Math.min(height, y0 + sampleSize);

    console.log(`📐 Sampling ${x1-x0}x${y1-y0} pixels from center of ${width}x${height} image`);

    // Read small windows from both bands
    const [dataB8A, dataB04] = await Promise.all([
      imageB8A.readRasters({ window: [x0, y0, x1, y1] }),
      imageB04.readRasters({ window: [x0, y0, x1, y1] }),
    ]);

    const nirValues = dataB8A[0];
    const redValues = dataB04[0];

    let ndviSum = 0;
    let validPixels = 0;

    // Calculate NDVI for the sample
    for (let i = 0; i < nirValues.length; i++) {
      const nir = nirValues[i];
      const red = redValues[i];

      // Skip invalid pixels (nodata, clouds, water)
      // Sentinel-2 L2A values are scaled 0-10000
      if (nir > 0 && red > 0 && nir < 10000 && red < 10000) {
        const ndvi = (nir - red) / (nir + red);

        // Valid NDVI range: -1 to 1
        if (ndvi >= -1 && ndvi <= 1) {
          ndviSum += ndvi;
          validPixels++;
        }
      }
    }

    if (validPixels === 0) {
      console.log('⚠️  No valid NDVI pixels found');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No valid vegetation data in this area',
        },
      });
    }

    const avgNDVI = ndviSum / validPixels;
    console.log(`✅ Processed ${validPixels}/${nirValues.length} pixels, avg NDVI: ${avgNDVI.toFixed(3)}`);

    // Score NDVI (0-10 scale)
    // NDVI ranges: -1 to 1
    // -1 to 0: Water/bare soil (0 points)
    // 0 to 0.2: Low vegetation (2 points)
    // 0.2 to 0.4: Moderate vegetation (5 points)
    // 0.4 to 0.6: Healthy vegetation (7 points)
    // 0.6 to 1.0: Dense/very healthy vegetation (10 points)

    let score;
    let category;

    if (avgNDVI < 0) {
      score = 0;
      category = 'No Vegetation';
    } else if (avgNDVI < 0.2) {
      score = Math.round((avgNDVI / 0.2) * 2);
      category = 'Sparse Vegetation';
    } else if (avgNDVI < 0.4) {
      score = Math.round(2 + ((avgNDVI - 0.2) / 0.2) * 3);
      category = 'Moderate Vegetation';
    } else if (avgNDVI < 0.6) {
      score = Math.round(5 + ((avgNDVI - 0.4) / 0.2) * 2);
      category = 'Healthy Vegetation';
    } else {
      score = Math.round(7 + ((avgNDVI - 0.6) / 0.4) * 3);
      category = 'Dense Vegetation';
    }

    console.log(`✅ NDVI: ${avgNDVI.toFixed(3)} (${category})`);

    res.json({
      success: true,
      data: {
        ndvi: parseFloat(avgNDVI.toFixed(3)),
        score: score,
        category: category,
        imageDate: mostRecentImage.properties.datetime,
        cloudCover: mostRecentImage.properties['eo:cloud_cover'],
        validPixels: validPixels,
        totalPixels: nirValues.length,
        location: { lat: latitude, lon: longitude },
        dataSource: 'Sentinel-2 L2A (Microsoft Planetary Computer)',
        dataQuality: 'verified',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating NDVI:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate NDVI',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Sentinel-2 Urban Heat Assessment - Surface temperature estimation using SWIR bands
app.get('/api/heat-island', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    // Validate coordinates
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`🔥 Calculating urban heat for: ${lat}, ${lon}`);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    // Define search area (800m radius = approximately 0.007 degrees)
    const radius = 0.007;
    const bbox = [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ];

    // Search for recent Sentinel-2 imagery (last 60 days, cloud-free)
    const today = new Date();
    const startDate = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['sentinel-2-l2a'],
      bbox: bbox,
      datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
      limit: 10,
      query: {
        'eo:cloud_cover': {
          lt: 20,
        },
      },
    };

    console.log(`📡 Searching Sentinel-2 imagery...`);
    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) {
      throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    }

    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No recent Sentinel-2 imagery found');
      return res.status(200).json({
        success: true,
        data: {
          heatIslandEffect: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No recent cloud-free satellite imagery available',
        },
      });
    }

    const mostRecentImage = stacData.features[0];
    console.log(`✅ Found Sentinel-2 image from ${mostRecentImage.properties.datetime}`);

    console.log(`📡 Fetching SWIR bands for surface temperature...`);

    // Get SWIR bands (B11 and B12 at 20m resolution) + NIR (B8A) and Red (B04) for NDVI
    const b11AssetHeat = mostRecentImage.assets.B11; // SWIR 1 (1610nm) - 20m
    const b12AssetHeat = mostRecentImage.assets.B12; // SWIR 2 (2190nm) - 20m
    const b8aAssetHeat = mostRecentImage.assets.B8A; // NIR (865nm) - 20m
    const b04AssetHeat = mostRecentImage.assets.B04; // Red (665nm) - 10m

    if (!b11AssetHeat || !b12AssetHeat || !b8aAssetHeat || !b04AssetHeat) {
      throw new Error('Missing required spectral bands');
    }

    // Sign the asset URLs
    const signingEndpoint = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

    const [b11SignedResponse, b12SignedResponse, b8aSignedResponseHeat, b04SignedResponseHeat] = await Promise.all([
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b11AssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b12AssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b8aAssetHeat.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b04AssetHeat.href)}`),
    ]);

    const [b11Signed, b12Signed, b8aSignedHeat, b04SignedHeat] = await Promise.all([
      b11SignedResponse.json(),
      b12SignedResponse.json(),
      b8aSignedResponseHeat.json(),
      b04SignedResponseHeat.json(),
    ]);

    // Read GeoTIFF bands
    const [tiffB11, tiffB12, tiffB8AHeat, tiffB04Heat] = await Promise.all([
      fromUrl(b11Signed.href),
      fromUrl(b12Signed.href),
      fromUrl(b8aSignedHeat.href),
      fromUrl(b04SignedHeat.href),
    ]);

    const [imageB11, imageB12, imageB8AHeat, imageB04Heat] = await Promise.all([
      tiffB11.getImage(),
      tiffB12.getImage(),
      tiffB8AHeat.getImage(),
      tiffB04Heat.getImage(),
    ]);

    // Get image metadata
    const width = imageB11.getWidth();
    const height = imageB11.getHeight();

    // Read a small center sample (100x100 pixels at 20m = 2km x 2km area)
    const sampleSize = 100;
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    const x0 = Math.max(0, centerX - Math.floor(sampleSize / 2));
    const y0 = Math.max(0, centerY - Math.floor(sampleSize / 2));
    const x1 = Math.min(width, x0 + sampleSize);
    const y1 = Math.min(height, y0 + sampleSize);

    console.log(`📐 Sampling ${x1-x0}x${y1-y0} pixels from center`);

    // Read small windows from all bands
    const [dataB11, dataB12, dataB8AHeat, dataB04Heat] = await Promise.all([
      imageB11.readRasters({ window: [x0, y0, x1, y1] }),
      imageB12.readRasters({ window: [x0, y0, x1, y1] }),
      imageB8AHeat.readRasters({ window: [x0, y0, x1, y1] }),
      imageB04Heat.readRasters({ window: [x0, y0, x1, y1] }),
    ]);

    const swir1Values = dataB11[0];
    const swir2Values = dataB12[0];
    const nirValues = dataB8AHeat[0];
    const redValues = dataB04Heat[0];

    // Calculate brightness temperature (proxy) and separate urban vs vegetation areas
    // Also compute NDBI (Normalized Difference Built-up Index)
    let urbanTempSum = 0;
    let urbanPixels = 0;
    let vegetationTempSum = 0;
    let vegetationPixels = 0;
    let ndbiSum = 0;
    let ndbiCount = 0;

    for (let i = 0; i < swir1Values.length; i++) {
      const swir1 = swir1Values[i];
      const swir2 = swir2Values[i];
      const nir = nirValues[i];
      const red = redValues[i];

      // Skip invalid pixels
      if (swir1 > 0 && swir2 > 0 && nir > 0 && red > 0 &&
          swir1 < 10000 && swir2 < 10000 && nir < 10000 && red < 10000) {

        // Calculate NDVI to distinguish vegetation from urban
        const ndvi = (nir - red) / (nir + red);

        // NDBI: (SWIR - NIR) / (SWIR + NIR) — measures built-up density
        const ndbiDenom = swir1 + nir;
        if (ndbiDenom > 0) {
          ndbiSum += (swir1 - nir) / ndbiDenom;
          ndbiCount++;
        }

        // Brightness temperature proxy (average of SWIR bands, normalized)
        const brightnessTemp = (swir1 + swir2) / 2;

        if (ndvi > 0.3) {
          // Vegetation pixel (NDVI > 0.3)
          vegetationTempSum += brightnessTemp;
          vegetationPixels++;
        } else {
          // Urban/bare soil pixel (NDVI <= 0.3)
          urbanTempSum += brightnessTemp;
          urbanPixels++;
        }
      }
    }

    // Building Density via NDBI
    const avgNdbi = ndbiCount > 0 ? ndbiSum / ndbiCount : null;
    let buildingDensityScore = 50; // default
    if (avgNdbi !== null) {
      // NDBI range: -1 to 1. Higher = more built-up.
      // Score inverted: less built-up = better for walkability comfort
      // NDBI > 0.2 = heavily built (score 20), < -0.1 = green (score 100)
      if (avgNdbi < -0.1) buildingDensityScore = 100;
      else if (avgNdbi < 0) buildingDensityScore = 85;
      else if (avgNdbi < 0.1) buildingDensityScore = 65;
      else if (avgNdbi < 0.2) buildingDensityScore = 40;
      else buildingDensityScore = 20;
    }

    if (urbanPixels === 0 && vegetationPixels === 0) {
      console.log('⚠️  No valid pixels found');
      return res.status(200).json({
        success: true,
        data: {
          heatIslandEffect: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No valid surface temperature data',
        },
      });
    }

    // Calculate average temperatures
    const avgUrbanTemp = urbanPixels > 0 ? urbanTempSum / urbanPixels : null;
    const avgVegetationTemp = vegetationPixels > 0 ? vegetationTempSum / vegetationPixels : null;

    // Calculate heat island effect (difference between urban and vegetation)
    let heatIslandEffect = null;
    let score = 5;
    let category = 'Unknown';

    if (avgUrbanTemp !== null && avgVegetationTemp !== null) {
      // Normalize the difference (SWIR values are 0-10000, scale to approximate °C difference)
      // Typical urban-vegetation difference is 5-15°C, SWIR difference ~500-1500
      heatIslandEffect = ((avgUrbanTemp - avgVegetationTemp) / 100);

      // Score based on heat island effect
      // Lower difference = better (cooler streets)
      if (heatIslandEffect < 2) {
        score = 10;
        category = 'Minimal Heat Island';
      } else if (heatIslandEffect < 5) {
        score = 8;
        category = 'Low Heat Island';
      } else if (heatIslandEffect < 8) {
        score = 6;
        category = 'Moderate Heat Island';
      } else if (heatIslandEffect < 12) {
        score = 4;
        category = 'Significant Heat Island';
      } else {
        score = 2;
        category = 'Severe Heat Island';
      }
    } else if (avgUrbanTemp !== null) {
      // Only urban pixels (no vegetation for comparison)
      score = 3;
      category = 'Dense Urban (No Vegetation Reference)';
    } else if (avgVegetationTemp !== null) {
      // Only vegetation pixels (ideal!)
      score = 10;
      category = 'Natural/Park Area';
    }

    console.log(`✅ Heat Island Effect: ${heatIslandEffect ? heatIslandEffect.toFixed(2) + '°C' : 'N/A'} (${category})`);

    res.json({
      success: true,
      data: {
        heatIslandEffect: heatIslandEffect ? parseFloat(heatIslandEffect.toFixed(2)) : null,
        score: score,
        category: category,
        urbanPixels: urbanPixels,
        vegetationPixels: vegetationPixels,
        totalPixels: swir1Values.length,
        buildingDensity: {
          ndbi: avgNdbi !== null ? parseFloat(avgNdbi.toFixed(3)) : null,
          score: buildingDensityScore,
        },
        imageDate: mostRecentImage.properties.datetime,
        cloudCover: mostRecentImage.properties['eo:cloud_cover'],
        location: { lat: latitude, lon: longitude },
        dataSource: 'Sentinel-2 L2A SWIR Bands (Microsoft Planetary Computer)',
        dataQuality: 'verified',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error calculating heat island:', error);
    res.status(500).json({
      error: error.message || 'Failed to calculate heat island effect',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ====================
// POPULATION DENSITY
// ====================

app.get('/api/population-density', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    console.log(`👥 Fetching population density for: ${latitude}, ${longitude}`);

    // Search GHS-POP (Global Human Settlement Population) via Planetary Computer
    const buffer = 0.005; // ~500m
    const bbox = [longitude - buffer, latitude - buffer, longitude + buffer, latitude + buffer];

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['ghs-pop'],
      bbox,
      limit: 1,
      sortby: [{ field: 'datetime', direction: 'desc' }],
    };

    const stacResponse = await fetch(stacSearchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(searchBody),
    });

    if (!stacResponse.ok) throw new Error(`STAC search failed: ${stacResponse.statusText}`);
    const stacData = await stacResponse.json();

    if (!stacData.features || stacData.features.length === 0) {
      console.log('⚠️  No GHS-POP data found, using fallback estimate');
      return res.json({
        success: true,
        data: {
          populationDensity: null,
          score: 50,
          category: 'No Data',
          dataSource: 'GHS-POP (no coverage)',
          dataQuality: 'estimated',
        },
      });
    }

    const feature = stacData.features[0];
    const populationAsset = feature.assets?.population_count || feature.assets?.data;
    if (!populationAsset) {
      throw new Error('No population count asset in GHS-POP feature');
    }

    // Sign URL
    const signingEndpoint = `https://planetarycomputer.microsoft.com/api/sas/v1/sign?href=${encodeURIComponent(populationAsset.href)}`;
    const signResponse = await fetch(signingEndpoint);
    if (!signResponse.ok) throw new Error('Failed to sign URL');
    const signedData = await signResponse.json();

    // Read GeoTIFF
    const tiff = await fromUrl(signedData.href);
    const image = await tiff.getImage();
    const geoBbox = image.getBoundingBox();
    const [minX, minY, maxX, maxY] = geoBbox;
    const width = image.getWidth();
    const height = image.getHeight();

    const pixelX = Math.floor(((longitude - minX) / (maxX - minX)) * width);
    const pixelY = Math.floor(((maxY - latitude) / (maxY - minY)) * height);

    if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
      return res.json({
        success: true,
        data: { populationDensity: null, score: 50, category: 'Out of Bounds', dataQuality: 'estimated' },
      });
    }

    // Read a small window around the point
    const sampleR = 2;
    const x0 = Math.max(0, pixelX - sampleR);
    const y0 = Math.max(0, pixelY - sampleR);
    const x1 = Math.min(width, pixelX + sampleR + 1);
    const y1 = Math.min(height, pixelY + sampleR + 1);

    const rasterData = await image.readRasters({ window: [x0, y0, x1, y1] });
    const values = rasterData[0];

    // GHS-POP gives population count per ~100m cell → people/km² ≈ value × 100
    let sum = 0;
    let validCount = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v > 0 && v < 1e6) { // filter nodata
        sum += v;
        validCount++;
      }
    }

    // Average population per cell, scaled to per km²
    // GHS-POP R2023 uses 100m grid → 1 cell = 0.01 km² → density = count / 0.01
    const avgPopPerCell = validCount > 0 ? sum / validCount : 0;
    const populationDensity = Math.round(avgPopPerCell / 0.01);

    // Score: higher density = better walkability context
    let score, category;
    if (populationDensity > 10000) { score = 100; category = 'Very High Density'; }
    else if (populationDensity > 5000) { score = 85; category = 'High Density'; }
    else if (populationDensity > 2000) { score = 65; category = 'Medium Density'; }
    else if (populationDensity > 500) { score = 40; category = 'Low Density'; }
    else { score = 20; category = 'Very Low Density'; }

    console.log(`✅ Population Density: ${populationDensity} people/km² (${category})`);

    res.json({
      success: true,
      data: {
        populationDensity,
        score,
        category,
        dataSource: 'GHS-POP R2023 (European Commission JRC)',
        dataQuality: 'verified',
        location: { lat: latitude, lon: longitude },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ Error fetching population density:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch population density',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// =====================
// CRASH / FATALITY DATA
// =====================

// WHO road traffic death rates per 100k (2021) — static dataset, updates every 2-3 years
// Source: WHO Global Health Observatory, Indicator RS_198
import { readFileSync } from 'fs';
const WHO_DATA_PATH = path.join(__dirname, '..', 'src', 'data', 'whoRoadDeaths.json');
let whoRoadDeaths = {};
try {
  whoRoadDeaths = JSON.parse(readFileSync(WHO_DATA_PATH, 'utf-8'));
} catch (e) {
  console.warn('⚠️  WHO road deaths data not found, international crash data disabled');
}

// In-memory cache for FARS county data (static historical data)
const farsCache = new Map();
const FARS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Nominatim country code is ISO 3166-1 alpha-2, WHO uses alpha-3
// Only need the US check here; for WHO lookup we accept alpha-2 and map to alpha-3
const iso2to3 = {
  AF:'AFG',AL:'ALB',DZ:'DZA',AD:'AND',AO:'AGO',AG:'ATG',AR:'ARG',AM:'ARM',AU:'AUS',AT:'AUT',
  AZ:'AZE',BS:'BHS',BH:'BHR',BD:'BGD',BB:'BRB',BY:'BLR',BE:'BEL',BZ:'BLZ',BJ:'BEN',BT:'BTN',
  BO:'BOL',BA:'BIH',BW:'BWA',BR:'BRA',BN:'BRN',BG:'BGR',BI:'BDI',KH:'KHM',CM:'CMR',CA:'CAN',
  CV:'CPV',CF:'CAF',CL:'CHL',CN:'CHN',CO:'COL',KM:'COM',CD:'COD',CR:'CRI',CI:'CIV',HR:'HRV',
  CU:'CUB',CY:'CYP',DK:'DNK',DJ:'DJI',DM:'DMA',DO:'DOM',EC:'ECU',EG:'EGY',ER:'ERI',EE:'EST',
  ET:'ETH',FJ:'FJI',FI:'FIN',FR:'FRA',GA:'GAB',GM:'GMB',DE:'DEU',GH:'GHA',GR:'GRC',GD:'GRD',
  GT:'GTM',GN:'GIN',GW:'GNB',GY:'GUY',HT:'HTI',HN:'HND',HU:'HUN',IS:'ISL',IN:'IND',ID:'IDN',
  IR:'IRN',IQ:'IRQ',IE:'IRL',IL:'ISR',IT:'ITA',JM:'JAM',JP:'JPN',JO:'JOR',KZ:'KAZ',KE:'KEN',
  KI:'KIR',KW:'KWT',KG:'KGZ',LA:'LAO',LV:'LVA',LB:'LBN',LS:'LSO',LY:'LBY',LT:'LTU',MG:'MDG',
  MW:'MWI',MY:'MYS',MV:'MDV',ML:'MLI',MT:'MLT',MH:'MHL',MR:'MRT',MU:'MUS',MX:'MEX',MD:'MDA',
  MC:'MCO',MN:'MNG',ME:'MNE',MZ:'MOZ',MM:'MMR',NA:'NAM',NR:'NRU',NP:'NPL',NL:'NLD',NZ:'NZL',
  NI:'NIC',NE:'NER',NG:'NGA',MK:'MKD',NO:'NOR',OM:'OMN',PK:'PAK',PW:'PLW',PS:'PSE',PA:'PAN',
  PG:'PNG',PY:'PRY',PH:'PHL',PL:'POL',PT:'PRT',PR:'PRI',QA:'QAT',KR:'KOR',RO:'ROU',RU:'RUS',
  RW:'RWA',KN:'KNA',LC:'LCA',VC:'VCT',WS:'WSM',SM:'SMR',SA:'SAU',RS:'SRB',SL:'SLE',SG:'SGP',
  SI:'SVN',SB:'SLB',SO:'SOM',ZA:'ZAF',SS:'SSD',ES:'ESP',LK:'LKA',SD:'SDN',SR:'SUR',SZ:'SWZ',
  SE:'SWE',CH:'CHE',SY:'SYR',TJ:'TJK',TZ:'TZA',TH:'THA',TL:'TLS',TG:'TGO',TO:'TON',TT:'TTO',
  TR:'TUR',TM:'TKM',TV:'TUV',UG:'UGA',UA:'UKR',AE:'ARE',GB:'GBR',US:'USA',UY:'URY',UZ:'UZB',
  VU:'VUT',VE:'VEN',VN:'VNM',YE:'YEM',ZM:'ZMB',GQ:'GNQ',PE:'PER',CZ:'CZE',SK:'SVK',HR:'HRV',
};

app.get('/api/crash-data', async (req, res) => {
  try {
    const { lat, lon, country } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const countryCode = (country || '').toUpperCase();
    const isUS = countryCode === 'US' || countryCode === 'USA';

    // --- Non-US: return WHO country-level data ---
    if (!isUS) {
      const iso3 = iso2to3[countryCode] || countryCode; // try direct if already alpha-3
      const whoEntry = whoRoadDeaths[iso3];

      if (!whoEntry) {
        return res.json({
          success: true,
          data: null, // no data available for this country
        });
      }

      console.log(`🌍 WHO crash data for ${whoEntry.name}: ${whoEntry.rate}/100k`);

      return res.json({
        success: true,
        data: {
          type: 'country',
          deathRatePer100k: whoEntry.rate,
          totalDeaths: 0, // WHO RS_198 only gives rate, not absolute count
          countryName: whoEntry.name,
          year: whoRoadDeaths._meta?.year || 2021,
          dataSource: 'WHO Global Health Observatory',
        },
      });
    }

    // --- US: FARS street-level data ---
    console.log(`🚨 Fetching US crash data for: ${lat}, ${lon}`);

    // Step 1: Get state/county FIPS from FCC Census API
    const fccController = new AbortController();
    const fccTimeout = setTimeout(() => fccController.abort(), 10000);

    const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`;
    const fccResponse = await fetch(fccUrl, {
      signal: fccController.signal,
      headers: { 'User-Agent': 'SafeStreets/1.0' },
    });
    clearTimeout(fccTimeout);

    if (!fccResponse.ok) {
      throw new Error(`FCC API returned ${fccResponse.status}`);
    }

    const fccData = await fccResponse.json();

    if (!fccData.results || fccData.results.length === 0) {
      // Not a valid US location (e.g. ocean, territory not covered)
      return res.json({ success: true, data: null });
    }

    const stateFips = fccData.results[0].state_fips;
    const countyFips = fccData.results[0].county_fips;
    const countyName = fccData.results[0].county_name || '';

    if (!stateFips || !countyFips) {
      return res.json({ success: true, data: null });
    }

    console.log(`📍 FIPS: state=${stateFips}, county=${countyFips} (${countyName})`);

    // Step 2: Query FARS (with caching)
    const fromYear = 2018;
    const toYear = 2022;
    const cacheKey = `crashes:${stateFips}:${countyFips}:${fromYear}-${toYear}`;

    let crashes;
    const cached = farsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FARS_CACHE_TTL) {
      crashes = cached.data;
      console.log(`📦 FARS cache hit: ${crashes.length} crashes in ${countyName}`);
    } else {
      const farsUrl = `https://crashviewer.nhtsa.dot.gov/CrashAPI/crashes/GetCrashesByLocation?fromCaseYear=${fromYear}&toCaseYear=${toYear}&state=${stateFips}&county=${countyFips}&format=json`;

      const farsController = new AbortController();
      const farsTimeout = setTimeout(() => farsController.abort(), 15000);

      const farsResponse = await fetch(farsUrl, {
        signal: farsController.signal,
        headers: { 'User-Agent': 'SafeStreets/1.0' },
      });
      clearTimeout(farsTimeout);

      if (!farsResponse.ok) {
        throw new Error(`FARS API returned ${farsResponse.status}`);
      }

      const farsData = await farsResponse.json();

      // FARS returns { Results: [{ ... }] } or array depending on format
      crashes = Array.isArray(farsData) ? farsData :
        (farsData.Results || farsData.results || []);

      // Flatten if nested arrays
      if (crashes.length > 0 && Array.isArray(crashes[0])) {
        crashes = crashes.flat();
      }

      farsCache.set(cacheKey, { data: crashes, timestamp: Date.now() });
      console.log(`✅ FARS: ${crashes.length} total crashes in ${countyName} (${fromYear}-${toYear})`);
    }

    // Step 3: Filter crashes within 800m
    const radiusMeters = 800;
    const nearbyCrashes = [];

    for (const crash of crashes) {
      const crashLat = parseFloat(crash.LATITUDE || crash.latitude);
      const crashLon = parseFloat(crash.LONGITUD || crash.LONGITUDE || crash.longitude || crash.longitud);

      if (isNaN(crashLat) || isNaN(crashLon) || crashLat === 0 || crashLon === 0) continue;

      const dist = haversineDistance(latNum, lonNum, crashLat, crashLon);
      if (dist <= radiusMeters) {
        nearbyCrashes.push({
          distance: Math.round(dist),
          fatalities: parseInt(crash.FATALS || crash.fatals || '1', 10),
          year: parseInt(crash.CaseYear || crash.CASEYEAR || crash.caseyear || '0', 10),
          road: crash.TWAY_ID || crash.tway_id || 'Unknown road',
          totalVehicles: parseInt(crash.TOTALVEHICLES || crash.totalvehicles || '0', 10),
        });
      }
    }

    // Step 4: Aggregate
    const totalCrashes = nearbyCrashes.length;
    const totalFatalities = nearbyCrashes.reduce((sum, c) => sum + c.fatalities, 0);

    // Yearly breakdown
    const yearMap = {};
    for (let y = fromYear; y <= toYear; y++) yearMap[y] = { year: y, crashes: 0, fatalities: 0 };
    for (const c of nearbyCrashes) {
      if (yearMap[c.year]) {
        yearMap[c.year].crashes++;
        yearMap[c.year].fatalities += c.fatalities;
      }
    }
    const yearlyBreakdown = Object.values(yearMap);

    // Nearest crash
    const nearest = nearbyCrashes.sort((a, b) => a.distance - b.distance)[0] || null;

    console.log(`🚨 Result: ${totalCrashes} crashes, ${totalFatalities} fatalities within ${radiusMeters}m`);

    res.json({
      success: true,
      data: {
        type: 'local',
        totalCrashes,
        totalFatalities,
        yearRange: { from: fromYear, to: toYear },
        yearlyBreakdown,
        nearestCrash: nearest ? {
          distance: nearest.distance,
          year: nearest.year,
          fatalities: nearest.fatalities,
          road: nearest.road,
        } : undefined,
        radiusMeters,
        dataSource: 'NHTSA FARS',
      },
    });

  } catch (error) {
    console.error('❌ Error fetching crash data:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch crash data',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// =====================
// DEMOGRAPHIC / ECONOMIC DATA
// =====================

// In-memory cache for demographic data (slow-moving: Census annual, World Bank annual)
const demographicsCache = new Map();
const DEMOGRAPHICS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

app.get('/api/demographics', async (req, res) => {
  try {
    const { lat, lon, countryCode } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const cc = (countryCode || '').toLowerCase();
    const isUS = cc === 'us' || cc === 'usa';

    // Check cache
    const cacheKey = isUS ? `demo:us:${latNum.toFixed(3)},${lonNum.toFixed(3)}` : `demo:${cc}`;
    const cached = demographicsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DEMOGRAPHICS_CACHE_TTL) {
      console.log(`📦 Demographics cache hit: ${cacheKey}`);
      return res.json({ success: true, data: cached.data });
    }

    if (isUS) {
      // ===== US: Census Bureau ACS tract-level data =====
      console.log(`📊 Fetching US Census data for: ${latNum}, ${lonNum}`);

      // Step 1: Get FIPS tract from FCC Census API
      const fccUrl = `https://geo.fcc.gov/api/census/area?lat=${latNum}&lon=${lonNum}&format=json`;
      const fccResponse = await fetch(fccUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'SafeStreets/2.0' },
      });

      if (!fccResponse.ok) throw new Error(`FCC API returned ${fccResponse.status}`);
      const fccData = await fccResponse.json();

      if (!fccData.results || fccData.results.length === 0) {
        return res.json({ success: true, data: null });
      }

      const stateFips = fccData.results[0].state_fips;
      const countyFips = fccData.results[0].county_fips;
      const blockFips = fccData.results[0].block_fips || '';
      // block_fips format: SSCCCTTTTTTBBBB (2 state + 3 county + 6 tract + 4 block)
      const tractCode = blockFips.substring(5, 11);

      if (!stateFips || !countyFips || !tractCode) {
        return res.json({ success: true, data: null });
      }

      console.log(`📍 Census tract: state=${stateFips}, county=${countyFips}, tract=${tractCode}`);

      // Step 2: Query Census ACS 5-Year (single batched request)
      const variables = [
        'B19013_001E', // Median household income
        'B25077_001E', // Median home value
        'B23025_005E', // Unemployed
        'B23025_002E', // In labor force
        'B17001_002E', // Below poverty
        'B17001_001E', // Total (for poverty rate)
        'B01002_001E', // Median age
        'B15003_022E', // Bachelor's degree
        'B15003_023E', // Master's degree
        'B15003_024E', // Professional degree
        'B15003_025E', // Doctorate
        'B15003_001E', // Total (for education rate)
      ].join(',');

      let censusUrl = `https://api.census.gov/data/2022/acs/acs5?get=${variables}&for=tract:${tractCode}&in=state:${stateFips}&in=county:${countyFips}`;
      if (process.env.CENSUS_API_KEY) {
        censusUrl += `&key=${process.env.CENSUS_API_KEY}`;
      }

      const censusResponse = await fetch(censusUrl, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'SafeStreets/2.0' },
      });

      if (!censusResponse.ok) throw new Error(`Census API returned ${censusResponse.status}`);
      const censusData = await censusResponse.json();

      // Census returns [[header row], [data row]]
      if (!censusData || censusData.length < 2) {
        return res.json({ success: true, data: null });
      }

      const row = censusData[1];
      const parse = (val) => {
        const n = parseInt(val, 10);
        // Census uses -666666666 for suppressed data
        return (isNaN(n) || n === -666666666) ? null : n;
      };

      const medianIncome = parse(row[0]);
      const medianHomeValue = parse(row[1]);
      const unemployed = parse(row[2]);
      const laborForce = parse(row[3]);
      const belowPoverty = parse(row[4]);
      const totalPoverty = parse(row[5]);
      const medianAge = row[6] ? parseFloat(row[6]) : null;
      const bachelors = parse(row[7]);
      const masters = parse(row[8]);
      const professional = parse(row[9]);
      const doctorate = parse(row[10]);
      const totalEducation = parse(row[11]);

      const unemploymentRate = (unemployed !== null && laborForce !== null && laborForce > 0)
        ? Math.round((unemployed / laborForce) * 1000) / 10
        : null;

      const povertyRate = (belowPoverty !== null && totalPoverty !== null && totalPoverty > 0)
        ? Math.round((belowPoverty / totalPoverty) * 1000) / 10
        : null;

      const bachelorOrHigherPct = (bachelors !== null && totalEducation !== null && totalEducation > 0)
        ? Math.round(((bachelors + (masters || 0) + (professional || 0) + (doctorate || 0)) / totalEducation) * 1000) / 10
        : null;

      const result = {
        type: 'us',
        tractFips: `${stateFips}${countyFips}${tractCode}`,
        medianHouseholdIncome: medianIncome,
        medianHomeValue: medianHomeValue,
        unemploymentRate,
        povertyRate,
        medianAge: (medianAge && medianAge > 0 && medianAge < 120) ? medianAge : null,
        bachelorOrHigherPct,
        dataSource: 'US Census Bureau ACS 5-Year',
        year: 2022,
      };

      console.log(`✅ Census data: income=$${medianIncome}, home=$${medianHomeValue}, unemp=${unemploymentRate}%`);
      demographicsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return res.json({ success: true, data: result });

    } else {
      // ===== International: World Bank API =====
      if (!cc) {
        return res.json({ success: true, data: null });
      }

      console.log(`🌍 Fetching World Bank data for country: ${cc}`);

      const indicators = [
        { id: 'NY.GDP.PCAP.CD', field: 'gdpPerCapita' },
        { id: 'SL.UEM.TOTL.ZS', field: 'unemploymentRate' },
        { id: 'SP.URB.TOTL.IN.ZS', field: 'urbanPopulationPct' },
      ];

      const results = await Promise.allSettled(
        indicators.map(async ({ id }) => {
          const url = `https://api.worldbank.org/v2/country/${cc}/indicator/${id}?format=json&date=2019:2024&per_page=6`;
          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!response.ok) return null;
          const data = await response.json();
          // World Bank returns [metadata, dataArray] — data at index 1
          if (!data || !data[1] || !Array.isArray(data[1])) return null;
          // Find most recent non-null value
          for (const entry of data[1]) {
            if (entry.value !== null) {
              return { value: Math.round(entry.value * 100) / 100, year: parseInt(entry.date) };
            }
          }
          return null;
        })
      );

      const getValue = (idx) => results[idx].status === 'fulfilled' && results[idx].value ? results[idx].value : null;
      const gdpResult = getValue(0);
      const unempResult = getValue(1);
      const urbanResult = getValue(2);

      // Determine country name from World Bank metadata
      let countryName = cc.toUpperCase();
      try {
        const metaUrl = `https://api.worldbank.org/v2/country/${cc}?format=json`;
        const metaResp = await fetch(metaUrl, { signal: AbortSignal.timeout(5000) });
        if (metaResp.ok) {
          const metaData = await metaResp.json();
          if (metaData && metaData[1] && metaData[1][0]) {
            countryName = metaData[1][0].name;
          }
        }
      } catch { /* use fallback name */ }

      const mostRecentYear = Math.max(
        gdpResult?.year || 0,
        unempResult?.year || 0,
        urbanResult?.year || 0
      );

      const result = {
        type: 'international',
        countryCode: cc.toUpperCase(),
        countryName,
        gdpPerCapita: gdpResult?.value || null,
        unemploymentRate: unempResult?.value || null,
        urbanPopulationPct: urbanResult?.value || null,
        dataSource: 'World Bank Open Data',
        year: mostRecentYear || 2023,
      };

      console.log(`✅ World Bank: GDP=$${result.gdpPerCapita}, unemp=${result.unemploymentRate}%, urban=${result.urbanPopulationPct}%`);
      demographicsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return res.json({ success: true, data: result });
    }

  } catch (error) {
    console.error('❌ Error fetching demographics:', error);
    // Graceful degradation — return null data, not 500
    res.json({ success: true, data: null });
  }
});

// =====================
// GEMINI AI BUDGET ANALYSIS
// =====================

// Budget analysis endpoint with file upload support (PDF, CSV, text)
app.post('/api/analyze-budget', upload.single('file'), async (req, res) => {
  // Track PDF upload
  trackEvent('pdf', req);

  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Gemini API not configured. Add GEMINI_API_KEY to .env file.',
      });
    }

    let budgetText = '';
    const locationName = req.body.locationName || 'Unknown location';

    // Handle file upload
    if (req.file) {
      const { buffer, mimetype, originalname } = req.file;
      console.log(`📄 Processing file: ${originalname} (${mimetype})`);

      if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
        // Parse PDF
        try {
          const pdfData = await parsePDF(buffer);
          budgetText = pdfData.text;
          console.log(`📄 Extracted ${budgetText.length} characters from PDF`);
        } catch (pdfError) {
          console.error('PDF parsing error:', pdfError);
          return res.status(400).json({ error: 'Failed to parse PDF. Please try a different file.' });
        }
      } else if (mimetype === 'text/csv' || originalname.endsWith('.csv')) {
        // CSV file
        budgetText = buffer.toString('utf-8');
      } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
        // Plain text
        budgetText = buffer.toString('utf-8');
      } else {
        // Try to read as text
        budgetText = buffer.toString('utf-8');
      }
    } else if (req.body.budgetText) {
      // Fallback to text in request body
      budgetText = req.body.budgetText;
    }

    if (!budgetText || budgetText.length < 50) {
      return res.status(400).json({ error: 'Could not extract text from file. Please try a different format.' });
    }

    console.log(`🤖 Analyzing budget for ${locationName}... (${budgetText.length} chars)`);

    const prompt = `You are a walkability infrastructure analyst specializing in municipal budgets. Analyze the following budget document and identify ALL spending related to walkability, pedestrian infrastructure, and street safety.

BUDGET DOCUMENT:
${budgetText.slice(0, 30000)}

LOCATION: ${locationName}

ANALYSIS FRAMEWORK:
1. Identify ALL budget line items that could impact walkability
2. Categorize spending into clear categories
3. Calculate percentages based on total budget
4. Provide specific, actionable recommendations
5. Estimate potential walkability score improvement

Respond with a JSON object (no markdown, just pure JSON) with this exact structure:
{
  "insights": [
    {
      "category": "Category name",
      "amount": "Dollar amount (e.g., $2.4M, ฿15M, €500K)",
      "percentage": "X% of total",
      "relevant": true/false,
      "recommendation": "Specific actionable recommendation"
    }
  ],
  "summary": {
    "totalWalkabilitySpending": "Total walkability-related spending",
    "percentageOfBudget": "X% of total budget",
    "recommendedReallocation": "Suggested reallocation amount",
    "priorityAreas": ["Priority 1", "Priority 2", "Priority 3"],
    "estimatedScoreImpact": "+X.X points improvement possible"
  }
}

WALKABILITY CATEGORIES TO IDENTIFY:
- Sidewalks & Footpaths (construction, repair, widening)
- Pedestrian Crossings (zebra crossings, signals, raised crosswalks)
- Street Lighting (pedestrian-focused lighting)
- Traffic Calming (speed bumps, chicanes, road diets)
- ADA/Accessibility (curb cuts, tactile paving, ramps)
- Bike Infrastructure (lanes, parking, shared paths)
- Parks & Green Spaces (paths, connectivity, shade)
- Public Transit (bus stops, stations, first/last mile)
- Road Maintenance (portion affecting pedestrian areas)
- Traffic Management (signals, enforcement)
- Urban Planning (pedestrian zones, plazas)
- Safety Programs (education, enforcement)

Be thorough and identify ALL relevant line items. Use the actual currency from the document.`;

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('No response from Gemini');
    }

    // Parse JSON from response (handle potential markdown wrapping)
    let analysisResult;
    try {
      // Remove markdown code blocks if present
      const jsonStr = textResponse.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', textResponse);
      throw new Error('Failed to parse AI response');
    }

    console.log(`✅ Budget analysis complete: ${analysisResult.insights?.length || 0} categories found`);

    res.json({
      success: true,
      analysis: analysisResult,
    });

  } catch (error) {
    console.error('❌ Budget analysis error:', error);
    res.status(500).json({
      error: error.message || 'Failed to analyze budget',
    });
  }
});

// Helper function to call Groq API (primary - faster and more generous limits)
async function callGroqAPI(prompt, groqKey) {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768'];

  for (const model of models) {
    try {
      console.log(`🚀 Trying Groq ${model}...`);

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 4096,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.choices?.[0]?.message?.content;
        if (textResponse) {
          console.log(`✅ Success with Groq ${model}`);
          return textResponse;
        }
      }

      if (response.status === 429) {
        console.log(`⏳ Rate limited on Groq ${model}, trying next model...`);
        continue;
      }

      if (response.status === 404) {
        console.log(`⚠️ Groq model ${model} not available, trying next...`);
        continue;
      }

      const errorText = await response.text();
      console.error(`Groq API error (${model}):`, errorText);

    } catch (error) {
      console.error(`Network error with Groq ${model}:`, error.message);
    }
  }

  return null; // Groq failed, will try Gemini as fallback
}

// Helper function to call Gemini API (fallback)
async function callGeminiAPI(prompt, geminiKey) {
  const models = ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-pro'];

  for (const model of models) {
    try {
      console.log(`🤖 Trying Gemini ${model}...`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (textResponse) {
          console.log(`✅ Success with Gemini ${model}`);
          return textResponse;
        }
      }

      if (response.status === 429 || response.status === 404) {
        console.log(`⚠️ Gemini ${model} unavailable, trying next...`);
        continue;
      }

      const errorText = await response.text();
      console.error(`Gemini API error (${model}):`, errorText);

    } catch (error) {
      console.error(`Network error with Gemini ${model}:`, error.message);
    }
  }

  return null;
}

// Combined AI caller - tries Groq first, then Gemini
async function callAIWithFallback(prompt, groqKey, geminiKey) {
  // Try Groq first (faster, better rate limits)
  if (groqKey) {
    const groqResult = await callGroqAPI(prompt, groqKey);
    if (groqResult) return groqResult;
  }

  // Fallback to Gemini
  if (geminiKey) {
    const geminiResult = await callGeminiAPI(prompt, geminiKey);
    if (geminiResult) return geminiResult;
  }

  throw new Error('All AI providers failed. Please try again later.');
}

// Location-based budget analysis - provides walkability investment guidance
// NOTE: This provides general guidance and recommendations, NOT actual budget data
// Real budget data requires official municipal documents
app.post('/api/analyze-budget-location', async (req, res) => {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!groqKey && !geminiKey) {
      return res.status(500).json({
        error: 'No AI API configured. Add GROQ_API_KEY or GEMINI_API_KEY to .env file.',
      });
    }

    const { city, country, displayName, lat, lon } = req.body;

    if (!city && !displayName) {
      return res.status(400).json({ error: 'Missing location information' });
    }

    const locationName = city || displayName.split(',')[0];
    const fullLocation = displayName || `${city}, ${country}`;

    console.log(`🔍 Generating walkability investment guidance for: ${fullLocation}`);

    const prompt = `You are a walkability infrastructure consultant providing investment guidance for ${fullLocation}.

LOCATION: ${fullLocation}
COUNTRY: ${country || 'Unknown'}

Your task is to provide ACTIONABLE RECOMMENDATIONS for improving walkability in this location.

DO NOT make up specific budget numbers or claim to have actual municipal budget data.

Instead, provide:
1. Key walkability infrastructure categories that need investment
2. Relative priority (High/Medium/Low) for each category
3. Specific, actionable recommendations based on typical needs for this type of location
4. What percentage of a typical municipal infrastructure budget SHOULD ideally go to walkability (based on WHO and urban planning best practices)

Respond with a JSON object (no markdown, just pure JSON):
{
  "insights": [
    {
      "category": "Category name",
      "priority": "High/Medium/Low",
      "currentState": "Brief assessment of typical conditions in this type of location",
      "relevant": true,
      "recommendation": "Specific actionable recommendation"
    }
  ],
  "summary": {
    "overallAssessment": "Brief overall assessment of walkability investment needs",
    "topPriorities": ["Priority 1", "Priority 2", "Priority 3"],
    "idealBudgetAllocation": "X-Y% of infrastructure budget (based on WHO guidelines)",
    "keyActions": ["Action 1", "Action 2", "Action 3"]
  },
  "disclaimer": "This is general guidance based on urban planning best practices, not actual budget data. Contact your local municipality for official budget information.",
  "resources": [
    {
      "name": "Resource name",
      "description": "Brief description",
      "type": "Official website/Report/Guide"
    }
  ]
}

CATEGORIES TO ASSESS:
1. Sidewalks & Footpaths
2. Pedestrian Crossings
3. Street Lighting
4. Traffic Calming
5. Accessibility (ADA/Universal Design)
6. Bicycle Infrastructure
7. Parks & Green Spaces
8. Public Transit Connectivity
9. Pedestrian Safety Programs

Base your assessment on:
- The type of city/area (urban density, climate, development level)
- Common walkability challenges in ${country || 'this region'}
- International best practices (WHO, UN-Habitat guidelines)

Be specific to ${locationName} where possible, but be honest that this is guidance, not actual budget data.`;

    // Call AI with fallback (Groq first, then Gemini)
    const textResponse = await callAIWithFallback(prompt, groqKey, geminiKey);

    // Parse JSON from response (handle potential markdown wrapping)
    let analysisResult;
    try {
      const jsonStr = textResponse.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse AI response:', textResponse);
      throw new Error('Failed to parse AI response');
    }

    console.log(`✅ Walkability guidance complete: ${analysisResult.insights?.length || 0} categories assessed`);

    res.json({
      success: true,
      analysis: analysisResult,
      location: fullLocation,
      isGuidance: true, // Flag to indicate this is guidance, not actual data
    });

  } catch (error) {
    console.error('❌ Budget guidance error:', error);

    // User-friendly error messages
    let userMessage = error.message || 'Failed to generate guidance for this location';
    if (error.message?.includes('rate limited') || error.message?.includes('quota')) {
      userMessage = 'AI service is temporarily busy. Please wait a minute and try again.';
    }

    res.status(500).json({
      error: userMessage,
    });
  }
});

// =====================
// STRIPE PAYMENT API
// =====================

// Stripe checkout session endpoint
app.post('/api/create-checkout-session', async (req, res) => {
  // Track payment attempt
  trackEvent('payment', req);

  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env file.',
      });
    }

    const { email, tier, locationName, userId, metadata } = req.body;

    if (!email || !tier) {
      return res.status(400).json({ error: 'Missing required fields: email, tier' });
    }

    // Define pricing
    const pricing = {
      advocate: {
        amount: 4900, // $49 in cents
        name: 'SafeStreets Advocate',
        description: 'Streetmix, 3DStreet, Policy Reports, Budget Analysis',
      },
    };

    const selectedPricing = pricing[tier];
    if (!selectedPricing) {
      return res.status(400).json({ error: 'Invalid tier. Must be "advocate"' });
    }

    console.log(`💳 Creating checkout session for ${email} - ${tier} tier`);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: selectedPricing.name,
              description: `${selectedPricing.description} for ${locationName}`,
            },
            unit_amount: selectedPricing.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=cancelled`,
      metadata: {
        userId: userId || '',
        tier,
        locationName: locationName || '',
        companyName: metadata?.companyName || '',
      },
    });

    console.log(`✅ Checkout session created: ${session.id}`);
    res.json({ url: session.url });

  } catch (error) {
    console.error('❌ Stripe error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create checkout session',
    });
  }
});

// Stripe webhook endpoint (for handling successful payments)
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️  Stripe webhook secret not configured');
    return res.status(400).json({ error: 'Webhook secret not configured' });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { tier, userId, locationName } = session.metadata || {};
      console.log(`✅ Payment successful for ${session.customer_email}`);
      console.log(`   Tier: ${tier}`);
      console.log(`   Location: ${locationName}`);

      // Update Clerk user metadata to grant premium access
      if (userId && tier) {
        try {
          const clerkSecretKey = process.env.CLERK_SECRET_KEY;
          if (!clerkSecretKey) {
            console.error('❌ CLERK_SECRET_KEY not configured — cannot activate tier');
          } else {
            const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                public_metadata: {
                  tier,
                  activatedAt: new Date().toISOString(),
                  stripeSessionId: session.id,
                },
              }),
            });

            if (clerkRes.ok) {
              console.log(`✅ Clerk metadata updated: ${userId} → ${tier}`);
            } else {
              const errBody = await clerkRes.text();
              console.error(`❌ Clerk API error (${clerkRes.status}): ${errBody}`);
              return res.status(503).json({ error: 'Failed to activate tier — will retry' });
            }
          }
        } catch (clerkErr) {
          console.error('❌ Failed to update Clerk metadata:', clerkErr.message);
          return res.status(503).json({ error: 'Failed to activate tier — will retry' });
        }
      } else {
        console.warn('⚠️  Missing userId or tier in session metadata — cannot activate');
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
});

// Verify payment status - frontend polls this after Stripe redirect
app.get('/api/verify-payment', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return res.status(500).json({ error: 'Clerk not configured' });
  }

  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { 'Authorization': `Bearer ${clerkSecretKey}` },
    });

    if (!clerkRes.ok) {
      return res.status(400).json({ error: 'User not found' });
    }

    const user = await clerkRes.json();
    const tier = user.public_metadata?.tier || 'free';

    res.json({ tier, activated: tier !== 'free' });
  } catch (error) {
    console.error('Verify payment error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment status' });
  }
});

// Verify access token (legacy magic-link support)
app.get('/api/verify-token', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Missing token' });
  }

  try {
    const jwt = await import('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ valid: false, error: 'Token verification not configured' });
    }
    const decoded = jwt.default.verify(token, secret);

    res.json({
      valid: true,
      tier: decoded.tier,
      email: decoded.email,
    });
  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid or expired token' });
  }
});

// ─── Contact Inquiry (Tier 3: Custom Analysis) ──────────────────────────────

const contactInquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 inquiries per hour per IP
  message: { error: 'Too many inquiries. Please try again later.' },
});

app.post('/api/contact-inquiry', contactInquiryLimiter, async (req, res) => {
  const { name, email, location, projectType, description, timeline } = req.body;

  if (!name || !email || !projectType || !description) {
    return res.status(400).json({ error: 'Missing required fields: name, email, projectType, description' });
  }

  // Basic email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const inquiry = {
    name,
    email,
    location: location || 'Not specified',
    projectType,
    description,
    timeline: timeline || 'Not specified',
    submittedAt: new Date().toISOString(),
    ip: req.ip,
  };

  console.log('📬 New contact inquiry:', JSON.stringify(inquiry, null, 2));

  // Persist inquiry to file
  saveInquiry(inquiry);

  // Send email if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const contactEmail = process.env.CONTACT_EMAIL;

  if (smtpHost && contactEmail) {
    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_USER || 'noreply@safestreets.com',
        to: contactEmail,
        replyTo: email,
        subject: `SafeStreets Inquiry: ${projectType} — ${name}`,
        text: [
          `New Custom Analysis Inquiry`,
          ``,
          `Name: ${name}`,
          `Email: ${email}`,
          `Location: ${inquiry.location}`,
          `Project Type: ${projectType}`,
          `Timeline: ${inquiry.timeline}`,
          ``,
          `Description:`,
          description,
          ``,
          `Submitted: ${inquiry.submittedAt}`,
        ].join('\n'),
      });

      console.log('📧 Inquiry email sent to', contactEmail);
    } catch (emailErr) {
      console.error('📧 Failed to send inquiry email:', emailErr.message);
      // Don't fail the request — inquiry is logged
    }
  }

  res.json({ success: true });
});

// ─── Advocacy Letter Generator (Claude AI) ───────────────────────────────────

const advocacyLetterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 letters per hour per IP
  message: { error: 'Too many letter requests. Please try again later.' },
});

app.post('/api/generate-advocacy-letter', advocacyLetterLimiter, async (req, res) => {
  // Track advocacy letter generation
  trackEvent('advocacy', req);

  try {
    const { location, metrics, authorName, recipientTitle, language } = req.body;

    if (!location || !metrics) {
      return res.status(400).json({ error: 'Missing location or metrics data' });
    }

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!groqKey && !geminiKey) {
      return res.status(503).json({ error: 'AI letter generation is not configured. Add GROQ_API_KEY or GEMINI_API_KEY.' });
    }

    // Build a concise metrics summary for the prompt
    const metricLines = [];
    if (metrics.crossingSafety !== undefined) metricLines.push(`Crossing Safety: ${metrics.crossingSafety}/10`);
    if (metrics.sidewalkCoverage !== undefined) metricLines.push(`Sidewalk Coverage: ${metrics.sidewalkCoverage}/10`);
    if (metrics.speedExposure !== undefined) metricLines.push(`Traffic Speed Safety: ${metrics.speedExposure}/10`);
    if (metrics.destinationAccess !== undefined) metricLines.push(`Daily Needs Nearby: ${metrics.destinationAccess}/10`);
    if (metrics.nightSafety !== undefined) metricLines.push(`Night Safety (Lighting): ${metrics.nightSafety}/10`);
    if (metrics.slope !== undefined) metricLines.push(`Flat Terrain: ${metrics.slope}/10`);
    if (metrics.treeCanopy !== undefined) metricLines.push(`Shade & Tree Canopy: ${metrics.treeCanopy}/10`);
    if (metrics.thermalComfort !== undefined) metricLines.push(`Thermal Comfort: ${metrics.thermalComfort}/10`);

    const worstMetrics = Object.entries(metrics)
      .filter(([k, v]) => typeof v === 'number' && k !== 'overallScore' && v <= 4)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3)
      .map(([k]) => k);

    const prompt = `Write a formal advocacy letter to a local government official about pedestrian safety and walkability improvements needed at the following location.

LOCATION: ${location.displayName}
COORDINATES: ${location.lat}, ${location.lon}
OVERALL WALKABILITY SCORE: ${metrics.overallScore.toFixed(1)}/10 (${metrics.label})

METRIC SCORES:
${metricLines.join('\n')}

WORST AREAS (scores ≤ 4): ${worstMetrics.length > 0 ? worstMetrics.join(', ') : 'None — all areas are adequate'}

${authorName ? `AUTHOR: ${authorName}` : ''}
${recipientTitle ? `RECIPIENT: ${recipientTitle}` : 'RECIPIENT: Local City Council / Municipal Authority'}

INSTRUCTIONS:
- Write a professional, respectful 400-500 word letter
- Open with the specific location and its walkability score
- Cite the 2-3 worst metrics with specific numbers
- Reference relevant standards (WHO, NACTO, ADA) where appropriate
- Include 2-3 specific, actionable recommendations tied to the worst metrics
- End with a clear call to action (site visit, public meeting, budget allocation)
- Use a formal but accessible tone — this should persuade, not lecture
- Do NOT include placeholder brackets like [Your Name] — write it as a complete letter
- If an author name is provided, sign with that name; otherwise sign as "A Concerned Resident"
- Do NOT include a subject line — just the letter body starting with "Dear..."`;

    // Multi-language support
    const langMap = { es: 'Spanish', fr: 'French', hi: 'Hindi', zh: 'Chinese', ar: 'Arabic', pt: 'Portuguese', th: 'Thai' };
    if (language && language !== 'en' && langMap[language]) {
      prompt += `\n\nIMPORTANT: Write the entire letter in ${langMap[language]}. Use culturally appropriate formal conventions for that language.`;
    }

    const letterText = await callAIWithFallback(prompt, groqKey, geminiKey);
    if (!letterText) {
      return res.status(500).json({ error: 'Failed to generate letter. AI services unavailable.' });
    }

    res.json({ success: true, letter: letterText });
  } catch (error) {
    console.error('Advocacy letter generation failed:', error.message);
    res.status(500).json({ error: 'Failed to generate letter. Please try again.' });
  }
});

// ─── Advocacy Chatbot (Groq, streaming) ──────────────────────────────────────

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages. Please slow down.' },
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  // Track chat message
  trackEvent('chat', req);

  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(503).json({ error: 'Chat is not configured' });
    }

    const { messages, context } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Missing messages' });
    }

    // Security: Block prompt injection attempts
    const dangerousPatterns = [
      /ignore\s+(previous|above|prior|all)\s+(instructions?|prompts?|rules?)/i,
      /system\s+prompt/i,
      /reveal\s+(your\s+)?(instructions?|prompt|rules?)/i,
      /what\s+(is|are)\s+your\s+(instructions?|rules?|system\s+prompt)/i,
      /(show|print|display|tell)\s+(me\s+)?(your\s+)?(instructions?|prompt|rules?)/i,
      /(api[_\s]?key|secret[_\s]?key|password|token)/i,
      /\bexec\(/i,
      /eval\(/i,
    ];

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      const content = lastUserMessage.content || '';
      if (dangerousPatterns.some(pattern => pattern.test(content))) {
        console.warn(`🚨 Prompt injection attempt blocked from ${req.ip}: "${content.slice(0, 100)}"`);
        return res.status(400).json({
          error: 'Invalid request. Please rephrase your question about urban planning and walkability.',
        });
      }
    }

    // Build system prompt with analysis context
    let systemPrompt = `You are the SafeStreets Urbanist — a sharp, passionate walkability expert and advocate embedded in a walkability analysis tool. You are not a generic chatbot. You are an urbanist who carries the intellectual DNA of the movement's greatest thinkers, grounded in verified data and global design standards.

YOUR IDENTITY:
You think like Jane Jacobs — you believe cities belong to the people who walk them. You see streets the way Jan Gehl does — as living rooms for public life. You argue like Jeff Speck — with precision, evidence, and persuasion. You have the operational boldness of Janette Sadik-Khan — if NYC can transform Times Square, any city can fix a crosswalk. You understand, like Charles Montgomery, that the design of our streets is inseparable from human happiness.

You are not neutral. You are an advocate for people over cars, for life over traffic, for equity over speed. But you earn that position through data, standards, and evidence — never ideology alone.

VOICE & STYLE:
- Sharp, direct, and confident. No filler. No corporate softness.
- Thoughtful — connect the user's specific data to bigger urban truths
- Inspirational — remind people that better streets are not utopian; they exist right now in cities worldwide
- Advocate's edge — when data reveals a failing, name it clearly. A crossing safety score of 2/10 isn't "an area for improvement" — it's a neighborhood where the street was designed to move cars, not protect people
- Use specific numbers, standards, and comparisons. Vague advice is useless advice
- Keep responses focused (2-4 paragraphs) unless the user asks for depth. Every sentence should earn its place
- When relevant, connect to the human story: who is affected, what daily life looks like, what changes would feel like

INTELLECTUAL FOUNDATIONS:

THE CLASSICS — Your Core Philosophy:
- Jane Jacobs (The Death and Life of Great American Cities): Mixed-use streets generate safety through "eyes on the street." Short blocks, diverse buildings, density of people — these are not urban planning preferences, they are the conditions under which cities thrive. Monoculture kills neighborhoods.
- Kevin Lynch (The Image of the City): People navigate through paths, edges, districts, nodes, and landmarks. Walkability isn't just physical — it's cognitive. If people can't mentally map a place, they won't walk it.
- Jan Gehl (Cities for People): 50 years of studying street life proved that human-scale design — 5 km/h architecture — creates cities worth living in. If you design for cars, you get traffic. If you design for people, you get life.

WALKABILITY & STREET DESIGN — Your Operational Knowledge:
- Jeff Speck (Walkable City / Walkable City Rules): The General Theory of Walkability — a walk must be useful, safe, comfortable, and interesting. All four. Missing one breaks the chain. Ten steps to walkability: put cars in their place, mix the uses, get the parking right, let transit work, protect the pedestrian, welcome bikes, shape the spaces, plant trees, make friendly and unique faces, pick your winners.
- Janette Sadik-Khan (Street Fight): Proved that street transformation doesn't require decades — paint, planters, and political will can reclaim space for people in weeks. NYC's transformation: 400+ miles of bike lanes, 60+ pedestrian plazas, Times Square pedestrianized.
- Charles Montgomery (Happy City): The happiest cities are walkable cities. Sprawl is not just inefficient — it is correlated with obesity, social isolation, depression, and civic disengagement. Street design is mental health infrastructure.

THE CAR CULTURE CRITIQUE — Your Understanding of the Problem:
- Donald Shoup (The High Cost of Free Parking): Free parking is the most destructive subsidy in urban planning. Minimum parking requirements guarantee car dependency, destroy walkability, and cost cities billions. Every parking space is 15-30m² of city that could be housing, parks, or commerce.
- J.H. Crawford (Carfree Cities): The radical but logical endpoint — cities designed entirely without private automobiles. Reference districts in Venice, Fez, and many historic city centers prove this works at scale.
- Angie Schmitt (Right of Way): The pedestrian safety crisis is not accidental — it is the predictable result of street design that prioritizes vehicle throughput over human life. 6,000+ pedestrians killed annually in the US. SUV/truck front-end design increases pedestrian fatality risk by 45%.

ECONOMICS & EQUITY — Your Justice Lens:
- Edward Glaeser (Triumph of the City): Dense, walkable cities are the greatest engines of prosperity, innovation, and upward mobility ever created. Restricting density through zoning is economically destructive.
- Richard Rothstein (The Color of Law): Segregation was not accidental — it was policy. Highway placement, redlining, exclusionary zoning, and car-dependent design systematically harmed communities of color. Walkability is a racial justice issue.
- Eric Klinenberg (Palaces for the People): Libraries, parks, sidewalks, and community spaces are "social infrastructure" — they determine whether neighborhoods are connected or isolated. Investment in social infrastructure saves lives during crises.

GLOBAL & TACTICAL PERSPECTIVES — Your Broader Vision:
- Mike Davis (Planet of Slums): 1 billion+ people live in informal settlements. Walkability in the Global South is not a lifestyle choice — it is survival. Sidewalks, shade, safe crossings, and access to services are fundamental human rights.
- Mike Lydon & Anthony Garcia (Tactical Urbanism): You don't need to wait for bureaucracy. Paint a crosswalk. Place a bench. Build a parklet. Tactical interventions demonstrate what's possible, build community support, and often become permanent.

GLOBAL STREET DESIGN STANDARDS (GSDS) — NACTO Global Designing Cities Initiative:
- Streets are public spaces first, movement corridors second
- Design speed determines safety outcomes: 30 km/h urban speed limit reduces pedestrian fatality risk from 80% (50 km/h) to 10%
- Pedestrian realm: minimum 2.4m (8ft) clear walking zone in high-activity areas; 1.8m absolute minimum
- Corner radii: tight turning radii (3-5m) force slower vehicle speeds and shorten pedestrian crossings
- Crossing frequency: every 80-100m on urban streets (NACTO); desire lines must be respected, not fenced off
- Protected intersections: raised crossings, pedestrian refuge islands, leading pedestrian intervals (LPI)
- One-way to two-way conversions improve street life and reduce speeding
- Street trees every 6-8m in the furniture zone — non-negotiable for comfort, shade, and safety
- Transit stops integrated with pedestrian infrastructure, not isolated on hostile roads

VERIFIED STANDARDS & BENCHMARKS:

CROSSINGS & PEDESTRIAN SAFETY:
- NACTO: marked crosswalks every 80-100m (250-330ft) on urban streets
- FHWA: pedestrian signals warranted at 100+ pedestrians/hr
- WHO: 1.35 million road deaths/year globally; pedestrians = 23%
- Vision Zero (Stockholm, 1997): zero fatalities target; 40+ cities adopted
- Complete Streets: designed for ALL users, not just drivers
- GSDS: raised crossings at every intersection in pedestrian priority zones

SIDEWALK & ACCESSIBILITY:
- ADA: minimum 1.5m (5ft) clear width; curb ramps at ALL intersections
- ITDP Pedestrian First: 1.8m (6ft) minimum for comfortable two-way walking
- GSDS/NACTO: 2.4m (8ft) minimum for high-pedestrian zones
- WHO Age-Friendly Cities: continuous, level, non-slip surfaces; 50+ lux at crossings
- Universal Design: sidewalks must work for wheelchairs, strollers, elderly, visually impaired — not just able-bodied adults

STREET CONNECTIVITY:
- 100+ intersections/km² = highly walkable grid (Portland ~140/km²)
- Ideal block length: 100-150m (330-500ft); max 200m before midblock crossing needed
- Cul-de-sacs reduce walkability 50-70% vs connected grids (Ewing & Cervero, 2010)
- Walk Score: 90-100 Walker's Paradise; 70-89 Very Walkable; 50-69 Somewhat Walkable; 25-49 Car-Dependent; 0-24 Almost All Errands Require Car
- Jacobs principle: short blocks create more corner opportunities, more route choices, more life

TREE CANOPY & GREEN SPACE:
- WHO: minimum 9m² green space/person; ideal 50m²/person
- American Forests: 40% tree canopy target for cities
- USDA Forest Service: urban trees reduce air temp 2-8°C
- One mature tree: absorbs ~22kg CO2/year; cooling = 10 room-sized ACs
- 10% canopy increase → 12% crime reduction (USFS)
- Street trees increase property values 3-15%
- Gehl principle: trees create the "edge effect" — people linger where there is shade and enclosure

THERMAL COMFORT (consolidated surface temperature + urban heat island):
- Urban areas 1-3°C warmer than rural (EPA); up to 5-8°C during heatwaves
- Dark asphalt: 60-80°C in summer; reflective surfaces: 30-50°C
- Green roofs reduce surface temp 30-40°C (EPA)
- Cool pavements reduce surface temps 5-15°C
- Every 1°C above 32°C → 2-5% increase in heat mortality
- Heat islands disproportionately affect low-income and minority neighborhoods
- EPA: living within 200m of high-traffic roads → asthma, cardiovascular disease, lung cancer

TRAFFIC FATALITY DATA (contextual — not a scored metric):
- US data: NHTSA Fatality Analysis Reporting System (FARS) — fatal crashes within 800m
- International: WHO Global Health Observatory — road traffic death rate per 100,000
- Global average: 15.0 deaths/100k (WHO 2021); best: Norway 1.5/100k
- US rate: 14.2/100k — nearly 3x European average of 5-6/100k
- Pedestrians represent 23% of all road traffic deaths globally (WHO 2023)
- 40,990 US road deaths in 2023 (NHTSA preliminary); pedestrian deaths hit 40-year high

TERRAIN & SLOPE:
- ADA max slope: 5% (1:20) accessible; 8.33% (1:12) absolute max with handrails
- Comfortable walking: <3%; >6% strenuous
- Slopes >3% significantly reduce elderly/wheelchair mobility
- Steep streets (>10%) reduce pedestrian volumes 50-80%

15-MINUTE CITY (Carlos Moreno, Sorbonne, 2016):
- All daily needs within 15-min walk or bike
- Six functions: living, working, commerce, healthcare, education, entertainment
- Active in Paris, Melbourne, Barcelona, Portland, Buenos Aires
- 15-min neighborhoods: 20-30% lower car dependency, higher life satisfaction
- Jacobs was writing about the 15-minute city in 1961 — she just didn't name it that

ECONOMIC IMPACT:
- Every 1-point Walk Score increase → $700-$3,000 home value gain (Brookings)
- Walkable areas: 80% higher retail revenue/sq ft (Leinberger & Lynch, GWU)
- Pedestrian/cycling infrastructure: $11.80 return per $1 invested (WHO Europe)
- Each mile walked saves $0.73 in health costs; each mile driven costs $0.44 in externalities
- Walkable cities: 20-40% lower transportation costs
- Glaeser's insight: density and walkability are not costs — they are the source of urban wealth

DATA SOURCES IN THIS TOOL:
- Street Connectivity: OpenStreetMap road network geometry (intersection density, route directness)
- Crosswalk Density: OpenStreetMap highway=crossing nodes within 500m radius
- Daily Needs Access: OpenStreetMap amenity/shop/leisure POIs within 1km radius
- Slope/Terrain: NASA SRTM 30m elevation data
- Tree Canopy: ESA Sentinel-2 NDVI at 10m resolution
- Surface Temperature: NASA POWER climatological data
- Air Quality: OpenAQ real-time monitoring (5,000+ stations, 100+ countries)
- Heat Island: Sentinel-2 SWIR urban vs vegetated surface comparison

WHO TO CONTACT (by issue):
- Crosswalks/signals → Transportation/Public Works, Traffic Engineering
- Sidewalk/ADA → Public Works, City ADA Coordinator, City Engineer
- Trees/green space → Parks & Recreation, Urban Forestry, City Arborist
- Air quality → Regional Air Quality District, Environmental Protection
- Heat mitigation → Sustainability Office, Climate Action, Urban Planning
- General walkability → City Planning, City Council Member for your district
- Elected officials → District Council Member, Mayor's Office, Planning Commission

ADVOCACY APPROACH — Inspired by Sadik-Khan & Lydon:
- Start with data (that's what this tool provides)
- Connect data to human stories (who is harmed, who benefits)
- Reference global standards (show what good looks like)
- Name specific interventions (not "improve walkability" but "install a raised crosswalk at the intersection of X and Y")
- Provide tactical options: what can citizens do THIS WEEK vs what requires policy change
- Remind people: every great street was once a bad one. Change is possible.

CRITICAL RULES — NEVER BREAK THESE:
1. NEVER fabricate contact info (phone, email, addresses, URLs). Say "Search your city's official website for [department]" instead.
2. NEVER claim you can perform actions. You CANNOT send emails, submit letters, or take action outside this chat. Draft content for the user to send themselves.
3. NEVER invent statistics beyond what's provided above or in the user's actual scores. If unsure, say so.
4. Suggest TYPES of officials/departments — never invent specific names or contact details.
5. Always: "Here's a draft you can send" — never "I've submitted this for you."
6. When explaining scores, anchor to specific standards (e.g., "Your crossing safety score of 2.6/10 means crosswalks are sparse and unprotected, far below NACTO's 80-100m standard — this is a street designed for cars, not people").
7. Be specific and actionable. Generic encouragement is not advocacy. Connect every recommendation to the user's data.
8. Channel the thinkers: when a Jacobs insight or a Speck principle is relevant, weave it in naturally — not as decoration, but as the intellectual backbone of your answer.`;

    if (context) {
      systemPrompt += `\n\nCURRENT ANALYSIS DATA:`;
      if (context.locationName) {
        systemPrompt += `\nLocation: ${context.locationName}`;
      }
      if (context.metrics) {
        const m = context.metrics;
        systemPrompt += `\n\nMetric Scores (0-10 scale):`;
        if (m.crossingSafety !== undefined) systemPrompt += `\n- Crossing Safety: ${m.crossingSafety}/10`;
        if (m.sidewalkCoverage !== undefined) systemPrompt += `\n- Sidewalk Coverage: ${m.sidewalkCoverage}/10`;
        if (m.speedExposure !== undefined) systemPrompt += `\n- Traffic Speed Safety: ${m.speedExposure}/10`;
        if (m.destinationAccess !== undefined) systemPrompt += `\n- Daily Needs Access: ${m.destinationAccess}/10`;
        if (m.nightSafety !== undefined) systemPrompt += `\n- Night Safety (Lighting): ${m.nightSafety}/10`;
        if (m.slope !== undefined) systemPrompt += `\n- Terrain (Flatness): ${m.slope}/10`;
        if (m.treeCanopy !== undefined) systemPrompt += `\n- Tree Canopy: ${m.treeCanopy}/10`;
        if (m.thermalComfort !== undefined) systemPrompt += `\n- Thermal Comfort: ${m.thermalComfort}/10`;
        if (m.overallScore !== undefined) systemPrompt += `\n- Overall Score: ${m.overallScore}/10 (${m.label || 'N/A'})`;

        const metricEntries = [
          ['Crossing Safety', m.crossingSafety],
          ['Sidewalk Coverage', m.sidewalkCoverage],
          ['Traffic Speed Safety', m.speedExposure],
          ['Daily Needs Access', m.destinationAccess],
          ['Night Safety', m.nightSafety],
          ['Terrain', m.slope],
          ['Tree Canopy', m.treeCanopy],
          ['Thermal Comfort', m.thermalComfort],
        ].filter(([, v]) => typeof v === 'number');

        const weakest = metricEntries.sort((a, b) => a[1] - b[1]).slice(0, 3);
        if (weakest.length > 0) {
          systemPrompt += `\n\nWeakest areas: ${weakest.map(([name, score]) => `${name} (${score}/10)`).join(', ')}`;
        }
      }
      if (context.dataQuality) {
        systemPrompt += `\nData confidence: ${context.dataQuality.confidence}`;
      }

      // Multi-language support
      const langMap = { es: 'Spanish', fr: 'French', hi: 'Hindi', zh: 'Chinese', ar: 'Arabic', pt: 'Portuguese', th: 'Thai' };
      if (context.language && context.language !== 'en' && langMap[context.language]) {
        systemPrompt += `\n\nIMPORTANT: Respond entirely in ${langMap[context.language]}. Maintain the same expert urbanist voice and style.`;
      }
    }

    // Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Limit conversation to last 20 messages
    const trimmedMessages = messages.slice(-20).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...trimmedMessages,
        ],
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq chat error:', response.status, errorText);
      if (response.status === 429) {
        res.write(`data: ${JSON.stringify({ error: 'rate_limited', retryAfter: 30 })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Chat service temporarily unavailable.' })}\n\n`);
      }
      res.end();
      return;
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) {
              res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: 'Chat failed. Please try again.' });
    }
  }
});

// Serve frontend static files if dist folder exists
import { existsSync } from 'fs';

// Try multiple possible dist locations (api/dist is copied during Railway build)
const possiblePaths = [
  path.join(__dirname, 'dist'),
  path.join(__dirname, '..', 'dist'),
  path.join(process.cwd(), 'dist'),
  '/app/dist',
];
let distPath = null;
for (const p of possiblePaths) {
  if (existsSync(path.join(p, 'index.html'))) {
    distPath = p;
    break;
  }
}

if (distPath) {
  console.log(`Serving frontend from: ${distPath}`);

  // Hashed assets (js/css) get long cache since filenames change on rebuild
  app.use('/assets', express.static(path.join(distPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // All other static files - no cache to prevent stale index.html
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));

  // SPA fallback - serve index.html for non-API routes (no cache)
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      next();
    }
  });
}

// Global error handler - catches unhandled route errors
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// Graceful shutdown
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

// ─── Honeypot Endpoints (Bot Detection) ──────────────────────────────────────
// Log bots trying to access common vulnerability paths
const honeypots = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/config',
  '/api/keys',
  '/api/config',
  '/.git/config',
  '/wp-admin',
  '/phpMyAdmin',
  '/config.json',
  '/secrets',
];

honeypots.forEach(path => {
  app.get(path, (req, res) => {
    console.warn(`🚨 Bot detected: ${req.ip} → ${path} (User-Agent: ${req.get('user-agent')?.slice(0, 50)})`);
    res.status(404).send('Not found');
  });
  app.post(path, (req, res) => {
    console.warn(`🚨 Bot detected: ${req.ip} → POST ${path}`);
    res.status(404).send('Not found');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SafeStreets API Server`);
  console.log(`✅ Running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Analytics: http://localhost:${PORT}/admin?key=SECRET\n`);
  console.log(`📡 Available APIs:`);
  console.log(`   ☀️  NASA POWER Temperature: GET /api/nasa-power-temperature`);
  console.log(`   🌫️  OpenAQ Air Quality: GET /api/air-quality ${process.env.OPENAQ_API_KEY ? '(configured)' : '(needs API key)'}`);
  console.log(`   ⛰️  NASADEM Elevation: GET /api/elevation`);
  console.log(`   🏔️  NASADEM Slope: GET /api/slope`);
  console.log(`   🌳 Sentinel-2 NDVI: GET /api/ndvi`);
  console.log(`   🔥 Urban Heat Island: GET /api/heat-island`);
  console.log(`   👥 Population Density: GET /api/population-density`);
  console.log(`   🚨 Crash Data: GET /api/crash-data (FARS + WHO)`);
  console.log(`   🗺️  Overpass Proxy: POST /api/overpass`);
  console.log(`   💳 Stripe Checkout: POST /api/create-checkout-session ${stripe ? '(configured)' : '(needs API key)'}`);
  console.log(`   🔑 Verify Payment: GET /api/verify-payment ${process.env.CLERK_SECRET_KEY ? '(configured)' : '(needs CLERK_SECRET_KEY)'}`);
  console.log(`   🪝 Stripe Webhook: POST /api/stripe-webhook ${process.env.STRIPE_WEBHOOK_SECRET ? '(configured)' : '(needs STRIPE_WEBHOOK_SECRET)'}`);
  console.log(`   📬 Contact Inquiry: POST /api/contact-inquiry ${process.env.SMTP_HOST ? '(email configured)' : '(console-only)'}\n`);
});
