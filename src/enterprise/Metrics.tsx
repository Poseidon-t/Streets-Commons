import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from './components/MetricCard';
import EnterpriseCTA from './components/EnterpriseCTA';

const CATEGORIES = [
  {
    name: 'Infrastructure',
    description: 'Physical built environment that supports or hinders walking',
    color: 'bg-blue-50 text-enterprise-navy',
    metrics: [
      {
        title: 'Sidewalk Quality',
        description: 'Surface condition, width, continuity, material, and maintenance state of pedestrian pathways throughout the study area.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
          </svg>
        ),
      },
      {
        title: 'Crossing Safety',
        description: 'Intersection design, crosswalk presence and condition, signal timing, visibility, and pedestrian refuge islands.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
      },
      {
        title: 'ADA Compliance',
        description: 'Curb ramp presence, tactile paving, accessible signal buttons, grade requirements, and barrier-free path of travel.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Environment',
    description: 'Comfort and sensory experience of the walking environment',
    color: 'bg-green-50 text-enterprise-green',
    metrics: [
      {
        title: 'Lighting & Visibility',
        description: 'Street lighting coverage, uniformity, pedestrian-scale illumination, and nighttime visibility conditions.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
      {
        title: 'Shade & Weather Protection',
        description: 'Tree canopy coverage, awnings, covered walkways, and shelter availability along pedestrian routes.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
          </svg>
        ),
      },
      {
        title: 'Noise & Pollution',
        description: 'Ambient noise levels, air quality indicators, traffic-related pollution exposure along walking routes.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Access',
    description: 'Connectivity and proximity to destinations and transit',
    color: 'bg-purple-50 text-purple-600',
    metrics: [
      {
        title: 'Transit Proximity',
        description: 'Distance to transit stops, service frequency, route coverage, and quality of pedestrian connections to transit.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        ),
      },
      {
        title: 'Destination Density',
        description: 'Concentration of shops, services, parks, schools, and other daily destinations within walking distance.',
        tier: 'core' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        title: 'Network Connectivity',
        description: 'Block size, intersection density, route directness, and the completeness of the pedestrian network.',
        tier: 'complete' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Safety',
    description: 'Traffic conditions and historical risk factors',
    color: 'bg-red-50 text-red-600',
    metrics: [
      {
        title: 'Traffic Volume',
        description: 'Vehicle counts, peak-hour analysis, heavy vehicle percentage, and pedestrian exposure to traffic.',
        tier: 'complete' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        title: 'Speed Environment',
        description: 'Posted speed limits, observed speeds, traffic calming measures, and speed-related risk to pedestrians.',
        tier: 'complete' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
      {
        title: 'Crash History',
        description: 'Pedestrian-involved collision data, severity analysis, hotspot identification, and trend analysis over 5 years.',
        tier: 'complete' as const,
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        ),
      },
    ],
  },
];

export default function Metrics() {
  useEffect(() => {
    document.title = 'Pedestrian Safety Metrics | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'SafeStreets Intelligence measures 12 pedestrian safety and infrastructure metrics across 4 categories: Infrastructure, Environment, Access, and Safety.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">Our Metrics</p>
          <h1 className="text-4xl md:text-5xl font-bold text-enterprise-slate mb-6">12 Metrics That Define Pedestrian Safety</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every SafeStreets report is built on a rigorous framework of 12 metrics across 4 categories, each measured through field audit and data analysis.
          </p>
        </div>
      </section>

      {/* Tier Legend */}
      <section className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-enterprise-navy">$50K+</span>
            <span className="text-sm text-gray-600">Included in Pedestrian Safety Intelligence</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-enterprise-green">$100K</span>
            <span className="text-sm text-gray-600">Complete Intelligence only</span>
          </div>
        </div>
      </section>

      {/* Categories */}
      {CATEGORIES.map((cat) => (
        <section key={cat.name} className="py-16 even:bg-enterprise-gray">
          <div className="max-w-6xl mx-auto px-6">
            <div className="mb-10">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3 ${cat.color}`}>
                {cat.name}
              </div>
              <p className="text-gray-600">{cat.description}</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {cat.metrics.map((m) => (
                <MetricCard key={m.title} icon={m.icon} title={m.title} description={m.description} tier={m.tier} />
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Summary */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold text-enterprise-slate mb-4">Comprehensive Coverage</h2>
          <p className="text-gray-600 mb-8">
            The Pedestrian Safety Intelligence package ($50K) covers 8 core metrics across Infrastructure, Environment, and Access.
            The Complete Intelligence package ($100K) adds all 4 Safety metrics plus Network Connectivity for full coverage.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/enterprise/pricing" className="px-6 py-3 bg-enterprise-navy text-white font-semibold rounded-lg hover:bg-enterprise-navy-light transition">
              Compare Packages
            </Link>
            <Link to="/enterprise/how-it-works" className="px-6 py-3 border-2 border-gray-300 text-enterprise-slate font-semibold rounded-lg hover:border-enterprise-navy transition">
              See Methodology
            </Link>
          </div>
        </div>
      </section>

      <EnterpriseCTA dark />
    </>
  );
}
