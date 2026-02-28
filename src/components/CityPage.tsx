/**
 * Programmatic SEO city landing page
 * Renders a pre-built page for "walkability score [city]" search queries.
 * Links to the main app with pre-filled coordinates for instant analysis.
 */

import { useParams, Link } from 'react-router-dom';
import { getCityBySlug, CITIES } from '../data/cities';

export default function CityPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const city = citySlug ? getCityBySlug(citySlug) : undefined;

  if (!city) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
        <div className="text-center px-6">
          <h1 className="text-6xl font-bold mb-4" style={{ color: '#2a3a2a' }}>404</h1>
          <p className="text-xl mb-6" style={{ color: '#5a6a5a' }}>City not found</p>
          <Link to="/" className="inline-block px-6 py-3 rounded-xl font-semibold text-white transition-all hover:shadow-lg" style={{ backgroundColor: '#e07850' }}>
            Go to SafeStreets
          </Link>
        </div>
      </div>
    );
  }

  const analyzeUrl = `/?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(`${city.name}, ${city.stateCode}`)}`;

  // Get 4 nearby cities for internal linking (exclude current)
  const nearbyCities = CITIES
    .filter(c => c.slug !== city.slug)
    .map(c => ({
      ...c,
      distance: Math.sqrt(Math.pow(c.lat - city.lat, 2) + Math.pow(c.lon - city.lon, 2)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      {/* Dynamic SEO meta via React 19 */}
      <title>{city.metaTitle}</title>
      <meta name="description" content={city.metaDescription} />
      <link rel="canonical" href={`https://safestreets.streetsandcommons.com/walkability/${city.slug}`} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`https://safestreets.streetsandcommons.com/walkability/${city.slug}`} />
      <meta property="og:site_name" content="SafeStreets by Streets & Commons" />
      <meta property="og:title" content={city.metaTitle} />
      <meta property="og:description" content={city.metaDescription} />
      <meta property="og:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={city.metaTitle} />
      <meta name="twitter:description" content={city.metaDescription} />
      <meta name="twitter:image" content="https://safestreets.streetsandcommons.com/og-image.png" />

      {/* JSON-LD WebPage + City + BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": `${city.name}, ${city.stateCode} Walkability Score`,
        "description": city.metaDescription,
        "url": `https://safestreets.streetsandcommons.com/walkability/${city.slug}`,
        "isPartOf": {
          "@type": "WebSite",
          "name": "SafeStreets",
          "url": "https://safestreets.streetsandcommons.com"
        },
        "about": {
          "@type": "City",
          "name": city.name,
          "containedInPlace": {
            "@type": "State",
            "name": city.state
          }
        },
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://safestreets.streetsandcommons.com" },
            { "@type": "ListItem", "position": 2, "name": "Walkability by City", "item": "https://safestreets.streetsandcommons.com/walkability" },
            { "@type": "ListItem", "position": 3, "name": `${city.name}, ${city.stateCode}` }
          ]
        }
      }) }} />

      {/* Header */}
      <header className="border-b" style={{ borderColor: '#e0dbd0', backgroundColor: 'rgba(255,255,255,0.7)' }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 44 44">
              <rect x="2" y="2" width="40" height="40" rx="10" fill="#e07850"/>
              <rect x="10" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="19" y="14" width="6" height="16" fill="white" rx="1"/>
              <rect x="28" y="14" width="6" height="16" fill="white" rx="1"/>
            </svg>
            <span className="text-xl font-bold" style={{ color: '#e07850' }}>SafeStreets</span>
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all hover:shadow-md text-white"
            style={{ backgroundColor: '#e07850' }}
          >
            Analyze Any Address
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
            {city.name}, {city.stateCode} Walkability Score
          </h1>
          <p className="text-lg max-w-2xl mx-auto mb-6" style={{ color: '#5a6a5a' }}>
            {city.description}
          </p>
          <Link
            to={analyzeUrl}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Analyze {city.name} Now — Free
          </Link>
          <p className="text-xs mt-3" style={{ color: '#8a9a8a' }}>
            No sign-up required · Powered by NASA & OpenStreetMap satellite data
          </p>
        </div>
      </section>

      {/* What You'll Get */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-center mb-8" style={{ color: '#2a3a2a' }}>
          What Your {city.name} Analysis Includes
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Sidewalk Coverage', desc: 'Percentage of streets with sidewalks within 400m', icon: '🚶' },
            { title: 'Tree Canopy', desc: 'Satellite-measured vegetation and shade coverage', icon: '🌳' },
            { title: 'Pedestrian Crossings', desc: 'Crossing density and safety infrastructure', icon: '🚦' },
            { title: 'Street Lighting', desc: 'Lit street coverage for nighttime safety', icon: '💡' },
            { title: 'Terrain Slope', desc: 'NASADEM elevation data for ADA accessibility', icon: '⛰️' },
            { title: 'Air Quality', desc: 'Real-time PM2.5 and pollution monitoring', icon: '🌬️' },
            { title: 'Traffic Safety', desc: 'NHTSA fatal crash data within 800m', icon: '🛡️' },
            { title: '15-Minute City', desc: 'Are daily services within a 15-min walk?', icon: '🏪' },
          ].map(item => (
            <div
              key={item.title}
              className="rounded-xl p-4 border"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-bold text-sm mb-1" style={{ color: '#2a3a2a' }}>{item.title}</h3>
              <p className="text-xs" style={{ color: '#6b7280' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-center mb-8" style={{ color: '#2a3a2a' }}>
          How It Works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { step: '1', title: 'Enter an Address', desc: `Type any address in ${city.name}, ${city.stateCode} into the search bar.` },
            { step: '2', title: 'Get Your Score', desc: 'We analyze 8+ walkability metrics using satellite data from NASA, Sentinel-2, and OpenStreetMap.' },
            { step: '3', title: 'Take Action', desc: 'Use your analysis for advocacy, planning, or real estate decisions. Export as PDF or draft advocacy letters to local officials.' },
          ].map(item => (
            <div key={item.step} className="text-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white mx-auto mb-3"
                style={{ backgroundColor: '#e07850' }}
              >
                {item.step}
              </div>
              <h3 className="font-bold mb-1" style={{ color: '#2a3a2a' }}>{item.title}</h3>
              <p className="text-sm" style={{ color: '#6b7280' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <div
          className="rounded-2xl p-8 text-center border-2"
          style={{ borderColor: '#e07850', backgroundColor: 'rgba(224, 120, 80, 0.05)' }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
            Ready to Analyze Your Street in {city.name}?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            Free walkability score for any address. No sign-up required. Powered by real satellite data.
          </p>
          <Link
            to={analyzeUrl}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            Get Your Free Walkability Score
          </Link>
        </div>
      </section>

      {/* Agent CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-10">
        <div
          className="rounded-2xl p-6 sm:p-8 border"
          style={{ borderColor: '#c8d4e0', backgroundColor: 'rgba(30, 58, 95, 0.04)' }}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold mb-1" style={{ color: '#1e3a5f' }}>
                Real Estate Agent in {city.name}?
              </h3>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Generate branded walkability reports for your listings. 3 free reports, then $99 one-time for unlimited.
              </p>
            </div>
            <Link
              to={analyzeUrl}
              className="flex-shrink-0 px-6 py-3 rounded-xl font-semibold text-white text-sm transition-all hover:opacity-90"
              style={{ backgroundColor: '#1e3a5f' }}
            >
              Generate Agent Report
            </Link>
          </div>
        </div>
      </section>

      {/* Nearby Cities (internal linking for SEO) */}
      <section className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-xl font-bold text-center mb-6" style={{ color: '#2a3a2a' }}>
          Walkability Scores in Other Cities
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {nearbyCities.map(c => (
            <Link
              key={c.slug}
              to={`/walkability/${c.slug}`}
              className="rounded-lg p-4 border text-center transition-all hover:shadow-md"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
            >
              <div className="font-bold text-sm" style={{ color: '#2a3a2a' }}>{c.name}</div>
              <div className="text-xs" style={{ color: '#8a9a8a' }}>{c.stateCode}</div>
            </Link>
          ))}
        </div>
        <div className="text-center mt-4">
          <Link to="/walkability" className="text-sm font-medium" style={{ color: '#e07850' }}>
            View all cities →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-8 py-8 text-center" style={{ backgroundColor: '#2a3a2a' }}>
        <Link to="/" className="text-sm font-semibold" style={{ color: '#e07850' }}>SafeStreets</Link>
        <span className="text-xs mx-2" style={{ color: '#5a6a5a' }}>by</span>
        <span className="text-xs" style={{ color: '#8a9a8a' }}>Streets & Commons</span>
        <p className="text-xs mt-2" style={{ color: '#5a6a5a' }}>
          Free walkability analysis powered by NASA, Sentinel-2, and OpenStreetMap satellite data.
        </p>
      </footer>
    </div>
  );
}
