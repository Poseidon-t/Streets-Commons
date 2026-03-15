import { useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function PlatformHome() {
  useEffect(() => {
    document.title = 'Street Intelligence Platform  -  SafeStreets Platform';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Infrastructure intelligence platform for municipal planners, real estate developers, impact investors, and community organizations. Custom dashboards, decisioning workflows, and scenario modeling.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-platform-gray py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-platform-navy font-semibold text-sm uppercase tracking-wider mb-4">SafeStreets Intelligence</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-platform-slate mb-6 leading-tight">
            Street Intelligence Platform
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            From <em>"how walkable is this street?"</em> to <em>"should I invest in this neighborhood?"</em>, <em>"which corridors need intervention most?"</em>, and <em>"what's the ROI of this infrastructure change?"</em>
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/platform/contact"
              className="px-8 py-4 bg-platform-navy text-white font-semibold rounded-lg hover:bg-platform-navy-dark transition text-base"
            >
              Request a Demo
            </Link>
            <Link
              to="/"
              className="px-8 py-4 border-2 border-gray-300 text-platform-slate font-semibold rounded-lg hover:border-platform-navy transition text-base"
            >
              Try the Free Tool
            </Link>
          </div>
        </div>
      </section>

      {/* Why It Matters */}
      <section className="py-16 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-lg text-gray-600 leading-relaxed">
            Streets are the foundation of how communities function. Walkable neighborhoods foster social connection, drive economic vitality, and strengthen cultural identity. SafeStreets turns that principle into actionable intelligence  -  for planners, developers, investors, and the communities they serve.
          </p>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-platform-slate mb-3">A Platform, Not a Report</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              A configurable platform built around your workflows, data sources, and decisioning requirements.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Investment & Site Intelligence',
                desc: 'Score and rank neighborhoods, corridors, and parcels to find underinvested areas, quantify pedestrian access, and build the data case for where to build or invest next.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                ),
              },
              {
                title: 'Infrastructure Decisioning',
                desc: 'Configure rules that turn scores into action  -  flag corridors below a walkability threshold, prioritize interventions by composite score, and generate ranked priority lists for capital planning.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                ),
              },
              {
                title: 'Comparative Analysis',
                desc: 'Compare walkability conditions across sites, corridors, or neighborhoods. Identify infrastructure gaps and quantify differences to support investment decisions.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                ),
              },
            ].map((cap) => (
              <div key={cap.title} className="bg-white border border-gray-100 rounded-xl p-8 hover:shadow-md hover:border-platform-navy/20 transition">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-platform-navy flex items-center justify-center mb-5">
                  {cap.icon}
                </div>
                <h3 className="text-base font-semibold text-platform-slate mb-2">{cap.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-platform-gray">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-platform-slate mb-3">From Data to Decisions</h2>
            <p className="text-gray-600">Live platform in 5-6 weeks.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Scope', desc: 'Define geography (city, region, corridor), select data sources (OSM, satellite imagery, CDC, GTFS, FEMA, proprietary), and agree on decisioning rules.' },
              { step: '02', title: 'Configure & Build', desc: 'Dashboard build, metric weighting, API keys, GIS connections (ArcGIS, PostGIS, Carto), threshold alerts, and composite score logic.' },
              { step: '03', title: 'Launch & Iterate', desc: 'Live platform with team onboarding, scheduled data refresh, and dedicated support for ongoing iteration as your needs evolve.' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-xl p-8 border border-gray-100">
                <p className="text-4xl font-bold text-platform-navy/20 mb-4">{s.step}</p>
                <h3 className="text-lg font-semibold text-platform-slate mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-platform-slate mb-4">Custom Pricing</h2>
          <p className="text-gray-600 mb-10 leading-relaxed">
            Every engagement is scoped to your project  -  geography, data depth, integrations, and deployment model. Tell us what you need and we'll put together a proposal.
          </p>
          <Link
            to="/platform/contact"
            className="inline-block px-10 py-4 bg-platform-navy text-white font-bold rounded-lg hover:bg-platform-navy-dark transition"
          >
            Request a Proposal
          </Link>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 bg-platform-gray">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-platform-slate text-center mb-12">Built for Your Sector</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Municipal Planners', desc: 'Which streets need intervention most? Prioritize capital budgets by pedestrian risk score, map Vision Zero high-injury corridors, and build the data case for ADA compliance investments.' },
              { title: 'Real Estate & Development', desc: 'Should I invest in this neighborhood? Score sites by walkability, accessibility, and growth potential across 100+ parcels. Portfolio-wide pedestrian intelligence for due diligence and site selection.' },
              { title: 'Impact Investors', desc: 'Find underinvested neighborhoods with strong fundamentals. Quantify the economic upside of walkability improvements and model ROI projections before committing capital.' },
              { title: 'Community Organizations', desc: 'Fight for your neighborhood with data. Generate infrastructure audit reports, map pedestrian gaps, and make a compelling case to planners and elected officials.' },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold text-platform-slate mb-2">{v.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-platform-navy">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to build your street intelligence platform?</h2>
          <p className="text-lg text-blue-200 mb-8">Tell us about your project and we'll put together a tailored proposal.</p>
          <Link
            to="/platform/contact"
            className="inline-block px-10 py-4 bg-white text-platform-navy font-bold rounded-lg hover:opacity-90 transition text-base"
          >
            Contact Sales →
          </Link>
        </div>
      </section>
    </>
  );
}
