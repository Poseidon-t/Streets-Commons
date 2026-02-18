import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import EnterpriseCTA from './components/EnterpriseCTA';

const FEATURES = [
  { name: 'Safety & infrastructure metrics', core: '8 core metrics', complete: 'All 12 metrics' },
  { name: 'Report length', core: '80+ pages', complete: '150+ pages' },
  { name: 'Field audit duration', core: '3-day audit', complete: '5-day audit' },
  { name: 'Delivery timeline', core: '6 weeks', complete: '8 weeks' },
  { name: 'Sidewalk quality analysis', core: true, complete: true },
  { name: 'Crossing safety assessment', core: true, complete: true },
  { name: 'ADA compliance review', core: true, complete: true },
  { name: 'Lighting & visibility analysis', core: true, complete: true },
  { name: 'Shade & weather protection', core: true, complete: true },
  { name: 'Noise & pollution mapping', core: true, complete: true },
  { name: 'Transit proximity scoring', core: true, complete: true },
  { name: 'Destination density mapping', core: true, complete: true },
  { name: 'Network connectivity analysis', core: false, complete: true },
  { name: 'Traffic volume assessment', core: false, complete: true },
  { name: 'Speed environment analysis', core: false, complete: true },
  { name: 'Crash history & risk mapping', core: false, complete: true },
  { name: 'Data appendix & methodology', core: true, complete: true },
  { name: 'Executive summary', core: true, complete: true },
  { name: 'Strategic action plan', core: false, complete: true },
  { name: 'Stakeholder presentation deck', core: false, complete: true },
  { name: 'Ongoing advisory support', core: false, complete: true },
];

const FAQS = [
  {
    q: 'What geographic area does a single report cover?',
    a: 'A single report typically covers a corridor, neighborhood, or district — roughly 0.5 to 2 square miles. Larger areas may require multiple reports or a custom scope. We define the exact boundaries during the Scope & Planning phase.',
  },
  {
    q: 'How is the field audit conducted?',
    a: 'Our trained analysts walk every street segment in the study area, documenting conditions across all assessed metrics using standardized protocols. We use GPS-tagged photography, measurement tools, and structured observation forms to ensure comprehensive and consistent data collection.',
  },
  {
    q: 'Can I customize which metrics are included?',
    a: 'The Pedestrian Safety Intelligence package includes 8 core metrics, and the Complete Intelligence package includes all 12. Within each tier, all metrics in that package are included. If you need a custom combination, contact us to discuss your specific needs.',
  },
  {
    q: 'What data sources do you use beyond field audits?',
    a: 'We integrate municipal GIS data, census demographics, transit schedules, crash databases, land use records, and satellite imagery. All data sources are documented in the methodology appendix of every report.',
  },
  {
    q: 'Do you work outside the United States?',
    a: 'Currently, our field audit capabilities are focused on US cities. We can discuss international projects on a case-by-case basis — the methodology is applicable globally, though data availability may vary.',
  },
  {
    q: 'What format is the final deliverable?',
    a: 'You receive a professionally designed PDF report, a stakeholder-ready presentation deck (Complete tier), raw data in CSV/GIS formats, and high-resolution maps. All deliverables are yours to use and share internally.',
  },
  {
    q: 'Is there ongoing support after delivery?',
    a: 'The Complete Intelligence package includes 3 months of advisory support for implementation questions. The Pedestrian Safety Intelligence package includes a post-delivery Q&A session. Extended advisory engagements are available separately.',
  },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Pricing | SafeStreets Intelligence';
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', 'SafeStreets Intelligence pricing. Pedestrian safety & infrastructure reports starting at $50K. Complete Intelligence System starting at $100K.');
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-enterprise-gray py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-enterprise-navy font-semibold text-sm uppercase tracking-wider mb-3">Pricing</p>
          <h1 className="text-4xl md:text-5xl font-bold text-enterprise-slate mb-6">Invest in Pedestrian Intelligence</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Two tiers designed for different project scopes. Both deliver rigorous, actionable pedestrian safety analysis.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-8 mb-20">
            {/* Core */}
            <div className="bg-white border-2 border-gray-100 rounded-2xl p-8 md:p-10">
              <p className="text-sm font-semibold text-enterprise-navy uppercase tracking-wider mb-3">Pedestrian Safety Intelligence</p>
              <p className="text-5xl font-bold text-enterprise-slate mb-1">$50K</p>
              <p className="text-sm text-gray-500 mb-2">Starting price</p>
              <p className="text-sm text-gray-600 mb-8">8 core metrics, 80-page report, 3-day field audit. Ideal for focused corridor or neighborhood analysis.</p>
              <Link to="/enterprise/contact" className="block text-center py-3.5 border-2 border-enterprise-navy text-enterprise-navy font-semibold rounded-lg hover:bg-enterprise-navy hover:text-white transition mb-6">
                Request Proposal
              </Link>
              <p className="text-xs text-gray-400 text-center">6-week delivery</p>
            </div>

            {/* Complete */}
            <div className="bg-enterprise-slate rounded-2xl p-8 md:p-10 text-white relative">
              <div className="absolute top-6 right-6 px-3 py-1 bg-enterprise-green/20 text-enterprise-green-light text-xs font-semibold rounded-full">
                Most Comprehensive
              </div>
              <p className="text-sm font-semibold text-enterprise-green-light uppercase tracking-wider mb-3">Complete Intelligence</p>
              <p className="text-5xl font-bold mb-1">$100K</p>
              <p className="text-sm text-gray-400 mb-2">Starting price</p>
              <p className="text-sm text-gray-300 mb-8">All 12 metrics, 150-page report, 5-day field audit, strategic action plan, and ongoing advisory.</p>
              <Link to="/enterprise/contact" className="block text-center py-3.5 bg-enterprise-green text-white font-semibold rounded-lg hover:bg-enterprise-green-light transition mb-6">
                Contact Sales
              </Link>
              <p className="text-xs text-gray-500 text-center">8-week delivery</p>
            </div>
          </div>

          {/* Feature Comparison */}
          <div>
            <h2 className="text-2xl font-bold text-enterprise-slate mb-8 text-center">Feature Comparison</h2>
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-3 bg-enterprise-gray px-6 py-4 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-500">Feature</div>
                <div className="text-sm font-semibold text-enterprise-navy text-center">Pedestrian Safety Intelligence</div>
                <div className="text-sm font-semibold text-enterprise-green text-center">Complete Intelligence</div>
              </div>
              {FEATURES.map((f, i) => (
                <div key={i} className={`grid grid-cols-3 px-6 py-3.5 items-center ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                  <div className="text-sm text-gray-700">{f.name}</div>
                  <div className="text-center">
                    {typeof f.core === 'string' ? (
                      <span className="text-sm text-gray-700">{f.core}</span>
                    ) : f.core ? (
                      <svg className="w-5 h-5 text-enterprise-navy mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </div>
                  <div className="text-center">
                    {typeof f.complete === 'string' ? (
                      <span className="text-sm text-gray-700">{f.complete}</span>
                    ) : f.complete ? (
                      <svg className="w-5 h-5 text-enterprise-green mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-gray-300">&mdash;</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-enterprise-gray">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-enterprise-slate mb-10 text-center">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left px-6 py-4 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-enterprise-slate pr-4">{faq.q}</span>
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
      <EnterpriseCTA
        title="Ready to get started?"
        description="Contact our team to discuss your project and receive a tailored proposal."
        primaryLabel="Contact Sales"
        secondaryLabel="See How It Works"
        secondaryHref="/enterprise/how-it-works"
      />
    </>
  );
}
