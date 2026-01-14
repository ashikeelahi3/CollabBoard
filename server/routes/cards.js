import express from 'express';
import Card from '../models/Card.js';
import Column from '../models/Column.js';
import Board from '../models/Board.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * @route   POST /api/cards
 * @desc    Create new card
 * @access  Private (Admin/Member)
 */
router.post('/', async (req, res) => {
  try {
    const { title, description, columnId, assignedTo, labels, dueDate, priority } = req.body;

    if (!title || !columnId) {
      return res.status(400).json({ error: 'Title and columnId required' });
    }

    const column = await Column.findById(columnId);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const board = await Board.findById(column.board);
    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create cards' });
    }

    const card = new Card({
      title,
      description,
      column: columnId,
      position: 0,
      assignedTo,
      labels,
      dueDate,
      priority,
      createdBy: req.user._id,
      history: [{
        action: 'created',
        user: req.user._id,
        timestamp: new Date()
      }]
    });

    await card.save();

    const populatedCard = await Card.findById(card._id)
      .populate('assignedTo', 'username email profile')
      .populate('createdBy', 'username');

    res.status(201).json({ message: 'Card created', card: populatedCard });
  } catch (error) {
    console.error('Create card error:', error);
    res.status(500).json({ error: 'Failed to create card' });
  }
});

/**
 * @route   GET /api/cards/:id
 * @desc    Get card details
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id)
      .populate('assignedTo', 'username email profile')
      .populate('createdBy', 'username')
      .populate('comments.author', 'username profile');

    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const column = await Column.findById(card.column);
    const board = await Board.findById(column.board);

    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ card });
  } catch (error) {
    console.error('Get card error:', error);
    res.status(500).json({ error: 'Failed to fetch card' });
  }
});

/**
 * @route   PUT /api/cards/:id
 * @desc    Update card
 * @access  Private (Admin/Member)
 */
router.put('/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const column = await Column.findById(card.column);
    const board = await Board.findById(column.board);

    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update cards' });
    }

    const { title, description, assignedTo, labels, dueDate, priority, checklist } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (labels !== undefined) updates.labels = labels;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (priority !== undefined) updates.priority = priority;
    if (checklist !== undefined) updates.checklist = checklist;

    Object.assign(card, updates);
    card.history.push({
      action: 'updated',
      user: req.user._id,
      timestamp: new Date(),
      details: { fields: Object.keys(updates) }
    });

    await card.save();

    const updatedCard = await Card.findById(card._id)
      .populate('assignedTo', 'username email profile')
      .populate('createdBy', 'username');

    res.json({ message: 'Card updated', card: updatedCard });
  } catch (error) {
    console.error('Update card error:', error);
    res.status(500).json({ error: 'Failed to update card' });
  }
});

/**
 * @route   PUT /api/cards/:id/move
 * @desc    Move card to different column/position
 * @access  Private (Admin/Member)
 */
router.put('/:id/move', async (req, res) => {
  try {
    const { targetColumnId, position } = req.body;

    if (!targetColumnId || position === undefined) {
      return res.status(400).json({ error: 'targetColumnId and position required' });
    }

    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const sourceColumn = await Column.findById(card.column);
    const targetColumn = await Column.findById(targetColumnId);

    if (!targetColumn) {
      return res.status(404).json({ error: 'Target column not found' });
    }

    const board = await Board.findById(targetColumn.board);
    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot move cards' });
    }

    const oldColumnId = card.column.toString();
    card.column = targetColumnId;
    card.position = position;
    card.history.push({
      action: 'moved',
      user: req.user._id,
      timestamp: new Date(),
      details: { from: oldColumnId, to: targetColumnId }
    });

    await card.save();

    // Recalculate positions in both columns
    await recalculatePositions(oldColumnId);
    await recalculatePositions(targetColumnId);

    res.json({ message: 'Card moved', card });
  } catch (error) {
    console.error('Move card error:', error);
    res.status(500).json({ error: 'Failed to move card' });
  }
});

/**
 * @route   DELETE /api/cards/:id
 * @desc    Delete card (archive)
 * @access  Private (Admin/Member)
 */
router.delete('/:id', async (req, res) => {
  try {
    const card = await Card.findById(req.params.id);
    if (!card) {
      return res.status(404).json({ error: 'Card not found' });
    }

    const column = await Column.findById(card.column);
    const board = await Board.findById(column.board);

    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot delete cards' });
    }

    card.isArchived = true;
    card.archivedAt = new Date();
    card.history.push({
      action: 'archived',
      user: req.user._id,
      timestamp: new Date()
    });

    await card.save();
    res.json({ message: 'Card archived' });
  } catch (error) {
    console.error('Delete card error:', error);
    res.status(500).json({ error: 'Failed to delete card' });
  }
});

/**
 * Helper: Recalculate card positions in a column
 */
async function recalculatePositions(columnId) {
  const cards = await Card.find({ 
    column: columnId, 
    isArchived: false 
  }).sort({ position: 1 });

  for (let i = 0; i < cards.length; i++) {
    if (cards[i].position !== i) {
      cards[i].position = i;
      await cards[i].save();
    }
  }
}

export default router;
