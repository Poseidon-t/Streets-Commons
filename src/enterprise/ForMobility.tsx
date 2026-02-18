import VerticalPage from './components/VerticalPage';

export default function ForMobility() {
  return (
    <VerticalPage
      metaTitle="Walkability Intelligence for Mobility"
      metaDescription="Transit integration analysis, micromobility planning, and last-mile connectivity mapping. Walkability reports for mobility companies and transit agencies."
      title="Walkability Intelligence for Mobility"
      subtitle="For Transit & Mobility Companies"
      heroDescription="Every trip begins and ends with walking. Our reports map the pedestrian environment around transit stops, micromobility hubs, and mobility corridors to improve first/last-mile connectivity."
      challenges={[
        {
          title: 'First/Last Mile Gap',
          description: 'Poor pedestrian infrastructure around transit stops suppresses ridership. Most agencies lack detailed data on the walking conditions their riders face.',
        },
        {
          title: 'Micromobility Siting Blindspots',
          description: 'Scooter and bikeshare stations placed without understanding pedestrian flow patterns lead to underutilization and sidewalk conflicts.',
        },
        {
          title: 'Safety Liability',
          description: 'Transit agencies and mobility providers face increasing scrutiny over pedestrian safety near their facilities. Data-driven planning reduces risk.',
        },
      ]}
      solutionTitle="Complete First/Last Mile Intelligence"
      solutionDescription="Map the pedestrian environment around transit stops, mobility hubs, and key corridors to understand how people actually walk to and from your service."
      solutionPoints={[
        'Pedestrian access analysis around transit stops and stations',
        'Walking route quality assessment for key corridors',
        'Sidewalk capacity and conflict zone identification',
        'ADA accessibility audit of transit-adjacent infrastructure',
        'Lighting and safety conditions for evening commuters',
        'Recommendations for pedestrian improvements that boost ridership',
      ]}
      useCases={[
        {
          title: 'Transit Access Improvement',
          description: 'Identify and prioritize pedestrian infrastructure improvements around transit stops that will have the greatest impact on ridership.',
        },
        {
          title: 'Micromobility Network Planning',
          description: 'Site scooter and bikeshare stations based on actual pedestrian flow patterns and infrastructure quality, not just demand projections.',
        },
        {
          title: 'Mobility Hub Design',
          description: 'Design multimodal transfer points with full understanding of the pedestrian environment, ensuring safe and comfortable connections.',
        },
        {
          title: 'Grant Applications & Funding',
          description: 'Support FTA and state grant applications with rigorous pedestrian data that demonstrates the need for first/last-mile improvements.',
        },
      ]}
      metrics={[
        { name: 'Transit Proximity', category: 'Access' },
        { name: 'Network Connectivity', category: 'Access' },
        { name: 'Sidewalk Quality', category: 'Infrastructure' },
        { name: 'Crossing Safety', category: 'Infrastructure' },
        { name: 'Lighting & Visibility', category: 'Environment' },
        { name: 'Traffic Volume', category: 'Safety' },
      ]}
      ctaTitle="Improve first/last mile for your riders"
      ctaDescription="Contact us to map the pedestrian experience around your transit network."
    />
  );
}
