# CV Backend Quick Start

Get AI sidewalk validation running in 5 minutes locally, 15 minutes deployed.

## Local Development (5 minutes)

### 1. Install Dependencies
```bash
cd cv-backend
pip install -r requirements.txt
```

**First-time setup**: Python packages will download (~500MB). This is normal.

### 2. Start Server
```bash
python main.py
```

**Expected output**:
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Starting SafeStreets CV Backend...
INFO:     Loading SegFormer model from Hugging Face...
INFO:     Model loaded successfully on cpu
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

**⚠️ First run**: Model download takes 1-2 minutes (~300MB). Subsequent runs are instant.

### 3. Test API
```bash
# New terminal window
cd cv-backend
python test_local.py
```

**Expected output**:
```
✅ Health check passed
✅ Analysis successful
   Sidewalk detected: True
   Confidence: high
   Quality: good
```

### 4. Connect Frontend
```bash
# In Streets-Commons root directory
echo "VITE_CV_API_URL=http://localhost:8000" >> .env

# Restart frontend
npm run dev
```

**Done!** 🎉 Search any address and check browser console for CV analysis logs.

---

## Production Deployment (15 minutes)

### Option A: Railway (Recommended)

**Why**: $5/month unlimited, auto-deploy from GitHub, built-in monitoring

**Steps**:
1. Push code to GitHub
2. Go to https://railway.app
3. Sign up with GitHub
4. Click "New Project" → "Deploy from GitHub"
5. Select your repo
6. Set root directory: `cv-backend`
7. Railway auto-detects Dockerfile and deploys

**Get URL**: Railway dashboard shows deployment URL

**Update frontend**:
```bash
echo "VITE_CV_API_URL=https://your-app.railway.app" >> .env
```

### Option B: Fly.io (Free Tier)

**Why**: Free tier available, good for testing

**Steps**:
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
cd cv-backend
fly launch
# Follow prompts, select region

# Get URL
fly info

# Update frontend
echo "VITE_CV_API_URL=https://your-app.fly.dev" >> .env
```

---

## Verify Deployment

### Health Check
```bash
curl https://your-deployed-url/health
```

**Expected**:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu",
  "gpu_available": false
}
```

### API Docs
Visit: `https://your-deployed-url/docs`

Interactive Swagger UI to test endpoints.

### Frontend Integration
1. Search any address in SafeStreets
2. Open browser console (F12)
3. Look for logs:
   ```
   Found 12 Mapillary images
   Analyzing image: xyz123
   AI detected: sidewalk present, 0 obstructions
   ```

---

## Troubleshooting

### Backend won't start

**Error**: `ModuleNotFoundError: No module named 'transformers'`

**Solution**:
```bash
pip install -r requirements.txt
```

### Model loading fails

**Error**: `Out of memory`

**Solution**: Model requires ~2GB RAM. Close other applications or upgrade server.

### API returns 500 errors

**Check logs**:
```bash
# Railway
railway logs

# Fly.io
fly logs

# Local
# Check terminal where you ran `python main.py`
```

**Common causes**:
1. Image URL unreachable → Test URL in browser
2. Model not loaded → Check startup logs
3. Out of memory → Scale up server

### Frontend can't reach API

**Error in browser console**: `CORS policy: No 'Access-Control-Allow-Origin'`

**Solution**: Update `main.py` to allow your frontend domain:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    ...
)
```

### Slow response (>10 seconds)

**Causes**:
1. First request after idle (cold start) - normal
2. Server location far from user
3. Large image download

**Solutions**:
1. Keep warm with health check pings
2. Deploy to region closest to users
3. Use thumb-256 URLs instead of thumb-1024

---

## Monitoring

### Set Up Alerts

**UptimeRobot** (Free):
1. Go to https://uptimerobot.com
2. Add monitor: `https://your-api-url/health`
3. Interval: 5 minutes
4. Email alert if down

### Check Usage

**Railway**:
- Dashboard shows requests/hour, response times
- $5/month includes 500 execution hours (always-on)

**Fly.io**:
- `fly dashboard` shows metrics
- Free tier: 3 shared CPUs, 256MB RAM

---

## Cost

### Railway
- **Hobby**: $5/month (500 hours = always-on)
- **Unlimited** CV inference
- Scales to 10,000+ users/month

### Fly.io
- **Free**: 3 CPUs, 256MB RAM (good for 100 users/month)
- **Scale**: ~$2-5/month as traffic grows

### Roboflow (Fallback)
- **Free**: 1,000 inferences/month
- **Paid**: $0.0005 per inference after free tier

**Recommendation**: Use self-hosted (Railway/Fly.io) for unlimited analysis

---

## Next Steps

After deployment:

- [ ] Update `VITE_CV_API_URL` in .env
- [ ] Test with 5+ different addresses
- [ ] Set up UptimeRobot monitoring
- [ ] Check Railway/Fly.io dashboard
- [ ] Monitor costs first week

---

## Full Documentation

- **Complete guide**: [README.md](README.md)
- **Deployment options**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Frontend integration**: [../SELF_HOSTED_CV_SUMMARY.md](../SELF_HOSTED_CV_SUMMARY.md)

---

## Support

**Issues**: File at GitHub repo

**Model docs**: https://huggingface.co/nvidia/segformer-b0-finetuned-cityscapes-1024-1024

**Railway**: https://railway.app/help

**Fly.io**: https://community.fly.io
