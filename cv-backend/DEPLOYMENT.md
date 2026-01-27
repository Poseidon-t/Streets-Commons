# Quick Deployment Guide

Deploy SafeStreets CV backend in 15 minutes.

## Option 1: Railway (Recommended - $5/month)

### Why Railway?
- Always-on server for $5/month
- Unlimited CV inference
- Auto-deploys from GitHub
- Built-in monitoring
- Best for production

### Steps

**1. Prepare Repository**
```bash
# If not already in git
cd /Users/sarath/Documents/Streets-Commons
git add cv-backend/
git commit -m "Add self-hosted CV backend"
git push origin main
```

**2. Sign Up for Railway**
- Go to https://railway.app
- Sign up with GitHub
- Connect your repository

**3. Deploy**
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your Streets-Commons repo
- Railway auto-detects the Dockerfile
- Set root directory: `cv-backend`
- Deploy!

**4. Get Your URL**
- Railway provides: `https://your-app.up.railway.app`
- Copy this URL

**5. Update Frontend**
```bash
# In Streets-Commons root
echo "VITE_CV_API_URL=https://your-app.up.railway.app" >> .env

# Restart dev server
npm run dev
```

**6. Test**
```bash
# Health check
curl https://your-app.up.railway.app/health

# Should return:
# {"status":"healthy","model_loaded":true,"device":"cpu","gpu_available":false}
```

**Done!** ✅ Your CV API is live and unlimited.

---

## Option 2: Fly.io (Free Tier Available)

### Why Fly.io?
- Free tier: 3 shared CPUs, 256MB RAM
- Good for testing / low traffic
- Pay-as-you-go after free tier

### Steps

**1. Install Fly CLI**
```bash
# macOS/Linux
curl -L https://fly.io/install.sh | sh

# Add to PATH
echo 'export PATH="$HOME/.fly/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**2. Login**
```bash
fly auth login
```

**3. Deploy**
```bash
cd /Users/sarath/Documents/Streets-Commons/cv-backend

# Launch app
fly launch

# Follow prompts:
# - App name: safestreets-cv (or your choice)
# - Region: Choose closest to users
# - Database: No
# - Deploy now: Yes
```

**4. Get URL**
```bash
fly info
# Note the "Hostname" value
```

**5. Update Frontend**
```bash
cd /Users/sarath/Documents/Streets-Commons
echo "VITE_CV_API_URL=https://safestreets-cv.fly.dev" >> .env
npm run dev
```

**6. Scale (Optional)**
```bash
# If free tier too slow, scale up
fly scale memory 512  # 512MB RAM
fly scale vm shared-cpu-1x  # Dedicated CPU
```

---

## Option 3: Docker on Any VPS

### Requirements
- VPS with Docker installed (DigitalOcean, Linode, AWS, etc.)
- At least 2GB RAM
- SSH access

### Steps

**1. Copy Files to Server**
```bash
# From your local machine
cd /Users/sarath/Documents/Streets-Commons
scp -r cv-backend/ user@your-vps-ip:/home/user/
```

**2. SSH into Server**
```bash
ssh user@your-vps-ip
```

**3. Build and Run**
```bash
cd /home/user/cv-backend

# Build image
docker build -t safestreets-cv .

# Run container
docker run -d \
  --name safestreets-cv \
  -p 8000:8000 \
  --restart unless-stopped \
  safestreets-cv

# Check logs
docker logs -f safestreets-cv
```

**4. Set Up Nginx (Reverse Proxy)**
```bash
# Install nginx
sudo apt update && sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/cv-api

# Add:
server {
    listen 80;
    server_name cv-api.your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/cv-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**5. Add SSL with Let's Encrypt**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d cv-api.your-domain.com
```

**6. Update Frontend**
```bash
echo "VITE_CV_API_URL=https://cv-api.your-domain.com" >> .env
```

---

## Verification Checklist

After deployment, verify everything works:

- [ ] Health check responds: `curl https://your-api-url/health`
- [ ] Swagger docs accessible: `https://your-api-url/docs`
- [ ] Model loads successfully (check logs)
- [ ] Single image analysis works: Test with `/analyze` endpoint
- [ ] Frontend can reach API (check browser console)
- [ ] CORS configured correctly (no browser errors)

## Monitoring Setup

### UptimeRobot (Free)
1. Go to https://uptimerobot.com
2. Add monitor: `https://your-api-url/health`
3. Check every 5 minutes
4. Get alerts if down

### Railway/Fly.io Built-in
- Railway: View metrics in dashboard
- Fly.io: `fly dashboard` or web UI

## Troubleshooting

### API returns 500 errors
**Check logs**:
```bash
# Railway
railway logs

# Fly.io
fly logs

# Docker
docker logs safestreets-cv
```

**Common causes**:
1. Out of memory (scale up)
2. Model download failed (check internet)
3. Image URL unreachable (test URL manually)

### Frontend can't reach API
**Check CORS**:
- Verify `allow_origins` in `main.py` includes your frontend domain
- Update and redeploy if needed

### Slow response times
**Solutions**:
1. **Scale up**: More RAM/CPU
2. **Add GPU**: Faster inference
3. **Deploy closer**: Choose region near users
4. **Add caching**: Cache frequent images

## Cost Optimization

### Keep Costs Low
1. **Use Railway Hobby**: $5/month unlimited
2. **Monitor usage**: Set up alerts
3. **Cache results**: Avoid re-analyzing same images
4. **Batch requests**: Use `/analyze-batch` for multiple images

### When to Upgrade
- **>10,000 users/month**: Consider GPU ($20-30/month extra)
- **>100,000 requests/month**: Scale to Pro plan
- **Need faster**: Add GPU or upgrade CPU

## Next Steps

After deployment:

1. **Update .env**: Add `VITE_CV_API_URL=your-deployed-url`
2. **Test thoroughly**: Analyze 10+ different locations
3. **Monitor costs**: Check Railway/Fly.io dashboard weekly
4. **Set up alerts**: UptimeRobot for downtime monitoring
5. **Document URL**: Share with team

## Support

**Railway**: https://railway.app/help
**Fly.io**: https://community.fly.io
**Docker**: https://docs.docker.com

**Issues**: File at your GitHub repo
