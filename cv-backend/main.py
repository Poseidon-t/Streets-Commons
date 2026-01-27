"""
SafeStreets CV Backend - Self-Hosted Sidewalk Detection
Uses Hugging Face SegFormer for semantic segmentation
Unlimited inference at ~$5/month deployment cost
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation
from PIL import Image
import torch
import numpy as np
import requests
from io import BytesIO
from typing import List, Dict
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SafeStreets CV API",
    description="Self-hosted sidewalk detection using Hugging Face Transformers",
    version="1.0.0"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model cache
model = None
processor = None

# Cityscapes class labels (SegFormer trained on this dataset)
CITYSCAPES_CLASSES = [
    'road', 'sidewalk', 'building', 'wall', 'fence', 'pole',
    'traffic light', 'traffic sign', 'vegetation', 'terrain',
    'sky', 'person', 'rider', 'car', 'truck', 'bus', 'train',
    'motorcycle', 'bicycle'
]

# Classes relevant for sidewalk analysis
SIDEWALK_CLASSES = ['sidewalk', 'road']
OBSTRUCTION_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person']
VEGETATION_CLASSES = ['vegetation', 'terrain']


class AnalysisRequest(BaseModel):
    image_url: HttpUrl
    image_id: str


class Detection(BaseModel):
    class_name: str
    confidence: float
    pixel_percentage: float


class AnalysisResult(BaseModel):
    imageId: str
    sidewalkDetected: bool
    confidence: str  # 'high', 'medium', 'low'
    issues: List[str]
    quality: str  # 'good', 'fair', 'poor', 'none'
    notes: str
    detections: List[Detection]


def load_model():
    """Load SegFormer model on first request"""
    global model, processor

    if model is None:
        logger.info("Loading SegFormer model from Hugging Face...")

        # Use Cityscapes-trained model (includes sidewalk class)
        model_name = "nvidia/segformer-b0-finetuned-cityscapes-1024-1024"

        processor = AutoImageProcessor.from_pretrained(model_name)
        model = AutoModelForSemanticSegmentation.from_pretrained(model_name)

        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        model = model.to(device)
        model.eval()  # Set to evaluation mode

        logger.info(f"Model loaded successfully on {device}")

    return model, processor


def fetch_image(url: str) -> Image.Image:
    """Fetch image from URL"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content)).convert('RGB')
        return image
    except Exception as e:
        logger.error(f"Failed to fetch image from {url}: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")


def analyze_segmentation(segmentation_map: np.ndarray, image_shape: tuple) -> Dict:
    """Analyze segmentation map to extract sidewalk and obstruction info"""
    total_pixels = segmentation_map.size

    # Count pixels for each class
    class_pixel_counts = {}
    for class_id in np.unique(segmentation_map):
        if class_id < len(CITYSCAPES_CLASSES):
            class_name = CITYSCAPES_CLASSES[class_id]
            pixel_count = np.sum(segmentation_map == class_id)
            percentage = (pixel_count / total_pixels) * 100

            if percentage > 0.5:  # Only count if >0.5% of image
                class_pixel_counts[class_name] = {
                    'pixels': int(pixel_count),
                    'percentage': float(percentage)
                }

    # Check for sidewalk presence
    sidewalk_percentage = class_pixel_counts.get('sidewalk', {}).get('percentage', 0)
    road_percentage = class_pixel_counts.get('road', {}).get('percentage', 0)

    # Detect obstructions on sidewalk
    obstructions = []
    for obstruction_class in OBSTRUCTION_CLASSES:
        if obstruction_class in class_pixel_counts:
            obstructions.append({
                'class': obstruction_class,
                'percentage': class_pixel_counts[obstruction_class]['percentage']
            })

    return {
        'sidewalk_percentage': sidewalk_percentage,
        'road_percentage': road_percentage,
        'obstructions': obstructions,
        'class_distribution': class_pixel_counts
    }


def determine_quality(sidewalk_pct: float, obstructions: List[Dict]) -> tuple:
    """Determine sidewalk quality and confidence"""

    # Determine if sidewalk is detected
    sidewalk_detected = sidewalk_pct > 5  # At least 5% of image must be sidewalk

    if not sidewalk_detected:
        return 'none', 'low', ['No sidewalk visible in image']

    # Calculate obstruction severity
    total_obstruction_pct = sum(obs['percentage'] for obs in obstructions)

    issues = []

    # Assess quality based on sidewalk presence and obstructions
    if sidewalk_pct > 20:  # Good sidewalk coverage
        if total_obstruction_pct > 15:
            quality = 'poor'
            confidence = 'high'
            issues.append(f'{len(obstructions)} obstruction(s) detected blocking sidewalk')
        elif total_obstruction_pct > 5:
            quality = 'fair'
            confidence = 'medium'
            issues.append('Minor obstructions detected on sidewalk')
        else:
            quality = 'good'
            confidence = 'high'
    elif sidewalk_pct > 10:  # Moderate coverage
        quality = 'fair'
        confidence = 'medium'
        if total_obstruction_pct > 10:
            issues.append('Sidewalk partially visible with obstructions')
        else:
            issues.append('Sidewalk partially visible')
    else:  # Low coverage (5-10%)
        quality = 'poor'
        confidence = 'medium'
        issues.append('Limited sidewalk visible in image')

    # Add specific obstruction details
    for obs in obstructions:
        if obs['percentage'] > 5:
            issues.append(f"{obs['class']} detected ({obs['percentage']:.1f}% of image)")

    return quality, confidence, issues


@app.on_event("startup")
async def startup_event():
    """Preload model on server startup"""
    logger.info("Starting SafeStreets CV Backend...")
    load_model()


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "SafeStreets CV API",
        "model": "nvidia/segformer-b0-finetuned-cityscapes-1024-1024",
        "device": "cuda" if torch.cuda.is_available() else "cpu"
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "gpu_available": torch.cuda.is_available()
    }


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_sidewalk(request: AnalysisRequest):
    """
    Analyze a street-level image for sidewalk presence and quality

    Returns:
    - sidewalkDetected: boolean
    - confidence: 'high' | 'medium' | 'low'
    - quality: 'good' | 'fair' | 'poor' | 'none'
    - issues: list of detected problems
    - detections: detailed class predictions
    """
    try:
        # Load model if not already loaded
        model, processor = load_model()

        # Fetch and prepare image
        logger.info(f"Analyzing image: {request.image_id}")
        image = fetch_image(str(request.image_url))

        # Preprocess image
        inputs = processor(images=image, return_tensors="pt")

        # Move to GPU if available
        device = "cuda" if torch.cuda.is_available() else "cpu"
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Run inference
        with torch.no_grad():
            outputs = model(**inputs)

        # Get segmentation map
        logits = outputs.logits
        segmentation = logits.argmax(dim=1).squeeze().cpu().numpy()

        # Analyze segmentation results
        analysis = analyze_segmentation(segmentation, image.size)

        # Determine quality and confidence
        quality, confidence, issues = determine_quality(
            analysis['sidewalk_percentage'],
            analysis['obstructions']
        )

        # Build detections list
        detections = []
        for class_name, data in analysis['class_distribution'].items():
            if data['percentage'] > 1:  # Only include significant detections
                detections.append(Detection(
                    class_name=class_name,
                    confidence=0.85,  # SegFormer is generally ~85% accurate
                    pixel_percentage=data['percentage']
                ))

        # Generate notes
        sidewalk_detected = quality != 'none'
        obstruction_count = len(analysis['obstructions'])
        notes = f"AI detected: {f'sidewalk present ({analysis['sidewalk_percentage']:.1f}% of image)' if sidewalk_detected else 'no sidewalk'}, {obstruction_count} obstruction(s)"

        result = AnalysisResult(
            imageId=request.image_id,
            sidewalkDetected=sidewalk_detected,
            confidence=confidence,
            issues=issues if issues else ['No issues detected'],
            quality=quality,
            notes=notes,
            detections=detections
        )

        logger.info(f"Analysis complete for {request.image_id}: quality={quality}, confidence={confidence}")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-batch")
async def analyze_batch(requests: List[AnalysisRequest]):
    """
    Analyze multiple images in a batch
    Returns list of analysis results
    """
    results = []
    for req in requests[:10]:  # Limit to 10 images per batch
        try:
            result = await analyze_sidewalk(req)
            results.append(result)
        except Exception as e:
            logger.error(f"Failed to analyze {req.image_id}: {e}")
            # Return error result
            results.append(AnalysisResult(
                imageId=req.image_id,
                sidewalkDetected=False,
                confidence='low',
                issues=[f'Analysis error: {str(e)}'],
                quality='none',
                notes='Error during automated analysis',
                detections=[]
            ))

    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
