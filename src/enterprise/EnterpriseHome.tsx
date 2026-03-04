import { useEffect } from 'react';
import { Link } from 'react-router-dom';

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
            Street Intelligence for Organizations
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Custom dashboards, decisioning workflows, and API access — built on the data sources that matter to your project.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/enterprise/contact"
              className="px-8 py-4 bg-enterprise-navy text-white font-semibold rounded-lg hover:bg-enterprise-navy-dark transition text-base"
            >
              Request a Demo
            </Link>
            <Link
              to="/"
              className="px-8 py-4 border-2 border-gray-300 text-enterprise-slate font-semibold rounded-lg hover:border-enterprise-navy transition text-base"
            >
              Try the Free Tool
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">A Platform, Not a Report</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              A configurable platform built around your workflows, data sources, and decisioning requirements.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: 'Custom Dashboards',
                desc: 'Configurable views of street data for any geography. Set your own metric weights and surface what matters most to your team.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
                  </svg>
                ),
              },
              {
                title: 'Decisioning Engine',
                desc: 'Define rules that turn raw walkability data into priorities. Set thresholds for risk alerts, scoring tiers, and workflow triggers.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                ),
              },
              {
                title: 'API & Integrations',
                desc: 'Connect to your GIS, planning tools, or internal workflows. API access, bulk export, and white-label deployment.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ),
              },
            ].map((cap) => (
              <div key={cap.title} className="bg-white border border-gray-100 rounded-xl p-8 hover:shadow-md hover:border-enterprise-navy/20 transition">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-enterprise-navy flex items-center justify-center mb-5">
                  {cap.icon}
                </div>
                <h3 className="text-base font-semibold text-enterprise-slate mb-2">{cap.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-enterprise-slate mb-3">From Data to Decisions</h2>
            <p className="text-gray-600">Live platform in 5–6 weeks.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Scope', desc: 'Define your geography, priority metrics, decisioning rules, and integration requirements.' },
              { step: '02', title: 'Configure & Build', desc: 'Dashboard build, metric weighting, API keys, GIS connections, and threshold alerts.' },
              { step: '03', title: 'Launch & Iterate', desc: 'Live platform with team onboarding, quarterly data refresh, and dedicated support.' },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-xl p-8 border border-gray-100">
                <p className="text-4xl font-bold text-enterprise-navy/20 mb-4">{s.step}</p>
                <h3 className="text-lg font-semibold text-enterprise-slate mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-enterprise-slate mb-4">Custom Pricing</h2>
          <p className="text-gray-600 mb-10 leading-relaxed">
            Every engagement is scoped to your project — geography, data depth, integrations, and deployment model. Tell us what you need and we'll put together a proposal.
          </p>
          <Link
            to="/enterprise/contact"
            className="inline-block px-10 py-4 bg-enterprise-navy text-white font-bold rounded-lg hover:bg-enterprise-navy-dark transition"
          >
            Request a Proposal
          </Link>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-enterprise-slate text-center mb-12">Built for Your Sector</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { title: 'Governments', desc: 'ADA compliance, Vision Zero corridors, capital improvement decisioning' },
              { title: 'Real Estate', desc: 'Site selection, due diligence, investment portfolio pedestrian intelligence' },
              { title: 'Mobility', desc: 'Transit integration, micromobility deployment, last-mile network analysis' },
              { title: 'Research', desc: 'Configurable scoring, bulk analysis, GIS export, API access' },
            ].map((v) => (
              <div key={v.title} className="bg-white rounded-xl p-6 border border-gray-100">
                <h3 className="font-semibold text-enterprise-slate mb-2">{v.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-enterprise-navy">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to build your street intelligence platform?</h2>
          <p className="text-lg text-blue-200 mb-8">Tell us about your project and we'll put together a tailored proposal.</p>
          <Link
            to="/enterprise/contact"
            className="inline-block px-10 py-4 bg-white text-enterprise-navy font-bold rounded-lg hover:opacity-90 transition text-base"
          >
            Contact Sales →
          </Link>
        </div>
      </section>
    </>
  );
}
