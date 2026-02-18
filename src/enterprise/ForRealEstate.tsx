import VerticalPage from './components/VerticalPage';

export default function ForRealEstate() {
  return (
    <VerticalPage
      metaTitle="Walkability Intelligence for Real Estate"
      metaDescription="Site selection insights, walkability premium analysis, and development risk assessment. Data-driven walkability reports for real estate developers and investors."
      title="Walkability Intelligence for Real Estate"
      subtitle="For Developers & Investors"
      heroDescription="Walkability drives property values. Our reports quantify pedestrian infrastructure quality to inform site selection, assess development risk, and identify value-creation opportunities."
      challenges={[
        {
          title: 'Walk Score Is Not Enough',
          description: 'Walk Score measures proximity to destinations but ignores actual pedestrian conditions — sidewalk quality, crossing safety, lighting, and ADA compliance.',
        },
        {
          title: 'Hidden Development Risk',
          description: 'Poor pedestrian infrastructure can delay permits, increase community opposition, and reduce long-term asset value. Identifying risks early saves millions.',
        },
        {
          title: 'Quantifying Walkability Premium',
          description: 'Research shows walkability adds 5-30% to property values, but developers lack the granular data to quantify this premium for specific sites.',
        },
      ]}
      solutionTitle="Beyond Walk Score"
      solutionDescription="Our field-verified walkability reports give you ground-truth data that no algorithmic score can provide. Understand the actual pedestrian experience around your development sites."
      solutionPoints={[
        'Street-level walkability scoring with photo documentation',
        'Pedestrian infrastructure gap analysis for due diligence',
        'Improvement opportunity identification to enhance walkability',
        'Comparative analysis against competing sites or neighborhoods',
        'Transit connectivity scoring for TOD projects',
        'Community impact data for entitlement support',
      ]}
      useCases={[
        {
          title: 'Site Selection & Due Diligence',
          description: 'Compare walkability conditions across potential development sites with field-verified data, not just algorithmic estimates.',
        },
        {
          title: 'Walkability Premium Analysis',
          description: 'Quantify the walkability advantage of your site versus competitors to support pricing decisions and investor presentations.',
        },
        {
          title: 'Transit-Oriented Development',
          description: 'Assess last-mile pedestrian connectivity to transit stations to support TOD density bonuses and reduce parking requirements.',
        },
        {
          title: 'Community Engagement Support',
          description: 'Use walkability data to demonstrate your project\'s positive impact on pedestrian safety and neighborhood connectivity.',
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
      ctaTitle="Make walkability part of your investment thesis"
      ctaDescription="Contact us to discuss walkability analysis for your development project."
    />
  );
}
