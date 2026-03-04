# SafeStreets — Coding Rules

---

## General

- **TypeScript strictly** — no `any`, no `as unknown as X` unless truly unavoidable
- **No new files** unless a component is genuinely reusable (>2 uses) or the file would exceed ~300 lines
- **No backwards-compat shims** — if something is removed, delete it completely
- **No unused imports** — clean up after yourself
- Task is done when the feature works correctly, not when it "compiles"

---

## React Patterns

- Heavy components (Agent reports, compare mode, infographics) → `React.lazy()` + `<Suspense fallback={null}>`
- State lifting: keep state in the lowest common ancestor, not globally unless shared across distant trees
- Don't add useEffect for things that can be computed inline
- Form handlers: `e.preventDefault()` + validate first, then async, always `finally { setLoading(false) }`

---

## Styling

- **Tailwind for layout/spacing/flex/grid** — use utility classes for structure
- **Inline `style={}` for brand colors** — Tailwind color tokens exist (earth.*, terra, enterprise.*) but inline styles are acceptable and often clearer for one-off brand colors
- **Mobile-first** — default styles are mobile, `sm:` and `md:` for larger screens
- Don't use `px-` values above `px-8` for section containers — use `max-w-*xl mx-auto px-6` pattern
- Rounded corners: `rounded-xl` (cards), `rounded-2xl` (major sections), `rounded-full` (pills/badges)

---

## API Calls

```typescript
const apiUrl = import.meta.env.VITE_API_URL || '';
const res = await fetch(`${apiUrl}/api/endpoint`, { ... });
```

Never hardcode API URLs. Never use relative paths without the env var prefix.

---

## Pricing Constraints (hard rule)

Do not change or invent pricing. If copy mentions money, use exactly:
- Core tool: **free**
- Agent Reports: **$49 one-time** (first 3 free)
- Enterprise: **custom** / contact us / no price shown

If you see $19, $99, or any other number in existing code/copy, those are stale — fix them to the above.

---

## Score & Tier System (hard rule)

Score is 0–10 in UI, 0–100 internally. Tiers:

```typescript
function getScoreTier(score: number): string { // score is 0–100
  if (score >= 80) return 'Walkable';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Car-dependent';
  if (score >= 20) return 'Difficult';
  return 'Hostile';
}
```

Display as `(score / 10).toFixed(1)` — e.g., 74 → "7.4".

---

## PersonaCard Verdicts (hard rule)

Verdicts are exactly: **Yes** · **Borderline** · **Unlikely**

Never invent alternative labels (Not Recommended, Poor, Good, etc.).

---

## Enterprise Section (hard rule)

Enterprise pages describe a **software platform**: custom dashboards, decisioning engine, API access, white-label deployment, workflow automation.

Never describe:
- Field audits ("trained analysts walk streets")
- Physical on-site assessments
- Per-street consulting packages ($50K, $100K)

The enterprise offering is B2B software, not services.

---

## Admin / Blog

- Admin is at `/admin`, gated by `ADMIN_USER_ID` (Clerk user ID) in `src/admin/AdminGuard.tsx`
- Blog content generation happens in `api/server.js` — BLOG_CONTENT_SYSTEM_PROMPT and POST_TYPE_PROMPTS
- Static image bank is in `api/server.js` near `BLOG_IMAGE_BANK` constant
- ContentQueue errors: failed generation should reset `status` to `'pending'` and surface `error` in UI — never leave stuck at `'generating'`

---

## Data Quality Badge (conditional, US vs international)

In results, the data quality badge shows different source labels:
- US addresses: `Census ACS · EPA · CDC · FEMA`
- International: `OSM · Sentinel-2 · OpenStreetMap`

Check `location.countryCode === 'US'` before showing US-specific sources.

---

## Email Capture Banner

`EmailCaptureBanner` accepts optional `headline` and `subtext` props.
- Landing page (default): "Stay in the loop" / "New data layers, city insights..."
- After results: "Get notified when we add new data" / "New metrics, city reports..."

---

## Things to Never Do

- Don't add `console.log` statements to production code
- Don't change the Tailwind config color tokens (they are correct)
- Don't add a "back" button or navigation that breaks the SPA flow — use `window.scrollTo` or state resets
- Don't add loading skeletons for fast operations (<300ms)
- Don't suggest the user "needs" to set up Stripe, UNSPLASH_ACCESS_KEY, etc. — note if missing, but don't block implementation
