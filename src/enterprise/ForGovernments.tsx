import VerticalPage from './components/VerticalPage';

export default function ForGovernments() {
  return (
    <VerticalPage
      metaTitle="Pedestrian Safety Intelligence for Governments"
      metaDescription="ADA compliance audits, Vision Zero planning, and infrastructure investment prioritization. Data-driven pedestrian safety reports for municipal governments."
      title="Pedestrian Safety Intelligence for Governments"
      subtitle="For Municipal & Regional Governments"
      heroDescription="Make evidence-based infrastructure decisions with comprehensive pedestrian safety data. From ADA compliance to Vision Zero planning, our platform gives you the dashboard, field data, and citizen voices to prioritize investments and serve your community."
      challenges={[
        {
          title: 'ADA Compliance Gaps',
          description: 'Federal requirements demand accessible pedestrian infrastructure, but most cities lack a comprehensive inventory of current conditions and compliance gaps.',
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
      solutionDescription="Our pedestrian safety intelligence platform provides the granular, field-verified data and community insights your planning department needs to make defensible investment decisions and meet federal compliance requirements."
      solutionPoints={[
        'Interactive dashboard for ongoing infrastructure monitoring and progress tracking',
        'Block-by-block ADA compliance inventory with photo documentation',
        'Citizen voice collection for community-informed priority setting',
        'Crossing safety scoring at every intersection in the study area',
        'Prioritized improvement lists ranked by impact and cost-effectiveness',
        'GIS-ready data layers for integration with municipal systems',
        'Multilingual community engagement for equitable outreach (Complete tier)',
        'Downloadable reports and executive summaries for council presentations',
      ]}
      useCases={[
        {
          title: 'ADA Transition Plans',
          description: 'Comprehensive curb ramp and accessible path-of-travel inventories that satisfy federal ADA transition plan requirements.',
        },
        {
          title: 'Vision Zero Action Plans',
          description: 'Identify high-risk pedestrian corridors with field-verified safety data to inform Vision Zero capital improvement programs.',
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
        { name: 'ADA Compliance', category: 'Infrastructure' },
        { name: 'Sidewalk Quality', category: 'Infrastructure' },
        { name: 'Crossing Safety', category: 'Infrastructure' },
        { name: 'Lighting & Visibility', category: 'Environment' },
        { name: 'Crash History', category: 'Safety' },
        { name: 'Network Connectivity', category: 'Access' },
      ]}
      ctaTitle="Ready to build your pedestrian safety baseline?"
      ctaDescription="Contact our team to scope a pedestrian infrastructure assessment for your municipality."
    />
  );
}
