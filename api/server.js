/**
 * SafeStreets API - Free Data Sources
 *
 * This backend provides access to:
 * - NASA POWER meteorological data (temperature)
 * - NASADEM elevation data via Microsoft Planetary Computer
 * - OpenStreetMap infrastructure via Overpass API
 * - EPA National Walkability Index (street design)
 * - US Census ACS (commute mode, demographics)
 * - Sentinel-2 NDVI + heat island data
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fromUrl } from 'geotiff';
import Stripe from 'stripe';
import helmet from 'helmet';

import dns from 'node:dns';
import { promisify } from 'node:util';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const resolveMx = promisify(dns.resolveMx);

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
  return createHash('sha256').update(query.trim()).digest('hex');
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

const ANALYTICS_FILE = process.env.ANALYTICS_FILE || path.join(__dirname, '..', 'data', 'analytics.json');
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
    case 'payment':
      today.payments++;
      break;
  }
}

// Flush to disk every 60 seconds
loadAnalytics();
setInterval(saveAnalytics, 60 * 1000);

// Push daily analytics summary to Airtable (survives redeployment)
async function pushAnalyticsToAirtable() {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) return;
  const today = getToday();
  const data = analyticsStore.daily[today];
  if (!data || data.pageViews === 0) return;
  try {
    await pushToAirtable({
      Email: `analytics-${today}@system`,
      Source: 'Daily Analytics',
      Type: 'Analytics Snapshot',
      Notes: `PV:${data.pageViews} UV:${data.uniqueVisitors} Analyses:${data.analyses} Chat:${data.chatMessages} Shares:${data.shareClicks || 0} Emails:${data.emailsCaptured || 0} Payments:${data.payments} Errors:${data.clientErrors || 0}`,
      'Captured At': new Date().toISOString(),
    });
    console.log('📊 Analytics snapshot pushed to Airtable');
  } catch (err) {
    console.warn('Analytics Airtable push failed:', err.message);
  }
}

// Push analytics to Airtable every 6 hours
setInterval(pushAnalyticsToAirtable, 6 * 60 * 60 * 1000);

// Also save on shutdown
process.on('SIGTERM', async () => {
  console.log('📊 Saving analytics before shutdown...');
  saveAnalytics();
  await pushAnalyticsToAirtable();
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

// ─── Airtable Integration ───────────────────────────────────────────────────

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID;

async function pushToAirtable(fields) {
  if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) return;
  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: [{ fields }] }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('Airtable push failed:', res.status, err);
    } else {
      console.log('Airtable: record created');
    }
  } catch (err) {
    console.warn('Airtable push error:', err.message);
  }
}

// ─── Email Capture ──────────────────────────────────────────────────────────

const EMAILS_FILE = process.env.EMAILS_FILE || path.join(__dirname, '..', 'data', 'emails.json');

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
const INQUIRIES_FILE = process.env.INQUIRIES_FILE || path.join(__dirname, '..', 'data', 'contact-inquiries.json');

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

// ─── Shareable Reports Storage ──────────────────────────────────────────────
const REPORTS_FILE = process.env.REPORTS_FILE || path.join(__dirname, '..', 'data', 'reports.json');

function loadReports() {
  try {
    if (fs.existsSync(REPORTS_FILE)) {
      return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load reports:', err.message);
  }
  return { reports: [], count: 0 };
}

function saveReports(data) {
  try {
    const dir = path.dirname(REPORTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Could not save reports:', err.message);
    }
  }
}

function generateReportId() {
  return createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 8);
}

// ─── Editorial Calendar Storage ─────────────────────────────────────────────
const EDITORIAL_CALENDAR_FILE = process.env.EDITORIAL_CALENDAR_FILE || path.join(__dirname, '..', 'data', 'editorial-calendar.json');

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
const BLOG_POSTS_FILE = process.env.BLOG_POSTS_FILE || path.join(__dirname, '..', 'data', 'blog-posts.json');

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
  const { email, source, utm } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  const ipHash = hashIP(req.ip || req.headers['x-forwarded-for']);
  const country = guessCountry(req);

  const entry = {
    email: email.toLowerCase().trim(),
    source: source || 'newsletter',
    utm: utm && Object.keys(utm).length > 0 ? utm : null,
    country,
    ipHash,
    capturedAt: new Date().toISOString(),
  };

  const emailDB = loadEmails();
  const existing = emailDB.emails.find(e => e.email === entry.email);

  if (existing) {
    existing.lastSeen = entry.capturedAt;
  } else {
    emailDB.emails.push(entry);
    emailDB.count = emailDB.emails.length;
  }

  saveEmails(emailDB);
  trackEvent('newsletter_subscribe', req, { source: entry.source });

  // Push to Airtable (non-blocking)
  pushToAirtable({
    Email: entry.email,
    Source: entry.source,
    Country: entry.country || '',
    Type: 'Newsletter',
    'Captured At': entry.capturedAt,
  });

  console.log(`📧 Newsletter subscriber: ${entry.email} (${entry.source})`);

  res.json({ success: true });
});

// ─── GDPR: Delete My Data ────────────────────────────────────────────────────

const deleteDataLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });

app.post('/api/delete-my-data', deleteDataLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  let deletedFrom = [];

  // 1. Remove from emails.json
  try {
    const emailDB = loadEmails();
    const before = emailDB.emails.length;
    emailDB.emails = emailDB.emails.filter(e => e.email.toLowerCase() !== normalizedEmail);
    if (emailDB.emails.length < before) {
      emailDB.count = emailDB.emails.length;
      saveEmails(emailDB);
      deletedFrom.push('email captures');
    }
  } catch (err) {
    console.warn('GDPR: Error cleaning emails:', err.message);
  }

  // 2. Remove from inquiries.json
  try {
    const inquiryDB = loadInquiries();
    const before = inquiryDB.inquiries.length;
    inquiryDB.inquiries = inquiryDB.inquiries.filter(i => (i.email || '').toLowerCase() !== normalizedEmail);
    if (inquiryDB.inquiries.length < before) {
      inquiryDB.count = inquiryDB.inquiries.length;
      const dir = path.dirname(INQUIRIES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(INQUIRIES_FILE, JSON.stringify(inquiryDB, null, 2));
      deletedFrom.push('contact inquiries');
    }
  } catch (err) {
    console.warn('GDPR: Error cleaning inquiries:', err.message);
  }

  // 3. Request deletion from Airtable (best-effort: find and delete matching records)
  if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID && AIRTABLE_TABLE_ID) {
    try {
      const searchRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}?filterByFormula=${encodeURIComponent(`{Email}='${normalizedEmail}'`)}`,
        { headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } }
      );
      if (searchRes.ok) {
        const { records } = await searchRes.json();
        for (const record of records) {
          await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}/${record.id}`,
            { method: 'DELETE', headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` } }
          );
        }
        if (records.length > 0) deletedFrom.push('cloud database');
      }
    } catch (err) {
      console.warn('GDPR: Airtable deletion error:', err.message);
    }
  }

  console.log(`🗑️ GDPR delete: ${normalizedEmail} — removed from: ${deletedFrom.join(', ') || 'no records found'}`);
  res.json({
    success: true,
    message: deletedFrom.length > 0
      ? `Your data has been deleted from: ${deletedFrom.join(', ')}.`
      : 'No data found associated with this email address.',
  });
});

// ─── Client Error Tracking ──────────────────────────────────────────────────

app.post('/api/error', (req, res) => {
  const { message, stack, url, userAgent, timestamp } = req.body;
  if (!message) return res.status(400).json({ error: 'Missing error message' });

  const today = ensureTodayExists();
  today.clientErrors = (today.clientErrors || 0) + 1;

  // Log for server-side visibility
  console.error(`🐛 Client error: ${message}`);
  if (stack) console.error(`   Stack: ${stack.split('\n')[0]}`);
  if (url) console.error(`   URL: ${url}`);

  res.json({ received: true });
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
        model: 'claude-sonnet-4-6',
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
        model: 'claude-sonnet-4-6',
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
// Sales Pipeline (Qualified Leads CRM)
// ═══════════════════════════════════════════════

const LEADS_FILE = process.env.LEADS_FILE || path.join(__dirname, '..', 'data', 'qualified-leads.json');

function loadLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.warn('Could not load leads:', err.message);
  }
  return [];
}

function saveLeads(leads) {
  try {
    const dir = path.dirname(LEADS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
  } catch (err) {
    console.error('Failed to save leads:', err.message);
  }
}

// GET /api/admin/sales/leads — return all leads
app.get('/api/admin/sales/leads', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const leads = loadLeads();
  res.json({ leads, count: leads.length });
});

// PUT /api/admin/sales/leads/:rank — update a lead
app.put('/api/admin/sales/leads/:rank', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const rank = parseInt(req.params.rank, 10);
  const leads = loadLeads();
  const idx = leads.findIndex(l => l.rank === rank);
  if (idx === -1) return res.status(404).json({ error: 'Lead not found' });

  const updates = req.body;
  // Only allow updating specific fields
  const allowed = ['outreachStatus', 'outreachDate', 'responseDate', 'notes', 'email', 'phone', 'website', 'sampleListing', 'listingPrice', 'agentName', 'brokerage', 'neighborhood', 'qualificationNotes', 'emailValid', 'activeListings'];
  for (const key of Object.keys(updates)) {
    if (allowed.includes(key)) {
      leads[idx][key] = updates[key];
    }
  }
  saveLeads(leads);
  res.json(leads[idx]);
});

// POST /api/admin/sales/validate-email — validate email format + MX records
app.post('/api/admin/sales/validate-email', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'email is required' });
  }
  // Placeholder detection
  if (/^check\s/i.test(email)) {
    return res.json({ valid: false, reason: 'Placeholder — not a real email', hasMx: false, status: 'placeholder' });
  }
  // Format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json({ valid: false, reason: 'Invalid email format', hasMx: false, status: 'invalid' });
  }
  // DNS MX lookup
  const domain = email.split('@')[1];
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      return res.json({ valid: true, reason: `MX records found (${mxRecords[0].exchange})`, hasMx: true, status: 'valid' });
    }
    return res.json({ valid: false, reason: `No MX records for ${domain}`, hasMx: false, status: 'invalid' });
  } catch (err) {
    const reason = err.code === 'ENOTFOUND' ? `Domain ${domain} does not exist`
      : err.code === 'ENODATA' ? `No MX records for ${domain}`
      : `DNS lookup failed: ${err.message}`;
    return res.json({ valid: false, reason, hasMx: false, status: 'invalid' });
  }
});

// ════════════════════════════════════════════════════
// REPORT GENERATION — Reusable core function
// ════════════════════════════════════════════════════

async function generateReportForLocation(neighborhood, city, state, agentProfile) {
    // 1. Geocode the location via Nominatim
    const primaryNeighborhood = neighborhood ? neighborhood.split(/\s*[\/&]\s*/)[0].trim() : '';
    const searchQuery = primaryNeighborhood ? `${primaryNeighborhood}, ${city}, ${state}` : `${city}, ${state}`;
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'SafeStreets/1.0 (safestreets.streetsandcommons.com)' },
    });
    const geoData = await geoRes.json();
    if (!geoData.length) {
      throw new Error(`Could not geocode "${searchQuery}"`);
    }
    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);
    const displayName = geoData[0].display_name?.split(',').slice(0, 3).join(',').trim() || searchQuery;

    // 2. Fetch OSM data via Overpass (try primary, then fallback mirror)
    const radius = 800;
    const poiRadius = 1200;
    const overpassQuery = `[out:json][timeout:25];
(node(around:${radius},${lat},${lon})["highway"="crossing"];way(around:${radius},${lat},${lon})["footway"="sidewalk"];way(around:${radius},${lat},${lon})["highway"~"^(footway|primary|secondary|tertiary|residential|living_street|pedestrian|unclassified|service)$"];);out body; >; out skel qt;
(node(around:${poiRadius},${lat},${lon})["amenity"];node(around:${poiRadius},${lat},${lon})["shop"];way(around:${poiRadius},${lat},${lon})["amenity"="school"];way(around:${poiRadius},${lat},${lon})["leisure"="park"];node(around:${poiRadius},${lat},${lon})["public_transport"="stop_position"];node(around:${poiRadius},${lat},${lon})["highway"="bus_stop"];node(around:${poiRadius},${lat},${lon})["railway"="station"];);out center;`;

    const overpassEndpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];

    let osmRaw = null;
    for (const endpoint of overpassEndpoints) {
      try {
        console.log(`🗺️  Overpass: ${endpoint}`);
        const overpassRes = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(overpassQuery)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: AbortSignal.timeout(30000),
        });
        if (!overpassRes.ok) {
          console.warn(`⚠️  Overpass ${overpassRes.status} from ${endpoint}`);
          continue;
        }
        osmRaw = await overpassRes.json();
        break;
      } catch (err) {
        console.warn(`⚠️  Overpass error (${endpoint}): ${err.message}`);
      }
    }
    if (!osmRaw) throw new Error('Overpass API unavailable — try again in a minute');
    const elements = osmRaw.elements || [];

    // 3. Process OSM data into categories
    const crossings = elements.filter(e => e.tags?.highway === 'crossing' || e.tags?.crossing);
    const streets = elements.filter(e => e.type === 'way' && e.tags?.highway && ['primary','secondary','tertiary','residential','living_street','pedestrian'].includes(e.tags.highway));
    const sidewalks = elements.filter(e => e.tags?.footway === 'sidewalk' || e.tags?.sidewalk || e.tags?.highway === 'footway');
    const pois = elements.filter(e => e.tags?.amenity || e.tags?.shop || e.tags?.leisure || e.tags?.railway === 'station');

    // 3b. Build network graph from street ways (same as frontend overpass.ts)
    const STREET_HIGHWAY_TYPES = ['primary','secondary','tertiary','residential','living_street','pedestrian','unclassified','service'];
    const nodeCoords = new Map();
    elements.filter(e => e.type === 'node' && e.lat !== undefined).forEach(n => nodeCoords.set(n.id.toString(), { lat: n.lat, lon: n.lon }));
    const streetWays = elements.filter(e => e.type === 'way' && e.tags?.highway && STREET_HIGHWAY_TYPES.includes(e.tags.highway) && e.nodes?.length >= 2);
    const nodeDegree = new Map();
    for (const way of streetWays) {
      for (const nodeId of way.nodes) {
        const key = nodeId.toString();
        nodeDegree.set(key, (nodeDegree.get(key) || 0) + 1);
      }
    }
    const graphIntersections = [];
    const graphDeadEnds = [];
    for (const [nodeId, degree] of nodeDegree) {
      const coords = nodeCoords.get(nodeId);
      if (!coords) continue;
      if (degree >= 3) graphIntersections.push({ id: nodeId, lat: coords.lat, lon: coords.lon, degree });
      else if (degree === 1) graphDeadEnds.push({ id: nodeId, lat: coords.lat, lon: coords.lon, degree: 1 });
    }
    let totalStreetLengthM = 0;
    for (const way of streetWays) {
      for (let i = 0; i < way.nodes.length - 1; i++) {
        const a = nodeCoords.get(way.nodes[i].toString());
        const b = nodeCoords.get(way.nodes[i + 1].toString());
        if (a && b) totalStreetLengthM += haversineDistance(a.lat, a.lon, b.lat, b.lon);
      }
    }
    const analysisAreaKm2 = Math.PI * (radius / 1000) ** 2;
    const totalStreetLengthKm = totalStreetLengthM / 1000;
    const averageBlockLengthM = graphIntersections.length > 1 ? totalStreetLengthM / graphIntersections.length : totalStreetLengthM;

    // Street Grid score (0-10) from 4 sub-metrics (same as networkMetrics.ts)
    const intDensity = analysisAreaKm2 > 0 ? graphIntersections.length / analysisAreaKm2 : 0;
    const intDensityScore = Math.max(0, Math.min(100, Math.round((intDensity / 150) * 100)));
    const blockLenScore = averageBlockLengthM <= 100 ? 100 : averageBlockLengthM >= 280 ? 0 : Math.max(0, Math.min(100, Math.round(((280 - averageBlockLengthM) / 180) * 100)));
    const netDensity = analysisAreaKm2 > 0 ? totalStreetLengthKm / analysisAreaKm2 : 0;
    const netDensityScore = Math.max(0, Math.min(100, Math.round((netDensity / 20) * 100)));
    const deadEndTotal = graphDeadEnds.length + graphIntersections.length;
    const deadEndRatio = deadEndTotal > 0 ? graphDeadEnds.length / deadEndTotal : 0;
    const deadEndScore = deadEndRatio <= 0 ? 100 : deadEndRatio >= 0.3 ? 0 : Math.max(0, Math.min(100, Math.round(((0.3 - deadEndRatio) / 0.3) * 100)));
    const networkScore100 = Math.round(intDensityScore * 0.3 + blockLenScore * 0.3 + netDensityScore * 0.2 + deadEndScore * 0.2);
    const streetGridScore = Math.round((networkScore100 / 10) * 10) / 10; // 0-10
    console.log(`  ✅ Street Grid: ${streetGridScore}/10 (${graphIntersections.length} intersections, ${graphDeadEnds.length} dead-ends, ${averageBlockLengthM.toFixed(0)}m avg block)`);

    // 4. Calculate metrics (same logic as client-side metrics.ts)
    // Destination Access
    const cats = { education: false, transit: false, shopping: false, healthcare: false, food: false, recreation: false };
    pois.forEach(p => {
      if (p.tags?.amenity === 'school' || p.tags?.amenity === 'kindergarten') cats.education = true;
      if (p.tags?.amenity === 'bus_station' || p.tags?.railway === 'station') cats.transit = true;
      if (p.tags?.shop) cats.shopping = true;
      if (p.tags?.amenity === 'hospital' || p.tags?.amenity === 'clinic' || p.tags?.amenity === 'pharmacy') cats.healthcare = true;
      if (p.tags?.amenity === 'restaurant' || p.tags?.amenity === 'cafe') cats.food = true;
      if (p.tags?.leisure === 'park' || p.tags?.leisure === 'playground') cats.recreation = true;
    });
    const destinationAccess = Math.round(Math.min(10, (Object.values(cats).filter(Boolean).length / 6) * 10) * 10) / 10;

    // 5. Fetch tree canopy and other layers in parallel
    console.log(`🛰️  Fetching NDVI, Census, EPA for ${lat}, ${lon}...`);
    let treeCanopyScore = 0;

    // Helper: race a promise against a timeout (prevents GeoTIFF hangs)
    const withTimeout = (promise, ms, fallback) =>
      Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))]);

    const [ndviResult, fccResult, floodResult, popResult, epaResult, greeneryResult] = await Promise.allSettled([
      // Sentinel-2 NDVI tree canopy (45s timeout)
      withTimeout((async () => {
        try {
          const ndviRadius = 0.007;
          const bb = [lon - ndviRadius, lat - ndviRadius, lon + ndviRadius, lat + ndviRadius];
          const today = new Date();
          const startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
          const sr = await fetch('https://planetarycomputer.microsoft.com/api/stac/v1/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collections: ['sentinel-2-l2a'], bbox: bb,
              datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
              limit: 20, query: { 'eo:cloud_cover': { lt: 15 } },
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (!sr.ok) return { score: 5, ndvi: null };
          const sd = await sr.json();
          if (!sd.features?.length) return { score: 5, ndvi: null };
          // Prefer peak growing-season images for accurate vegetation measurement
          // Peak months have greenest vegetation; avoids Mediterranean dry-season brown
          const peakRank = (d) => {
            const m = new Date(d).getMonth() + 1;
            const peak = lat > 0 ? [5, 6] : [11, 12];       // May-Jun NH, Nov-Dec SH
            const good = lat > 0 ? [4, 7] : [10, 1];         // Apr/Jul NH, Oct/Jan SH
            const ok   = lat > 0 ? [3, 8] : [9, 2];          // Mar/Aug NH, Sep/Feb SH
            if (peak.includes(m)) return 0;
            if (good.includes(m)) return 1;
            if (ok.includes(m)) return 2;
            return 3; // off-season
          };
          // Sort: peak months first, then by cloud cover within each tier
          sd.features.sort((a, b) => {
            const ra = peakRank(a.properties.datetime), rb = peakRank(b.properties.datetime);
            if (ra !== rb) return ra - rb;
            return (a.properties['eo:cloud_cover'] || 100) - (b.properties['eo:cloud_cover'] || 100);
          });
          const best = sd.features[0];
          const b08 = best.assets.B08, b04 = best.assets.B04;
          if (!b08 || !b04) return { score: 5, ndvi: null };
          const signingEp = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';
          const [s08, s04] = await Promise.all([
            fetch(`${signingEp}?href=${encodeURIComponent(b08.href)}`).then(r => r.json()),
            fetch(`${signingEp}?href=${encodeURIComponent(b04.href)}`).then(r => r.json()),
          ]);
          const [tB08, tB04] = await Promise.all([fromUrl(s08.href), fromUrl(s04.href)]);
          const [iB08, iB04] = await Promise.all([tB08.getImage(), tB04.getImage()]);
          const w = iB08.getWidth(), h = iB08.getHeight();
          const origin = iB08.getOrigin(), imgRes = iB08.getResolution();
          const utm = latLonToUTM(lat, lon);
          const tX = Math.round((utm.easting - origin[0]) / imgRes[0]);
          const tY = Math.round((utm.northing - origin[1]) / imgRes[1]);
          if (tX < 0 || tX >= w || tY < 0 || tY >= h) return { score: 5, ndvi: null };
          const sz = 80, half = 40;
          const x0 = Math.max(0, tX - half), y0 = Math.max(0, tY - half);
          const x1 = Math.min(w, x0 + sz), y1 = Math.min(h, y0 + sz);
          const [dB08, dB04] = await Promise.all([
            iB08.readRasters({ window: [x0, y0, x1, y1] }),
            iB04.readRasters({ window: [x0, y0, x1, y1] }),
          ]);
          const nirV = dB08[0], redV = dB04[0];
          let ndviSum = 0, valid = 0;
          for (let i = 0; i < nirV.length; i++) {
            const nir = nirV[i], red = redV[i];
            if (nir > 0 && red > 0 && nir < 10000 && red < 10000) {
              const ndvi = (nir - red) / (nir + red);
              if (ndvi >= -1 && ndvi <= 1) { ndviSum += ndvi; valid++; }
            }
          }
          if (valid === 0) return { score: 5, ndvi: null };
          const avgNDVI = ndviSum / valid;
          // Urban-calibrated NDVI scoring curve
          // Dense urban areas (NDVI 0.05-0.15) get 2-4 instead of old 0.5-1.5
          let sc;
          if (avgNDVI < 0) sc = 0;
          else if (avgNDVI < 0.10) sc = Math.round((1 + (avgNDVI / 0.10) * 2) * 10) / 10;            // 0-0.10 -> 1-3
          else if (avgNDVI < 0.20) sc = Math.round((3 + ((avgNDVI - 0.10) / 0.10) * 2) * 10) / 10;   // 0.10-0.20 -> 3-5
          else if (avgNDVI < 0.35) sc = Math.round((5 + ((avgNDVI - 0.20) / 0.15) * 2.5) * 10) / 10; // 0.20-0.35 -> 5-7.5
          else if (avgNDVI < 0.50) sc = Math.round((7.5 + ((avgNDVI - 0.35) / 0.15) * 2.5) * 10) / 10; // 0.35-0.50 -> 7.5-10
          else sc = 10;
          const imgDate = best.properties.datetime?.split('T')[0] || 'unknown';
          const imgCloud = best.properties['eo:cloud_cover'] || 0;
          const imgPeakRank = peakRank(best.properties.datetime);
          console.log(`  ✅ NDVI: ${avgNDVI.toFixed(3)} → ${sc}/10 (image: ${imgDate}, cloud: ${imgCloud}%, peakRank: ${imgPeakRank})`);
          return { score: sc, ndvi: parseFloat(avgNDVI.toFixed(3)), imageDate: imgDate, cloudCover: imgCloud, peakRank: imgPeakRank };
        } catch (e) { console.warn('⚠️  NDVI failed:', e.message); return { score: 5, ndvi: null, imageDate: null, cloudCover: null, peakRank: null }; }
      })(), 45000, { score: 5, ndvi: null }),
      // FCC Census geocode (for CDC health data)
      fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`, {
        signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'SafeStreets/1.0' },
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      // FEMA Flood Risk
      fetch(`https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?geometry=${lon},${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`, {
        signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'SafeStreets/1.0' },
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      // Census ACS — commute mode, socioeconomic data, population (for density classification)
      // B08301: Means of Transportation to Work, B19013: Median Income, B25077: Median Home Value, B01003: Total Pop
      withTimeout((async () => {
        try {
          const fccCensus = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`, {
            signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'SafeStreets/1.0' },
          });
          if (!fccCensus.ok) return null;
          const fccCensusData = await fccCensus.json();
          const blk = fccCensusData.results?.[0];
          if (!blk?.block_fips || !blk.state_fips || !blk.county_fips) return null;
          const tractFips = blk.block_fips.substring(5, 11);
          const countyFips = blk.county_fips.substring(2);
          const acsRes = await fetch(
            `https://api.census.gov/data/2022/acs/acs5?get=B08301_001E,B08301_019E,B08301_018E,B08301_010E,B19013_001E,B25077_001E,B01003_001E&for=tract:${tractFips}&in=state:${blk.state_fips}&in=county:${countyFips}`,
            { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SafeStreets/1.0' } }
          );
          if (!acsRes.ok) return null;
          const acsData = await acsRes.json();
          const row = acsData?.[1];
          if (!row) return null;
          const totalCommuters = parseInt(row[0], 10) || 0;
          const walked = parseInt(row[1], 10) || 0;
          const biked = parseInt(row[2], 10) || 0;
          const transit = parseInt(row[3], 10) || 0;
          const medianIncome = parseInt(row[4], 10) || null;
          const medianHomeValue = parseInt(row[5], 10) || null;
          const totalPop = parseInt(row[6], 10) || 0;
          const altMode = walked + biked + transit;
          const altPct = totalCommuters > 0 ? Math.round((altMode / totalCommuters) * 1000) / 10 : 0;
          const walkPct = totalCommuters > 0 ? Math.round((walked / totalCommuters) * 1000) / 10 : 0;
          const bikePct = totalCommuters > 0 ? Math.round((biked / totalCommuters) * 1000) / 10 : 0;
          const transitPct = totalCommuters > 0 ? Math.round((transit / totalCommuters) * 1000) / 10 : 0;
          // Commute mode score (0-10): % of commuters using walk/bike/transit
          let commuteScore;
          if (altPct >= 50) commuteScore = 10;
          else if (altPct >= 35) commuteScore = 8.5;
          else if (altPct >= 20) commuteScore = 7;
          else if (altPct >= 10) commuteScore = 5.5;
          else if (altPct >= 5) commuteScore = 4;
          else commuteScore = 2;
          commuteScore = Math.round(commuteScore * 10) / 10;
          // Estimate density for internal percentile context (urban/suburban/rural)
          const blockPop = blk.block_pop_2020 || 100;
          const bbox = blk.bbox;
          let estDensity = totalPop > 0 ? Math.round(totalPop / 2.5) : 1000; // fallback avg
          if (bbox && bbox.length === 4 && blockPop > 0) {
            const cosLat = Math.cos(lat * Math.PI / 180);
            const blockArea = Math.abs(bbox[2] - bbox[0]) * 111.32 * cosLat * Math.abs(bbox[3] - bbox[1]) * 111.32;
            if (blockArea > 0) estDensity = Math.round(totalPop / (blockArea * (totalPop / Math.max(blockPop, 1))));
          }
          console.log(`  ✅ Commute: ${altPct}% walk/bike/transit → ${commuteScore}/10 | Income: $${medianIncome?.toLocaleString()} | Home: $${medianHomeValue?.toLocaleString()}`);
          return { commuteScore, walkPct, bikePct, transitPct, altPct, medianIncome, medianHomeValue, totalPop, estDensity, dataSource: 'Census ACS 2022' };
        } catch (e) { console.warn('⚠️  Census ACS failed:', e.message); return null; }
      })(), 25000, null),

      // EPA National Walkability Index -- street design quality
      // Static census data (2018), cache for 30 days. Retry once on failure.
      withTimeout((async () => {
        try {
          const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          const cached = epaCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
            console.log(`  ✅ EPA Street Design (cached): score=${cached.data.score}`);
            return cached.data;
          }
          const epaUrl = `https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?` +
            `geometry=${lon},${lat}` +
            `&geometryType=esriGeometryPoint` +
            `&inSR=4326` +
            `&spatialRel=esriSpatialRelIntersects` +
            `&outFields=NatWalkInd,D3B,D3B_Ranked,D4A,D4A_Ranked,D2B_E8MIXA,D2B_Ranked,TotPop,CBSA_Name,AutoOwn0,AutoOwn1,AutoOwn2p` +
            `&returnGeometry=false` +
            `&f=json`;
          // Try up to 2 attempts with increasing timeout
          let epaData = null;
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const timeout = attempt === 1 ? 15000 : 25000;
              console.log(`  🔄 EPA Street Design: attempt ${attempt}/2 (${timeout/1000}s timeout)...`);
              const resp = await fetch(epaUrl, {
                signal: AbortSignal.timeout(timeout),
                headers: { 'User-Agent': 'SafeStreets/1.0' },
              });
              if (!resp.ok) throw new Error(`EPA API returned ${resp.status}`);
              const parsed = await resp.json();
              if (parsed.error) throw new Error(`EPA query error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
              epaData = parsed;
              break;
            } catch (retryErr) {
              console.warn(`  ⚠️  EPA attempt ${attempt} failed: ${retryErr.message}`);
              if (attempt === 2) throw retryErr;
              await new Promise(r => setTimeout(r, 1000)); // 1s pause before retry
            }
          }
          if (!epaData?.features || epaData.features.length === 0) return null;
          const attrs = epaData.features[0].attributes;
          const d3bRank = attrs.D3B_Ranked ?? attrs.D3B ?? 0;
          const d4aRank = attrs.D4A_Ranked ?? attrs.D4A ?? 0;
          const d2bRank = attrs.D2B_Ranked ?? 0;
          const natWalkInd = attrs.NatWalkInd ?? 0;
          const d3bScoreEpa = Math.round((d3bRank / 20) * 100);
          const d4aScoreEpa = Math.round((d4aRank / 20) * 100);
          const d2bScoreEpa = Math.round((d2bRank / 20) * 100);
          const epaScore = Math.round(d3bScoreEpa * 0.50 + d4aScoreEpa * 0.30 + d2bScoreEpa * 0.20);
          const totalHH = (attrs.AutoOwn0 ?? 0) + (attrs.AutoOwn1 ?? 0) + (attrs.AutoOwn2p ?? 0);
          const zeroCarPct = totalHH > 0 ? Math.round((attrs.AutoOwn0 / totalHH) * 100) : null;
          let category;
          if (epaScore >= 80) category = 'Excellent street design for walking';
          else if (epaScore >= 60) category = 'Good street design for walking';
          else if (epaScore >= 40) category = 'Moderate street design';
          else if (epaScore >= 20) category = 'Car-oriented street design';
          else category = 'Very car-dependent design';
          const result = { score: epaScore, category, d3bRank, d4aRank, d2bRank, natWalkInd, zeroCarPct, totalPop: attrs.TotPop ?? null, metroArea: attrs.CBSA_Name || null, dataSource: 'EPA National Walkability Index' };
          epaCache.set(cacheKey, { data: result, timestamp: Date.now() });
          console.log(`  ✅ EPA Street Design: score=${epaScore}, D3B=${d3bRank}/20, D4A=${d4aRank}/20`);
          return result;
        } catch (e) { console.warn('⚠️  EPA Street Design failed after retries:', e.message); return null; }
      })(), 45000, null),

      // Ground-truth greenery -- Claude web research assessment (45s timeout, web search takes 12-15s)
      withTimeout((async () => {
        try {
          const locationName = `${neighborhood || ''}${neighborhood ? ', ' : ''}${city}${state ? ', ' + state : ''}`;
          return await fetchGroundTruthGreenery(lat, lon, locationName);
        } catch (e) { console.warn('⚠️  Ground truth greenery failed:', e.message); return null; }
      })(), 45000, null),
    ]);

    // Track validation metadata for report health check
    const _validation = {
      treeCanopy: { status: 'ok', imageDate: null, cloudCover: null, peakRank: null, ndvi: null },
      streetDesign: { status: 'pending' },
      streetGrid: { status: 'ok', streetCount: streets.length },
      destinationAccess: { status: 'ok', poiCount: pois.length },
      commuteMode: { status: 'pending' },
    };

    if (ndviResult.status === 'fulfilled' && ndviResult.value) {
      treeCanopyScore = ndviResult.value.score;
      _validation.treeCanopy = {
        status: treeCanopyScore < 2 ? 'warning' : 'ok',
        imageDate: ndviResult.value.imageDate || null,
        cloudCover: ndviResult.value.cloudCover ?? null,
        peakRank: ndviResult.value.peakRank ?? null,
        ndvi: ndviResult.value.ndvi,
      };
    } else {
      _validation.treeCanopy = { status: 'failed', imageDate: null, cloudCover: null, peakRank: null, ndvi: null };
    }

    // Ground-truth knowledge assessment: Claude primary, NDVI as fallback
    // Claude scores are more accurate for pedestrian experience in dense urban areas.
    // NDVI only used when Claude is unavailable or has low confidence.
    let groundTruthData = null;
    const ndviOnlyScore = treeCanopyScore;
    if (greeneryResult.status === 'fulfilled' && greeneryResult.value?.score != null) {
      groundTruthData = greeneryResult.value;
      if (groundTruthData.confidence === 'high' || groundTruthData.confidence === 'medium') {
        // Claude knows this area -- use its score directly
        treeCanopyScore = groundTruthData.score;
        console.log(`  🌳 Tree Canopy: Claude ${treeCanopyScore}/10 (${groundTruthData.confidence}) | NDVI ${ndviOnlyScore}/10 (fallback only)`);
      } else {
        // Low confidence -- fall back to NDVI
        console.log(`  🌳 Tree Canopy: NDVI ${ndviOnlyScore}/10 (Claude low confidence: ${groundTruthData.score}/10)`);
      }
    }
    // 5b. Neighborhood Intelligence — transit/park/food from OSM elements + CDC + FEMA
    const niTransit = { busStops: 0, railStations: 0, totalStops: 0, score: 0 };
    const niParks = { parks: 0, playgrounds: 0, gardens: 0, totalGreenSpaces: 0, nearestParkMeters: null, score: 0 };
    const niFood = { supermarkets: 0, groceryStores: 0, convenienceStores: 0, totalFoodStores: 0, nearestSupermarketMeters: null, isFoodDesert: true, score: 0 };

    for (const el of elements) {
      const t = el.tags || {};
      // Transit
      if (t.railway === 'station' || t.railway === 'halt' || t.station === 'subway' || t.station === 'light_rail') niTransit.railStations++;
      else if (t.highway === 'bus_stop' || t.amenity === 'bus_station' || (t.public_transport === 'stop_position' && !t.railway)) niTransit.busStops++;
      // Parks
      if (t.leisure === 'park' || t.leisure === 'nature_reserve' || t.landuse === 'recreation_ground') niParks.parks++;
      else if (t.leisure === 'playground') niParks.playgrounds++;
      else if (t.leisure === 'garden') niParks.gardens++;
      // Food
      if (t.shop === 'supermarket') niFood.supermarkets++;
      else if (t.shop === 'grocery' || t.shop === 'greengrocer') niFood.groceryStores++;
      else if (t.shop === 'convenience' || t.shop === 'general') niFood.convenienceStores++;
    }
    niTransit.totalStops = niTransit.busStops + niTransit.railStations;
    niTransit.score = Math.min(10, Math.round((Math.min(niTransit.busStops / 15 * 7, 7) + Math.min(niTransit.railStations * 3, 6)) * 10) / 10);
    niParks.totalGreenSpaces = niParks.parks + niParks.playgrounds + niParks.gardens;
    niParks.score = Math.round(Math.min(10, niParks.totalGreenSpaces / 5 * 10) * 10) / 10;
    niFood.totalFoodStores = niFood.supermarkets + niFood.groceryStores + niFood.convenienceStores;
    niFood.isFoodDesert = niFood.supermarkets === 0;
    niFood.score = Math.round(Math.min(10, (niFood.supermarkets / 3 * 4 + niFood.groceryStores / 3 * 2)) * 10) / 10;

    // Flood risk from FEMA
    let floodData = null;
    if (floodResult.status === 'fulfilled' && floodResult.value?.features) {
      const zone = floodResult.value.features?.[0]?.attributes?.FLD_ZONE || 'X';
      const highRiskZones = ['A', 'AE', 'AH', 'AO', 'AR', 'V', 'VE'];
      floodData = { floodZone: zone, isHighRisk: highRiskZones.includes(zone), description: zone === 'X' ? 'Minimal flood risk' : `Flood zone ${zone}`, dataSource: 'FEMA NFHL' };
    }

    // CDC health data (chained on FCC result for tract FIPS)
    let healthData = null;
    if (fccResult.status === 'fulfilled' && fccResult.value?.results?.[0]?.block_fips) {
      const blockFips = fccResult.value.results[0].block_fips;
      const tractFips = blockFips.substring(0, 11);
      try {
        const cdcRes = await fetch(`https://data.cdc.gov/resource/cwsq-ngmh.json?locationid=${tractFips}&$limit=50`, {
          signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SafeStreets/1.0' },
        });
        if (cdcRes.ok) {
          const cdcRows = await cdcRes.json();
          if (cdcRows.length > 0) {
            const getMeasure = (id) => { const r = cdcRows.find(r => r.measureid === id || r.measure_id === id); return r ? parseFloat(r.data_value) || null : null; };
            healthData = { tractFips, obesity: getMeasure('OBESITY'), diabetes: getMeasure('DIABETES'), physicalInactivity: getMeasure('LPA'), mentalHealth: getMeasure('MHLTH'), asthma: getMeasure('CASTHMA'), dataYear: 2023, dataSource: 'CDC PLACES' };
          }
        }
      } catch { /* non-critical */ }
    }

    // Extract Census ACS socioeconomic data for neighborhood intelligence
    const acsResult = popResult.status === 'fulfilled' ? popResult.value : null;
    const economics = acsResult ? {
      medianIncome: acsResult.medianIncome,
      medianHomeValue: acsResult.medianHomeValue,
      dataSource: 'Census ACS 2022',
    } : null;
    const commuteDetail = acsResult ? {
      walkPct: acsResult.walkPct,
      bikePct: acsResult.bikePct,
      transitPct: acsResult.transitPct,
      altModePct: acsResult.altPct,
      dataSource: 'Census ACS 2022',
    } : null;

    const neighborhoodIntel = {
      commute: commuteDetail,
      transit: niTransit.totalStops > 0 ? niTransit : null,
      parks: niParks.totalGreenSpaces > 0 ? niParks : null,
      food: niFood.totalFoodStores > 0 ? niFood : null,
      economics,
      health: healthData,
      flood: floodData,
    };

    // 6. Commute Mode score (0-10) -- % walking/biking/transit from Census ACS (US only)
    let commuteModeScore = 0;
    let censusAcsData = null;
    if (popResult.status === 'fulfilled' && popResult.value) {
      censusAcsData = popResult.value;
      commuteModeScore = censusAcsData.commuteScore;
    }
    console.log(`  ✅ Commute Mode: ${commuteModeScore}/10${!censusAcsData ? ' (Census ACS unavailable -- non-US or API failure)' : ` (${censusAcsData.altPct}% walk/bike/transit)`}`);

    // 6b. Street Design score (0-10) from EPA National Walkability Index
    let streetDesignScore = 0;
    let streetDesignData = null;
    if (epaResult.status === 'fulfilled' && epaResult.value) {
      streetDesignData = epaResult.value;
    }
    // Check cache as final fallback if EPA fetch failed (main fetch already retries twice)
    if (!streetDesignData) {
      const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const cached = epaCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 30 * 24 * 60 * 60 * 1000) {
        streetDesignData = cached.data;
        console.log(`  ✅ EPA Street Design (cache fallback): score=${cached.data.score}`);
      } else {
        console.warn('  ⚠️  EPA Street Design: unavailable after retries, no cache hit');
      }
    }
    if (streetDesignData) {
      streetDesignScore = Math.round(streetDesignData.score / 10 * 10) / 10; // EPA 0-100 → 0-10
    }
    // If EPA unavailable for US locations, exclude from scoring (don't penalize with 0)
    // streetDesignScore stays 0 which gets filtered out by the available.filter(s => s > 0)
    // Update validation metadata for remaining metrics
    _validation.commuteMode = censusAcsData
      ? { status: 'ok', altPct: censusAcsData.altPct }
      : { status: 'unavailable', altPct: null };
    _validation.streetDesign = streetDesignData
      ? { status: 'ok', epaScore: streetDesignData.score }
      : { status: 'timeout', epaScore: null };

    console.log(`  ✅ Street Design: ${streetDesignScore}/10${!streetDesignData ? ' (EPA data unavailable)' : ` (EPA score: ${streetDesignData.score}/100)`}`);

    // 7. Overall score -- US vs International metric selection
    // US: Destinations + Tree Canopy + Street Design (EPA) + Commute Mode (Census ACS)
    // International: Destinations + Tree Canopy + Street Grid (OSM) -- no EPA/Census
    const isUS = censusAcsData !== null || streetDesignData !== null;
    const metricsForOverall = isUS
      ? [destinationAccess, treeCanopyScore, streetDesignScore, commuteModeScore]
      : [destinationAccess, treeCanopyScore, streetGridScore];
    const available = metricsForOverall.filter(s => s > 0);
    console.log(`  📍 Location type: ${isUS ? 'US' : 'International'}, metrics for overall: ${available.length}`);
    const overallScore = available.length > 0
      ? Math.round((available.reduce((a, b) => a + b, 0) / available.length) * 10) / 10
      : 0;
    const grade = overallScore >= 8 ? 'A' : overallScore >= 6.5 ? 'B' : overallScore >= 5 ? 'C' : overallScore >= 3 ? 'D' : 'F';
    const label = overallScore >= 8 ? 'Excellent' : overallScore >= 6 ? 'Good' : overallScore >= 4 ? 'Fair' : overallScore >= 2 ? 'Poor' : 'Critical';

    // 7b. Percentile ranking — research-backed reference distributions
    // Based on Walk Score research + urban planning literature (NACTO, ITDP)
    const PERCENTILE_REFS = {
      urban:    { p10: 3.5, p25: 5.0, p50: 6.5, p75: 7.5, p90: 8.5 },
      suburban: { p10: 1.5, p25: 2.5, p50: 4.0, p75: 5.5, p90: 7.0 },
      rural:    { p10: 0.5, p25: 1.0, p50: 2.0, p75: 3.0, p90: 4.5 },
    };
    // Use estimated density from Census ACS for context classification (internal only)
    const estDensity = censusAcsData?.estDensity || 1000;
    const popContext = estDensity >= 5000 ? 'urban' : estDensity >= 500 ? 'suburban' : 'rural';
    const ref = PERCENTILE_REFS[popContext];
    // Linear interpolation between reference percentile points
    function interpolatePercentile(score, ref) {
      const pts = [
        [0, 0], [ref.p10, 10], [ref.p25, 25], [ref.p50, 50], [ref.p75, 75], [ref.p90, 90], [10, 100],
      ];
      for (let i = 1; i < pts.length; i++) {
        if (score <= pts[i][0]) {
          const [x0, y0] = pts[i - 1];
          const [x1, y1] = pts[i];
          return Math.round(y0 + (score - x0) / (x1 - x0) * (y1 - y0));
        }
      }
      return 99;
    }
    const percentileValue = Math.min(99, Math.max(1, interpolatePercentile(overallScore, ref)));
    const contextLabel = popContext === 'urban' ? 'urban neighborhoods' : popContext === 'suburban' ? 'suburban neighborhoods' : 'rural areas';
    const percentile = {
      overall: percentileValue,
      context: popContext,
      label: `Better than ${percentileValue}% of ${contextLabel}`,
    };
    console.log(`  📊 Percentile: ${percentileValue}th (${popContext})`);

    // 8. Build report data
    // For US: streetGrid is reference-only (not in overall). For international: streetDesign/commuteMode are 0.
    const reportData = {
      location: { lat, lon, displayName },
      isUS,
      metrics: {
        destinationAccess, treeCanopy: treeCanopyScore,
        streetGrid: isUS ? 0 : streetGridScore,
        commuteMode: commuteModeScore,
        streetDesign: streetDesignScore,
        overallScore, label,
      },
      streetDesignData,
      groundTruthGreenery: groundTruthData ? {
        score: groundTruthData.score,
        confidence: groundTruthData.confidence,
        greenCharacter: groundTruthData.greenCharacter,
        knownFeatures: groundTruthData.knownFeatures,
      } : null,
      treeCanopySource: groundTruthData ? 'satellite+knowledge' : 'satellite',
      compositeScore: { overallScore: overallScore * 10, grade, components: [] },
      dataQuality: { crossingCount: crossings.length, streetCount: streets.length, sidewalkCount: sidewalks.length, poiCount: pois.length, confidence: streets.length > 50 ? 'high' : streets.length > 20 ? 'medium' : 'low' },
      neighborhoodIntel,
      agentProfile,
      percentile,
      // Report health metadata for admin validation
      reportHealth: {
        generatedAt: new Date().toISOString(),
        metricsAvailable: available.length,
        metricsTotal: isUS ? 4 : 3,
        isUS,
        metrics: _validation,
        issues: [
          ...(_validation.treeCanopy.status === 'warning' ? [`Tree Canopy score ${treeCanopyScore} is very low -- satellite image may be from wrong season (image: ${_validation.treeCanopy.imageDate})`] : []),
          ...(_validation.treeCanopy.status === 'failed' ? ['Tree Canopy: satellite data fetch failed, using default score'] : []),
          ...(isUS && _validation.streetDesign.status === 'timeout' ? ['Street Design: EPA API timed out after 2 attempts -- metric excluded from score'] : []),
          ...(isUS && _validation.commuteMode.status === 'unavailable' ? ['Commute Mode: Census ACS data unavailable'] : []),
          ...(!isUS && streetGridScore < 3 ? [`Street Grid score ${streetGridScore} is unusually low -- OSM data may be sparse for this area`] : []),
        ],
        overallHealth: available.length >= (isUS ? 3 : 2) && !_validation.treeCanopy.status.match(/warning|failed/) ? 'good' : available.length >= 2 ? 'fair' : 'poor',
      },
    };

    console.log(`📊 Report: ${displayName} (${overallScore}/10 ${grade}, ${available.length} metrics, health: ${reportData.reportHealth.overallHealth}) — ${agentProfile.name}`);
    return reportData;
}

// POST /api/admin/sales/generate-report — single location report
app.post('/api/admin/sales/generate-report', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const { neighborhood, city, state, agentProfile } = req.body;
  if (!city || !agentProfile?.name) {
    return res.status(400).json({ error: 'city and agentProfile.name are required' });
  }
  try {
    const reportData = await generateReportForLocation(neighborhood, city, state, agentProfile);
    res.json(reportData);
  } catch (err) {
    console.error('Report generation failed:', err);
    res.status(500).json({ error: `Report generation failed: ${err.message}` });
  }
});

// POST /api/regenerate-report — public endpoint for report health check regeneration
// Called from AgentReportView when admin clicks "Regenerate" to refresh stale data
app.post('/api/regenerate-report', async (req, res) => {
  const { lat, lon, displayName, agentProfile } = req.body;
  if (!lat || !lon || !agentProfile?.name) {
    return res.status(400).json({ error: 'lat, lon, and agentProfile.name are required' });
  }
  try {
    // Reverse geocode to get neighborhood/city/state from lat/lon
    const geoResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`, {
      headers: { 'User-Agent': 'SafeStreets/1.0 (safestreets.streetsandcommons.com)' },
      signal: AbortSignal.timeout(8000),
    });
    const geoData = geoResp.ok ? await geoResp.json() : null;
    const addr = geoData?.address || {};
    const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter || '';
    const city = addr.city || addr.town || addr.village || '';
    const state = addr.state || '';

    console.log(`🔄 Regenerating report for: ${displayName || `${neighborhood}, ${city}`}`);
    const reportData = await generateReportForLocation(neighborhood, city, state, agentProfile);
    res.json(reportData);
  } catch (err) {
    console.error('Report regeneration failed:', err);
    res.status(500).json({ error: `Report regeneration failed: ${err.message}` });
  }
});

// POST /api/admin/sales/generate-comparison — compare 2-4 neighborhoods
app.post('/api/admin/sales/generate-comparison', async (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const { neighborhoods, agentProfile } = req.body;
  if (!Array.isArray(neighborhoods) || neighborhoods.length < 2 || neighborhoods.length > 4) {
    return res.status(400).json({ error: '2-4 neighborhoods required' });
  }
  if (!agentProfile?.name) {
    return res.status(400).json({ error: 'agentProfile.name is required' });
  }

  try {
    console.log(`🏘️  Comparison: ${neighborhoods.length} neighborhoods for ${agentProfile.name}`);
    const results = await Promise.allSettled(
      neighborhoods.map(n => generateReportForLocation(n.neighborhood, n.city, n.state, agentProfile))
    );

    const comparisonData = {
      type: 'comparison',
      neighborhoods: results.map((r, i) => ({
        reportData: r.status === 'fulfilled' ? r.value : null,
        status: r.status === 'fulfilled' ? 'success' : 'failed',
        error: r.status === 'rejected' ? r.reason?.message || 'Generation failed' : undefined,
        input: neighborhoods[i],
      })),
      agentProfile,
      generatedAt: new Date().toISOString(),
    };

    const successful = comparisonData.neighborhoods.filter(n => n.status === 'success');
    console.log(`📊 Comparison: ${successful.length}/${neighborhoods.length} succeeded — ${agentProfile.name}`);

    if (successful.length === 0) {
      return res.status(500).json({ error: 'All neighborhood reports failed to generate' });
    }

    res.json(comparisonData);
  } catch (err) {
    console.error('Comparison generation failed:', err);
    res.status(500).json({ error: `Comparison generation failed: ${err.message}` });
  }
});

// ════════════════════════════════════════════════════
// SHAREABLE REPORTS
// ════════════════════════════════════════════════════

// POST /api/reports — save a report (single or comparison) and get a shareable URL
app.post('/api/reports', (req, res) => {
  try {
    const { reportData } = req.body;
    const isComparison = reportData?.type === 'comparison';

    if (isComparison) {
      if (!reportData.neighborhoods?.length || reportData.neighborhoods.length < 2) {
        return res.status(400).json({ error: 'Comparison requires 2+ neighborhoods' });
      }
    } else {
      if (!reportData?.location || !reportData?.metrics) {
        return res.status(400).json({ error: 'Missing reportData with location and metrics' });
      }
    }

    const id = generateReportId();
    const db = loadReports();
    db.reports.push({
      id,
      reportData,
      type: isComparison ? 'comparison' : 'single',
      createdAt: new Date().toISOString(),
      viewCount: 0,
      leads: [],
    });
    db.count = db.reports.length;
    saveReports(db);

    const label = isComparison
      ? `${reportData.neighborhoods.filter(n => n.status === 'success').length} neighborhoods compared`
      : reportData.location.displayName;
    console.log(`📄 Report saved: ${id} — ${label}`);
    res.json({ id, shareUrl: `/r/${id}` });
  } catch (err) {
    console.error('Failed to save report:', err);
    res.status(500).json({ error: 'Failed to save report' });
  }
});

// GET /api/reports/:id — fetch report data by ID
app.get('/api/reports/:id', (req, res) => {
  try {
    const db = loadReports();
    const report = db.reports.find(r => r.id === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Increment view count
    report.viewCount = (report.viewCount || 0) + 1;
    saveReports(db);

    res.json({
      reportData: report.reportData,
      createdAt: report.createdAt,
      viewCount: report.viewCount,
    });
  } catch (err) {
    console.error('Failed to fetch report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// POST /api/reports/:id/lead — capture a lead from shared report
app.post('/api/reports/:id/lead', (req, res) => {
  try {
    const { email, name, phone } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = loadReports();
    const report = db.reports.find(r => r.id === req.params.id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Check if email already captured for this report
    if (!report.leads.some(l => l.email === email)) {
      report.leads.push({
        email,
        name: name || null,
        phone: phone || null,
        capturedAt: new Date().toISOString(),
      });
      saveReports(db);
      console.log(`📧 Lead captured on report ${req.params.id}: ${email}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Failed to capture lead:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
});

// POST /api/admin/sales/leads — add a new lead
app.post('/api/admin/sales/leads', (req, res) => {
  if (!requireAdminKey(req, res)) return;
  const { agentName, city, state } = req.body;
  if (!agentName || !city || !state) {
    return res.status(400).json({ error: 'agentName, city, and state are required' });
  }
  const leads = loadLeads();
  const maxRank = leads.reduce((max, l) => Math.max(max, l.rank || 0), 0);
  const newLead = {
    rank: maxRank + 1,
    agentName: req.body.agentName || '',
    brokerage: req.body.brokerage || '',
    city: req.body.city || '',
    state: req.body.state || '',
    neighborhood: req.body.neighborhood || '',
    email: req.body.email || '',
    phone: req.body.phone || '',
    website: req.body.website || '',
    sampleListing: req.body.sampleListing || '',
    listingPrice: req.body.listingPrice || '',
    qualificationNotes: req.body.qualificationNotes || '',
    outreachStatus: 'not_started',
    notes: '',
  };
  leads.push(newLead);
  saveLeads(leads);
  console.log(`📋 Added lead #${newLead.rank}: ${newLead.agentName} (${newLead.city}, ${newLead.state})`);
  res.json(newLead);
});

// POST /api/admin/sales/search — AI-powered agent search & qualification
app.post('/api/admin/sales/search', async (req, res) => {
  if (!requireAdminKey(req, res)) return;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { city, state, country = 'US', neighborhoods = '', count = 5 } = req.body;
  if (!city) {
    return res.status(400).json({ error: 'city is required' });
  }

  const safeCount = Math.min(Math.max(parseInt(count, 10) || 5, 1), 10);
  const locationDesc = state ? `${city}, ${state}` : `${city}, ${country}`;
  const neighborhoodHint = neighborhoods ? `\nFocus on these walkable neighborhoods: ${neighborhoods}` : '';

  // Load existing leads to avoid duplicates
  const existingLeads = loadLeads();
  const existingNames = existingLeads
    .filter(l => l.city.toLowerCase() === city.toLowerCase())
    .map(l => l.agentName.toLowerCase());
  const dupeWarning = existingNames.length
    ? `\nAVOID these agents (already in pipeline): ${existingNames.join(', ')}`
    : '';

  const prompt = `You are a sales research agent for SafeStreets, a walkability analysis tool that generates branded PDF reports for real estate agents. We sell a $99 one-time Pro license.

Find ${safeCount} real estate agents in ${locationDesc} who would be the best prospects for our walkability report tool.${neighborhoodHint}${dupeWarning}

QUALIFICATION CRITERIA:
- Agent specializes in walkable urban neighborhoods (not suburban/rural)
- Has active listings in the $400K-$1M price range (walkability premiums matter most here)
- Individual agent or small team (not mega-teams where your email gets lost)
- Contact info is publicly findable (has a website, listed on Compass/Zillow/Realtor.com)
- Bonus: already markets walkability/location as a selling point

For each agent, provide their REAL publicly available information. If you're not confident about specific contact details, say "verify at [website]" instead of guessing.

Return ONLY a JSON array (no markdown code fences):
[
  {
    "agentName": "Full Name",
    "brokerage": "Company Name",
    "city": "${city}",
    "state": "${state || country}",
    "neighborhood": "Primary walkable neighborhood they work",
    "email": "their@email.com or 'verify at website.com'",
    "phone": "(xxx) xxx-xxxx or 'verify at website.com'",
    "website": "https://their-website.com",
    "sampleListing": "Suggest searching their website for active listing",
    "listingPrice": "$XXXk-$XXXk range",
    "qualificationNotes": "One sentence on why they're a good prospect — mention specific walkability angle"
  }
]`;

  try {
    console.log(`🔍 AI searching for ${safeCount} agents in ${locationDesc}...`);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: `AI search failed (${response.status})` });
    }

    const result = await response.json();
    const text = result.content?.[0]?.text || '';

    let agents;
    try {
      agents = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        agents = JSON.parse(jsonMatch[0]);
      } else {
        return res.status(500).json({ error: 'AI returned invalid format. Please try again.' });
      }
    }

    // Filter out any that match existing leads
    const filtered = agents.filter(a =>
      !existingNames.includes(a.agentName?.toLowerCase())
    );

    console.log(`✅ Found ${filtered.length} new qualified agents in ${locationDesc}`);
    res.json({ agents: filtered, city, state });
  } catch (err) {
    console.error('Agent search error:', err);
    res.status(500).json({ error: 'Failed to search for agents. Please try again.' });
  }
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

// --- UTM conversion helper for Sentinel-2 pixel mapping ---
function latLonToUTM(lat, lon) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const a = 6378137; // WGS84 semi-major axis
  const f = 1 / 298.257223563;
  const e = Math.sqrt(2 * f - f * f);
  const e2 = (e * e) / (1 - e * e);
  const k0 = 0.9996;

  const latRad = lat * Math.PI / 180;
  const lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;

  const N = a / Math.sqrt(1 - e * e * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = e2 * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lon * Math.PI / 180 - lon0);

  const M = a * (
    (1 - e*e/4 - 3*e*e*e*e/64 - 5*e*e*e*e*e*e/256) * latRad
    - (3*e*e/8 + 3*e*e*e*e/32 + 45*e*e*e*e*e*e/1024) * Math.sin(2*latRad)
    + (15*e*e*e*e/256 + 45*e*e*e*e*e*e/1024) * Math.sin(4*latRad)
    - (35*e*e*e*e*e*e/3072) * Math.sin(6*latRad)
  );

  const easting = k0 * N * (
    A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*e2)*A*A*A*A*A/120
  ) + 500000;

  let northing = k0 * (
    M + N * Math.tan(latRad) * (
      A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24
      + (61-58*T+T*T+600*C-330*e2)*A*A*A*A*A*A/720
    )
  );

  if (lat < 0) northing += 10000000;

  return { easting, northing, zone };
}

// Sentinel-2 NDVI API - Calculate vegetation index for tree canopy
app.get('/api/ndvi', async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lon',
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    console.log(`🌳 Calculating NDVI for: ${latitude}, ${longitude}`);

    // 800m radius bounding box for STAC search
    const radius = 0.007;
    const bbox = [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ];

    // Search last 365 days (not 60) to find best imagery across seasons
    const today = new Date();
    const startDate = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

    const stacSearchUrl = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
    const searchBody = {
      collections: ['sentinel-2-l2a'],
      bbox: bbox,
      datetime: `${startDate.toISOString().split('T')[0]}/${today.toISOString().split('T')[0]}`,
      limit: 20,
      query: {
        'eo:cloud_cover': { lt: 15 },
      },
    };

    console.log(`📡 Searching Sentinel-2 imagery (last 365 days, <15% cloud)...`);
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
      console.log('⚠️  No Sentinel-2 imagery found');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'No cloud-free satellite imagery available for this location',
        },
      });
    }

    // Prefer peak growing-season images for accurate vegetation measurement
    // Peak months have greenest vegetation; avoids Mediterranean dry-season brown
    const peakRank = (dateStr) => {
      const m = new Date(dateStr).getMonth() + 1;
      const peak = latitude > 0 ? [5, 6] : [11, 12];       // May-Jun NH, Nov-Dec SH
      const good = latitude > 0 ? [4, 7] : [10, 1];         // Apr/Jul NH, Oct/Jan SH
      const ok   = latitude > 0 ? [3, 8] : [9, 2];          // Mar/Aug NH, Sep/Feb SH
      if (peak.includes(m)) return 0;
      if (good.includes(m)) return 1;
      if (ok.includes(m)) return 2;
      return 3; // off-season
    };
    // Sort: peak months first, then by cloud cover within each tier
    stacData.features.sort((a, b) => {
      const ra = peakRank(a.properties.datetime), rb = peakRank(b.properties.datetime);
      if (ra !== rb) return ra - rb;
      return (a.properties['eo:cloud_cover'] || 100) - (b.properties['eo:cloud_cover'] || 100);
    });
    const bestImage = stacData.features[0];
    console.log(`✅ Best image: ${bestImage.properties.datetime} (${bestImage.properties['eo:cloud_cover']}% cloud, peakRank: ${peakRank(bestImage.properties.datetime)})`);

    // Use B08 (NIR 10m) + B04 (Red 10m) — SAME resolution, no mismatch
    const b08Asset = bestImage.assets.B08;
    const b04Asset = bestImage.assets.B04;

    if (!b08Asset || !b04Asset) {
      throw new Error('Missing required spectral bands (B08, B04)');
    }

    // Sign the asset URLs for Planetary Computer access
    const signingEndpoint = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';
    const [b08SignedResponse, b04SignedResponse] = await Promise.all([
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b08Asset.href)}`),
      fetch(`${signingEndpoint}?href=${encodeURIComponent(b04Asset.href)}`),
    ]);

    const b08Signed = await b08SignedResponse.json();
    const b04Signed = await b04SignedResponse.json();

    // Open COGs (Cloud Optimized GeoTIFFs) — only fetches needed tiles
    const [tiffB08, tiffB04] = await Promise.all([
      fromUrl(b08Signed.href),
      fromUrl(b04Signed.href),
    ]);

    const [imageB08, imageB04] = await Promise.all([
      tiffB08.getImage(),
      tiffB04.getImage(),
    ]);

    const width = imageB08.getWidth();
    const height = imageB08.getHeight();

    // Convert lat/lon to pixel coordinates using image geo-transform
    const origin = imageB08.getOrigin();       // [utmX, utmY] of top-left pixel
    const resolution = imageB08.getResolution(); // [xRes, yRes] (yRes is negative)
    const utm = latLonToUTM(latitude, longitude);

    const targetX = Math.round((utm.easting - origin[0]) / resolution[0]);
    const targetY = Math.round((utm.northing - origin[1]) / resolution[1]);

    console.log(`📐 Target pixel: (${targetX}, ${targetY}) in ${width}x${height} image`);

    // Validate pixel is within the image
    if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
      console.log('⚠️  Target location falls outside the Sentinel-2 tile');
      return res.status(200).json({
        success: true,
        data: {
          ndvi: null,
          score: 5,
          category: 'No Data',
          dataQuality: 'estimated',
          message: 'Location falls outside available satellite tile',
        },
      });
    }

    // Sample 80x80 pixels centered on target (800m x 800m at 10m resolution)
    const sampleSize = 80;
    const halfSample = Math.floor(sampleSize / 2);
    const x0 = Math.max(0, targetX - halfSample);
    const y0 = Math.max(0, targetY - halfSample);
    const x1 = Math.min(width, x0 + sampleSize);
    const y1 = Math.min(height, y0 + sampleSize);

    console.log(`📐 Sampling ${x1-x0}x${y1-y0} pixels at user's location`);

    // Read pixel windows from both bands (same resolution = aligned pixels)
    const [dataB08, dataB04] = await Promise.all([
      imageB08.readRasters({ window: [x0, y0, x1, y1] }),
      imageB04.readRasters({ window: [x0, y0, x1, y1] }),
    ]);

    const nirValues = dataB08[0];
    const redValues = dataB04[0];

    let ndviSum = 0;
    let validPixels = 0;

    for (let i = 0; i < nirValues.length; i++) {
      const nir = nirValues[i];
      const red = redValues[i];

      // Sentinel-2 L2A surface reflectance: 0-10000 scale
      // Skip nodata, clouds, saturated pixels
      if (nir > 0 && red > 0 && nir < 10000 && red < 10000) {
        const ndvi = (nir - red) / (nir + red);
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
    const pixelCoverage = (validPixels / nirValues.length * 100).toFixed(0);
    console.log(`✅ NDVI: ${avgNDVI.toFixed(3)} from ${validPixels}/${nirValues.length} pixels (${pixelCoverage}% valid)`);

    // Urban-calibrated NDVI scoring curve (0-10 scale)
    // Dense urban areas (NDVI 0.05-0.15) get 2-4 instead of old 0.5-1.5
    let score;
    let category;

    if (avgNDVI < 0) {
      score = 0;
      category = 'No Vegetation';
    } else if (avgNDVI < 0.10) {
      score = Math.round((1 + (avgNDVI / 0.10) * 2) * 10) / 10;              // 0-0.10 -> 1-3
      category = 'Sparse Urban Greenery';
    } else if (avgNDVI < 0.20) {
      score = Math.round((3 + ((avgNDVI - 0.10) / 0.10) * 2) * 10) / 10;     // 0.10-0.20 -> 3-5
      category = 'Moderate Urban Greenery';
    } else if (avgNDVI < 0.35) {
      score = Math.round((5 + ((avgNDVI - 0.20) / 0.15) * 2.5) * 10) / 10;   // 0.20-0.35 -> 5-7.5
      category = 'Good Tree Cover';
    } else if (avgNDVI < 0.50) {
      score = Math.round((7.5 + ((avgNDVI - 0.35) / 0.15) * 2.5) * 10) / 10; // 0.35-0.50 -> 7.5-10
      category = 'Excellent Tree Cover';
    } else {
      score = 10;
      category = 'Dense Vegetation';
    }

    console.log(`🌳 Score: ${score}/10 (${category})`);

    res.json({
      success: true,
      data: {
        ndvi: parseFloat(avgNDVI.toFixed(3)),
        score: score,
        category: category,
        imageDate: bestImage.properties.datetime,
        cloudCover: bestImage.properties['eo:cloud_cover'],
        validPixels: validPixels,
        totalPixels: nirValues.length,
        pixelCoverage: `${pixelCoverage}%`,
        location: { lat: latitude, lon: longitude },
        dataSource: 'Sentinel-2 L2A (Microsoft Planetary Computer)',
        bands: 'B08 (NIR 10m) + B04 (Red 10m)',
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
// COMMUTE MODE (replaces Population Density — GHS-POP removed from Planetary Computer)
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

    // Step 1: FCC Census API → tract FIPS
    const fccRes = await fetch(
      `https://geo.fcc.gov/api/census/area?lat=${latitude}&lon=${longitude}&format=json`,
      { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'SafeStreets/1.0' } }
    );
    if (!fccRes.ok) throw new Error(`FCC API returned ${fccRes.status}`);
    const fccData = await fccRes.json();
    const blk = fccData.results?.[0];

    if (!blk?.block_fips) {
      // Non-US location or no coverage
      return res.json({
        success: true,
        data: { score: 50, category: 'No Data', dataSource: 'Census ACS (no coverage)' },
      });
    }

    const stateFips = blk.state_fips;
    const countyFips = blk.county_fips.substring(2);
    const tractFips = blk.block_fips.substring(5, 11);

    // Step 2: Census ACS — commute mode (B08301), income (B19013), home value (B25077), population (B01003)
    const acsUrl = `https://api.census.gov/data/2022/acs/acs5?get=B08301_001E,B08301_019E,B08301_018E,B08301_010E,B19013_001E,B25077_001E,B01003_001E&for=tract:${tractFips}&in=state:${stateFips}&in=county:${countyFips}`;
    const acsRes = await fetch(acsUrl, { signal: AbortSignal.timeout(15000) });

    if (!acsRes.ok) throw new Error(`Census ACS returned ${acsRes.status}`);
    const acsJson = await acsRes.json();

    if (!acsJson || acsJson.length < 2) {
      return res.json({
        success: true,
        data: { score: 50, category: 'No Data', dataSource: 'Census ACS (no tract data)' },
      });
    }

    const row = acsJson[1];
    const totalWorkers = parseInt(row[0]) || 0;
    const walkCount = parseInt(row[1]) || 0;
    const bikeCount = parseInt(row[2]) || 0;
    const transitCount = parseInt(row[3]) || 0;
    const medianIncome = parseInt(row[4]) || null;
    const medianHomeValue = parseInt(row[5]) || null;
    const totalPop = parseInt(row[6]) || 0;

    const pct = (n) => totalWorkers > 0 ? Math.round(n / totalWorkers * 1000) / 10 : 0;
    const walkPct = pct(walkCount);
    const bikePct = pct(bikeCount);
    const transitPct = pct(transitCount);
    const altPct = Math.round((walkPct + bikePct + transitPct) * 10) / 10;

    // Score: same as agent report scoring
    let score;
    if (altPct >= 50) score = 100;
    else if (altPct >= 35) score = 85;
    else if (altPct >= 20) score = 70;
    else if (altPct >= 10) score = 55;
    else if (altPct >= 5) score = 40;
    else score = 20;

    const category = altPct >= 40 ? 'Strong Car-Optional' :
      altPct >= 20 ? 'Good Alternatives' :
      altPct >= 10 ? 'Some Alternatives' : 'Car-Dependent';

    res.json({
      success: true,
      data: {
        score,
        category,
        walkPct, bikePct, transitPct, altPct,
        medianIncome, medianHomeValue, totalPop,
        dataSource: 'Census ACS 2022',
        dataQuality: 'verified',
      },
    });

  } catch (error) {
    console.error('Error fetching commute mode:', error.message);
    // Graceful fallback instead of 500
    res.json({
      success: true,
      data: { score: 50, category: 'No Data', dataSource: 'Census ACS (unavailable)' },
    });
  }
});


function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =====================
// GROUND-TRUTH GREENERY (Web Image Search + Claude Vision)
// =====================
// Searches the web for street-level photos of the location, then uses
// Claude Vision to analyze actual greenery. Falls back to knowledge-only
// assessment if no images can be found.

const greeneryCache = new Map();
const GREENERY_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// =====================
// GROUND TRUTH GREENERY SCORING
// Uses Claude Sonnet with web search tool to research any location
// Searches: Walk Score, tree canopy data, Wikipedia, GitHub, city open data, news
// =====================

async function fetchGroundTruthGreenery(lat, lon, locationName) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return null;

  const cacheKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const cached = greeneryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GREENERY_CACHE_TTL) {
    return cached.data;
  }
  if (greeneryCache.size >= 500) {
    const oldest = [...greeneryCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) greeneryCache.delete(oldest[0]);
  }

  try {
    console.log(`  Researching greenery for ${locationName} (${lat}, ${lon})...`);

    const requestBody = {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{
        role: 'user',
        content: `You are an urban forestry analyst scoring pedestrian-level tree canopy and greenery for a walkability tool.

Research and score the pedestrian greenery experience for: ${locationName} (${lat}, ${lon})

SEARCH the web for:
1. Walk Score and walkability data for this specific neighborhood
2. Tree canopy coverage, street trees, urban forestry programs
3. Parks, boulevards, greenways within walking distance
4. Any tree canopy studies, city forestry data, or GIS datasets

After researching, return ONLY valid JSON (no other text, no markdown):
{
  "score": <0.0-10.0>,
  "confidence": "high|medium|low",
  "greenCharacter": "<one sentence describing the pedestrian greenery experience>",
  "knownFeatures": ["feature1", "feature2", "feature3", "feature4", "feature5"]
}

Scoring guide:
0-1: Industrial/highway, no vegetation
2-3: Dense commercial core, concrete canyon, very few street trees (Times Square, downtown parking lots)
4-5: Some street trees but inconsistent, limited shade
6-7: Good tree coverage, shade on most blocks, parks nearby, pleasant walking
7-8: Well-treed neighborhood, tree-lined streets, multiple parks, Walk Score 90+
8-9: Exceptional canopy, famous for trees, continuous shade
9-10: World-class urban forest (Savannah historic district, old-growth urban areas)

Your score must reflect the ACTUAL WALKING EXPERIENCE based on the data you find. Trust Walk Score, tree canopy percentages, and neighborhood descriptions over any single photo.`
      }],
    };

    // Retry up to 2 times with backoff for rate limiting (429)
    let data = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const delay = attempt * 5000; // 5s, 10s backoff
        console.log(`  Retrying greenery request (attempt ${attempt + 1}/3) after ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(60000),
      });

      if (response.status === 429) {
        const errBody = await response.text().catch(() => '');
        console.warn(`  Ground truth greenery: rate limited (429), attempt ${attempt + 1}/3: ${errBody.substring(0, 100)}`);
        if (attempt < 2) continue; // retry
        return null;
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.warn(`  Ground truth greenery: API returned ${response.status}: ${errBody.substring(0, 200)}`);
        return null;
      }

      data = await response.json();
      break; // success
    }

    if (!data) return null;

    // Extract the final text response (after web search tool use)
    let text = null;
    for (const block of (data.content || []).reverse()) {
      if (block.type === 'text' && block.text) {
        text = block.text;
        break;
      }
    }
    if (!text) {
      console.warn(`  Ground truth greenery: no text in response. stop_reason=${data.stop_reason}, blocks=${(data.content || []).map(b => b.type).join(',')}`);
      return null;
    }

    // Count web searches performed
    const searchCount = (data.content || []).filter(b => b.type === 'server_tool_use').length;

    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Extract JSON from text that may have surrounding content
    const jsonMatch = jsonStr.match(/\{[\s\S]*"score"[\s\S]*"confidence"[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 10) return null;
    if (!['high', 'medium', 'low'].includes(parsed.confidence)) parsed.confidence = 'low';

    const result = {
      score: Math.round(parsed.score * 10) / 10,
      confidence: parsed.confidence,
      greenCharacter: parsed.greenCharacter || null,
      knownFeatures: Array.isArray(parsed.knownFeatures) ? parsed.knownFeatures.slice(0, 5) : [],
      webSearches: searchCount,
      dataSource: searchCount > 0 ? `Web Research (${searchCount} searches)` : 'Claude Knowledge',
    };

    greeneryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    console.log(`  Ground truth: ${result.score}/10 (${result.confidence}) [${searchCount} searches] -- ${result.greenCharacter?.substring(0, 80)}`);
    return result;
  } catch (e) {
    console.warn(`  Ground truth greenery failed: ${e.message}`);
    return null;
  }
}

// GET /api/ground-truth-greenery -- standalone endpoint for testing + frontend
app.get('/api/ground-truth-greenery', async (req, res) => {
  try {
    const { lat, lon, name } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const locationName = name || `${lat}, ${lon}`;
    const result = await fetchGroundTruthGreenery(parseFloat(lat), parseFloat(lon), locationName);
    if (!result) return res.json({ success: false, reason: 'unavailable' });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================
// STREET DESIGN (EPA National Walkability Index)
// =====================

const epaCache = new Map();
const EPA_CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days (census block data, updates every few years)

app.get('/api/street-design', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Check cache
    const cacheKey = `epa:${latNum.toFixed(4)},${lonNum.toFixed(4)}`;
    const cached = epaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < EPA_CACHE_TTL) {
      console.log(`📦 EPA cache hit for ${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`);
      const debug = req.query.debug === '1';
      if (debug) return res.json({ success: true, data: cached.data, debug: { cacheHit: true, cacheAge: `${Math.round((Date.now() - cached.timestamp) / 1000)}s`, cacheKey } });
      return res.json({ success: true, data: cached.data });
    }

    console.log(`🛣️ Fetching EPA Walkability Index for: ${latNum}, ${lonNum}`);

    const epaUrl = `https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?` +
      `geometry=${lonNum},${latNum}` +
      `&geometryType=esriGeometryPoint` +
      `&inSR=4326` +
      `&spatialRel=esriSpatialRelIntersects` +
      `&outFields=NatWalkInd,D3B,D3B_Ranked,D4A,D4A_Ranked,D2B_E8MIXA,D2B_Ranked,D1A,D1B,AutoOwn0,AutoOwn1,AutoOwn2p,TotPop,Workers,Ac_Total,CBSA_Name,CSA_Name` +
      `&returnGeometry=false` +
      `&f=json`;

    // Try up to 2 attempts with increasing timeout
    const debug = req.query.debug === '1';
    const debugInfo = { cacheHit: false, attempts: [], rawFeatureCount: null, epaUrl };
    let epaData = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const timeoutMs = attempt === 1 ? 15000 : 25000;
        const start = Date.now();
        const response = await fetch(epaUrl, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'User-Agent': 'SafeStreets/1.0' },
        });
        const elapsed = Date.now() - start;
        debugInfo.attempts.push({ attempt, status: response.status, elapsed: `${elapsed}ms`, ok: response.ok });
        if (!response.ok) throw new Error(`EPA API returned ${response.status}`);
        epaData = await response.json();
        debugInfo.rawFeatureCount = epaData?.features?.length ?? 0;
        break;
      } catch (retryErr) {
        debugInfo.attempts.push({ attempt, error: retryErr.message });
        console.warn(`  EPA attempt ${attempt} failed: ${retryErr.message}`);
        if (attempt === 2) throw retryErr;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (!epaData.features || epaData.features.length === 0) {
      console.log(`🛣️ No EPA data for this location (likely outside US)`);
      if (debug) return res.json({ success: true, data: null, debug: debugInfo, rawResponse: epaData });
      return res.json({ success: true, data: null });
    }

    const attrs = epaData.features[0].attributes;

    // D3B: Street intersection density (pedestrian-oriented, 1-20 ranked)
    // D4A: Distance to nearest transit stop (1-20 ranked)
    // D2B: Land use mix (employment + household + employment sectors, 1-20 ranked)
    // NatWalkInd: National Walkability Index composite (1-20)
    const d3bRank = attrs.D3B_Ranked ?? attrs.D3B ?? 0;  // Street connectivity
    const d4aRank = attrs.D4A_Ranked ?? attrs.D4A ?? 0;  // Transit proximity
    const d2bRank = attrs.D2B_Ranked ?? 0;                // Land use mix
    const natWalkInd = attrs.NatWalkInd ?? 0;             // Overall EPA walkability

    // Calculate score: weighted blend of D3B (street connectivity, 50%), D4A (transit, 30%), D2B (land use, 20%)
    // EPA ranks are 1-20, convert to 0-100
    const d3bScore = Math.round((d3bRank / 20) * 100);
    const d4aScore = Math.round((d4aRank / 20) * 100);
    const d2bScore = Math.round((d2bRank / 20) * 100);
    const score = Math.round(d3bScore * 0.50 + d4aScore * 0.30 + d2bScore * 0.20);

    // Zero-car household percentage
    const totalHH = (attrs.AutoOwn0 ?? 0) + (attrs.AutoOwn1 ?? 0) + (attrs.AutoOwn2p ?? 0);
    const zeroCarPct = totalHH > 0 ? Math.round((attrs.AutoOwn0 / totalHH) * 100) : null;

    // Category label
    let category;
    if (score >= 80) category = 'Excellent street design for walking';
    else if (score >= 60) category = 'Good street design for walking';
    else if (score >= 40) category = 'Moderate street design';
    else if (score >= 20) category = 'Car-oriented street design';
    else category = 'Very car-dependent design';

    const result = {
      score,
      category,
      d3bRank,         // Street intersection density (1-20)
      d4aRank,         // Transit proximity (1-20)
      d2bRank,         // Land use mix (1-20)
      natWalkInd,      // EPA composite (1-20)
      // NatWalkInd_Ranked removed -- field no longer exists in EPA dataset
      zeroCarPct,
      totalPop: attrs.TotPop ?? null,
      metroArea: attrs.CBSA_Name || attrs.CSA_Name || null,
      dataSource: 'EPA National Walkability Index',
    };

    // Cache it
    epaCache.set(cacheKey, { data: result, timestamp: Date.now() });
    if (epaCache.size > 1000) {
      const oldest = epaCache.keys().next().value;
      epaCache.delete(oldest);
    }

    console.log(`🛣️ EPA result: score=${score}, D3B=${d3bRank}/20, D4A=${d4aRank}/20, NatWalkInd=${natWalkInd}`);

    res.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ EPA Walkability Index error:', error.message);
    // Graceful fallback: return null instead of 500
    res.json({ success: true, data: null });
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
        'B19013_001E', // [0] Median household income
        'B25077_001E', // [1] Median home value
        'B23025_005E', // [2] Unemployed
        'B23025_002E', // [3] In labor force
        'B17001_002E', // [4] Below poverty
        'B17001_001E', // [5] Total (for poverty rate)
        'B01002_001E', // [6] Median age
        'B15003_022E', // [7] Bachelor's degree
        'B15003_023E', // [8] Master's degree
        'B15003_024E', // [9] Professional degree
        'B15003_025E', // [10] Doctorate
        'B15003_001E', // [11] Total (for education rate)
        // Commute mode (ACS Table B08301)
        'B08301_001E', // [12] Total commuters
        'B08301_019E', // [13] Walked to work
        'B08301_018E', // [14] Bicycle
        'B08301_010E', // [15] Public transit
        'B08301_003E', // [16] Carpooled
        'B08301_021E', // [17] Worked from home
        // Vehicle availability (ACS Table B08201)
        'B08201_002E', // [18] 0-vehicle households
        'B08201_001E', // [19] Total households
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

      // Commute mode data
      const totalCommuters = parse(row[12]);
      const walked = parse(row[13]);
      const biked = parse(row[14]);
      const transit = parse(row[15]);
      const carpooled = parse(row[16]);
      const wfh = parse(row[17]);
      const zeroCarHH = parse(row[18]);
      const totalHH = parse(row[19]);

      const pct = (num, denom) => (num !== null && denom !== null && denom > 0)
        ? Math.round((num / denom) * 1000) / 10
        : 0;

      const commute = (totalCommuters !== null && totalCommuters > 0) ? {
        totalWorkers: totalCommuters,
        walkPct: pct(walked, totalCommuters),
        bikePct: pct(biked, totalCommuters),
        transitPct: pct(transit, totalCommuters),
        carpoolPct: pct(carpooled, totalCommuters),
        wfhPct: pct(wfh, totalCommuters),
        zeroCar: pct(zeroCarHH, totalHH),
        totalHouseholds: totalHH || 0,
      } : null;

      const result = {
        type: 'us',
        tractFips: `${stateFips}${countyFips}${tractCode}`,
        medianHouseholdIncome: medianIncome,
        medianHomeValue: medianHomeValue,
        unemploymentRate,
        povertyRate,
        medianAge: (medianAge && medianAge > 0 && medianAge < 120) ? medianAge : null,
        bachelorOrHigherPct,
        commute,
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
// CDC PLACES HEALTH DATA
// =====================

const cdcCache = new Map();
const CDC_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

app.get('/api/cdc-health', async (req, res) => {
  try {
    const { tractFips } = req.query;
    if (!tractFips || !/^\d{11}$/.test(tractFips)) {
      return res.status(400).json({ error: 'Missing or invalid tractFips (must be 11 digits)' });
    }

    const cacheKey = `cdc:${tractFips}`;
    const cached = cdcCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CDC_CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }

    console.log(`🏥 Fetching CDC PLACES data for tract: ${tractFips}`);

    const url = `https://data.cdc.gov/resource/cwsq-ngmh.json?locationid=${tractFips}&$limit=50`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'SafeStreets/2.0' },
    });

    if (!response.ok) throw new Error(`CDC API returned ${response.status}`);
    const data = await response.json();

    if (!data || data.length === 0) {
      cdcCache.set(cacheKey, { data: null, timestamp: Date.now() });
      return res.json({ success: true, data: null });
    }

    // CDC PLACES returns one row per measure per tract
    const getValue = (measureId) => {
      const row = data.find(r => r.measureid === measureId || r.measure_id === measureId);
      if (!row) return null;
      const val = parseFloat(row.data_value);
      return isNaN(val) ? null : Math.round(val * 10) / 10;
    };

    const result = {
      tractFips,
      obesity: getValue('OBESITY'),
      diabetes: getValue('DIABETES'),
      physicalInactivity: getValue('LPA'),
      mentalHealth: getValue('MHLTH'),
      asthma: getValue('CASTHMA'),
      dataYear: 2023,
      dataSource: 'CDC PLACES',
    };

    console.log(`✅ CDC PLACES: obesity=${result.obesity}%, diabetes=${result.diabetes}%`);
    cdcCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ Error fetching CDC health data:', error);
    res.json({ success: true, data: null });
  }
});

// =====================
// FEMA FLOOD RISK
// =====================

const floodCache = new Map();
const FLOOD_CACHE_TTL = 24 * 60 * 60 * 1000;

app.get('/api/flood-risk', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
      return res.status(400).json({ error: 'Missing required parameters: lat, lon' });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    const cacheKey = `flood:${latNum.toFixed(4)},${lonNum.toFixed(4)}`;
    const cached = floodCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FLOOD_CACHE_TTL) {
      return res.json({ success: true, data: cached.data });
    }

    console.log(`🌊 Fetching FEMA flood data for: ${latNum}, ${lonNum}`);

    const femaUrl = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?geometry=${lonNum},${latNum}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY&returnGeometry=false&f=json`;

    const response = await fetch(femaUrl, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'SafeStreets/2.0' },
    });

    if (!response.ok) throw new Error(`FEMA API returned ${response.status}`);
    const data = await response.json();

    if (!data.features || data.features.length === 0) {
      // No flood data = likely outside NFHL coverage or minimal risk
      const result = {
        floodZone: 'X',
        isHighRisk: false,
        description: 'Minimal flood risk — outside mapped flood hazard areas',
        dataSource: 'FEMA NFHL',
      };
      floodCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return res.json({ success: true, data: result });
    }

    const zone = data.features[0].attributes.FLD_ZONE || 'X';
    const highRiskZones = ['A', 'AE', 'AH', 'AO', 'AR', 'V', 'VE'];
    const moderateZones = ['B', 'X500', 'D'];
    const isHighRisk = highRiskZones.includes(zone);
    const isModerate = moderateZones.includes(zone);

    const descriptions = {
      A: 'High risk — 1% annual flood chance (100-year floodplain)',
      AE: 'High risk — 1% annual flood chance with base flood elevations',
      AH: 'High risk — shallow flooding (1-3 feet)',
      AO: 'High risk — sheet flow flooding (1-3 feet)',
      V: 'High risk — coastal flood zone with wave action',
      VE: 'High risk — coastal flood zone with base flood elevations',
      X: 'Minimal flood risk',
      D: 'Undetermined risk — possible but not analyzed',
    };

    const result = {
      floodZone: zone,
      isHighRisk,
      description: descriptions[zone] || (isModerate ? 'Moderate flood risk — 0.2% annual chance' : `Flood zone ${zone}`),
      dataSource: 'FEMA NFHL',
    };

    console.log(`✅ FEMA flood: zone=${zone}, highRisk=${isHighRisk}`);
    floodCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.json({ success: true, data: result });

  } catch (error) {
    console.error('❌ Error fetching flood risk:', error);
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
      pro: {
        amount: 9900, // $99 one-time
        name: 'SafeStreets Pro — Agent Reports',
        description: 'Branded walkability reports for real estate listings',
        mode: 'payment',
      },
    };

    const selectedPricing = pricing[tier];
    if (!selectedPricing) {
      return res.status(400).json({ error: 'Invalid tier. Must be "pro"' });
    }

    console.log(`💳 Creating checkout session for ${email} - ${tier} tier (${selectedPricing.mode})`);

    // Build checkout session config
    const sessionConfig = {
      payment_method_types: ['card'],
      customer_email: email,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/?payment=cancelled`,
      metadata: {
        userId: userId || '',
        tier,
        locationName: locationName || '',
        companyName: metadata?.companyName || '',
      },
    };

    if (selectedPricing.mode === 'subscription') {
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: selectedPricing.name, description: selectedPricing.description },
          unit_amount: selectedPricing.amount,
          recurring: { interval: selectedPricing.interval },
        },
        quantity: 1,
      }];
      sessionConfig.subscription_data = {
        metadata: { userId: userId || '', tier },
      };
    } else {
      sessionConfig.mode = 'payment';
      sessionConfig.line_items = [{
        price_data: {
          currency: 'usd',
          product_data: { name: selectedPricing.name, description: `${selectedPricing.description} for ${locationName}` },
          unit_amount: selectedPricing.amount,
        },
        quantity: 1,
      }];
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create(sessionConfig);

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

      // Validate tier to prevent metadata tampering
      const validTiers = ['pro'];
      if (tier && !validTiers.includes(tier)) {
        console.error(`❌ Invalid tier in session metadata: ${tier}`);
        return res.status(400).json({ error: 'Invalid tier in session metadata' });
      }

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
                  ...(tier === 'pro' && session.subscription ? { stripeSubscriptionId: session.subscription } : {}),
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

    // Handle subscription cancellation — downgrade pro users
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId;
      console.log(`⚠️  Subscription cancelled: ${subscription.id}`);

      if (userId) {
        try {
          const clerkSecretKey = process.env.CLERK_SECRET_KEY;
          if (clerkSecretKey) {
            const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${clerkSecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                public_metadata: {
                  tier: 'free',
                  cancelledAt: new Date().toISOString(),
                },
              }),
            });

            if (clerkRes.ok) {
              console.log(`✅ User ${userId} downgraded to free tier after subscription cancellation`);
            } else {
              console.error(`❌ Failed to downgrade user ${userId}`);
            }
          }
        } catch (err) {
          console.error('❌ Failed to process subscription cancellation:', err.message);
        }
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

  // Push to Airtable (non-blocking)
  pushToAirtable({
    Email: email,
    Source: `Contact: ${projectType}`,
    Location: inquiry.location,
    Type: 'Contact Inquiry',
    Notes: `Name: ${name}\nOrg/Role: see description\nTimeline: ${inquiry.timeline}\n\n${description}`,
    'Captured At': inquiry.submittedAt,
  });

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

// ─── Meridian Chatbot (Anthropic Claude, streaming) ──────────────────────────

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many messages. Please slow down.' },
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  // Track chat message
  trackEvent('chat', req);

  try {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(503).json({ error: 'Chat is not configured. Add ANTHROPIC_API_KEY.' });
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
- Sharp, direct, and honest. No filler. No corporate softness. No overselling what the data can tell us.
- Thoughtful — connect the user's specific data to bigger urban truths, but always be clear about what is measured data vs general urban planning knowledge
- Inspirational — remind people that better streets are not utopian; they exist right now in cities worldwide
- Advocate's edge — when data reveals a failing, name it clearly, but qualify appropriately. A crossing safety score of 2/10 BASED ON OUR DATA suggests crossings may be sparse — but note whether OSM coverage could be a factor
- Use specific numbers, standards, and comparisons. Vague advice is useless advice. But distinguish YOUR data from general benchmarks
- Keep responses focused (2-4 paragraphs) unless the user asks for depth. Every sentence should earn its place
- When relevant, connect to the human story: who is affected, what daily life looks like, what changes would feel like
- Be honest about uncertainty. "Our data suggests" and "based on available mapping data" are more trustworthy than false confidence. Users respect honesty more than a chatbot that pretends to know everything

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

STREET DESIGN (scored metric — EPA National Walkability Index):
- D3B: Street intersection density (weighted 50%)
- D4A: Distance to nearest transit stop (weighted 30%)
- D2B: Land use diversity/employment mix (weighted 20%)
- EPA ranks 1-20 per census block group, converted to 0-100 score
- Source: geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex

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

DATA SOURCES & HONEST LIMITATIONS — READ THIS CAREFULLY:

This tool uses two types of data with VERY different reliability levels. You MUST communicate this distinction honestly.

US LOCATIONS (4 metrics):
- Tree Canopy: ESA Sentinel-2 NDVI at 10m resolution — measures actual vegetation, reliable (HIGH)
- Street Design: EPA National Walkability Index — intersection density, transit proximity, land use mix (MEDIUM)
- Destinations: OSM amenity/shop/leisure POIs — captures major destinations but misses many small businesses (MEDIUM-LOW)
- Commute Mode: US Census ACS — car-free commuting percentage (MEDIUM)

INTERNATIONAL LOCATIONS (3 metrics):
- Tree Canopy: ESA Sentinel-2 NDVI at 10m resolution (HIGH)
- Street Grid: OSM road network — intersection density, block length, dead-end ratio (MEDIUM)
- Destinations: OSM amenity/shop/leisure POIs (MEDIUM-LOW)

Note: Street Grid is excluded for US locations because EPA Street Design already captures intersection density, avoiding double-counting. EPA and Census data are US-only, so international locations use OSM Street Grid instead.

CRITICAL: OSM coverage varies enormously by city. Well-mapped cities (e.g., Portland, Berlin, Amsterdam) have rich data. Many cities in Africa, South Asia, Southeast Asia, parts of Australia, and smaller cities worldwide have sparse, incomplete, or outdated OSM data. Scores for these places may reflect MAPPING GAPS, not actual conditions on the ground.

You MUST NOT present OSM-derived scores as ground truth. Always qualify them.

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

ENTERPRISE AWARENESS:
If the user asks about analyzing multiple locations, city-wide assessments, team access, API access, bulk analysis, reports for clients, planning department use, or organizational/municipal deployment — naturally mention that Streets & Commons offers an enterprise tier with custom multi-location dashboards, field audits, and dedicated support. Say something like: "For multi-location or organizational needs, Streets & Commons offers an enterprise solution — you can learn more at streetsandcommons.com/enterprise or book a consultation there." Keep it brief and natural — don't push it if the user is just asking a regular question. Only mention it when their question genuinely signals organizational or multi-site needs.

CRITICAL RULES — NEVER BREAK THESE:
1. NEVER fabricate contact info (phone, email, addresses, URLs). Say "Search your city's official website for [department]" instead.
2. NEVER claim you can perform actions. You CANNOT send emails, submit letters, or take action outside this chat. Draft content for the user to send themselves.
3. NEVER invent statistics beyond what's provided above or in the user's actual scores. If unsure, say so.
4. Suggest TYPES of officials/departments — never invent specific names or contact details.
5. Always: "Here's a draft you can send" — never "I've submitted this for you."
6. When explaining scores, anchor to specific standards (e.g., "Your crossing safety score of 2.6/10 means crosswalks are sparse and unprotected, far below NACTO's 80-100m standard").
7. Be specific and actionable. Generic encouragement is not advocacy. Connect every recommendation to the user's data.
8. Channel the thinkers: when a Jacobs insight or a Speck principle is relevant, weave it in naturally — not as decoration, but as the intellectual backbone of your answer.

HONESTY & DATA INTEGRITY — THESE ARE EQUALLY CRITICAL:
9. ALWAYS distinguish between "what our tool's data shows" vs "general urban planning knowledge." NEVER present general knowledge as if it came from the user's analysis. Say "Based on your scores..." for actual data, and "Generally in urban planning..." for background knowledge.
10. NEVER describe sidewalk condition, quality, width, accessibility, or usability. Our sidewalk metric ONLY measures whether sidewalks are tagged in OpenStreetMap. Say "Our data shows X% of streets have mapped sidewalks" — NEVER "the sidewalks in this area are good/bad/narrow/wide/broken."
11. NEVER describe street lighting conditions as fact. Our lighting data is mostly inferred, not measured. Say "Our estimate suggests..." or "Based on limited available data..." — NEVER "this area has poor lighting" as a definitive claim.
12. When scores seem surprisingly low or high, proactively flag that OSM mapping coverage may be a factor. Example: "This area shows low crossing data — this could mean crossings are genuinely sparse, or it may reflect limited mapping coverage in OpenStreetMap for this area."
13. NEVER make specific claims about a location's physical infrastructure (e.g., "the sidewalks here are cracked," "this intersection lacks a signal," "there are no bike lanes on X street") unless that specific detail is in the provided analysis data. You are not a local — do not pretend to be.
14. For cities outside well-mapped regions (North America, Western Europe, Japan, South Korea), add a brief data confidence note: "Note: OpenStreetMap coverage for [city/region] may be limited, so these scores should be interpreted as estimates rather than definitive assessments."
15. When the user asks about something we don't measure (e.g., crime safety, ADA compliance, pavement quality, road noise), be upfront: "That's not something our tool measures. Our analysis covers [list actual metrics]. For [their question], you'd need [suggest appropriate source]."
16. Be an honest urban planner, not a salesperson. If the data is uncertain, say so. Trust is more valuable than appearing comprehensive. An honest "we can't tell you that from our data" is always better than a confident guess.`;

    if (context) {
      systemPrompt += `\n\nCURRENT ANALYSIS DATA:`;
      if (context.locationName) {
        systemPrompt += `\nLocation: ${context.locationName}`;
      }
      if (context.metrics) {
        const m = context.metrics;
        systemPrompt += `\n\nMetric Scores (0-10 scale):`;
        if (m.treeCanopy !== undefined) systemPrompt += `\n- Tree Canopy: ${m.treeCanopy}/10`;
        if (m.streetGrid !== undefined && m.streetGrid > 0) systemPrompt += `\n- Street Grid: ${m.streetGrid}/10`;
        if (m.streetDesign !== undefined) systemPrompt += `\n- Street Design: ${m.streetDesign}/10`;
        if (m.destinationAccess !== undefined) systemPrompt += `\n- Daily Needs Access: ${m.destinationAccess}/10`;
        if (m.commuteMode !== undefined) systemPrompt += `\n- Commute Mode: ${m.commuteMode}/10`;
        if (m.overallScore !== undefined) systemPrompt += `\n\nOverall Score: ${m.overallScore}/10 (${m.label || 'N/A'})`;

        const metricEntries = [
          ['Daily Needs Access', m.destinationAccess],
          ['Tree Canopy', m.treeCanopy],
          ['Street Grid', m.streetGrid],
          ['Street Design', m.streetDesign],
          ['Commute Mode', m.commuteMode],
        ].filter(([, v]) => typeof v === 'number' && v > 0);

        const weakest = metricEntries.sort((a, b) => a[1] - b[1]).slice(0, 3);
        if (weakest.length > 0) {
          systemPrompt += `\n\nWeakest areas: ${weakest.map(([name, score]) => `${name} (${score}/10)`).join(', ')}`;
        }
      }
      if (context.dataQuality) {
        systemPrompt += `\nData confidence: ${context.dataQuality.confidence}`;
        if (context.dataQuality.confidence === 'low') {
          systemPrompt += `\nWARNING: Data confidence is LOW for this location. OpenStreetMap coverage may be sparse. Be extra cautious about making specific claims — clearly communicate that scores are estimates based on limited available data.`;
        }
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        system: systemPrompt,
        messages: trimmedMessages,
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic chat error:', response.status, errorText);
      if (response.status === 429) {
        res.write(`data: ${JSON.stringify({ error: 'rate_limited', retryAfter: 30 })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Chat service temporarily unavailable.' })}\n\n`);
      }
      res.end();
      return;
    }

    // Stream the Anthropic response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              res.write(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`);
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

  // SPA fallback - serve index.html for non-API, non-asset routes (no cache)
  // Assets must NOT fall through here — missing hashed assets should 404,
  // not return index.html (which causes MIME type errors in the browser).
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/assets/')) {
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

// Debug: proxy raw EPA response to diagnose Railway connectivity
app.get('/api/debug/epa-raw', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat, lon required' });
    const epaUrl = `https://geodata.epa.gov/arcgis/rest/services/OA/WalkabilityIndex/MapServer/0/query?` +
      `geometry=${parseFloat(lon)},${parseFloat(lat)}` +
      `&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&outFields=NatWalkInd,D3B_Ranked,D4A_Ranked,D2B_Ranked,CBSA_Name,TotPop` +
      `&returnGeometry=false&f=json`;
    const start = Date.now();
    const resp = await fetch(epaUrl, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'SafeStreets/1.0' },
    });
    const elapsed = Date.now() - start;
    const body = await resp.text();
    res.json({ status: resp.status, elapsed: `${elapsed}ms`, headers: Object.fromEntries(resp.headers), bodyLength: body.length, body: JSON.parse(body) });
  } catch (e) { res.status(500).json({ error: e.message, name: e.name }); }
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
  console.log(`   🚶 Commute Mode: GET /api/population-density`);
  console.log(`   🛣️  Street Design: GET /api/street-design (EPA Walkability Index)`);
  console.log(`   🗺️  Overpass Proxy: POST /api/overpass`);
  console.log(`   💳 Stripe Checkout: POST /api/create-checkout-session ${stripe ? '(configured)' : '(needs API key)'}`);
  console.log(`   🔑 Verify Payment: GET /api/verify-payment ${process.env.CLERK_SECRET_KEY ? '(configured)' : '(needs CLERK_SECRET_KEY)'}`);
  console.log(`   🪝 Stripe Webhook: POST /api/stripe-webhook ${process.env.STRIPE_WEBHOOK_SECRET ? '(configured)' : '(needs STRIPE_WEBHOOK_SECRET)'}`);
  console.log(`   📬 Contact Inquiry: POST /api/contact-inquiry ${process.env.SMTP_HOST ? '(email configured)' : '(console-only)'}\n`);
});
