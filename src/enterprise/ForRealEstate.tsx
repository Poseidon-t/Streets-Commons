import { Link } from 'react-router-dom';
import VerticalPage from './components/VerticalPage';

export default function ForRealEstate() {
  return (
    <>
      {/* Agent-focused hero section — direct link to the tool */}
      <section className="border-b" style={{ borderColor: '#e0dbd0', backgroundColor: '#faf8f4' }}>
        <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1e3a5f' }}>
                For Real Estate Agents
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#2a3a2a' }}>
                Branded Walkability Reports for Your Listings
              </h2>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6b7280' }}>
                Every Walk Score point adds ~$3,500 to home value. Give your buyers the data they need —
                and put your name on it. 8 metrics from satellite imagery and OpenStreetMap, formatted
                as a print-ready PDF with your branding.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/?agent=true"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Try It Free — 3 Reports
                </Link>
                <a
                  href="https://buy.stripe.com/7sY5kD8XD7VL3FAgYo2Fa08"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-medium hover:underline"
                  style={{ color: '#1e3a5f' }}
                >
                  Or get unlimited — $99 one-time &rarr;
                </a>
              </div>
            </div>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                { icon: '📊', title: 'Your Branding on Every Page', desc: 'Name, title, company, phone, and email' },
                { icon: '🏠', title: 'Full Walkability Analysis', desc: '8 metrics, 15-min city scores & social indicators' },
                { icon: '🖨️', title: 'Print-Ready PDF', desc: '3-page report optimized for print and email' },
                { icon: '🌍', title: 'Any Address Worldwide', desc: 'Works for US listings and international properties' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
                  <span className="text-lg flex-shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#2a3a2a' }}>{f.title}</div>
                    <div className="text-xs" style={{ color: '#8a9a8a' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Existing enterprise-focused content for developers/investors */}
      <VerticalPage
        metaTitle="Walkability & Street Intelligence for Real Estate"
        metaDescription="Branded walkability reports for agents. Site selection insights for developers. Data-driven pedestrian analysis powered by satellite imagery."
        title="Walkability & Street Intelligence for Real Estate"
        subtitle="For Developers & Investors"
        heroDescription="Pedestrian infrastructure drives property values. Our platform quantifies street-level conditions with interactive dashboards, field audits, and community sentiment data to inform site selection, assess risk, and identify value-creation opportunities."
        challenges={[
          {
            title: 'Proximity Scores Are Not Enough',
            description: 'Traditional walkability scores measure proximity to destinations but ignore actual pedestrian conditions - crossing safety, lighting, and ADA compliance.',
          },
          {
            title: 'Hidden Development Risk',
            description: 'Poor pedestrian infrastructure can delay permits, increase community opposition, and reduce long-term asset value. Identifying risks early saves millions.',
          },
          {
            title: 'Quantifying the Pedestrian Premium',
            description: 'Research shows strong pedestrian environments add 5-30% to property values, but developers lack the granular data to quantify this premium for specific sites.',
          },
        ]}
        solutionTitle="Beyond Proximity Scores"
        solutionDescription="Our field-verified platform gives you ground-truth data that no algorithmic score can provide. Understand the actual pedestrian experience and community sentiment around your development sites."
        solutionPoints={[
          'Interactive dashboard for site comparison and portfolio monitoring',
          'Street-level pedestrian safety scoring with photo documentation',
          'Community sentiment data to anticipate neighborhood reception',
          'Pedestrian infrastructure gap analysis for due diligence',
          'Improvement opportunity identification to enhance the pedestrian environment',
          'Comparative analysis against competing sites or neighborhoods',
          'Cultural context insights for community-aligned development proposals',
          'Transit connectivity scoring for TOD projects',
        ]}
        useCases={[
          {
            title: 'Site Selection & Due Diligence',
            description: 'Compare pedestrian conditions across potential development sites with field-verified data, not just algorithmic estimates.',
          },
          {
            title: 'Pedestrian Premium Analysis',
            description: 'Quantify the pedestrian environment advantage of your site versus competitors to support pricing decisions and investor presentations.',
          },
          {
            title: 'Transit-Oriented Development',
            description: 'Assess last-mile pedestrian connectivity to transit stations to support TOD density bonuses and reduce parking requirements.',
          },
          {
            title: 'Community Engagement Support',
            description: 'Use pedestrian safety data to demonstrate your project\'s positive impact on neighborhood connectivity and street quality.',
          },
        ]}
        metrics={[
          { name: 'Sidewalk Quality', category: 'Infrastructure' },
          { name: 'Destination Density', category: 'Access' },
          { name: 'Transit Proximity', category: 'Access' },
          { name: 'Crossing Safety', category: 'Infrastructure' },
          { name: 'Shade & Weather Protection', category: 'Environment' },
          { name: 'Network Connectivity', category: 'Access' },
        ]}
        ctaTitle="Make pedestrian safety part of your investment thesis"
        ctaDescription="Contact us to discuss pedestrian infrastructure analysis for your development project."
      />
    </>
  );
}
