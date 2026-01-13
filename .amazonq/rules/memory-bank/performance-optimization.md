# Performance Optimization & Best Practices

## Frontend Performance Optimization

### Code Splitting & Lazy Loading
```javascript
// modules/core/ModuleLoader.js - Dynamic module loading
class ModuleLoader {
  constructor() {
    this.loadedModules = new Map();
    this.loadingPromises = new Map();
  }

  async loadModule(moduleName) {
    // Return cached module if already loaded
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    // Return existing promise if module is currently loading
    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName);
    }

    // Create loading promise
    const loadingPromise = this.dynamicImport(moduleName);
    this.loadingPromises.set(moduleName, loadingPromise);

    try {
      const module = await loadingPromise;
      this.loadedModules.set(moduleName, module);
      this.loadingPromises.delete(moduleName);
      return module;
    } catch (error) {
      this.loadingPromises.delete(moduleName);
      throw error;
    }
  }

  async dynamicImport(moduleName) {
    const moduleMap = {
      'board': () => import('./components/Board.js'),
      'card-editor': () => import('./components/CardEditor.js'),
      'board-settings': () => import('./components/BoardSettings.js'),
      'user-management': () => import('./components/UserManagement.js'),
      'analytics': () => import('./components/Analytics.js')
    };

    const importFn = moduleMap[moduleName];
    if (!importFn) {
      throw new Error(`Module ${moduleName} not found`);
    }

    return await importFn();
  }

  // Preload critical modules
  async preloadCriticalModules() {
    const criticalModules = ['board', 'card-editor'];
    
    const preloadPromises = criticalModules.map(module => 
      this.loadModule(module).catch(error => 
        console.warn(`Failed to preload ${module}:`, error)
      )
    );

    await Promise.allSettled(preloadPromises);
  }
}

export const moduleLoader = new ModuleLoader();
```

### Virtual Scrolling for Large Lists
```javascript
// modules/components/VirtualList.js - Virtual scrolling implementation
export class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 5;
    this.items = [];
    this.visibleItems = [];
    this.scrollTop = 0;
    this.containerHeight = 0;
    
    this.init();
  }

  init() {
    this.container.style.overflow = 'auto';
    this.container.style.position = 'relative';
    
    this.viewport = document.createElement('div');
    this.viewport.style.position = 'relative';
    this.container.appendChild(this.viewport);
    
    this.container.addEventListener('scroll', this.handleScroll.bind(this));
    
    // Observe container size changes
    this.resizeObserver = new ResizeObserver(entries => {
      this.containerHeight = entries[0].contentRect.height;
      this.updateVisibleItems();
    });
    this.resizeObserver.observe(this.container);
  }

  setItems(items) {
    this.items = items;
    this.updateVisibleItems();
  }

  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.updateVisibleItems();
  }

  updateVisibleItems() {
    if (!this.items.length) return;

    const startIndex = Math.max(0, 
      Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize
    );
    
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight) + 
      (this.bufferSize * 2);
    
    const endIndex = Math.min(this.items.length, startIndex + visibleCount);

    // Update viewport height
    this.viewport.style.height = `${this.items.length * this.itemHeight}px`;

    // Clear existing items
    this.viewport.innerHTML = '';

    // Render visible items
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      const element = this.renderItem(item, i);
      element.style.position = 'absolute';
      element.style.top = `${i * this.itemHeight}px`;
      element.style.height = `${this.itemHeight}px`;
      element.style.width = '100%';
      this.viewport.appendChild(element);
    }
  }

  renderItem(item, index) {
    // Override in subclasses
    const element = document.createElement('div');
    element.textContent = item.toString();
    return element;
  }

  destroy() {
    this.resizeObserver.disconnect();
    this.container.removeEventListener('scroll', this.handleScroll);
  }
}

// Usage for large card lists
class CardVirtualList extends VirtualList {
  renderItem(card, index) {
    const element = document.createElement('div');
    element.className = 'virtual-card-item';
    element.innerHTML = `
      <div class="card-preview">
        <h4>${card.title}</h4>
        <p>${card.description?.substring(0, 100) || ''}</p>
        <div class="card-meta">
          <span class="assignee">${card.assignedTo?.username || ''}</span>
          <span class="due-date">${this.formatDate(card.dueDate)}</span>
        </div>
      </div>
    `;
    return element;
  }

  formatDate(date) {
    return date ? new Date(date).toLocaleDateString() : '';
  }
}
```

### Image Optimization & Lazy Loading
```javascript
// modules/utils/ImageOptimizer.js - Image optimization utilities
class ImageOptimizer {
  constructor() {
    this.observer = null;
    this.imageCache = new Map();
    this.setupIntersectionObserver();
  }

  setupIntersectionObserver() {
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadImage(entry.target);
          this.observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });
  }

  // Lazy load images
  lazyLoad(img) {
    if (!img.dataset.src) return;

    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s';
    
    this.observer.observe(img);
  }

  async loadImage(img) {
    const src = img.dataset.src;
    if (!src) return;

    try {
      // Check cache first
      if (this.imageCache.has(src)) {
        const cachedBlob = this.imageCache.get(src);
        img.src = URL.createObjectURL(cachedBlob);
        img.style.opacity = '1';
        return;
      }

      // Show loading placeholder
      img.src = this.generatePlaceholder(img.width, img.height);

      // Load and cache image
      const response = await fetch(src);
      const blob = await response.blob();
      
      // Cache the blob
      this.imageCache.set(src, blob);
      
      // Create object URL and display
      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      img.style.opacity = '1';

      // Clean up object URL after load
      img.onload = () => URL.revokeObjectURL(objectUrl);

    } catch (error) {
      console.error('Failed to load image:', error);
      img.src = this.generateErrorPlaceholder();
      img.style.opacity = '1';
    }
  }

  generatePlaceholder(width = 300, height = 200) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = '#ccc';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Loading...', width / 2, height / 2);
    
    return canvas.toDataURL();
  }

  generateErrorPlaceholder() {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffebee';
    ctx.fillRect(0, 0, 300, 200);
    
    ctx.fillStyle = '#f44336';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to load', 150, 100);
    
    return canvas.toDataURL();
  }

  // Optimize image before upload
  async optimizeImage(file, maxWidth = 1200, quality = 0.8) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

export const imageOptimizer = new ImageOptimizer();
```

## Backend Performance Optimization

### Database Query Optimization
```javascript
// server/services/OptimizedBoardService.js - Optimized database queries
const Board = require('../models/Board');
const Column = require('../models/Column');
const Card = require('../models/Card');
const CacheManager = require('../utils/CacheManager');

class OptimizedBoardService {
  // Optimized board loading with aggregation
  static async getBoardWithDetails(boardId, userId) {
    const cacheKey = `board:${boardId}:${userId}`;
    
    // Check cache first
    const cached = await CacheManager.get(cacheKey);
    if (cached) return cached;

    // Use aggregation pipeline for efficient data fetching
    const boardData = await Board.aggregate([
      { $match: { _id: mongoose.Types.ObjectId(boardId) } },
      
      // Populate owner
      {
        $lookup: {
          from: 'users',
          localField: 'owner',
          foreignField: '_id',
          as: 'owner',
          pipeline: [
            { $project: { username: 1, email: 1, 'profile.avatar': 1 } }
          ]
        }
      },
      { $unwind: '$owner' },
      
      // Populate members
      {
        $lookup: {
          from: 'users',
          localField: 'members.user',
          foreignField: '_id',
          as: 'memberUsers'
        }
      },
      
      // Get columns with cards in one query
      {
        $lookup: {
          from: 'columns',
          let: { boardId: '$_id' },
          pipeline: [
            { $match: { 
              $expr: { $eq: ['$board', '$$boardId'] },
              isArchived: false 
            }},
            { $sort: { position: 1 } },
            
            // Get cards for each column
            {
              $lookup: {
                from: 'cards',
                let: { columnId: '$_id' },
                pipeline: [
                  { $match: { 
                    $expr: { $eq: ['$column', '$$columnId'] },
                    isArchived: false 
                  }},
                  { $sort: { position: 1 } },
                  
                  // Populate assigned users
                  {
                    $lookup: {
                      from: 'users',
                      localField: 'assignedTo',
                      foreignField: '_id',
                      as: 'assignedTo',
                      pipeline: [
                        { $project: { username: 1, 'profile.avatar': 1 } }
                      ]
                    }
                  }
                ],
                as: 'cards'
              }
            }
          ],
          as: 'columns'
        }
      }
    ]);

    if (!boardData.length) {
      throw new Error('Board not found');
    }

    const board = boardData[0];
    
    // Check user access
    const hasAccess = this.checkUserAccess(board, userId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // Cache the result
    await CacheManager.set(cacheKey, board, 300); // 5 minutes

    return board;
  }

  // Batch card operations for better performance
  static async batchUpdateCards(updates) {
    const bulkOps = updates.map(update => ({
      updateOne: {
        filter: { _id: update.cardId },
        update: { $set: update.changes },
        upsert: false
      }
    }));

    const result = await Card.bulkWrite(bulkOps, { ordered: false });
    
    // Invalidate related caches
    const boardIds = [...new Set(updates.map(u => u.boardId))];
    await Promise.all(
      boardIds.map(boardId => CacheManager.invalidatePattern(`board:${boardId}:*`))
    );

    return result;
  }

  // Optimized search with text indexes
  static async searchCards(query, boardIds, options = {}) {
    const {
      limit = 20,
      skip = 0,
      sortBy = 'relevance'
    } = options;

    const searchPipeline = [
      {
        $match: {
          $text: { $search: query },
          column: { $in: await this.getColumnIds(boardIds) },
          isArchived: false
        }
      },
      
      // Add relevance score
      { $addFields: { score: { $meta: 'textScore' } } },
      
      // Sort by relevance or other criteria
      { $sort: sortBy === 'relevance' 
          ? { score: { $meta: 'textScore' } }
          : { [sortBy]: -1 }
      },
      
      { $skip: skip },
      { $limit: limit },
      
      // Populate necessary fields
      {
        $lookup: {
          from: 'columns',
          localField: 'column',
          foreignField: '_id',
          as: 'column',
          pipeline: [
            { $project: { title: 1, board: 1 } }
          ]
        }
      },
      { $unwind: '$column' },
      
      {
        $lookup: {
          from: 'boards',
          localField: 'column.board',
          foreignField: '_id',
          as: 'board',
          pipeline: [
            { $project: { title: 1 } }
          ]
        }
      },
      { $unwind: '$board' }
    ];

    return await Card.aggregate(searchPipeline);
  }

  static checkUserAccess(board, userId) {
    return board.owner._id.toString() === userId.toString() ||
           board.members.some(member => member.user.toString() === userId.toString());
  }

  static async getColumnIds(boardIds) {
    const columns = await Column.find(
      { board: { $in: boardIds }, isArchived: false },
      { _id: 1 }
    );
    return columns.map(col => col._id);
  }
}

module.exports = OptimizedBoardService;
```

### Connection Pooling & Caching
```javascript
// server/config/database.js - Optimized database configuration
const mongoose = require('mongoose');
const redis = require('redis');

class DatabaseManager {
  constructor() {
    this.mongoConnection = null;
    this.redisClient = null;
  }

  async connectMongoDB() {
    const options = {
      // Connection pool settings
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      
      // Performance optimizations
      bufferCommands: false,
      bufferMaxEntries: 0,
      
      // Write concern for consistency vs performance
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 1000
      },
      
      // Read preference for scaling
      readPreference: 'secondaryPreferred',
      
      // Compression
      compressors: ['zlib']
    };

    this.mongoConnection = await mongoose.connect(process.env.MONGODB_URI, options);
    
    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return this.mongoConnection;
  }

  async connectRedis() {
    this.redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('Redis server connection refused');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    await this.redisClient.connect();

    this.redisClient.on('error', (err) => {
      console.error('Redis error:', err);
    });

    this.redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return this.redisClient;
  }

  async initialize() {
    await Promise.all([
      this.connectMongoDB(),
      this.connectRedis()
    ]);
  }
}

module.exports = new DatabaseManager();
```

## WebSocket Performance Optimization

### Efficient Socket.io Configuration
```javascript
// server/socket/optimizedSocket.js - Optimized Socket.io setup
const socketIo = require('socket.io');
const redis = require('socket.io-redis');
const jwt = require('jsonwebtoken');

class OptimizedSocketManager {
  constructor(server) {
    this.io = socketIo(server, {
      // Transport optimization
      transports: ['websocket', 'polling'],
      upgradeTimeout: 30000,
      pingTimeout: 60000,
      pingInterval: 25000,
      
      // Compression
      compression: true,
      
      // CORS configuration
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST']
      }
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupRateLimiting();
  }

  setupRedisAdapter() {
    // Use Redis adapter for horizontal scaling
    this.io.adapter(redis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD
    }));
  }

  setupMiddleware() {
    // JWT authentication
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        socket.userId = decoded.userId;
        socket.username = decoded.username;
        socket.userRole = decoded.role;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use((socket, next) => {
      socket.rateLimiter = new Map();
      next();
    });
  }

  setupRateLimiting() {
    const rateLimits = {
      'card:move': { max: 10, window: 1000 }, // 10 per second
      'card:create': { max: 5, window: 1000 }, // 5 per second
      'card:update': { max: 20, window: 1000 } // 20 per second
    };

    this.io.on('connection', (socket) => {
      Object.keys(rateLimits).forEach(event => {
        socket.on(event, (data, callback) => {
          if (this.isRateLimited(socket, event, rateLimits[event])) {
            if (callback) callback({ error: 'Rate limit exceeded' });
            return;
          }
          
          this.handleEvent(socket, event, data, callback);
        });
      });
    });
  }

  isRateLimited(socket, event, limit) {
    const now = Date.now();
    const key = `${event}:${socket.userId}`;
    
    if (!socket.rateLimiter.has(key)) {
      socket.rateLimiter.set(key, { count: 1, resetTime: now + limit.window });
      return false;
    }

    const limiter = socket.rateLimiter.get(key);
    
    if (now > limiter.resetTime) {
      limiter.count = 1;
      limiter.resetTime = now + limit.window;
      return false;
    }

    if (limiter.count >= limit.max) {
      return true;
    }

    limiter.count++;
    return false;
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);

      // Join user to their personal room
      socket.join(`user:${socket.userId}`);

      socket.on('board:join', async (boardId) => {
        try {
          // Verify board access
          const hasAccess = await this.verifyBoardAccess(socket.userId, boardId);
          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Leave previous board rooms
          const rooms = Array.from(socket.rooms);
          rooms.forEach(room => {
            if (room.startsWith('board:')) {
              socket.leave(room);
            }
          });

          // Join new board room
          socket.join(`board:${boardId}`);
          socket.currentBoard = boardId;

          // Notify other users
          socket.to(`board:${boardId}`).emit('user:joined', {
            userId: socket.userId,
            username: socket.username
          });

          // Send current board state
          const boardState = await this.getBoardState(boardId);
          socket.emit('board:state', boardState);

        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('disconnect', () => {
        if (socket.currentBoard) {
          socket.to(`board:${socket.currentBoard}`).emit('user:left', {
            userId: socket.userId
          });
        }
        console.log(`User ${socket.userId} disconnected`);
      });
    });
  }

  async handleEvent(socket, event, data, callback) {
    try {
      switch (event) {
        case 'card:move':
          await this.handleCardMove(socket, data);
          break;
        case 'card:create':
          await this.handleCardCreate(socket, data);
          break;
        case 'card:update':
          await this.handleCardUpdate(socket, data);
          break;
      }
      
      if (callback) callback({ success: true });
    } catch (error) {
      console.error(`Error handling ${event}:`, error);
      if (callback) callback({ error: error.message });
    }
  }

  async handleCardMove(socket, data) {
    // Validate and process card move
    const { cardId, sourceColumnId, targetColumnId, position, boardId } = data;
    
    // Verify permissions
    const canMove = await this.verifyCardPermission(socket.userId, cardId, 'move');
    if (!canMove) throw new Error('Permission denied');

    // Update database
    await this.updateCardPosition(cardId, targetColumnId, position);

    // Broadcast to board members
    socket.to(`board:${boardId}`).emit('card:moved', {
      cardId,
      sourceColumnId,
      targetColumnId,
      position,
      movedBy: socket.userId,
      timestamp: new Date()
    });
  }

  // Batch operations for better performance
  async batchBroadcast(boardId, events) {
    this.io.to(`board:${boardId}`).emit('batch:update', {
      events,
      timestamp: new Date()
    });
  }
}

module.exports = OptimizedSocketManager;
```

## CSS Performance Optimization

### Critical CSS & Lazy Loading
```css
/* styles/critical.css - Above-the-fold critical styles */
/* Only include styles needed for initial render */

/* Reset and base styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

/* Critical layout styles */
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  z-index: 1000;
}

.main-content {
  margin-top: 60px;
  min-height: calc(100vh - 60px);
}

/* Loading states */
.loading-skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

```javascript
// modules/utils/CSSLoader.js - Dynamic CSS loading
class CSSLoader {
  constructor() {
    this.loadedStyles = new Set();
  }

  async loadCSS(href, media = 'all') {
    if (this.loadedStyles.has(href)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.media = media;
      
      link.onload = () => {
        this.loadedStyles.add(href);
        resolve();
      };
      
      link.onerror = () => {
        reject(new Error(`Failed to load CSS: ${href}`));
      };

      document.head.appendChild(link);
    });
  }

  // Load non-critical CSS after page load
  async loadNonCriticalCSS() {
    const nonCriticalStyles = [
      '/styles/components.css',
      '/styles/animations.css',
      '/styles/themes.css'
    ];

    // Load after initial render
    requestIdleCallback(() => {
      nonCriticalStyles.forEach(href => {
        this.loadCSS(href).catch(error => 
          console.warn('Failed to load non-critical CSS:', error)
        );
      });
    });
  }

  // Preload CSS for better performance
  preloadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = () => {
      link.rel = 'stylesheet';
    };
    document.head.appendChild(link);
  }
}

export const cssLoader = new CSSLoader();
```

## Performance Monitoring

### Client-Side Performance Metrics
```javascript
// modules/utils/PerformanceMonitor.js - Client-side performance monitoring
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observer = null;
    this.setupPerformanceObserver();
  }

  setupPerformanceObserver() {
    if ('PerformanceObserver' in window) {
      this.observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.recordMetric(entry);
        });
      });

      // Observe different types of performance entries
      this.observer.observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint'] });
    }
  }

  recordMetric(entry) {
    switch (entry.entryType) {
      case 'navigation':
        this.recordNavigationMetrics(entry);
        break;
      case 'paint':
        this.recordPaintMetrics(entry);
        break;
      case 'largest-contentful-paint':
        this.recordLCPMetric(entry);
        break;
    }
  }

  recordNavigationMetrics(entry) {
    this.metrics.set('domContentLoaded', entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart);
    this.metrics.set('loadComplete', entry.loadEventEnd - entry.loadEventStart);
    this.metrics.set('domInteractive', entry.domInteractive - entry.navigationStart);
  }

  recordPaintMetrics(entry) {
    this.metrics.set(entry.name, entry.startTime);
  }

  recordLCPMetric(entry) {
    this.metrics.set('largestContentfulPaint', entry.startTime);
  }

  // Measure custom operations
  measureOperation(name, operation) {
    const start = performance.now();
    
    const result = operation();
    
    if (result instanceof Promise) {
      return result.then(value => {
        const duration = performance.now() - start;
        this.metrics.set(name, duration);
        return value;
      });
    } else {
      const duration = performance.now() - start;
      this.metrics.set(name, duration);
      return result;
    }
  }

  // Get Core Web Vitals
  getCoreWebVitals() {
    return {
      lcp: this.metrics.get('largestContentfulPaint'),
      fid: this.getFirstInputDelay(),
      cls: this.getCumulativeLayoutShift()
    };
  }

  getFirstInputDelay() {
    // Measure FID using PerformanceObserver
    return new Promise(resolve => {
      new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0];
        if (firstInput) {
          resolve(firstInput.processingStart - firstInput.startTime);
        }
      }).observe({ type: 'first-input', buffered: true });
    });
  }

  getCumulativeLayoutShift() {
    let cls = 0;
    new PerformanceObserver((list) => {
      list.getEntries().forEach(entry => {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      });
    }).observe({ type: 'layout-shift', buffered: true });
    return cls;
  }

  // Send metrics to analytics
  async sendMetrics() {
    const metrics = Object.fromEntries(this.metrics);
    const webVitals = this.getCoreWebVitals();
    
    try {
      await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics, webVitals })
      });
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
    }
  }
}

export const performanceMonitor = new PerformanceMonitor();
```