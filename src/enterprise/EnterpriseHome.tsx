import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './components/EnterpriseCTA';

const VERTICALS = [
  {
    title: 'Governments',
    description: 'Custom dashboards for ADA compliance tracking, Vision Zero corridor prioritization, and capital improvement decisioning.',
    href: '/enterprise/governments',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
  },
  {
    title: 'Real Estate',
    description: 'Pedestrian intelligence workflows for site selection, due diligence, and investment thesis development.',
    href: '/enterprise/real-estate',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" />
      </svg>
    ),
  },
  {
    title: 'Mobility',
    description: 'Street-level intelligence for transit integration planning, micromobility deployment, and last-mile network analysis.',
    href: '/enterprise/mobility',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0h-2.25m0 0V6.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3.659M9.75 10.034V6.375c0-.621-.504-1.125-1.125-1.125H6.375c-.621 0-1.125.504-1.125 1.125v7.875" />
      </svg>
    ),
  },
  {
    title: 'Research',
    description: 'Structured datasets, configurable scoring methodology, and bulk analysis workflows for academic and policy research.',
    href: '/enterprise/research',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
];

const PLATFORM_CAPABILITIES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
    title: 'Custom Intelligence Dashboards',
    description: 'Configurable views of street-level data across any geography. Choose your metrics, set your own weighting, and surface what matters most to your team\'s decisions.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Decisioning Engine',
    description: 'Define rules that turn raw walkability data into actionable priorities. Set thresholds for risk alerts, scoring tiers, and workflow triggers — built around how your organization makes decisions.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: 'Workflow & API Integration',
    description: 'Embed the intelligence engine into your existing planning tools, GIS systems, or internal workflows. API access, bulk export, and white-label deployment options.',
  },
];

const STATS = [
  { value: '50+', label: 'Integrated Data Sources' },
  { value: '12', label: 'Walkability Metrics' },
  { value: 'Any City', label: 'Global Coverage' },
  { value: 'Custom', label: 'Per-Client Workflows' },
];

export default function EnterpriseHome() {
  useEffect(() => {
    document.title = 'Street Intelligence Platform — SafeStreets Enterprise';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Custom dashboards and decisioning workflows for neighborhood and street intelligence. Built for governments, real estate, mobility operators, and research institutions.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-4">SafeStreets Intelligence</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-enterprise-slate mb-6 leading-tight">
            Custom Dashboards and Workflows for Street Intelligence
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            A decisioning engine for neighborhood and street data. Configure custom dashboards, set decisioning rules, and integrate walkability intelligence into how your organization plans and acts.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/enterprise/contact"
              className="px-8 py-4 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition text-lg"
            >
              Request a Demo
            </Link>
            <Link
              to="/enterprise/how-it-works"
              className="px-8 py-4 border-2 border-gray-300 text-enterprise-slate font-semibold rounded-lg hover:border-enterprise-navy transition text-lg"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-100 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-enterprise-navy">{s.value}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-3">A Platform, Not a Report</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Built on the same scoring engine that powers the free SafeStreets tool — extended into a configurable platform for organizational workflows.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {PLATFORM_CAPABILITIES.map((cap) => (
              <div key={cap.title} className="bg-white border border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-enterprise-navy/20 transition">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-enterprise-navy flex items-center justify-center mb-5">
                  {cap.icon}
                </div>
                <h3 className="text-lg font-semibold text-enterprise-slate mb-3">{cap.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions by Vertical */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-3">Built for Your Use Case</h2>
            <p className="text-gray-600 max-w-xl mx-auto">The same intelligence engine, configured for the decisions and workflows of each sector.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {VERTICALS.map((v) => (
              <Link
                key={v.title}
                to={v.href}
                className="group bg-white border border-gray-100 rounded-xl p-8 hover:shadow-lg hover:border-enterprise-navy/20 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-enterprise-navy flex items-center justify-center mb-4 group-hover:bg-enterprise-navy group-hover:text-white transition">
                  {v.icon}
                </div>
                <h3 className="text-xl font-semibold text-enterprise-slate mb-2">For {v.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">{v.description}</p>
                <span className="text-sm font-medium text-enterprise-navy group-hover:underline">Learn more &rarr;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes It Different */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-5">Intelligence that fits your workflow</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Most walkability tools give you a score. SafeStreets Intelligence gives you a configurable engine — one you can shape around the specific decisions your team needs to make.
              </p>
              <ul className="space-y-4">
                {[
                  'Define your own metric weights and composite score logic',
                  'Set threshold rules that flag streets, corridors, or zones needing attention',
                  'Configure dashboards per team or stakeholder role',
                  'Export to GIS, connect via API, or deploy white-label',
                  'Bulk analysis across portfolios, districts, or city-wide geographies',
                  'Built on OpenStreetMap, satellite imagery, and census data — no vendor lock-in',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-enterprise-green mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-enterprise-slate rounded-2xl p-8 text-white">
              <p className="text-sm font-semibold text-enterprise-green-light uppercase tracking-wider mb-6">Data Sources</p>
              <div className="space-y-4">
                {[
                  { name: 'OpenStreetMap', desc: 'Street network, intersections, pedestrian paths' },
                  { name: 'Satellite Imagery', desc: 'Canopy cover, land use, urban heat, surface conditions' },
                  { name: 'EPA Walkability Index', desc: 'Intersection density, transit proximity, land use mix' },
                  { name: 'Census & Demographics', desc: 'Population density, commute patterns, equity indicators' },
                  { name: 'Municipal GIS', desc: 'Zoning, infrastructure, public right-of-way data' },
                  { name: 'Transit Feeds (GTFS)', desc: 'Service frequency, route coverage, stop accessibility' },
                ].map((ds) => (
                  <div key={ds.name} className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-enterprise-green mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{ds.name}</p>
                      <p className="text-xs text-gray-400">{ds.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <EnterpriseCTA dark />
    </>
  );
}
