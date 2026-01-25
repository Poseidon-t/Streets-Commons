/**
 * PDF Report Generator for SafeStreets
 * Creates professional policy reports for advocacy and presentations
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Location, WalkabilityMetrics, DataQuality } from '../types';

interface ReportData {
  location: Location;
  metrics: WalkabilityMetrics;
  dataQuality: DataQuality;
  mapElement?: HTMLElement;
}

/**
 * Generate a professional PDF report
 */
export async function generatePDFReport(data: ReportData): Promise<void> {
  const { location, metrics, dataQuality } = data;

  // Create PDF (A4 size)
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  let yPosition = margin;

  // Helper function to add text

  // Helper function to check if we need a new page
  const checkNewPage = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // ===== COVER PAGE =====

  // Title
  pdf.setFillColor(240, 86, 33); // Orange
  pdf.rect(0, 0, pageWidth, 60, 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont('helvetica', 'bold');
  pdf.text('SafeStreets', margin, 35);

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Walkability Analysis Report', margin, 48);

  // Location info
  yPosition = 80;
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text(location.displayName, margin, yPosition);
  yPosition += 15;

  // Overall score - Big and prominent
  pdf.setFillColor(245, 245, 245);
  pdf.roundedRect(margin, yPosition, contentWidth, 50, 5, 5, 'F');

  // Score color based on value
  const scoreColor = metrics.overallScore >= 8 ? [34, 197, 94] : // Green
                     metrics.overallScore >= 6 ? [234, 179, 8] :  // Yellow
                     metrics.overallScore >= 4 ? [249, 115, 22] : // Orange
                     [239, 68, 68]; // Red

  pdf.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  pdf.setFontSize(48);
  pdf.setFont('helvetica', 'bold');
  pdf.text(metrics.overallScore.toFixed(1), margin + 10, yPosition + 35);

  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(14);
  pdf.text(`/10 - ${metrics.label}`, margin + 45, yPosition + 35);

  yPosition += 70;

  // Date
  pdf.setTextColor(100, 100, 100);
  pdf.setFontSize(10);
  const reportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  pdf.text(`Generated: ${reportDate}`, margin, yPosition);
  yPosition += 10;

  // ===== MAP (if available) =====
  if (data.mapElement) {
    checkNewPage(120);
    try {
      const canvas = await html2canvas(data.mapElement, {
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Analysis Area (800m radius)', margin, yPosition);
      yPosition += 10;

      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 100));
      yPosition += Math.min(imgHeight, 100) + 10;
    } catch (error) {
      console.error('Failed to capture map:', error);
    }
  }

  // ===== NEW PAGE: DETAILED METRICS =====
  pdf.addPage();
  yPosition = margin;

  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Detailed Metrics Breakdown', margin, yPosition);
  yPosition += 15;

  // Metrics array
  const metricsData = [
    { name: 'Crossing Density', score: metrics.crossingDensity, icon: '🚶',
      desc: 'Marked pedestrian crossings per km + distribution' },
    { name: 'Sidewalk Coverage', score: metrics.sidewalkCoverage, icon: '🚶‍♀️',
      desc: '% of streets with sidewalk infrastructure' },
    { name: 'Network Efficiency', score: metrics.networkEfficiency, icon: '🗺️',
      desc: 'Street grid connectivity (more intersections = better)' },
    { name: 'Destination Access', score: metrics.destinationAccess, icon: '🏪',
      desc: 'Variety of daily destinations within 800m' },
    { name: 'Slope', score: metrics.slope, icon: '⛰️',
      desc: 'Terrain gradient (wheelchair accessibility)' },
    { name: 'Tree Canopy', score: metrics.treeCanopy, icon: '🌳',
      desc: 'Vegetation coverage (shade, cooling, air quality)' },
    { name: 'Surface Temperature', score: metrics.surfaceTemp, icon: '🌡️',
      desc: 'Ground/pavement heat (urban heat island)' },
  ];

  // Render each metric
  metricsData.forEach((metric) => {
    checkNewPage(35);

    // Metric box
    const boxHeight = 30;
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(margin, yPosition, contentWidth, boxHeight, 3, 3, 'F');

    // Score bar
    const barWidth = (metric.score / 10) * 60;
    const barColor = metric.score >= 8 ? [34, 197, 94] :
                     metric.score >= 6 ? [234, 179, 8] :
                     metric.score >= 4 ? [249, 115, 22] :
                     [239, 68, 68];
    pdf.setFillColor(barColor[0], barColor[1], barColor[2]);
    pdf.roundedRect(contentWidth - 60 + margin, yPosition + 8, barWidth, 14, 2, 2, 'F');

    // Metric name and score
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${metric.icon} ${metric.name}`, margin + 5, yPosition + 12);

    pdf.setFontSize(14);
    pdf.setTextColor(barColor[0], barColor[1], barColor[2]);
    pdf.text(metric.score.toFixed(1), contentWidth - 70 + margin, yPosition + 18);

    // Description
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    pdf.text(metric.desc, margin + 5, yPosition + 24, { maxWidth: contentWidth - 70 });

    yPosition += boxHeight + 5;
  });

  // ===== DATA QUALITY =====
  yPosition += 10;
  checkNewPage(50);

  pdf.setFontSize(16);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Data Quality & Sources', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  const qualityText = [
    `Crossings: ${dataQuality.crossingCount} marked pedestrian crossings`,
    `Streets: ${dataQuality.streetCount} street segments analyzed`,
    `Sidewalks: ${dataQuality.sidewalkCount} with sidewalk data`,
    `POIs: ${dataQuality.poiCount} destinations (schools, shops, parks, etc.)`,
    `Confidence: ${dataQuality.confidence.toUpperCase()}`,
  ];

  qualityText.forEach(text => {
    pdf.text(`• ${text}`, margin + 5, yPosition);
    yPosition += 6;
  });

  // ===== NEW PAGE: METHODOLOGY =====
  pdf.addPage();
  yPosition = margin;

  pdf.setFontSize(20);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Methodology & Data Sources', margin, yPosition);
  yPosition += 15;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  const methodology = [
    {
      title: 'OpenStreetMap (OSM) Data',
      content: 'Crossing density, sidewalk coverage, network efficiency, and destination access are calculated from OpenStreetMap data via Overpass API. 800m analysis radius.'
    },
    {
      title: 'SRTM Elevation Data',
      content: 'Slope calculated from 30m resolution elevation data (9-point grid) via Open-Elevation API. Scores based on wheelchair accessibility standards (≤5% gradient).'
    },
    {
      title: 'Sentinel-2/Landsat 8 NDVI',
      content: 'Tree canopy measured using Normalized Difference Vegetation Index from satellite imagery. NDVI ≥0.6 indicates dense tree coverage.'
    },
    {
      title: 'Landsat 8/9 Thermal Data',
      content: 'Surface temperature from thermal infrared bands via Google Earth Engine. Measures ground/pavement heat, not air temperature. 90-day rolling window.'
    },
  ];

  methodology.forEach(section => {
    checkNewPage(25);
    pdf.setFont('helvetica', 'bold');
    pdf.text(section.title, margin, yPosition);
    yPosition += 5;
    pdf.setFont('helvetica', 'normal');
    const lines = pdf.splitTextToSize(section.content, contentWidth);
    pdf.text(lines, margin + 5, yPosition);
    yPosition += lines.length * 5 + 5;
  });

  // ===== RECOMMENDATIONS =====
  yPosition += 10;
  checkNewPage(60);

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(0, 0, 0);
  pdf.text('Recommendations', margin, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60, 60, 60);

  // Generate recommendations based on scores
  const recommendations: string[] = [];

  if (metrics.crossingDensity < 5) {
    recommendations.push('Add more marked pedestrian crossings, especially at major intersections');
  }
  if (metrics.sidewalkCoverage < 5) {
    recommendations.push('Improve sidewalk infrastructure and documentation');
  }
  if (metrics.networkEfficiency < 5) {
    recommendations.push('Increase street connectivity to reduce walking distances');
  }
  if (metrics.destinationAccess < 5) {
    recommendations.push('Encourage mixed-use development with essential services within walking distance');
  }
  if (metrics.slope < 5) {
    recommendations.push('Improve accessibility with ramps and gradual slopes (≤5% gradient)');
  }
  if (metrics.treeCanopy < 5) {
    recommendations.push('Plant more street trees for shade, cooling, and air quality');
  }
  if (metrics.surfaceTemp < 5) {
    recommendations.push('Reduce urban heat island effect with trees, shade structures, and cool pavement');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current excellent walkability standards');
    recommendations.push('Continue monitoring and improving pedestrian infrastructure');
  }

  recommendations.forEach((rec, index) => {
    checkNewPage(10);
    pdf.text(`${index + 1}. ${rec}`, margin + 5, yPosition, { maxWidth: contentWidth - 10 });
    yPosition += 8;
  });

  // ===== FOOTER =====
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  const footerText = 'Generated by SafeStreets • Honest Analysis • No Fake Metrics • safestreets.app';
  pdf.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });

  // Download PDF
  const filename = `SafeStreets-Report-${location.city || location.displayName.split(',')[0]}-${Date.now()}.pdf`;
  pdf.save(filename);
}
