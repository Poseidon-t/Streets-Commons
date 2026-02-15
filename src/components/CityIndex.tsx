/**
 * City index page — lists all available city walkability pages
 * Good for SEO internal linking and discoverability
 */

import { Link } from 'react-router-dom';
import { CITIES } from '../data/cities';

export default function CityIndex() {
  // Group cities by state
  const byState = CITIES.reduce<Record<string, typeof CITIES>>((acc, city) => {
    const key = city.state;
    if (!acc[key]) acc[key] = [];
    acc[key].push(city);
    return acc;
  }, {});

  const states = Object.keys(byState).sort();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #f8f6f1 0%, #eef5f0 100%)' }}>
      <title>Walkability Scores by City — Free Analysis for 20+ US Cities | SafeStreets</title>
      <meta name="description" content="Get free walkability scores for major US cities. Analyze sidewalks, tree cover, crash data, air quality & more using NASA satellite data. No sign-up required." />
      <link rel="canonical" href="https://safestreets.streetsandcommons.com/walkability" />

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
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
          Walkability Scores by City
        </h1>
        <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: '#5a6a5a' }}>
          Free satellite-powered walkability analysis for {CITIES.length}+ major US cities.
          Choose a city below or analyze any address worldwide.
        </p>
      </section>

      {/* City Grid */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        {states.map(state => (
          <div key={state} className="mb-8">
            <h2 className="text-lg font-bold mb-3" style={{ color: '#2a3a2a' }}>{state}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byState[state].map(city => (
                <Link
                  key={city.slug}
                  to={`/walkability/${city.slug}`}
                  className="rounded-xl p-4 border transition-all hover:shadow-md flex items-center gap-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.7)', borderColor: '#e0dbd0' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs flex-shrink-0"
                    style={{ backgroundColor: '#e07850' }}
                  >
                    {city.stateCode}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: '#2a3a2a' }}>{city.name}</div>
                    <div className="text-xs" style={{ color: '#8a9a8a' }}>
                      Pop. {city.population.toLocaleString()} · Free analysis
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div
          className="rounded-2xl p-8 text-center border-2"
          style={{ borderColor: '#e07850', backgroundColor: 'rgba(224, 120, 80, 0.05)' }}
        >
          <h2 className="text-2xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
            Don't See Your City?
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            SafeStreets works for any address worldwide. Enter any location to get an instant walkability analysis.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white text-lg transition-all hover:shadow-lg"
            style={{ backgroundColor: '#e07850' }}
          >
            Analyze Any Address — Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ backgroundColor: '#2a3a2a' }}>
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
