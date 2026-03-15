import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PlatformCTA from './components/PlatformCTA';

const PHASES = [
  {
    number: '01',
    title: 'Discovery & Scoping',
    duration: 'Week 1',
    description: 'We work with your team to define the decisions you need to make, the geographies that matter, and how intelligence needs to flow into your existing workflows.',
    details: [
      'Map out the decisions your team needs to make and the data gaps blocking them',
      'Define priority geographies  -  corridors, districts, city-wide, or portfolio-level',
      'Identify key stakeholders and how dashboards will be used across roles',
      'Determine integration requirements (GIS systems, internal tools, reporting formats)',
      'Agree on metric weights and composite score logic for your use case',
      'Establish output formats: API, embed, white-label, or dashboard login',
    ],
  },
  {
    number: '02',
    title: 'Data Configuration',
    duration: 'Week 1-2',
    description: 'The intelligence engine is configured for your geography and use case. Your datasets are connected. Metric weights and scoring rules are tuned to your decision-making logic.',
    details: [
      'Configure the scoring engine for your geographic area',
      'Connect your municipal GIS, zoning, and infrastructure datasets',
      'Tune metric weights and composite score logic per your scoping inputs',
      'Integrate transit feeds (GTFS), census layers, and EPA walkability data',
      'Set up alert thresholds and priority scoring rules for your decisioning workflows',
      'Validate scoring output against known corridors and test cases',
    ],
  },
  {
    number: '03',
    title: 'Dashboard Build',
    duration: 'Week 2-4',
    description: 'Custom dashboard views are built to your specification  -  organized around the questions your team needs to answer, not generic metrics.',
    details: [
      'Build primary dashboard view with your priority metrics and map layers',
      'Configure per-role views for planners, executives, and field teams',
      'Configure corridor comparison and scoring breakdown views',
      'Build decisioning panels: priority lists, threshold alerts, scoring breakdowns',
      'Test with your team and iterate on display logic and user experience',
      'Document custom metric definitions and scoring methodology for your records',
    ],
  },
  {
    number: '04',
    title: 'Integration & Deployment',
    duration: 'Week 3-5',
    description: 'The platform is connected to your existing systems. Whether you need API access, a GIS export pipeline, an embedded view, or a white-label deployment, we set it up and hand it over.',
    details: [
      'Set up API keys and documentation for your developers',
      'Configure bulk export pipelines to CSV, GeoJSON, or GIS-compatible formats',
      'Deploy embed code for internal portals or public-facing dashboards',
      'White-label deployment with your branding, domain, and access controls',
      'Set up webhook triggers for threshold-based alerts and workflow automation',
      'Security review and access control configuration',
    ],
  },
  {
    number: '05',
    title: 'Launch & Ongoing Intelligence',
    duration: 'Week 5-6 and beyond',
    description: 'Your team goes live. Ongoing support ensures the intelligence stays current and your decisioning workflows evolve with your needs.',
    details: [
      'Team onboarding sessions and role-specific documentation',
      'Data refresh cadence established  -  quarterly or continuous depending on tier',
      'Alert and notification configuration finalized',
      'Dedicated support contact for questions and workflow adjustments',
      'Quarterly review of scoring rules and decisioning thresholds',
      'Access to platform updates and new data source integrations',
    ],
  },
];

const DATA_SOURCES = [
  { name: 'OpenStreetMap', desc: 'Street network topology, intersection density, pedestrian path coverage' },
  { name: 'Satellite & Aerial Imagery', desc: 'Canopy cover, urban heat, land use classification, impervious surface' },
  { name: 'EPA Walkability Index', desc: 'Block-level intersection density, transit access, land use mix scores' },
  { name: 'Census & Demographics', desc: 'Population density, income, age distribution, commute patterns, equity layers' },
  { name: 'Municipal GIS', desc: 'Parcel data, zoning, public right-of-way, infrastructure inventories' },
  { name: 'Transit Feeds (GTFS)', desc: 'Service frequency, route coverage, stop locations, accessibility data' },
  { name: 'Client Data', desc: 'Your organization\'s internal datasets, inspection records, complaint logs, or custom layers' },
];

export default function HowItWorks() {
  useEffect(() => {
    document.title = 'How It Works | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'How SafeStreets Intelligence builds custom street intelligence dashboards and decisioning workflows: Discovery, Data Configuration, Dashboard Build, Integration, and Launch.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-platform-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-platform-navy font-semibold text-sm uppercase tracking-wider mb-3">How It Works</p>
          <h1 className="text-4xl md:text-5xl font-bold text-platform-slate mb-6">From Raw Data to Decisions</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            A structured 5-phase process that takes your organization from scattered street data to a live decisioning platform  -  configured around how your team actually works.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          {/* Horizontal progress bar (desktop) */}
          <div className="hidden md:flex items-center justify-between mb-16 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-platform-navy" style={{ width: '100%' }} />
            {PHASES.map((p) => (
              <div key={p.number} className="relative z-10 text-center">
                <div className="w-10 h-10 rounded-full bg-platform-navy text-white text-sm font-bold flex items-center justify-center mx-auto">
                  {p.number}
                </div>
                <p className="text-sm font-medium text-platform-slate mt-2">{p.title}</p>
                <p className="text-xs text-gray-400">{p.duration}</p>
              </div>
            ))}
          </div>

          {/* Phase Details */}
          <div className="space-y-12">
            {PHASES.map((phase, i) => (
              <div key={phase.number} className={`grid md:grid-cols-2 gap-10 items-start ${i % 2 === 1 ? 'md:direction-rtl' : ''}`}>
                <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-bold text-platform-navy bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center">
                      {phase.number}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-platform-slate">{phase.title}</h3>
                      <p className="text-xs text-gray-400">{phase.duration}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-4">{phase.description}</p>
                </div>
                <div className={`bg-platform-gray rounded-xl p-6 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                  <ul className="space-y-2.5">
                    {phase.details.map((d, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-platform-green mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-gray-700">{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Sources */}
      <section className="py-20 bg-platform-gray">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-platform-slate mb-3">Data Sources</h2>
            <p className="text-gray-600 max-w-xl mx-auto">The intelligence engine integrates multiple authoritative sources  -  plus your own datasets  -  for a complete picture of pedestrian conditions.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {DATA_SOURCES.map((ds) => (
              <div key={ds.name} className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-platform-slate mb-2">{ds.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{ds.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-platform-slate mb-3">What You Get</h2>
            <p className="text-gray-500 max-w-xl mx-auto">A live platform built around your decisions  -  not a one-time report that sits in a drawer.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-8">
              <p className="text-sm font-semibold text-platform-navy uppercase tracking-wider mb-4">Intelligence Platform</p>
              <ul className="space-y-3">
                {[
                  'Custom dashboard with your metric configuration',
                  'Decisioning rules and priority scoring',
                  'API access for your development team',
                  'GIS-compatible data export (CSV, GeoJSON)',
                  'Heat maps and corridor analysis tools',
                  'Quarterly data refresh',
                  'Team onboarding and documentation',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-platform-navy mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-platform-slate rounded-2xl p-8 text-white">
              <p className="text-sm font-semibold text-platform-green-light uppercase tracking-wider mb-4">Custom Decisioning Build</p>
              <p className="text-xs text-gray-400 mb-4">Everything in Platform, plus:</p>
              <ul className="space-y-3">
                {[
                  'Bespoke decisioning workflows and alert rules',
                  'White-label or embedded deployment',
                  'Custom metric weights and composite score logic',
                  'Integration with your existing systems',
                  'Webhook triggers for workflow automation',
                  'Continuous data updates',
                  'Dedicated support and platform advisory',
                  'Multi-geography or portfolio-wide analysis',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-platform-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link to="/platform/pricing" className="text-sm font-medium text-platform-navy hover:underline">
              See pricing options &rarr;
            </Link>
          </div>
        </div>
      </section>

      <PlatformCTA
        dark
        title="Ready to build your street intelligence platform?"
        description="Tell us about your organization and we'll scope a custom engagement."
      />
    </>
  );
}
