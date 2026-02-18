import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './components/EnterpriseCTA';

const VERTICALS = [
  {
    title: 'Governments',
    description: 'ADA compliance audits, Vision Zero planning, and infrastructure investment prioritization.',
    href: '/enterprise/governments',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    ),
  },
  {
    title: 'Real Estate',
    description: 'Site selection insights, pedestrian infrastructure analysis, and risk assessment for developments.',
    href: '/enterprise/real-estate',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" />
      </svg>
    ),
  },
  {
    title: 'Mobility',
    description: 'Transit integration analysis, micromobility planning, and last-mile connectivity mapping.',
    href: '/enterprise/mobility',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25m-2.25 0h-2.25m0 0V6.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3.659M9.75 10.034V6.375c0-.621-.504-1.125-1.125-1.125H6.375c-.621 0-1.125.504-1.125 1.125v7.875" />
      </svg>
    ),
  },
  {
    title: 'Research',
    description: 'Peer-reviewed methodology, comprehensive datasets, and academic partnership opportunities.',
    href: '/enterprise/research',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
];

const STATS = [
  { value: '12', label: 'Safety & Infrastructure Metrics' },
  { value: 'Live', label: 'Interactive Dashboard' },
  { value: '5-Day', label: 'In-Depth Field Audits' },
  { value: '3', label: 'Intelligence Pillars' },
];

export default function EnterpriseHome() {
  useEffect(() => {
    document.title = 'SafeStreets Intelligence — Pedestrian Safety & Infrastructure Platform';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'Interactive dashboards, in-depth field audits, and citizen advocacy intelligence for governments, real estate developers, mobility companies, and research institutions. Starting at $50K.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-4">Pedestrian Safety & Infrastructure Intelligence</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-enterprise-slate mb-6 leading-tight">
            Data-Driven Pedestrian Intelligence for Better Decisions
          </h1>
          <p className="text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            An intelligence platform combining interactive dashboards, in-depth field audits, and citizen advocacy to transform pedestrian safety data into action for governments, developers, and urban planners.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/enterprise/contact"
              className="px-8 py-4 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition text-lg"
            >
              Request a Consultation
            </Link>
            <Link
              to="/enterprise/how-it-works"
              className="px-8 py-4 border-2 border-gray-300 text-enterprise-slate font-semibold rounded-lg hover:border-enterprise-navy transition text-lg"
            >
              See How It Works
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

      {/* Solutions by Vertical */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-3">Intelligence for Every Stakeholder</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Tailored pedestrian safety analysis for your specific use case and decision-making needs.</p>
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

      {/* Methodology Preview */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-3">Rigorous Methodology</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Every engagement follows a structured 5-phase process combining field research, community engagement, and data analysis.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6">
            {[
              { step: '01', title: 'Scope & Planning', desc: 'Define study area, objectives, and community engagement plan.' },
              { step: '02', title: 'Field Audit', desc: '3-5 day on-ground assessment by trained analysts.' },
              { step: '03', title: 'Citizen Engagement', desc: 'Community surveys, voice collection, and cultural context.' },
              { step: '04', title: 'Analysis', desc: 'Multi-source data integration and metric scoring.' },
              { step: '05', title: 'Dashboard & Delivery', desc: 'Interactive platform, downloadable reports, and advocacy insights.' },
            ].map((phase) => (
              <div key={phase.step} className="bg-white rounded-xl border border-gray-100 p-6">
                <p className="text-sm font-bold text-enterprise-navy mb-2">{phase.step}</p>
                <h3 className="text-base font-semibold text-enterprise-slate mb-2">{phase.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{phase.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/enterprise/how-it-works" className="text-sm font-medium text-enterprise-navy hover:underline">
              Learn more about our process &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Two Tiers Preview */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-enterprise-slate mb-3">Two Tiers, One Standard</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Choose the depth of analysis that matches your project scope.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Pedestrian Safety Intelligence */}
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-8">
              <p className="text-sm font-semibold text-enterprise-navy uppercase tracking-wider mb-2">Pedestrian Safety Intelligence</p>
              <p className="text-4xl font-bold text-enterprise-slate mb-1">$50K</p>
              <p className="text-sm text-gray-500 mb-6">Starting price</p>
              <ul className="space-y-3 mb-8">
                {['Interactive dashboard with core metrics', '3-day in-depth field audit (8 metrics)', 'Community survey & voice collection', '80+ page downloadable report', '6-week delivery'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-enterprise-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/enterprise/pricing" className="block text-center py-3 border-2 border-enterprise-navy text-enterprise-navy font-semibold rounded-lg hover:bg-enterprise-navy hover:text-white transition">
                View Pricing
              </Link>
            </div>

            {/* Complete Intelligence */}
            <div className="bg-enterprise-slate rounded-2xl p-8 text-white relative overflow-hidden">
              <div className="absolute top-4 right-4 px-3 py-1 bg-enterprise-green/20 text-enterprise-green-light text-xs font-semibold rounded-full">
                Most Comprehensive
              </div>
              <p className="text-sm font-semibold text-enterprise-green-light uppercase tracking-wider mb-2">Complete Intelligence</p>
              <p className="text-4xl font-bold mb-1">$100K</p>
              <p className="text-sm text-gray-400 mb-6">Starting price</p>
              <ul className="space-y-3 mb-8">
                {['Full 12-metric interactive dashboard', '5-day comprehensive field audit', 'Full citizen advocacy module', '150+ page report & strategic action plan', '8-week delivery', 'Ongoing advisory support'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                    <svg className="w-4 h-4 text-enterprise-green flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/enterprise/contact" className="block text-center py-3 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition">
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <EnterpriseCTA dark />
    </>
  );
}
