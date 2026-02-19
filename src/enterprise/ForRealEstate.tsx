import VerticalPage from './components/VerticalPage';

export default function ForRealEstate() {
  return (
    <VerticalPage
      metaTitle="Walkability & Street Intelligence for Real Estate"
      metaDescription="Site selection insights, pedestrian environment analysis, and development risk assessment. Data-driven walkability reports for real estate developers and investors."
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
  );
}
