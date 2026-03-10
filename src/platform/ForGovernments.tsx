import VerticalPage from './components/VerticalPage';

export default function ForGovernments() {
  return (
    <VerticalPage
      metaTitle="Walkability & Street Intelligence for Governments"
      metaDescription="Vision Zero planning and infrastructure investment prioritization. Data-driven walkability and street safety analysis for municipal governments."
      title="Walkability & Street Intelligence for Governments"
      subtitle="For Municipal & Regional Governments"
      heroDescription="Make evidence-based infrastructure decisions with comprehensive pedestrian safety data. Our platform gives you dashboards powered by satellite imagery, OpenStreetMap, and government data to prioritize investments and serve your community."
      challenges={[
        {
          title: 'Fragmented Pedestrian Data',
          description: 'Cities lack a unified view of walkability conditions — street connectivity, tree cover, transit access, and safety data live in separate systems with no composite picture.',
        },
        {
          title: 'Vision Zero Without Data',
          description: 'Pedestrian safety plans need granular street-level data to identify high-risk corridors, but traditional methods are slow and incomplete.',
        },
        {
          title: 'Infrastructure Prioritization',
          description: 'Limited budgets require evidence-based prioritization. Without pedestrian infrastructure data, investments may not target the areas of greatest need or impact.',
        },
      ]}
      solutionTitle="Evidence-Based Planning"
      solutionDescription="Our platform combines satellite imagery, OpenStreetMap, and government data (Census, CDC, EPA, FEMA) to give planning departments a composite view of pedestrian conditions across your jurisdiction."
      solutionPoints={[
        'Interactive dashboard for ongoing walkability monitoring and progress tracking',
        'Composite walkability scoring across 4 components (Network, Comfort, Safety, Density)',
        'Street network connectivity and intersection density analysis',
        'Tree canopy and environmental comfort mapping from satellite data',
        'Neighborhood health outcomes and demographic context (US, via CDC/Census)',
        'GIS-ready data layers for integration with municipal systems',
        'Downloadable reports and executive summaries for council presentations',
      ]}
      useCases={[
        {
          title: 'Pedestrian Infrastructure Assessment',
          description: 'Comprehensive walkability scoring across your jurisdiction to identify corridors with the weakest pedestrian infrastructure and greatest need.',
        },
        {
          title: 'Vision Zero Action Plans',
          description: 'Identify high-risk pedestrian corridors using street network, safety, and environmental data to inform Vision Zero capital improvement programs.',
        },
        {
          title: 'Capital Improvement Prioritization',
          description: 'Data-driven ranking of sidewalk, crossing, and lighting improvements to maximize safety impact per dollar invested.',
        },
        {
          title: 'Complete Streets Implementation',
          description: 'Baseline pedestrian infrastructure assessment to measure the effectiveness of Complete Streets policies and track improvement over time.',
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
      ctaTitle="Ready to build your pedestrian safety baseline?"
      ctaDescription="Contact our team to scope a pedestrian infrastructure assessment for your municipality."
    />
  );
}
