import VerticalPage from './components/VerticalPage';

export default function ForResearch() {
  return (
    <VerticalPage
      metaTitle="Walkability Intelligence for Research"
      metaDescription="Peer-reviewed methodology, comprehensive datasets, and academic partnership opportunities. Walkability data for researchers and academic institutions."
      title="Walkability Intelligence for Research"
      subtitle="For Researchers & Academic Institutions"
      heroDescription="Access comprehensive, field-verified walkability data built on transparent methodology. Our standardized assessment framework provides the reliable data your research requires."
      challenges={[
        {
          title: 'Inconsistent Measurement',
          description: 'Walkability research suffers from inconsistent measurement approaches. Different studies use different metrics, making comparison and meta-analysis difficult.',
        },
        {
          title: 'Limited Ground-Truth Data',
          description: 'Most walkability research relies on GIS-derived measures or surveys. Field-verified, block-by-block pedestrian environment data is rare and expensive to collect independently.',
        },
        {
          title: 'Interdisciplinary Gaps',
          description: 'Public health, urban planning, transportation, and environmental science each study walkability differently. Integrated datasets that serve all disciplines are scarce.',
        },
      ]}
      solutionTitle="Research-Grade Walkability Data"
      solutionDescription="Our standardized, field-verified assessment methodology produces datasets suitable for peer-reviewed research, with full documentation of collection protocols and scoring criteria."
      solutionPoints={[
        'Standardized 12-metric assessment framework',
        'Full methodology documentation with inter-rater reliability data',
        'Raw measurement data in open formats (CSV, GeoJSON, Shapefile)',
        'GPS-tagged photograph database for qualitative analysis',
        'Scoring algorithms published for replication',
        'Academic licensing and collaboration opportunities',
      ]}
      useCases={[
        {
          title: 'Health & Walkability Studies',
          description: 'Correlate granular pedestrian environment data with health outcomes, physical activity levels, and population demographics.',
        },
        {
          title: 'Urban Planning Research',
          description: 'Study the relationship between built environment characteristics and pedestrian behavior with field-verified infrastructure data.',
        },
        {
          title: 'Transportation Equity Analysis',
          description: 'Compare walkability conditions across neighborhoods to study infrastructure investment equity and environmental justice.',
        },
        {
          title: 'Climate & Sustainability Research',
          description: 'Assess how walkability infrastructure supports car-free mobility and contributes to urban sustainability goals.',
        },
      ]}
      metrics={[
        { name: 'Sidewalk Quality', category: 'Infrastructure' },
        { name: 'ADA Compliance', category: 'Infrastructure' },
        { name: 'Destination Density', category: 'Access' },
        { name: 'Noise & Pollution', category: 'Environment' },
        { name: 'Crash History', category: 'Safety' },
        { name: 'Speed Environment', category: 'Safety' },
      ]}
      ctaTitle="Partner with us on walkability research"
      ctaDescription="Contact our team to discuss academic partnerships, data licensing, and collaborative research opportunities."
    />
  );
}
