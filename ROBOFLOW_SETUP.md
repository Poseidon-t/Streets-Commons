# 🤖 Roboflow Setup Guide

## Quick Start (5 minutes)

### 1. Sign Up for Roboflow (Free)

1. Go to **https://roboflow.com**
2. Click **"Sign Up"** (top right)
3. Use Google/GitHub sign-in or email
4. Free tier: **1,000 inferences/month** (no credit card required)

### 2. Get Your API Key

1. After signing up, you'll land on your workspace dashboard
2. Click your **profile icon** (top right) → **"Settings"**
3. In the left sidebar, click **"Roboflow API"**
4. Copy your **Private API Key** (starts with `RF...`)

### 3. Add to SafeStreets

1. Open your `.env` file in the project root
2. Add this line:
   ```bash
   VITE_ROBOFLOW_API_KEY=RF_YOUR_KEY_HERE
   ```
3. Save the file
4. Restart your dev server: `npm run dev`

### 4. Verify It's Working

1. Search for any address in SafeStreets
2. Open browser console (F12)
3. Look for logs like:
   ```
   Found 12 Mapillary images in area
   Analyzing image: xyz123
   AI detected: sidewalk present, 2 obstructions
   ```
4. Check metric cards for confidence badges (🟢🟡🔴)

---

## Using the Public Model

We're using a **public sidewalk detection model** that's already trained:

**Model**: `sidewalk-detection-x8wlj/2`
- Trained on 5,000+ street-view images
- Detects: sidewalks, footpaths, vehicles, obstructions
- ~85% accuracy for sidewalk presence
- ~90% accuracy for vehicle/obstruction detection

**You don't need to train anything** - just use your API key!

---

## Free Tier Limits

| Feature | Free Tier | Notes |
|---------|-----------|-------|
| **Inferences** | 1,000/month | ~30 users/month analyzing 10 images each |
| **API Calls** | Unlimited | Only inferences count |
| **Models** | Unlimited | Can use any public model |
| **Storage** | 1,000 images | Not relevant for us (we don't upload) |

### What Uses an Inference?

✅ **Counts**: Analyzing a Mapillary image for sidewalk detection
❌ **Doesn't count**: Fetching Mapillary images, OSM data, displaying results

### Optimization Tips

**Smart analysis**:
- Only analyze when Mapillary images exist
- Limit to 10 images per location (covers 800m radius well)
- Skip analysis if OSM data looks reliable
- Cache results to avoid re-analyzing

**Expected usage**:
- 100 users/month = 100 locations × 10 images = **1,000 inferences** (exactly at free tier!)
- 1,000 users/month = **10,000 inferences** = **$5/month** ($0.0005 per inference after free tier)

---

## Alternative: Self-Hosted CV (Free Forever)

If you exceed free tier or want more control, you can run CV locally:

### Option 1: DeepLabV3+ (PyTorch)
```python
# Install
pip install torch torchvision segmentation-models-pytorch

# Run inference
from segmentation_models_pytorch import DeepLabV3Plus
model = DeepLabV3Plus('resnet50', classes=19)
# ... process image
```

### Option 2: SegFormer (Hugging Face)
```python
# Install
pip install transformers

# Run inference
from transformers import SegformerForSemanticSegmentation
model = SegformerForSemanticSegmentation.from_pretrained('nvidia/segformer-b0-finetuned-ade-512-512')
# ... process image
```

**Pros**: Free, unlimited, full control
**Cons**: Need GPU server, more setup, maintenance

---

## Troubleshooting

### "API key invalid" Error

**Check**:
1. Key copied correctly (no extra spaces)
2. Key starts with `RF`
3. Using **Private API Key**, not public key

**Fix**: Go to Roboflow → Settings → Roboflow API → regenerate key

### "Rate limit exceeded" Error

You've hit 1,000 inferences this month!

**Options**:
1. Wait until next month (resets automatically)
2. Upgrade to paid plan ($50/month for 100k inferences)
3. Implement caching to reduce calls
4. Switch to self-hosted CV model

### No CV Analysis Running

**Check browser console**:
- `VITE_ROBOFLOW_API_KEY` not found → Add to `.env`
- `Roboflow API error 401` → Invalid key
- `Roboflow API error 429` → Rate limit exceeded
- No errors → Fallback mode (manual inspection)

---

## Cost Projection

### Launch (Month 1-3)
- **Users**: 100-500/month
- **Inferences**: 1,000-5,000
- **Cost**: **$0-2/month** (mostly free tier)

### Growth (Month 6)
- **Users**: 1,000/month
- **Inferences**: 10,000
- **Cost**: **~$5/month**

### Scale (Year 1)
- **Users**: 10,000/month
- **Inferences**: 100,000
- **Cost**: **~$50/month** (or switch to self-hosted)

**Conclusion**: Cost is negligible for launch. Can revisit if usage explodes.

---

## Support

**Roboflow Support**:
- Docs: https://docs.roboflow.com
- Community: https://discuss.roboflow.com
- Email: support@roboflow.com

**SafeStreets Issues**:
- GitHub: [Your repo issues]
- Check `SIDEWALK_CV_ANALYSIS.md` for detailed docs

---

**Setup complete!** 🎉

Your SafeStreets instance now has AI-powered sidewalk validation.
