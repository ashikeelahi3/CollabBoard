# Deployment & DevOps

## Production Architecture

### Infrastructure Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Web Server    │    │   Database      │
│   (Nginx)       │────│   (Node.js)     │────│   (MongoDB)     │
│   SSL/TLS       │    │   PM2 Cluster   │    │   Replica Set   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │   Redis Cache   │              │
         └──────────────│   Session Store │──────────────┘
                        │   Socket.io     │
                        └─────────────────┘
```

### Docker Configuration

#### Dockerfile for Node.js Application
```dockerfile
# Dockerfile - Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build application (if needed)
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/server ./server
COPY --from=builder --chown=nodejs:nodejs /app/public ./public

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "server/server.js"]
```

#### Docker Compose for Development
```yaml
# docker-compose.yml - Development environment
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/collabboard
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-secret-key
    volumes:
      - .:/app
      - /app/node_modules
    depends_on:
      - mongo
      - redis
    networks:
      - collabboard-network

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_DATABASE=collabboard
    volumes:
      - mongo-data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - collabboard-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - collabboard-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - collabboard-network

volumes:
  mongo-data:
  redis-data:

networks:
  collabboard-network:
    driver: bridge
```

#### Production Docker Compose
```yaml
# docker-compose.prod.yml - Production environment
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
    networks:
      - collabboard-network
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M

  mongo:
    image: mongo:6.0
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_ROOT_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_ROOT_PASSWORD}
      - MONGO_INITDB_DATABASE=collabboard
    volumes:
      - mongo-data:/data/db
      - ./scripts/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
    networks:
      - collabboard-network
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    networks:
      - collabboard-network

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.prod.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    networks:
      - collabboard-network

volumes:
  mongo-data:
  redis-data:

networks:
  collabboard-network:
    driver: bridge
```

## Nginx Configuration

### Production Nginx Config
```nginx
# nginx/nginx.prod.conf - Production Nginx configuration
events {
    worker_connections 1024;
}

http {
    upstream app {
        least_conn;
        server app:3000 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    server {
        listen 80;
        server_name collabboard.com www.collabboard.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name collabboard.com www.collabboard.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Static files
        location /static/ {
            alias /app/public/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # Login endpoint with stricter rate limiting
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support for Socket.io
        location /socket.io/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # SPA fallback
        location / {
            try_files $uri $uri/ /index.html;
            proxy_pass http://app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml - CI/CD pipeline
name: Deploy CollabBoard

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '18'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm test
        env:
          NODE_ENV: test
          MONGODB_URI: mongodb://localhost:27017/collabboard_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-secret

      - name: Run security audit
        run: npm audit --audit-level high

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to production
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/collabboard
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
            docker system prune -f

      - name: Health check
        run: |
          sleep 30
          curl -f https://collabboard.com/health || exit 1

      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
        if: always()
```

## Monitoring & Logging

### Application Monitoring
```javascript
// server/middleware/monitoring.js - Application monitoring
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'websocket_active_connections',
  help: 'Number of active WebSocket connections'
});

const cardOperations = new prometheus.Counter({
  name: 'card_operations_total',
  help: 'Total number of card operations',
  labelNames: ['operation', 'board_id']
});

// Middleware to track HTTP requests
const trackHttpRequests = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
};

// Track WebSocket connections
const trackWebSocketConnections = (io) => {
  io.on('connection', (socket) => {
    activeConnections.inc();
    
    socket.on('disconnect', () => {
      activeConnections.dec();
    });
    
    socket.on('card:move', (data) => {
      cardOperations.labels('move', data.boardId).inc();
    });
    
    socket.on('card:create', (data) => {
      cardOperations.labels('create', data.boardId).inc();
    });
  });
};

// Metrics endpoint
const metricsEndpoint = (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
};

module.exports = {
  trackHttpRequests,
  trackWebSocketConnections,
  metricsEndpoint
};
```

### Structured Logging
```javascript
// server/utils/logger.js - Structured logging with Winston
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'collabboard',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    })
  ]
});

// Console logging for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id
    });
  });
  
  next();
};

// Error logging
const errorLogger = (error, req, res, next) => {
  logger.error('Application Error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    body: req.body
  });
  
  next(error);
};

module.exports = { logger, requestLogger, errorLogger };
```

## Environment Configuration

### Environment Variables
```bash
# .env.production - Production environment variables
NODE_ENV=production
PORT=3000

# Database
MONGODB_URI=mongodb://mongo-user:password@mongo:27017/collabboard?authSource=admin
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=secure-password

# Redis
REDIS_URL=redis://:redis-password@redis:6379
REDIS_PASSWORD=secure-redis-password

# JWT
JWT_SECRET=super-secure-jwt-secret-key-256-bits
JWT_EXPIRES_IN=24h

# File uploads
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif,application/pdf

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true

# External services
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@collabboard.com
SMTP_PASS=app-specific-password

# SSL
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

### Health Check Endpoint
```javascript
// healthcheck.js - Application health check
const http = require('http');
const mongoose = require('mongoose');
const redis = require('redis');

const healthCheck = async () => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {}
  };

  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState === 1) {
      checks.checks.mongodb = { status: 'healthy' };
    } else {
      throw new Error('MongoDB not connected');
    }

    // Check Redis connection
    const redisClient = redis.createClient(process.env.REDIS_URL);
    await redisClient.ping();
    checks.checks.redis = { status: 'healthy' };
    await redisClient.quit();

    // Check memory usage
    const memUsage = process.memoryUsage();
    checks.checks.memory = {
      status: memUsage.heapUsed < 500 * 1024 * 1024 ? 'healthy' : 'warning',
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    };

    return checks;

  } catch (error) {
    checks.status = 'unhealthy';
    checks.error = error.message;
    return checks;
  }
};

// For Docker health check
if (require.main === module) {
  healthCheck()
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(result.status === 'healthy' ? 0 : 1);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = healthCheck;
```