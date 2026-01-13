# Database Design & Optimization

## MongoDB Schema Design Principles

### Document Structure Strategy
- **Embed vs Reference**: Cards embedded in columns for atomic operations, users referenced for normalization
- **Denormalization**: User info cached in cards for quick display
- **Indexing Strategy**: Compound indexes for common query patterns
- **Sharding Key**: Board ID for horizontal scaling

### Optimized Mongoose Schemas

#### User Schema with Indexing
```javascript
// models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'member', 'viewer'],
    default: 'member'
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    timezone: { type: String, default: 'UTC' }
  },
  preferences: {
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
    notifications: { type: Boolean, default: true }
  },
  lastActive: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { 
    transform: (doc, ret) => {
      delete ret.password;
      return ret;
    }
  }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ lastActive: -1 });
userSchema.index({ 'profile.firstName': 1, 'profile.lastName': 1 });

module.exports = mongoose.model('User', userSchema);
```

#### Board Schema with Member Management
```javascript
// models/Board.js
const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'member', 'viewer'],
    default: 'member'
  },
  joinedAt: { type: Date, default: Date.now },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

const boardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [memberSchema],
  settings: {
    isPublic: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: true },
    cardLimit: { type: Number, default: 1000 }
  },
  background: {
    type: { type: String, enum: ['color', 'image'], default: 'color' },
    value: { type: String, default: '#0079bf' }
  },
  isArchived: { type: Boolean, default: false },
  archivedAt: Date
}, {
  timestamps: true
});

// Compound indexes for efficient queries
boardSchema.index({ owner: 1, createdAt: -1 });
boardSchema.index({ 'members.user': 1 });
boardSchema.index({ isArchived: 1, updatedAt: -1 });
boardSchema.index({ title: 'text', description: 'text' });

// Virtual for member count
boardSchema.virtual('memberCount').get(function() {
  return this.members.length + 1; // +1 for owner
});

module.exports = mongoose.model('Board', boardSchema);
```

#### Column Schema with Position Management
```javascript
// models/Column.js
const mongoose = require('mongoose');

const columnSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  board: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board',
    required: true
  },
  position: {
    type: Number,
    required: true,
    min: 0
  },
  settings: {
    cardLimit: { type: Number, default: 100 },
    isCollapsed: { type: Boolean, default: false }
  },
  isArchived: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Ensure unique positions within a board
columnSchema.index({ board: 1, position: 1 }, { unique: true });
columnSchema.index({ board: 1, isArchived: 1, position: 1 });

// Pre-save middleware to manage positions
columnSchema.pre('save', async function(next) {
  if (this.isNew) {
    const maxPosition = await this.constructor.findOne(
      { board: this.board, isArchived: false },
      { position: 1 }
    ).sort({ position: -1 });
    
    this.position = maxPosition ? maxPosition.position + 1 : 0;
  }
  next();
});

module.exports = mongoose.model('Column', columnSchema);
```

#### Card Schema with Rich Metadata
```javascript
// models/Card.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
  isEdited: { type: Boolean, default: false }
});

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimeType: String,
  size: Number,
  url: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  uploadedAt: { type: Date, default: Date.now }
});

const historySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['created', 'moved', 'updated', 'archived', 'restored'],
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  details: {
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    field: String
  }
});

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 2000
  },
  column: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Column',
    required: true
  },
  position: {
    type: Number,
    required: true,
    min: 0
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  labels: [{
    name: String,
    color: String
  }],
  dueDate: Date,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  checklist: [{
    text: String,
    completed: { type: Boolean, default: false },
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    completedAt: Date
  }],
  comments: [commentSchema],
  attachments: [attachmentSchema],
  history: [historySchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isArchived: { type: Boolean, default: false },
  archivedAt: Date
}, {
  timestamps: true
});

// Compound indexes for efficient queries
cardSchema.index({ column: 1, position: 1 });
cardSchema.index({ column: 1, isArchived: 1, position: 1 });
cardSchema.index({ assignedTo: 1, dueDate: 1 });
cardSchema.index({ createdBy: 1, createdAt: -1 });
cardSchema.index({ dueDate: 1, isArchived: 1 });
cardSchema.index({ title: 'text', description: 'text' });

// Virtual for completion percentage
cardSchema.virtual('completionPercentage').get(function() {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const completed = this.checklist.filter(item => item.completed).length;
  return Math.round((completed / this.checklist.length) * 100);
});

module.exports = mongoose.model('Card', cardSchema);
```

## Query Optimization Strategies

### Efficient Data Fetching
```javascript
// Optimized board loading with populated data
const getBoardWithDetails = async (boardId, userId) => {
  const board = await Board.findById(boardId)
    .populate('owner', 'username email profile.avatar')
    .populate('members.user', 'username profile.avatar')
    .lean(); // Use lean() for read-only operations

  if (!board) throw new Error('Board not found');

  // Check user access
  const hasAccess = board.owner._id.toString() === userId.toString() ||
    board.members.some(member => member.user._id.toString() === userId.toString());

  if (!hasAccess) throw new Error('Access denied');

  // Get columns with cards in a single query
  const columns = await Column.find({ 
    board: boardId, 
    isArchived: false 
  })
  .sort({ position: 1 })
  .lean();

  // Get all cards for the board
  const columnIds = columns.map(col => col._id);
  const cards = await Card.find({ 
    column: { $in: columnIds }, 
    isArchived: false 
  })
  .populate('assignedTo', 'username profile.avatar')
  .populate('createdBy', 'username')
  .sort({ position: 1 })
  .lean();

  // Group cards by column
  const cardsByColumn = cards.reduce((acc, card) => {
    const columnId = card.column.toString();
    if (!acc[columnId]) acc[columnId] = [];
    acc[columnId].push(card);
    return acc;
  }, {});

  // Attach cards to columns
  columns.forEach(column => {
    column.cards = cardsByColumn[column._id.toString()] || [];
  });

  return { ...board, columns };
};
```

### Aggregation Pipelines for Analytics
```javascript
// Board analytics aggregation
const getBoardAnalytics = async (boardId) => {
  const analytics = await Card.aggregate([
    { $match: { 
      column: { $in: await getColumnIds(boardId) },
      isArchived: false 
    }},
    {
      $group: {
        _id: '$column',
        totalCards: { $sum: 1 },
        completedCards: {
          $sum: {
            $cond: [
              { $eq: ['$completionPercentage', 100] },
              1,
              0
            ]
          }
        },
        overdueTasks: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$dueDate', null] },
                { $lt: ['$dueDate', new Date()] }
              ]},
              1,
              0
            ]
          }
        },
        avgCompletionTime: {
          $avg: {
            $subtract: ['$updatedAt', '$createdAt']
          }
        }
      }
    },
    {
      $lookup: {
        from: 'columns',
        localField: '_id',
        foreignField: '_id',
        as: 'columnInfo'
      }
    }
  ]);

  return analytics;
};
```

## Performance Optimization

### Database Connection Optimization
```javascript
// config/database.js - Optimized MongoDB connection
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pool settings
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      
      // Performance optimizations
      bufferCommands: false,
      bufferMaxEntries: 0,
      
      // Write concern for consistency
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 1000
      }
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Monitor connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
```

### Caching Strategy
```javascript
// utils/cache.js - Redis caching for frequently accessed data
const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL);

class CacheManager {
  constructor() {
    this.defaultTTL = 300; // 5 minutes
  }

  async get(key) {
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  async set(key, data, ttl = this.defaultTTL) {
    try {
      await client.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  async del(key) {
    try {
      await client.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  // Cache board data
  async cacheBoard(boardId, boardData) {
    await this.set(`board:${boardId}`, boardData, 600); // 10 minutes
  }

  async getCachedBoard(boardId) {
    return await this.get(`board:${boardId}`);
  }

  // Invalidate related caches
  async invalidateBoardCache(boardId) {
    await this.del(`board:${boardId}`);
    await this.del(`board:${boardId}:analytics`);
  }
}

module.exports = new CacheManager();
```

### Batch Operations for Performance
```javascript
// utils/batchOperations.js - Efficient bulk operations
class BatchOperations {
  static async reorderCards(columnId, cardUpdates) {
    const bulkOps = cardUpdates.map(update => ({
      updateOne: {
        filter: { _id: update.cardId },
        update: { position: update.newPosition }
      }
    }));

    return await Card.bulkWrite(bulkOps);
  }

  static async moveMultipleCards(cardIds, targetColumnId) {
    return await Card.updateMany(
      { _id: { $in: cardIds } },
      { 
        column: targetColumnId,
        $push: {
          history: {
            action: 'moved',
            user: req.user._id,
            timestamp: new Date(),
            details: { to: targetColumnId }
          }
        }
      }
    );
  }

  static async archiveBoard(boardId) {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // Archive board
        await Board.updateOne(
          { _id: boardId },
          { isArchived: true, archivedAt: new Date() },
          { session }
        );

        // Archive all columns
        await Column.updateMany(
          { board: boardId },
          { isArchived: true },
          { session }
        );

        // Archive all cards
        const columns = await Column.find({ board: boardId }).session(session);
        const columnIds = columns.map(col => col._id);
        
        await Card.updateMany(
          { column: { $in: columnIds } },
          { isArchived: true, archivedAt: new Date() },
          { session }
        );
      });
    } finally {
      await session.endSession();
    }
  }
}

module.exports = BatchOperations;
```