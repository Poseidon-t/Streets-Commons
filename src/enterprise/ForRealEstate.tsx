import VerticalPage from './components/VerticalPage';

export default function ForRealEstate() {
  return (
    <VerticalPage
      metaTitle="Pedestrian Infrastructure Intelligence for Real Estate"
      metaDescription="Site selection insights, pedestrian environment analysis, and development risk assessment. Data-driven reports for real estate developers and investors."
      title="Pedestrian Infrastructure Intelligence for Real Estate"
      subtitle="For Developers & Investors"
      heroDescription="Pedestrian infrastructure drives property values. Our reports quantify street-level conditions to inform site selection, assess development risk, and identify value-creation opportunities."
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
          title: 'Quantifying the Pedestrian Premium',
          description: 'Research shows strong pedestrian environments add 5-30% to property values, but developers lack the granular data to quantify this premium for specific sites.',
        },
      ]}
      solutionTitle="Beyond Walk Score"
      solutionDescription="Our field-verified reports give you ground-truth data that no algorithmic score can provide. Understand the actual pedestrian experience around your development sites."
      solutionPoints={[
        'Street-level pedestrian safety scoring with photo documentation',
        'Pedestrian infrastructure gap analysis for due diligence',
        'Improvement opportunity identification to enhance the pedestrian environment',
        'Comparative analysis against competing sites or neighborhoods',
        'Transit connectivity scoring for TOD projects',
        'Community impact data for entitlement support',
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
