import mongoose from 'mongoose';

/**
 * Board Schema for Kanban boards with member management
 */
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
  joinedAt: {
    type: Date,
    default: Date.now
  }
});

const boardSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Board title is required'],
    trim: true,
    maxlength: [100, 'Board title cannot exceed 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [memberSchema],
  settings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    allowComments: {
      type: Boolean,
      default: true
    }
  },
  background: {
    type: String,
    default: '#0079bf'
  },
  isArchived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
boardSchema.index({ owner: 1, createdAt: -1 });
boardSchema.index({ 'members.user': 1 });
boardSchema.index({ isArchived: 1, updatedAt: -1 });

// Virtual for member count
boardSchema.virtual('memberCount').get(function() {
  return this.members.length + 1; // +1 for owner
});

// Check if user has access to board
boardSchema.methods.hasAccess = function(userId) {
  const ownerId = this.owner._id || this.owner;
  return ownerId.toString() === userId.toString() ||
         this.members.some(member => {
           const memberId = member.user._id || member.user;
           return memberId.toString() === userId.toString();
         });
};

// Get user role in board
boardSchema.methods.getUserRole = function(userId) {
  const ownerId = this.owner._id || this.owner;
  if (ownerId.toString() === userId.toString()) {
    return 'admin';
  }
  
  const member = this.members.find(member => {
    const memberId = member.user._id || member.user;
    return memberId.toString() === userId.toString();
  });
  
  return member ? member.role : null;
};

export default mongoose.model('Board', boardSchema);