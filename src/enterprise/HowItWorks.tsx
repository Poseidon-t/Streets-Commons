import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './components/EnterpriseCTA';

const PHASES = [
  {
    number: '01',
    title: 'Scope & Planning',
    duration: 'Week 1-2',
    description: 'We define the study area, assessment objectives, and project parameters together. This phase ensures the final report addresses your specific decision-making needs.',
    details: [
      'Define study area boundaries via GIS mapping',
      'Identify key stakeholders and report audience',
      'Establish assessment objectives and priorities',
      'Customize metric weighting for your use case',
      'Schedule field audit logistics',
    ],
  },
  {
    number: '02',
    title: 'Field Audit',
    duration: '3-5 Days On-Site',
    description: 'Trained analysts walk every street segment in the study area, documenting conditions across all assessed metrics using standardized protocols.',
    details: [
      'GPS-tagged photography of every block',
      'Sidewalk condition and width measurements',
      'Intersection and crossing safety evaluation',
      'ADA compliance assessment at every curb',
      'Lighting, shade, and comfort documentation',
      'Traffic observation and speed measurements',
    ],
  },
  {
    number: '03',
    title: 'Analysis & Modeling',
    duration: 'Week 3-5',
    description: 'Field observations are combined with municipal data, census demographics, transit schedules, and crash databases into a multi-source walkability model.',
    details: [
      'Field data digitization and quality review',
      'GIS integration with municipal datasets',
      'Statistical scoring of each metric (0-100)',
      'Heat map and hotspot generation',
      'Comparative analysis with peer corridors',
      'Identification of priority improvement zones',
    ],
  },
  {
    number: '04',
    title: 'Report & Strategy',
    duration: 'Week 6-8',
    description: 'A comprehensive, professionally designed report with executive summary, detailed findings, data appendix, and actionable recommendations.',
    details: [
      '80-150 page professionally designed report',
      'Executive summary for leadership audiences',
      'Detailed metric-by-metric analysis',
      'High-resolution maps and visualizations',
      'Prioritized improvement recommendations',
      'Data appendix with raw measurements',
      'Stakeholder presentation deck (Complete tier)',
    ],
  },
];

const DATA_SOURCES = [
  { name: 'Field Observations', desc: 'GPS-tagged photos, measurements, structured observation forms' },
  { name: 'Municipal GIS', desc: 'Parcel data, zoning, infrastructure, public right-of-way' },
  { name: 'Census & Demographics', desc: 'Population density, income, age distribution, commute patterns' },
  { name: 'Transit Data', desc: 'GTFS feeds, service frequency, route coverage, ridership' },
  { name: 'Crash Databases', desc: 'FARS, state DOT records, police reports, severity coding' },
  { name: 'Satellite & Aerial', desc: 'Land cover, canopy analysis, impervious surface mapping' },
];

export default function HowItWorks() {
  useEffect(() => {
    document.title = 'How It Works | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'SafeStreets Intelligence follows a rigorous 4-phase process: Scope & Planning, Field Audit, Analysis & Modeling, and Report & Strategy.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">Our Process</p>
          <h1 className="text-4xl md:text-5xl font-bold text-enterprise-slate mb-6">How We Build Intelligence</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every SafeStreets report follows a structured 4-phase methodology that combines on-the-ground field research with rigorous data analysis.
          </p>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          {/* Horizontal progress bar (desktop) */}
          <div className="hidden md:flex items-center justify-between mb-16 relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-enterprise-navy" style={{ width: '100%' }} />
            {PHASES.map((p) => (
              <div key={p.number} className="relative z-10 text-center">
                <div className="w-10 h-10 rounded-full bg-enterprise-navy text-white text-sm font-bold flex items-center justify-center mx-auto">
                  {p.number}
                </div>
                <p className="text-sm font-medium text-enterprise-slate mt-2">{p.title}</p>
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
                    <span className="text-sm font-bold text-enterprise-navy bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center">
                      {phase.number}
                    </span>
                    <div>
                      <h3 className="text-xl font-bold text-enterprise-slate">{phase.title}</h3>
                      <p className="text-xs text-gray-400">{phase.duration}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 leading-relaxed mb-4">{phase.description}</p>
                </div>
                <div className={`bg-enterprise-gray rounded-xl p-6 ${i % 2 === 1 ? 'md:order-1' : ''}`}>
                  <ul className="space-y-2.5">
                    {phase.details.map((d, j) => (
                      <li key={j} className="flex items-start gap-2.5">
                        <svg className="w-4 h-4 text-enterprise-green mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">Data Sources</h2>
            <p className="text-gray-600 max-w-xl mx-auto">We integrate multiple data sources for a comprehensive, validated picture of walkability conditions.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {DATA_SOURCES.map((ds) => (
              <div key={ds.name} className="bg-white rounded-xl border border-gray-100 p-6">
                <h3 className="text-base font-semibold text-enterprise-slate mb-2">{ds.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{ds.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">What You Receive</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-8">
              <p className="text-sm font-semibold text-enterprise-navy uppercase tracking-wider mb-4">Walkability Intelligence — $50K</p>
              <ul className="space-y-3">
                {[
                  '80+ page professionally designed report',
                  'Executive summary',
                  '8 metric analyses with scoring',
                  'Heat maps and GIS visualizations',
                  'Prioritized improvement list',
                  'Data appendix with raw measurements',
                  'Post-delivery Q&A session',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-enterprise-navy mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-enterprise-slate rounded-2xl p-8 text-white">
              <p className="text-sm font-semibold text-enterprise-green-light uppercase tracking-wider mb-4">Complete Intelligence — $100K</p>
              <p className="text-xs text-gray-400 mb-4">Everything in Walkability Intelligence, plus:</p>
              <ul className="space-y-3">
                {[
                  '150+ page comprehensive report',
                  'All 12 metric analyses',
                  'Strategic action plan with timelines',
                  'Stakeholder presentation deck',
                  'Comparative peer analysis',
                  '3 months of advisory support',
                  'Annual update option',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-enterprise-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="text-center mt-10">
            <Link to="/enterprise/pricing" className="text-sm font-medium text-enterprise-navy hover:underline">
              See full pricing comparison &rarr;
            </Link>
          </div>
        </div>
      </section>

      <EnterpriseCTA
        dark
        title="Ready to start your walkability assessment?"
        description="Tell us about your project and we'll scope a custom engagement for you."
      />
    </>
  );
}
