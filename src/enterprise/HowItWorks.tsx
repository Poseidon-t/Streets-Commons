import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './components/EnterpriseCTA';

const PHASES = [
  {
    number: '01',
    title: 'Scope & Planning',
    duration: 'Week 1-2',
    description: 'We define the study area, assessment objectives, and community engagement plan together. This phase ensures every deliverable addresses your specific decision-making needs.',
    details: [
      'Define study area boundaries via GIS mapping',
      'Identify key stakeholders and target communities',
      'Establish assessment objectives and priorities',
      'Customize metric weighting for your use case',
      'Design citizen advocacy survey parameters',
      'Schedule field audit and community engagement logistics',
    ],
  },
  {
    number: '02',
    title: 'In-Depth Field Audit',
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
    title: 'Citizen Engagement',
    duration: 'Concurrent / Week 2-4',
    description: 'Community voices are captured through structured surveys, interviews, and digital input tools to understand the lived pedestrian experience beyond what physical infrastructure reveals.',
    details: [
      'Deploy community survey tools (digital and in-person)',
      'Collect citizen voices on safety concerns and barriers',
      'Document cultural context and community-specific needs',
      'Multilingual outreach for diverse communities (Complete tier)',
      'Sentiment analysis and theme identification (Complete tier)',
    ],
  },
  {
    number: '04',
    title: 'Analysis & Modeling',
    duration: 'Week 3-5',
    description: 'Field observations and citizen input are combined with municipal data, census demographics, transit schedules, and crash databases into a multi-source pedestrian safety model.',
    details: [
      'Field data digitization and quality review',
      'Integration of citizen advocacy data with field observations',
      'GIS integration with municipal datasets',
      'Statistical scoring of each metric (0-100)',
      'Heat map and hotspot generation',
      'Identification of priority improvement zones',
    ],
  },
  {
    number: '05',
    title: 'Dashboard & Deliverables',
    duration: 'Week 6-8',
    description: 'Your interactive dashboard goes live with all metrics, maps, and citizen insights. Comprehensive reports are available for download directly from the platform.',
    details: [
      'Interactive dashboard with live metrics and scoring',
      'Heat maps, GIS visualizations, and trend analytics',
      'Citizen advocacy module with community voice data',
      '80-150+ page downloadable PDF report',
      'Executive summary for leadership audiences',
      'Prioritized improvement recommendations',
      'Strategic action plan & presentation deck (Complete tier)',
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
  { name: 'Community Input', desc: 'Citizen surveys, voice recordings, cultural context interviews, community feedback' },
];

export default function HowItWorks() {
  useEffect(() => {
    document.title = 'How It Works | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'SafeStreets Intelligence follows a rigorous 5-phase process: Scope & Planning, In-Depth Field Audit, Citizen Engagement, Analysis & Modeling, and Dashboard & Deliverables.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">Our Process</p>
          <h1 className="text-4xl md:text-5xl font-bold text-enterprise-slate mb-6">How We Build Intelligence</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every SafeStreets engagement follows a structured 5-phase methodology combining field research, community engagement, and data analysis.
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
            <p className="text-gray-600 max-w-xl mx-auto">We integrate multiple data sources for a comprehensive, validated picture of pedestrian conditions.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
              <p className="text-sm font-semibold text-enterprise-navy uppercase tracking-wider mb-4">Pedestrian Safety Intelligence — $50K</p>
              <ul className="space-y-3">
                {[
                  'Interactive dashboard with core metrics',
                  '3-day in-depth field audit data',
                  'Community survey & voice collection',
                  '80+ page downloadable report',
                  'Executive summary',
                  'Heat maps and GIS visualizations',
                  'Data export (CSV, GIS formats)',
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
              <p className="text-xs text-gray-400 mb-4">Everything in Pedestrian Safety Intelligence, plus:</p>
              <ul className="space-y-3">
                {[
                  'Full 12-metric interactive dashboard',
                  'Advanced analytics & trend tracking',
                  'Complete citizen advocacy module',
                  'Cultural context mapping & sentiment analysis',
                  'Multilingual community engagement',
                  '150+ page comprehensive report',
                  'Strategic action plan & presentation deck',
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
        title="Ready to start your pedestrian safety assessment?"
        description="Tell us about your project and we'll scope a custom engagement for you."
      />
    </>
  );
}
