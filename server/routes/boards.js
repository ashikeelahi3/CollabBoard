import express from 'express';
import Board from '../models/Board.js';
import Column from '../models/Column.js';
import Card from '../models/Card.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/boards
 * @desc    Get all boards for authenticated user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const boards = await Board.find({
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ],
      isArchived: false
    })
    .populate('owner', 'username email')
    .sort({ updatedAt: -1 });

    res.json({ boards });
  } catch (error) {
    console.error('Get boards error:', error);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

/**
 * @route   POST /api/boards
 * @desc    Create new board
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, background } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Board title is required' });
    }

    const board = new Board({
      title: title.trim(),
      description: description?.trim(),
      background: background || '#0079bf',
      owner: req.user._id
    });

    await board.save();

    // Create default columns
    const defaultColumns = [
      { title: 'To Do', board: board._id, position: 0 },
      { title: 'In Progress', board: board._id, position: 1 },
      { title: 'Done', board: board._id, position: 2 }
    ];

    await Column.insertMany(defaultColumns);

    const populatedBoard = await Board.findById(board._id)
      .populate('owner', 'username email');

    res.status(201).json({
      message: 'Board created successfully',
      board: populatedBoard
    });
  } catch (error) {
    console.error('Create board error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }

    res.status(500).json({ error: 'Failed to create board' });
  }
});

/**
 * @route   GET /api/boards/:id
 * @desc    Get board by ID with columns and cards
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id)
      .populate('owner', 'username email profile')
      .populate('members.user', 'username email profile');

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check access
    if (!board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied to this board' });
    }

    // Get columns with cards
    const columns = await Column.find({ 
      board: board._id, 
      isArchived: false 
    })
    .sort({ position: 1 });

    const columnIds = columns.map(col => col._id);
    const cards = await Card.find({ 
      column: { $in: columnIds }, 
      isArchived: false 
    })
    .populate('assignedTo', 'username email profile')
    .populate('createdBy', 'username')
    .sort({ position: 1 });

    // Group cards by column
    const columnsWithCards = columns.map(column => ({
      ...column.toObject(),
      cards: cards.filter(card => card.column.toString() === column._id.toString())
    }));

    res.json({
      board: {
        ...board.toObject(),
        userRole: board.getUserRole(req.user._id)
      },
      columns: columnsWithCards
    });
  } catch (error) {
    console.error('Get board error:', error);
    res.status(500).json({ error: 'Failed to fetch board' });
  }
});

/**
 * @route   PUT /api/boards/:id
 * @desc    Update board
 * @access  Private (Admin/Owner only)
 */
router.put('/:id', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user is owner or admin
    const userRole = board.getUserRole(req.user._id);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only board admins can update board settings' });
    }

    const { title, description, background, settings } = req.body;

    if (title !== undefined) board.title = title.trim();
    if (description !== undefined) board.description = description?.trim();
    if (background !== undefined) board.background = background;
    if (settings !== undefined) board.settings = { ...board.settings, ...settings };

    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate('owner', 'username email')
      .populate('members.user', 'username email');

    res.json({
      message: 'Board updated successfully',
      board: updatedBoard
    });
  } catch (error) {
    console.error('Update board error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: messages.join(', ') });
    }

    res.status(500).json({ error: 'Failed to update board' });
  }
});

/**
 * @route   DELETE /api/boards/:id
 * @desc    Delete board (archive)
 * @access  Private (Owner only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Only owner can delete
    if (board.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only board owner can delete the board' });
    }

    board.isArchived = true;
    board.archivedAt = new Date();
    await board.save();

    res.json({ message: 'Board archived successfully' });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({ error: 'Failed to delete board' });
  }
});

/**
 * @route   POST /api/boards/:id/members
 * @desc    Add member to board
 * @access  Private (Admin only)
 */
router.post('/:id/members', async (req, res) => {
  try {
    const { email, role } = req.body;
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user is admin
    const userRole = board.getUserRole(req.user._id);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    // Find user by email
    const User = (await import('../models/User.js')).default;
    const userToAdd = await User.findOne({ email });
    
    if (!userToAdd) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if user already a member
    if (board.members.some(m => m.user.toString() === userToAdd._id.toString())) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    board.members.push({
      user: userToAdd._id,
      role: role || 'member'
    });

    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate('members.user', 'username email');

    res.json({
      message: 'Member added successfully',
      board: updatedBoard
    });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

/**
 * @route   PUT /api/boards/:id/members/:userId
 * @desc    Update member role
 * @access  Private (Admin only)
 */
router.put('/:id/members/:userId', async (req, res) => {
  try {
    const { role } = req.body;
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user is admin
    const userRole = board.getUserRole(req.user._id);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update member roles' });
    }

    // Find member
    const member = board.members.find(m => m.user.toString() === req.params.userId);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Update role
    member.role = role;
    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate('members.user', 'username email');

    res.json({
      message: 'Member role updated successfully',
      board: updatedBoard
    });
  } catch (error) {
    console.error('Update member error:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

/**
 * @route   DELETE /api/boards/:id/members/:userId
 * @desc    Remove member from board
 * @access  Private (Admin only)
 */
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const board = await Board.findById(req.params.id);

    if (!board) {
      return res.status(404).json({ error: 'Board not found' });
    }

    // Check if user is admin
    const userRole = board.getUserRole(req.user._id);
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    // Cannot remove owner
    if (board.owner.toString() === req.params.userId) {
      return res.status(400).json({ error: 'Cannot remove board owner' });
    }

    // Remove member
    board.members = board.members.filter(m => m.user.toString() !== req.params.userId);
    await board.save();

    const updatedBoard = await Board.findById(board._id)
      .populate('members.user', 'username email');

    res.json({
      message: 'Member removed successfully',
      board: updatedBoard
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;