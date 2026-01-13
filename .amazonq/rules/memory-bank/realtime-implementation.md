# Real-Time Implementation Guide

## WebSocket Architecture with Socket.io

### Client-Side Socket Management
```javascript
// socket.js - Client socket manager
class SocketManager {
  constructor() {
    this.socket = null;
    this.boardId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(boardId, token) {
    this.boardId = boardId;
    this.socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });
    
    this.setupEventHandlers();
    this.joinBoard(boardId);
  }

  setupEventHandlers() {
    this.socket.on('card:moved', this.handleCardMoved.bind(this));
    this.socket.on('card:created', this.handleCardCreated.bind(this));
    this.socket.on('card:updated', this.handleCardUpdated.bind(this));
    this.socket.on('user:joined', this.handleUserJoined.bind(this));
    this.socket.on('disconnect', this.handleDisconnect.bind(this));
  }

  emitCardMove(cardId, sourceColumnId, targetColumnId, position) {
    this.socket.emit('card:move', {
      cardId,
      sourceColumnId,
      targetColumnId,
      position,
      boardId: this.boardId
    });
  }
}
```

### Server-Side Socket Handlers
```javascript
// socket/handlers.js - Server socket event handlers
const socketAuth = require('../middleware/socketAuth');

module.exports = (io) => {
  io.use(socketAuth); // JWT verification for socket connections

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected`);

    socket.on('board:join', async (boardId) => {
      // Verify user has access to board
      const hasAccess = await checkBoardAccess(socket.userId, boardId);
      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      socket.join(boardId);
      socket.boardId = boardId;
      
      // Notify other users
      socket.to(boardId).emit('user:joined', {
        userId: socket.userId,
        username: socket.username
      });
    });

    socket.on('card:move', async (data) => {
      try {
        // Validate move operation
        const canMove = await validateCardMove(socket.userId, data);
        if (!canMove) {
          socket.emit('error', { message: 'Move not allowed' });
          return;
        }

        // Update database
        const updatedCard = await moveCard(data);
        
        // Broadcast to all users in the board
        io.to(data.boardId).emit('card:moved', {
          cardId: data.cardId,
          sourceColumnId: data.sourceColumnId,
          targetColumnId: data.targetColumnId,
          position: data.position,
          movedBy: socket.userId,
          timestamp: new Date()
        });

      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('disconnect', () => {
      if (socket.boardId) {
        socket.to(socket.boardId).emit('user:left', {
          userId: socket.userId
        });
      }
    });
  });
};
```

## Real-Time Event Types

### Card Operations
- `card:move` - Card moved between columns
- `card:created` - New card added
- `card:updated` - Card details modified
- `card:deleted` - Card removed

### User Presence
- `user:joined` - User joined board
- `user:left` - User left board
- `user:typing` - User typing in card description

### Board Operations
- `board:updated` - Board settings changed
- `column:created` - New column added
- `column:deleted` - Column removed

## Conflict Resolution Strategy

### Optimistic Updates
1. Update UI immediately for better UX
2. Send operation to server
3. If server rejects, revert UI changes
4. Show error message to user

### Last-Write-Wins with Timestamps
```javascript
// Conflict resolution for concurrent card moves
const resolveCardMoveConflict = (localMove, serverMove) => {
  if (serverMove.timestamp > localMove.timestamp) {
    // Server move is newer, accept it
    return serverMove;
  }
  // Local move is newer or same time, keep local
  return localMove;
};
```

### Position Recalculation
```javascript
// Ensure consistent card positions after moves
const recalculatePositions = async (columnId) => {
  const cards = await Card.find({ column: columnId }).sort({ position: 1 });
  
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].position !== i) {
      cards[i].position = i;
      await cards[i].save();
    }
  }
};
```