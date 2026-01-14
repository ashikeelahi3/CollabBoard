import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Socket.io authentication middleware
 */
export const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return next(new Error('Invalid token'));
    }

    socket.userId = user._id;
    socket.username = user.username;
    socket.userRole = user.role;
    
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
};

/**
 * Socket.io event handlers
 */
export const setupSocketHandlers = (io) => {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`User ${socket.username} connected: ${socket.id}`);

    // Join board room
    socket.on('board:join', (boardId) => {
      socket.join(`board:${boardId}`);
      socket.currentBoard = boardId;
      
      socket.to(`board:${boardId}`).emit('user:joined', {
        userId: socket.userId,
        username: socket.username
      });
      
      console.log(`${socket.username} joined board ${boardId}`);
    });

    // Leave board room
    socket.on('board:leave', (boardId) => {
      socket.leave(`board:${boardId}`);
      
      socket.to(`board:${boardId}`).emit('user:left', {
        userId: socket.userId,
        username: socket.username
      });
      
      console.log(`${socket.username} left board ${boardId}`);
    });

    // Card created
    socket.on('card:created', (data) => {
      socket.to(`board:${data.boardId}`).emit('card:created', {
        ...data,
        userId: socket.userId,
        username: socket.username
      });
    });

    // Card updated
    socket.on('card:updated', (data) => {
      socket.to(`board:${data.boardId}`).emit('card:updated', {
        ...data,
        userId: socket.userId,
        username: socket.username
      });
    });

    // Card moved
    socket.on('card:moved', (data) => {
      socket.to(`board:${data.boardId}`).emit('card:moved', {
        ...data,
        userId: socket.userId,
        username: socket.username
      });
    });

    // Column created
    socket.on('column:created', (data) => {
      socket.to(`board:${data.boardId}`).emit('column:created', {
        ...data,
        userId: socket.userId,
        username: socket.username
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (socket.currentBoard) {
        socket.to(`board:${socket.currentBoard}`).emit('user:left', {
          userId: socket.userId,
          username: socket.username
        });
      }
      console.log(`User ${socket.username} disconnected: ${socket.id}`);
    });
  });
};
