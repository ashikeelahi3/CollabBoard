# CollabBoard Deployment Guide

## Quick Deployment Options

### 🚀 Option 1: Render (Recommended - Free & Easy)

**Best for:** Quick deployment with free tier

#### Step 1: Prepare Your Code
```bash
# Add start script to package.json
"scripts": {
  "start": "node server/server.js"
}
```

#### Step 2: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Connect your repository

#### Step 3: Deploy Backend
1. Click "New +" → "Web Service"
2. Connect your GitHub repo
3. Configure:
   - **Name:** collabboard-api
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

#### Step 4: Add Environment Variables
```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
CORS_ORIGIN=https://your-frontend-url.onrender.com
```

#### Step 5: Deploy Frontend
1. Click "New +" → "Static Site"
2. Configure:
   - **Name:** collabboard
   - **Build Command:** Leave empty
   - **Publish Directory:** `src`

#### Step 6: Update API URL
In `src/modules/core/ApiClient.js`:
```javascript
const API_BASE_URL = 'https://collabboard-api.onrender.com';
```

**Cost:** FREE (with sleep after inactivity)

---

### 🌐 Option 2: Vercel + MongoDB Atlas (Fast & Free)

**Best for:** Fastest deployment with serverless

#### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

#### Step 2: Create vercel.json
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    },
    {
      "src": "src/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "server/server.js"
    },
    {
      "src": "/socket.io/(.*)",
      "dest": "server/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "src/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### Step 3: Deploy
```bash
vercel
# Follow prompts
# Add environment variables when asked
```

**Cost:** FREE

---

### 🐳 Option 3: Railway (Modern & Simple)

**Best for:** Modern deployment with database included

#### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

#### Step 2: Deploy
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Railway auto-detects Node.js

#### Step 3: Add MongoDB
1. Click "New" → "Database" → "MongoDB"
2. Copy connection string
3. Add to environment variables

#### Step 4: Environment Variables
```
NODE_ENV=production
MONGODB_URI=${{MongoDB.MONGO_URL}}
JWT_SECRET=your-secret-key
PORT=${{PORT}}
```

**Cost:** $5/month (includes database)

---

### ☁️ Option 4: Heroku (Traditional)

**Best for:** Enterprise-ready deployment

#### Step 1: Install Heroku CLI
```bash
npm install -g heroku
heroku login
```

#### Step 2: Create Heroku App
```bash
heroku create collabboard-app
```

#### Step 3: Add MongoDB
```bash
heroku addons:create mongolab:sandbox
```

#### Step 4: Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key
heroku config:set CORS_ORIGIN=https://collabboard-app.herokuapp.com
```

#### Step 5: Create Procfile
```
web: node server/server.js
```

#### Step 6: Deploy
```bash
git push heroku main
```

**Cost:** $7/month (Eco Dynos)

---

## Database Setup (MongoDB Atlas)

### Step 1: Create Free Cluster
1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for free
3. Create a free M0 cluster (512MB)

### Step 2: Configure Access
1. **Network Access:** Add `0.0.0.0/0` (allow from anywhere)
2. **Database Access:** Create user with password
3. **Connect:** Get connection string

### Step 3: Connection String
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/collabboard?retryWrites=true&w=majority
```

---

## Pre-Deployment Checklist

### ✅ Code Preparation
- [ ] Update API URLs to production
- [ ] Remove console.logs
- [ ] Add error handling
- [ ] Test all features locally
- [ ] Update CORS origins

### ✅ Environment Variables
```bash
# Required for production
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=minimum-32-character-secret
CORS_ORIGIN=https://your-domain.com
```

### ✅ Security
- [ ] Strong JWT secret (32+ characters)
- [ ] HTTPS enabled
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints

### ✅ Performance
- [ ] Database indexes created
- [ ] Static files compressed
- [ ] API response caching
- [ ] Connection pooling configured

---

## Quick Start Scripts

### For Render
```bash
# package.json
{
  "scripts": {
    "start": "node server/server.js",
    "build": "echo 'No build needed'"
  }
}
```

### For Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### For Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway up
```

---

## Post-Deployment Testing

### Test Checklist
```bash
# 1. Health check
curl https://your-api.com/health

# 2. Register user
curl -X POST https://your-api.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"test123"}'

# 3. Login
curl -X POST https://your-api.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 4. Test WebSocket
# Open browser console on your frontend
# Check for "Socket connected" message
```

---

## Troubleshooting

### Common Issues

#### 1. "Cannot connect to database"
```bash
# Check MongoDB Atlas IP whitelist
# Add 0.0.0.0/0 to allow all IPs
```

#### 2. "CORS error"
```bash
# Update CORS_ORIGIN in environment variables
CORS_ORIGIN=https://your-frontend-domain.com
```

#### 3. "WebSocket connection failed"
```bash
# Ensure Socket.io transports are configured
# In server.js:
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN,
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});
```

#### 4. "Module not found"
```bash
# Ensure all dependencies are in package.json
npm install --save express mongoose socket.io jsonwebtoken bcryptjs cors dotenv
```

---

## Monitoring & Maintenance

### Free Monitoring Tools
1. **Uptime Robot** - Monitor uptime (free)
2. **LogRocket** - Frontend error tracking
3. **Sentry** - Backend error tracking
4. **MongoDB Atlas** - Database monitoring

### Health Check Endpoint
Add to `server/server.js`:
```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});
```

---

## Recommended: Render Deployment (Detailed)

### Why Render?
- ✅ Free tier available
- ✅ Auto-deploy from GitHub
- ✅ Built-in SSL
- ✅ Easy environment variables
- ✅ Good for full-stack apps

### Complete Render Setup

#### 1. Backend Service
```yaml
# render.yaml (optional)
services:
  - type: web
    name: collabboard-api
    env: node
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        generateValue: true
      - key: PORT
        value: 10000
```

#### 2. Frontend Static Site
- **Build Command:** (leave empty)
- **Publish Directory:** `src`
- **Auto-Deploy:** Yes

#### 3. Custom Domain (Optional)
1. Go to Settings → Custom Domain
2. Add your domain
3. Update DNS records

---

## Cost Comparison

| Platform | Free Tier | Paid Tier | Database | Best For |
|----------|-----------|-----------|----------|----------|
| **Render** | ✅ Yes (sleeps) | $7/mo | Separate | Quick start |
| **Vercel** | ✅ Yes | $20/mo | Separate | Serverless |
| **Railway** | ❌ No | $5/mo | Included | All-in-one |
| **Heroku** | ❌ No | $7/mo | $9/mo | Enterprise |

---

## Final Steps

1. **Choose platform** (Render recommended)
2. **Setup MongoDB Atlas** (free tier)
3. **Deploy backend** with environment variables
4. **Deploy frontend** with updated API URL
5. **Test all features**
6. **Monitor for errors**

## Support

If you encounter issues:
1. Check deployment logs
2. Verify environment variables
3. Test database connection
4. Check CORS configuration
5. Review error messages

---

**🎉 Your CollabBoard is now live!**
