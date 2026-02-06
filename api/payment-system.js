/**
 * Payment System - Email Magic Link + JWT Access Control
 *
 * Flow:
 * 1. User pays via Stripe → Webhook fires
 * 2. Generate JWT token with email + tier
 * 3. Send magic link email
 * 4. User clicks link → Token verified → Access granted
 * 5. Token stored in localStorage (works cross-device via email)
 */

import fs from 'fs/promises';
import path from 'path';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// JWT secret (should be in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'safestreets-dev-secret-change-in-production';
const PURCHASES_DB = path.join(__dirname, 'data', 'purchases.json');

/**
 * Load purchases database
 */
async function loadPurchases() {
  try {
    const data = await fs.readFile(PURCHASES_DB, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, return empty structure
    return { purchases: [] };
  }
}

/**
 * Save purchases database
 */
async function savePurchases(data) {
  await fs.writeFile(PURCHASES_DB, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Generate JWT access token
 */
export function generateAccessToken(email, tier, locationName) {
  const payload = {
    email,
    tier, // 'advocate' or 'professional'
    locationName,
    issuedAt: new Date().toISOString(),
  };

  // Token expires in 1 year (users can always request new one via email)
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '365d' });
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      valid: true,
      ...decoded,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

/**
 * Record a purchase in database
 */
export async function recordPurchase(purchaseData) {
  const db = await loadPurchases();

  const purchase = {
    id: purchaseData.stripeSessionId,
    email: purchaseData.email,
    tier: purchaseData.tier,
    amount: purchaseData.amount,
    stripeSessionId: purchaseData.stripeSessionId,
    locationName: purchaseData.locationName,
    purchasedAt: new Date().toISOString(),
    accessToken: purchaseData.accessToken,
    metadata: purchaseData.metadata || {},
  };

  db.purchases.push(purchase);
  await savePurchases(db);

  console.log(`✅ Recorded purchase: ${purchase.email} → ${purchase.tier} tier`);
  return purchase;
}

/**
 * Find purchase by email
 */
export async function findPurchaseByEmail(email) {
  const db = await loadPurchases();
  return db.purchases.filter(p => p.email.toLowerCase() === email.toLowerCase());
}

/**
 * Find purchase by Stripe session ID
 */
export async function findPurchaseBySessionId(sessionId) {
  const db = await loadPurchases();
  return db.purchases.find(p => p.stripeSessionId === sessionId);
}

/**
 * Send magic link email
 *
 * For launch: Uses console.log
 * TODO: Replace with Resend, SendGrid, or AWS SES in production
 */
export async function sendMagicLinkEmail(email, tier, token, locationName) {
  const magicLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/activate?token=${token}`;

  const tierDetails = {
    advocate: {
      name: 'Advocate',
      price: '$19',
      features: '• Street Redesign\n• 3DStreet Visualization\n• Policy Report PDF\n• Budget Analysis\n• International Standards (WHO, ADA)\n• Advocacy Proposal PDF'
    },
  };

  const details = tierDetails.advocate;

  const emailBody = `
🎉 Welcome to SafeStreets ${details.name} Tier!

Thank you for your purchase for ${locationName}.

Your Premium Features (${details.price}):
${details.features}

🔗 ACTIVATE YOUR ACCESS:
Click here to unlock premium features on any device:
${magicLink}

This link will work on any browser/device. Bookmark it or save this email to access premium features anytime.

Lost this email? Just visit SafeStreets and use the "Lost Access" button to get a new link.

Questions? Reply to this email or visit https://safestreets.app/support

---
SafeStreets Team
Making cities walkable, one street at a time 🚶
  `;

  console.log('\n' + '='.repeat(80));
  console.log('📧 MAGIC LINK EMAIL (Development Mode)');
  console.log('='.repeat(80));
  console.log(`To: ${email}`);
  console.log(`Subject: Welcome to SafeStreets ${details.name} - Activate Your Access`);
  console.log('\n' + emailBody);
  console.log('='.repeat(80) + '\n');

  // TODO: In production, use real email service:
  /*
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'SafeStreets <noreply@safestreets.app>',
    to: email,
    subject: `Welcome to SafeStreets ${details.name} - Activate Your Access`,
    text: emailBody,
  });
  */

  return { success: true, message: 'Email sent (dev mode: check console)' };
}

/**
 * Process successful Stripe payment
 */
export async function processPayment(stripeSession) {
  const { id, customer_email, amount_total, metadata } = stripeSession;

  // Only advocate tier ($19) is currently offered
  const tier = 'advocate';
  const email = customer_email;
  const locationName = metadata.locationName || 'Location';

  // Generate access token
  const accessToken = generateAccessToken(email, tier, locationName);

  // Record purchase in database
  await recordPurchase({
    stripeSessionId: id,
    email,
    tier,
    amount: amount_total,
    locationName,
    accessToken,
    metadata,
  });

  // Send magic link email
  await sendMagicLinkEmail(email, tier, accessToken, locationName);

  return { success: true, token: accessToken };
}
