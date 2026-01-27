/**
 * Sidewalk Image Analysis Service
 * Analyzes Mapillary street-level images to detect sidewalk presence and quality
 * Uses self-hosted Hugging Face SegFormer model for unlimited CV analysis
 */

import { MapillaryImage } from './mapillary';

// Self-hosted CV API endpoint
const CV_API_URL = import.meta.env.VITE_CV_API_URL || 'http://localhost:8000';

export interface SidewalkAnalysisResult {
  imageId: string;
  sidewalkDetected: boolean;
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  quality: 'good' | 'fair' | 'poor' | 'none';
  notes: string;
}

export interface AggregatedSidewalkAnalysis {
  totalImages: number;
  imagesAnalyzed: number;
  sidewalkPresenceRate: number; // 0-100%
  averageQuality: 'good' | 'fair' | 'poor' | 'none';
  commonIssues: string[];
  confidence: 'high' | 'medium' | 'low';
  discrepancyWithOSM: boolean;
  osmSidewalkCoverage: number; // OSM reported percentage
}

/**
 * Analyze a single Mapillary image for sidewalk presence and quality
 * Uses self-hosted CV API with Hugging Face SegFormer
 */
export async function analyzeSidewalkFromImage(
  image: MapillaryImage
): Promise<SidewalkAnalysisResult> {
  try {
    // Use thumb1024Url for analysis (good balance of quality and speed)
    const imageUrl = image.thumb1024Url || image.thumb256Url;

    if (!imageUrl) {
      return {
        imageId: image.id,
        sidewalkDetected: false,
        confidence: 'low',
        issues: ['Image URL not available'],
        quality: 'none',
        notes: 'Cannot analyze - image URL missing'
      };
    }

    // Try self-hosted CV API (unlimited, free)
    const selfHostedResult = await trySelfHostedAnalysis(imageUrl, image.id);
    if (selfHostedResult) {
      return selfHostedResult;
    }

    // Fallback: Roboflow (if configured, limited to 1000/month)
    const roboflowResult = await tryRoboflowAnalysis(imageUrl, image.id);
    if (roboflowResult) {
      return roboflowResult;
    }

    // Final fallback: Manual inspection mode
    return {
      imageId: image.id,
      sidewalkDetected: false,
      confidence: 'medium',
      issues: ['CV analysis unavailable'],
      quality: 'none',
      notes: `Street-level photo available for visual verification. View at Mapillary to manually verify sidewalk condition.`
    };

  } catch (error) {
    console.error('Failed to analyze image:', error);
    return {
      imageId: image.id,
      sidewalkDetected: false,
      confidence: 'low',
      issues: ['Analysis error'],
      quality: 'none',
      notes: 'Error during automated analysis'
    };
  }
}

/**
 * Try self-hosted CV API (primary method - unlimited)
 */
async function trySelfHostedAnalysis(
  imageUrl: string,
  imageId: string
): Promise<SidewalkAnalysisResult | null> {
  try {
    // Check if CV API is configured
    if (!CV_API_URL) {
      console.log('CV API URL not configured - skipping self-hosted analysis');
      return null;
    }

    // Call self-hosted API
    const response = await fetch(`${CV_API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        image_id: imageId
      })
    });

    if (!response.ok) {
      console.warn(`Self-hosted CV API error ${response.status} - falling back`);
      return null;
    }

    const data = await response.json();

    // API returns data in our expected format
    return {
      imageId: data.imageId,
      sidewalkDetected: data.sidewalkDetected,
      confidence: data.confidence as 'high' | 'medium' | 'low',
      issues: data.issues || [],
      quality: data.quality as 'good' | 'fair' | 'poor' | 'none',
      notes: data.notes
    };

  } catch (error) {
    console.error('Self-hosted CV analysis failed:', error);
    return null; // Fall back to Roboflow or manual mode
  }
}

/**
 * Try Roboflow CV API for sidewalk detection (fallback, limited to 1000/month)
 */
async function tryRoboflowAnalysis(
  imageUrl: string,
  imageId: string
): Promise<SidewalkAnalysisResult | null> {
  try {
    const ROBOFLOW_API_KEY = import.meta.env.VITE_ROBOFLOW_API_KEY;

    if (!ROBOFLOW_API_KEY) {
      console.log('Roboflow API key not configured - skipping CV analysis');
      return null;
    }

    // Use generic segmentation model that detects roads, sidewalks, vehicles
    const ROBOFLOW_MODEL = 'sidewalk-detection-x8wlj/2'; // Public sidewalk model

    const response = await fetch(
      `https://detect.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_API_KEY}&image=${encodeURIComponent(imageUrl)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      console.warn(`Roboflow API error ${response.status} - falling back`);
      return null;
    }

    const data = await response.json();
    const predictions = data.predictions || [];

    // Look for sidewalk-related detections
    const sidewalkDetections = predictions.filter((p: any) =>
      p.class?.toLowerCase().includes('sidewalk') ||
      p.class?.toLowerCase().includes('pavement') ||
      p.class?.toLowerCase().includes('footpath')
    );

    // Look for obstructions
    const obstructionDetections = predictions.filter((p: any) =>
      p.class?.toLowerCase().includes('vehicle') ||
      p.class?.toLowerCase().includes('parked') ||
      p.class?.toLowerCase().includes('obstacle')
    );

    const sidewalkDetected = sidewalkDetections.length > 0;
    const hasObstructions = obstructionDetections.length > 0;

    // Calculate confidence
    const avgConfidence = sidewalkDetections.length > 0
      ? sidewalkDetections.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) / sidewalkDetections.length
      : 0;

    const confidenceLevel = avgConfidence > 0.7 ? 'high' : avgConfidence > 0.4 ? 'medium' : 'low';

    // Assess quality
    let quality: 'good' | 'fair' | 'poor' | 'none' = 'none';
    const issues: string[] = [];

    if (sidewalkDetected) {
      if (hasObstructions) {
        quality = 'poor';
        issues.push(`${obstructionDetections.length} obstruction(s) blocking sidewalk`);
      } else if (avgConfidence > 0.7) {
        quality = 'good';
      } else {
        quality = 'fair';
        issues.push('Sidewalk partially visible or unclear');
      }
    } else {
      issues.push('No sidewalk visible in image');
    }

    return {
      imageId,
      sidewalkDetected,
      confidence: confidenceLevel,
      issues,
      quality,
      notes: `AI detected: ${sidewalkDetected ? 'sidewalk present' : 'no sidewalk'}, ${obstructionDetections.length} obstructions`
    };

  } catch (error) {
    console.error('Roboflow analysis failed:', error);
    return null; // Fall back to manual inspection mode
  }
}

/**
 * Analyze multiple Mapillary images and aggregate results
 * Compare with OSM data to detect discrepancies
 */
export async function analyzeAreaSidewalks(
  images: MapillaryImage[],
  osmSidewalkCoverage: number // percentage from OSM data
): Promise<AggregatedSidewalkAnalysis> {
  if (images.length === 0) {
    return {
      totalImages: 0,
      imagesAnalyzed: 0,
      sidewalkPresenceRate: 0,
      averageQuality: 'none',
      commonIssues: ['No street-level imagery available in this area'],
      confidence: 'low',
      discrepancyWithOSM: false,
      osmSidewalkCoverage
    };
  }

  // Analyze each image (for now, just counts available images)
  const analysisResults = await Promise.all(
    images.slice(0, 10).map(img => analyzeSidewalkFromImage(img)) // Limit to 10 for performance
  );

  // Count images with detected sidewalks
  const sidewalksDetected = analysisResults.filter(r => r.sidewalkDetected).length;
  const sidewalkPresenceRate = (sidewalksDetected / analysisResults.length) * 100;

  // Check for major discrepancy with OSM data
  // If OSM says 80%+ coverage but imagery shows <50%, flag it
  const discrepancyWithOSM =
    (osmSidewalkCoverage >= 80 && sidewalkPresenceRate < 50) ||
    (osmSidewalkCoverage < 30 && sidewalkPresenceRate > 70);

  // Collect all issues
  const allIssues = analysisResults.flatMap(r => r.issues);
  const issueCount: Record<string, number> = {};
  allIssues.forEach(issue => {
    issueCount[issue] = (issueCount[issue] || 0) + 1;
  });
  const commonIssues = Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);

  return {
    totalImages: images.length,
    imagesAnalyzed: analysisResults.length,
    sidewalkPresenceRate,
    averageQuality: determineAverageQuality(analysisResults),
    commonIssues,
    confidence: images.length >= 5 ? 'medium' : 'low',
    discrepancyWithOSM,
    osmSidewalkCoverage
  };
}

/**
 * Determine average quality from analysis results
 */
function determineAverageQuality(
  results: SidewalkAnalysisResult[]
): 'good' | 'fair' | 'poor' | 'none' {
  const qualityCounts = {
    good: results.filter(r => r.quality === 'good').length,
    fair: results.filter(r => r.quality === 'fair').length,
    poor: results.filter(r => r.quality === 'poor').length,
    none: results.filter(r => r.quality === 'none').length
  };

  // Return most common quality
  const maxCount = Math.max(...Object.values(qualityCounts));
  const dominantQuality = Object.entries(qualityCounts)
    .find(([, count]) => count === maxCount)?.[0] as 'good' | 'fair' | 'poor' | 'none';

  return dominantQuality || 'none';
}

/**
 * Generate user-friendly message about sidewalk validation
 */
export function generateValidationMessage(
  analysis: AggregatedSidewalkAnalysis
): string {
  if (analysis.totalImages === 0) {
    return 'No street-level imagery available for visual validation. Analysis based on OpenStreetMap data only.';
  }

  if (analysis.confidence === 'low') {
    return `${analysis.totalImages} street-level images available for manual inspection. Automated validation requires computer vision integration.`;
  }

  if (analysis.discrepancyWithOSM) {
    return `⚠️ Discrepancy detected: OSM reports ${analysis.osmSidewalkCoverage}% sidewalk coverage, but street imagery suggests ${Math.round(analysis.sidewalkPresenceRate)}%. Visual inspection recommended.`;
  }

  return `${analysis.imagesAnalyzed} street-level images analyzed. Sidewalk presence: ${Math.round(analysis.sidewalkPresenceRate)}%.`;
}

/**
 * Check if we should downgrade data quality confidence based on image analysis
 */
export function shouldDowngradeConfidence(
  analysis: AggregatedSidewalkAnalysis
): boolean {
  // Downgrade if there's a major discrepancy with OSM
  if (analysis.discrepancyWithOSM) {
    return true;
  }

  // Downgrade if common issues are detected
  const criticalIssues = analysis.commonIssues.filter(issue =>
    issue.includes('obstruction') ||
    issue.includes('broken') ||
    issue.includes('narrow')
  );

  return criticalIssues.length > 0;
}
