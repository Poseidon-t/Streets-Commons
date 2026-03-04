# SafeStreets — Design System

---

## Two Visual Modes

The product has two distinct visual identities:

| Context | Palette | Feel |
|---------|---------|------|
| Consumer tool (main app, landing, results, blog) | Earth / warm naturals | Organic, approachable |
| Enterprise section (/enterprise/*) | Navy / dark slate | Professional, credible |

Never mix them. The main app should never use `enterprise-navy`. Enterprise pages should never use `terra` orange as a primary CTA.

---

## Consumer Palette (Tailwind tokens)

```
earth-cream:      #f8f6f1  — page backgrounds, section fills
earth-border:     #e0dbd0  — card borders, dividers
earth-text-dark:  #2a3a2a  — headings, primary text
earth-text-body:  #5a6a5a  — body text
earth-text-light: #8a9a8a  — captions, metadata, secondary
earth-text-muted: #7a8a7a  — placeholder text
earth-green:      #4a8a4a  — success states, positive verdicts
terra:            #e07850  — primary CTA buttons, highlights
```

Common patterns:
- Card: `style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}`
- Section bg: `style={{ backgroundColor: '#f8f6f1', border: '1px solid #e0dbd0' }}`
- Heading: `style={{ color: '#2a3a2a' }}`
- Caption: `style={{ color: '#8a9a8a' }}`
- Primary button: `style={{ backgroundColor: '#e07850' }}` with white text

---

## Enterprise Palette (Tailwind tokens)

```
enterprise-navy:       #1E40AF  — primary CTAs, headings, accents
enterprise-navy-dark:  #1E3A8A  — hover states
enterprise-slate:      #0F172A  — dark card backgrounds
enterprise-slate-mid:  #1E293B  — dark section fills
enterprise-gray:       #F8FAFC  — light section backgrounds
enterprise-green:      #10B981  — success, check icons
enterprise-green-light:#34D399  — text on dark backgrounds
```

---

## Typography

- **Font sans:** DM Sans — used for all body and UI text
- **Font mono:** Space Mono — used for data values, scores, metric numbers
- Standard type scale: `text-xs` (10-12px captions) · `text-sm` (14px body) · `text-base` (16px) · `text-lg` through `text-5xl` for headings
- Headings: `font-bold`, consumer = `text-earth-text-dark`, enterprise = `text-enterprise-slate`

---

## Score Circle Colors (by tier, 0–100 internal scale)

```typescript
function getScoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // Walkable — green
  if (score >= 60) return '#84cc16'; // Moderate — yellow-green
  if (score >= 40) return '#eab308'; // Car-dependent — yellow
  if (score >= 20) return '#f97316'; // Difficult — orange
  return '#ef4444';                  // Hostile — red
}
```

---

## Component Conventions

### Cards
```tsx
<div
  className="rounded-2xl shadow-sm p-4 sm:p-6 border"
  style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
>
```

### Section containers (consumer)
```tsx
<section style={{ backgroundColor: '#f8f6f1', border: '1px solid #e0dbd0' }}>
  <div className="max-w-5xl mx-auto px-6 py-12">
```

### Primary CTA button (consumer)
```tsx
<button
  className="px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
  style={{ backgroundColor: '#e07850' }}
>
```

### Primary CTA button (enterprise)
```tsx
<button
  className="px-6 py-3 rounded-xl font-bold text-white text-sm bg-enterprise-navy hover:bg-enterprise-navy-dark transition-colors"
>
```

### Verdict/badge pills
- Yes / positive: `bg-green-50 text-green-700 border border-green-200`
- Borderline / warning: `bg-yellow-50 text-yellow-700 border border-yellow-200`
- Unlikely / negative: `bg-red-50 text-red-700 border border-red-200`

---

## Layout Rules

- Max width for content: `max-w-5xl` (sections), `max-w-4xl` (text-heavy), `max-w-6xl` (wide data tables)
- Side padding: `px-6` (standard), never less than `px-4`
- Section vertical rhythm: `py-12` (compact), `py-16` or `py-20` (enterprise sections)
- Grid: `grid sm:grid-cols-2` or `grid md:grid-cols-3` — always mobile-first single column
- Gap: `gap-4` (tight), `gap-6` (standard), `gap-8` (loose)

---

## Responsive Breakpoints

- Default (no prefix) = mobile
- `sm:` = 640px+ (most grid changes happen here)
- `md:` = 768px+ (major layout shifts)
- `lg:` = 1024px+ (used sparingly for enterprise pages)

Most components should work perfectly at 375px (iPhone SE) as baseline.
