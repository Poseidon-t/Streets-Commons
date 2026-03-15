import { Link } from 'react-router-dom';
import VerticalPage from './components/VerticalPage';

export default function ForRealEstate() {
  return (
    <>
      {/* Agent-focused hero section  -  direct link to the tool */}
      <section className="border-b" style={{ borderColor: '#e0dbd0', backgroundColor: '#faf8f4' }}>
        <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
          <div className="grid sm:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#1e3a5f' }}>
                For Real Estate Agents
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#1a2a1a' }}>
                Branded Walkability Reports for Your Listings
              </h2>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6b7280' }}>
                Give your buyers the walkability data they need  -  and put your name on it. Metrics from satellite imagery and OpenStreetMap, formatted as a print-ready PDF with your branding.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/?agent=true"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:opacity-90"
                  style={{ backgroundColor: '#1e3a5f' }}
                >
                  Try SafeStreets Free
                </Link>
              </div>
            </div>

            {/* Feature list */}
            <div className="space-y-3">
              {[
                { icon: '📊', title: 'Your Branding on Every Page', desc: 'Name, title, company, phone, and email' },
                { icon: '🏠', title: 'Full Walkability Analysis', desc: 'Scored metrics, 15-min city analysis & neighborhood intelligence' },
                { icon: '🖨️', title: 'Print-Ready PDF', desc: '3-page report optimized for print and email' },
                { icon: '🌍', title: 'Any Address Worldwide', desc: 'Works for US listings and international properties' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: '#e0dbd0', backgroundColor: 'white' }}>
                  <span className="text-lg flex-shrink-0">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: '#1a2a1a' }}>{f.title}</div>
                    <div className="text-xs" style={{ color: '#8a9a8a' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Existing platform-focused content for developers/investors */}
      <VerticalPage
        metaTitle="Walkability & Street Intelligence for Real Estate"
        metaDescription="Branded walkability reports for agents. Site selection insights for developers. Data-driven pedestrian analysis powered by satellite imagery."
        title="Walkability & Street Intelligence for Real Estate"
        subtitle="For Developers & Investors"
        heroDescription="Pedestrian infrastructure drives property values. Our platform quantifies street-level conditions with interactive dashboards and data-driven scoring to inform site selection, assess risk, and identify value-creation opportunities."
        challenges={[
          {
            title: 'Proximity Scores Are Not Enough',
            description: 'Traditional walkability scores measure proximity to destinations but ignore actual pedestrian conditions  -  street network quality, tree canopy, and environmental comfort.',
          },
          {
            title: 'Hidden Development Risk',
            description: 'Poor pedestrian infrastructure can delay permits, increase community opposition, and reduce long-term asset value. Identifying risks early saves millions.',
          },
          {
            title: 'Quantifying the Pedestrian Premium',
            description: 'Strong pedestrian environments correlate with higher property values, but developers lack the granular data to quantify walkability conditions for specific sites.',
          },
        ]}
        solutionTitle="Beyond Proximity Scores"
        solutionDescription="Our platform uses satellite imagery, OpenStreetMap, and government data to give you a multi-dimensional view of pedestrian conditions  -  not just proximity scores."
        solutionPoints={[
          'Interactive dashboard for site comparison and portfolio monitoring',
          'Composite walkability scoring across 4 components (Network, Comfort, Safety, Density)',
          'Tree canopy and environmental comfort analysis from Sentinel-2 satellite data',
          'Pedestrian infrastructure gap analysis for due diligence',
          'Comparative analysis against competing sites or neighborhoods',
          'Neighborhood intelligence: demographics, health outcomes, flood risk (US)',
          'Transit connectivity and 15-minute city access scoring',
        ]}
        useCases={[
          {
            title: 'Site Selection & Due Diligence',
            description: 'Compare pedestrian conditions across potential development sites with satellite and infrastructure data, beyond simple proximity scores.',
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
          { name: 'Network Design', category: 'Infrastructure' },
          { name: 'Environmental Comfort', category: 'Environment' },
          { name: 'Safety', category: 'Infrastructure' },
          { name: 'Density Context', category: 'Access' },
          { name: 'Tree Canopy (NDVI)', category: 'Environment' },
          { name: 'Transit Access', category: 'Access' },
        ]}
        ctaTitle="Make pedestrian safety part of your investment thesis"
        ctaDescription="Contact us to discuss pedestrian infrastructure analysis for your development project."
      />
    </>
  );
}
