import express from 'express';
import Column from '../models/Column.js';
import Board from '../models/Board.js';
import Card from '../models/Card.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * @route   POST /api/columns
 * @desc    Create new column
 * @access  Private (Admin/Member)
 */
router.post('/', async (req, res) => {
  try {
    const { title, boardId } = req.body;

    if (!title || !boardId) {
      return res.status(400).json({ error: 'Title and boardId required' });
    }

    const board = await Board.findById(boardId);
    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot create columns' });
    }

    const column = new Column({ title, board: boardId });
    await column.save();

    res.status(201).json({ message: 'Column created', column });
  } catch (error) {
    console.error('Create column error:', error);
    res.status(500).json({ error: 'Failed to create column' });
  }
});

/**
 * @route   PUT /api/columns/:id
 * @desc    Update column
 * @access  Private (Admin/Member)
 */
router.put('/:id', async (req, res) => {
  try {
    const column = await Column.findById(req.params.id);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const board = await Board.findById(column.board);
    if (!board || !board.hasAccess(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const userRole = board.getUserRole(req.user._id);
    if (userRole === 'viewer') {
      return res.status(403).json({ error: 'Viewers cannot update columns' });
    }

    const { title, position } = req.body;
    if (title !== undefined) column.title = title;
    if (position !== undefined) column.position = position;

    await column.save();
    res.json({ message: 'Column updated', column });
  } catch (error) {
    console.error('Update column error:', error);
    res.status(500).json({ error: 'Failed to update column' });
  }
});

/**
 * @route   DELETE /api/columns/:id
 * @desc    Delete column (archive)
 * @access  Private (Admin only)
 */
router.delete('/:id', async (req, res) => {
  try {
    const column = await Column.findById(req.params.id);
    if (!column) {
      return res.status(404).json({ error: 'Column not found' });
    }

    const board = await Board.findById(column.board);
    if (!board || board.getUserRole(req.user._id) !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete columns' });
    }

    column.isArchived = true;
    await column.save();

    // Archive all cards in column
    await Card.updateMany(
      { column: column._id },
      { isArchived: true, archivedAt: new Date() }
    );

    res.json({ message: 'Column archived' });
  } catch (error) {
    console.error('Delete column error:', error);
    res.status(500).json({ error: 'Failed to delete column' });
  }
});

export default router;
