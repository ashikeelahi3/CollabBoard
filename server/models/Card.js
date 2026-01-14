import mongoose from 'mongoose';

/**
 * Card Schema with full metadata and history tracking
 */
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
  timestamp: {
    type: Date,
    default: Date.now
  },
  details: {
    from: mongoose.Schema.Types.Mixed,
    to: mongoose.Schema.Types.Mixed,
    field: String
  }
});

const checklistSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    maxlength: 200
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completedAt: Date
});

const cardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Card title is required'],
    trim: true,
    maxlength: [200, 'Card title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
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
  checklist: [checklistSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  history: [historySchema],
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
cardSchema.index({ column: 1, position: 1 });
cardSchema.index({ column: 1, isArchived: 1, position: 1 });
cardSchema.index({ assignedTo: 1, dueDate: 1 });
cardSchema.index({ createdBy: 1, createdAt: -1 });
cardSchema.index({ dueDate: 1, isArchived: 1 });

// Virtual for completion percentage
cardSchema.virtual('completionPercentage').get(function() {
  if (!this.checklist || this.checklist.length === 0) return 0;
  const completed = this.checklist.filter(item => item.completed).length;
  return Math.round((completed / this.checklist.length) * 100);
});

// Pre-save middleware for position management
cardSchema.pre('save', async function(next) {
  if (this.isNew && this.position === undefined) {
    try {
      const maxPosition = await this.constructor.findOne(
        { column: this.column, isArchived: false },
        { position: 1 }
      ).sort({ position: -1 });
      
      this.position = maxPosition ? maxPosition.position + 1 : 0;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Method to add history entry
cardSchema.methods.addHistory = function(action, userId, details = {}) {
  this.history.push({
    action,
    user: userId,
    details
  });
};

// Static method to reorder positions within column
cardSchema.statics.reorderPositions = async function(columnId) {
  const cards = await this.find({ 
    column: columnId, 
    isArchived: false 
  }).sort({ position: 1 });
  
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].position !== i) {
      cards[i].position = i;
      await cards[i].save();
    }
  }
};

export default mongoose.model('Card', cardSchema);