# Production Environment Variables - Railway Setup

## Required for Stripe Payment Integration

### Railway Dashboard Setup

Go to your Railway project → Variables tab and add these environment variables:

```bash
# Frontend URL (for Stripe redirect)
FRONTEND_URL=https://safestreets.streetsandcommons.com

# Stripe Keys (copy from your local .env file)
STRIPE_SECRET_KEY=<copy_from_your_local_env>
STRIPE_WEBHOOK_SECRET=<copy_from_your_local_env>

# Clerk Keys (copy from your local .env file)
CLERK_SECRET_KEY=<copy_from_your_local_env>
VITE_CLERK_PUBLISHABLE_KEY=<copy_from_your_local_env>

# AI Keys (copy from your local .env file)
GROQ_API_KEY=<copy_from_your_local_env>
GEMINI_API_KEY=<copy_from_your_local_env>
ANTHROPIC_API_KEY=<copy_from_your_local_env>
```

**⚠️ Important:** Get actual values from your local `.env` file. Never commit API keys to git!

## Stripe Webhook Setup

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://your-railway-backend.up.railway.app/api/stripe-webhook`
4. Select event: `checkout.session.completed`
5. Copy the webhook signing secret → add to `STRIPE_WEBHOOK_SECRET` in Railway

## Testing Payment Flow

### Test Mode (Current Setup)
- Using test keys (`sk_test_...`)
- Use [test card](https://stripe.com/docs/testing): `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

### Live Mode (When Ready)
1. Get live keys from Stripe: `sk_live_...` and `pk_live_...`
2. Replace test keys in Railway environment variables
3. Update Clerk keys to live: `pk_live_...` and `sk_live_...`
4. Create live webhook endpoint in Stripe
5. Test with real card (charge yourself $19 and refund)

## Current Status

✅ **Backend endpoints working:**
- `/api/create-checkout-session` - Creates Stripe session
- `/api/stripe-webhook` - Updates Clerk user metadata
- `/api/verify-payment` - Checks payment status

✅ **Frontend integration complete:**
- PaymentModalWithAuth handles sign-in + payment
- Success redirect shows banner
- Premium features unlock automatically

⚠️ **Production checklist:**
- [ ] Set FRONTEND_URL in Railway environment variables
- [ ] Configure Stripe webhook endpoint
- [ ] Test payment with test card
- [ ] Verify premium features unlock after payment
- [ ] Check Clerk user metadata updates correctly
