import mongoose from 'mongoose';

/**
 * Column Schema for organizing cards in boards
 */
const columnSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Column title is required'],
    trim: true,
    maxlength: [50, 'Column title cannot exceed 50 characters']
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
    cardLimit: {
      type: Number,
      default: 100
    },
    isCollapsed: {
      type: Boolean,
      default: false
    }
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance and uniqueness
columnSchema.index({ board: 1, position: 1 });
columnSchema.index({ board: 1, isArchived: 1, position: 1 });

// Pre-save middleware to manage positions
columnSchema.pre('save', async function(next) {
  if (this.isNew && this.position === undefined) {
    try {
      const maxPosition = await this.constructor.findOne(
        { board: this.board, isArchived: false },
        { position: 1 }
      ).sort({ position: -1 });
      
      this.position = maxPosition ? maxPosition.position + 1 : 0;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Static method to reorder positions
columnSchema.statics.reorderPositions = async function(boardId) {
  const columns = await this.find({ 
    board: boardId, 
    isArchived: false 
  }).sort({ position: 1 });
  
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].position !== i) {
      columns[i].position = i;
      await columns[i].save();
    }
  }
};

export default mongoose.model('Column', columnSchema);