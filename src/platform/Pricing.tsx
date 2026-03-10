import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PlatformCTA from './components/PlatformCTA';

const PLATFORM_FEATURES = [
  { name: 'Custom dashboard', platform: 'Configured for your use case', custom: 'Multi-view, role-based' },
  { name: 'Geographic coverage', platform: 'Single geography / corridor', custom: 'Multi-geography or portfolio' },
  { name: 'Walkability metrics', platform: 'All 12 core metrics', custom: 'All 12 + custom composites' },
  { name: 'Metric weight configuration', platform: true, custom: true },
  { name: 'Decisioning rules & threshold alerts', platform: 'Standard', custom: 'Fully custom logic' },
  { name: 'Heat maps & corridor analysis', platform: true, custom: true },
  { name: 'API access', platform: true, custom: true },
  { name: 'GIS export (CSV, GeoJSON)', platform: true, custom: true },
  { name: 'Embedded or white-label deployment', platform: false, custom: true },
  { name: 'Integration with your systems', platform: 'Basic', custom: 'Full integration build' },
  { name: 'Webhook & workflow automation', platform: false, custom: true },
  { name: 'Data refresh cadence', platform: 'Quarterly', custom: 'Continuous or custom' },
  { name: 'Team onboarding & documentation', platform: true, custom: true },
  { name: 'Support', platform: 'Standard', custom: 'Dedicated contact' },
  { name: 'Multi-client / portfolio analysis', platform: false, custom: true },
];

const FAQS = [
  {
    q: 'What geographic area can the platform cover?',
    a: 'The platform can analyze any geography — from a single corridor or neighborhood to a full city or multi-city portfolio. Coverage is based on OpenStreetMap and satellite data, which is available globally. Larger geographies may affect configuration time and pricing.',
  },
  {
    q: 'Can we connect our own data to the platform?',
    a: 'Yes. The Custom Decisioning Build tier supports integration of your organization\'s internal datasets — GIS layers, inspection records, complaint logs, permit data, or any other structured data source. Custom data layers are incorporated into dashboards and scoring logic during the Data Configuration phase.',
  },
  {
    q: 'What does "decisioning rules" mean in practice?',
    a: 'Decisioning rules turn walkability scores into actionable outputs. Examples: flag every street segment where the composite score drops below 40; rank a portfolio of sites by pedestrian premium potential; trigger an alert when a corridor\'s crossing safety score changes by more than 10 points. Rules are defined during Discovery based on how your team actually makes decisions.',
  },
  {
    q: 'How does API access work?',
    a: 'Both tiers include API access. You receive endpoint documentation, authentication keys, and rate limits appropriate to your tier. The API returns walkability scores, metric breakdowns, and geographic data in JSON. Custom Decisioning Build clients can request webhook endpoints for real-time threshold alerts.',
  },
  {
    q: 'What is white-label or embedded deployment?',
    a: 'White-label deployment means the platform runs under your organization\'s branding, domain, and access controls — with no SafeStreets branding visible to your users. Embedded deployment means specific dashboard views or map widgets are embedded directly into your existing internal tools or public-facing portals. Both options are available in the Custom Decisioning Build tier.',
  },
  {
    q: 'How long does it take to go live?',
    a: 'A standard Intelligence Platform deployment typically takes 5–6 weeks from contract to launch. Custom Decisioning Builds with system integrations or white-label deployment typically take 6–10 weeks depending on complexity. Timeline is established during Discovery.',
  },
  {
    q: 'How often is the data updated?',
    a: 'Intelligence Platform includes quarterly data refreshes. Custom Decisioning Build supports continuous updates tied to OpenStreetMap edits, satellite imagery updates, and any connected live data sources. Update cadence is agreed upon during scoping.',
  },
  {
    q: 'Do you work internationally?',
    a: 'Yes. The platform is built on OpenStreetMap and satellite data, which have global coverage. The EPA Walkability Index, Census, CDC, and FEMA layers are US-specific, but the core scoring engine works for any geography with OSM and Sentinel-2 data.',
  },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Pricing | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'SafeStreets Intelligence platform pricing. Custom dashboards, decisioning workflows, and API access for neighborhood and street intelligence. Contact us for a custom quote.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-platform-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-platform-navy font-semibold text-sm uppercase tracking-wider mb-3">Pricing</p>
          <h1 className="text-4xl md:text-5xl font-bold text-platform-slate mb-6">Platform Pricing</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Two tiers designed for different levels of customization and integration. Both include a configured dashboard, API access, and ongoing data. Priced per engagement based on geography, scope, and integration requirements.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {/* Intelligence Platform */}
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-8 md:p-10">
              <p className="text-sm font-semibold text-platform-navy uppercase tracking-wider mb-3">Intelligence Platform</p>
              <p className="text-4xl font-bold text-platform-slate mb-1">Custom Pricing</p>
              <p className="text-sm text-gray-500 mb-2">Based on geography and scope</p>
              <p className="text-sm text-gray-600 mb-8">
                A configured dashboard for your geography, with your metric weights, decisioning thresholds, API access, and quarterly data updates. The fastest path to live street intelligence.
              </p>
              <Link to="/platform/contact" className="block text-center py-3.5 border-2 border-platform-navy text-platform-navy font-semibold rounded-lg hover:bg-platform-navy hover:text-white transition mb-6">
                Request a Quote
              </Link>
              <p className="text-xs text-gray-400 text-center">Typical deployment: 5–6 weeks</p>
            </div>

            {/* Custom Decisioning Build */}
            <div className="bg-platform-slate rounded-2xl p-8 md:p-10 text-white relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-platform-green/20 text-platform-green-light text-xs font-semibold rounded-full">
                Most Flexible
              </div>
              <p className="text-sm font-semibold text-platform-green-light uppercase tracking-wider mb-3">Custom Decisioning Build</p>
              <p className="text-4xl font-bold mb-1">Custom Pricing</p>
              <p className="text-sm text-gray-400 mb-2">Based on scope, integrations, and deployment</p>
              <p className="text-sm text-gray-300 mb-8">
                Bespoke decisioning workflows, white-label or embedded deployment, full system integrations, and continuous data updates. Built for organizations that need the intelligence engine embedded into their own operations.
              </p>
              <Link to="/platform/contact" className="block text-center py-3.5 bg-platform-green text-white font-semibold rounded-lg hover:bg-platform-green-light transition mb-6">
                Contact Sales
              </Link>
              <p className="text-xs text-gray-500 text-center">Typical deployment: 6–10 weeks</p>
            </div>
          </div>

          {/* Feature Comparison */}
          <div>
            <h2 className="text-2xl font-bold text-platform-slate mb-8 text-center">Feature Comparison</h2>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
              <div className="min-w-[600px]">
                <div className="grid grid-cols-3 bg-platform-gray px-6 py-4 border-b border-gray-100">
                  <div className="text-sm font-semibold text-gray-500">Feature</div>
                  <div className="text-sm font-semibold text-platform-navy text-center">Intelligence Platform</div>
                  <div className="text-sm font-semibold text-platform-green text-center">Custom Decisioning Build</div>
                </div>
                {PLATFORM_FEATURES.map((f, i) => (
                  <div key={i} className={`grid grid-cols-3 px-6 py-3.5 items-center ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <div className="text-sm text-gray-700">{f.name}</div>
                    <div className="text-center">
                      {typeof f.platform === 'string' ? (
                        <span className="text-sm text-gray-700">{f.platform}</span>
                      ) : f.platform ? (
                        <>
                          <svg className="w-5 h-5 text-platform-navy mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <span className="text-gray-300" aria-label="Not included">&mdash;</span>
                      )}
                    </div>
                    <div className="text-center">
                      {typeof f.custom === 'string' ? (
                        <span className="text-sm text-gray-700">{f.custom}</span>
                      ) : f.custom ? (
                        <>
                          <svg className="w-5 h-5 text-platform-green mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="sr-only">Included</span>
                        </>
                      ) : (
                        <span className="text-gray-300" aria-label="Not included">&mdash;</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-platform-gray">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-platform-slate mb-10 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-platform-slate pr-4">{faq.q}</span>
                  <svg
                    className={`w-5 h-5 text-gray-400 flex-shrink-0 transition ${openFaq === i ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <PlatformCTA
        title="Ready to build your intelligence platform?"
        description="Contact our team to scope a custom engagement and receive a proposal."
        primaryLabel="Contact Sales"
        secondaryLabel="How It Works"
        secondaryHref="/platform/how-it-works"
      />
    </>
  );
}
