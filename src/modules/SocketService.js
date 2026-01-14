/**
 * SocketService - Client-side Socket.io management
 */
class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentBoard = null;
  }

  /**
   * Connect to Socket.io server
   */
  connect() {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      console.error('No auth token for socket connection');
      return;
    }

    this.socket = io({
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.connected = true;
      
      // Rejoin board if was in one
      if (this.currentBoard) {
        this.joinBoard(this.currentBoard);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
  }

  /**
   * Join board room
   */
  joinBoard(boardId) {
    if (!this.socket || !this.connected) {
      console.error('Socket not connected');
      return;
    }

    this.currentBoard = boardId;
    this.socket.emit('board:join', boardId);
    console.log('Joined board:', boardId);
  }

  /**
   * Leave board room
   */
  leaveBoard(boardId) {
    if (!this.socket || !this.connected) return;

    this.socket.emit('board:leave', boardId);
    this.currentBoard = null;
    console.log('Left board:', boardId);
  }

  /**
   * Emit card created event
   */
  emitCardCreated(boardId, card) {
    if (!this.socket || !this.connected) return;
    
    this.socket.emit('card:created', { boardId, card });
  }

  /**
   * Emit card updated event
   */
  emitCardUpdated(boardId, cardId, updates) {
    if (!this.socket || !this.connected) return;
    
    this.socket.emit('card:updated', { boardId, cardId, updates });
  }

  /**
   * Emit card moved event
   */
  emitCardMoved(boardId, cardId, sourceColumnId, targetColumnId, position) {
    if (!this.socket || !this.connected) return;
    
    this.socket.emit('card:moved', {
      boardId,
      cardId,
      sourceColumnId,
      targetColumnId,
      position
    });
  }

  /**
   * Emit column created event
   */
  emitColumnCreated(boardId, column) {
    if (!this.socket || !this.connected) return;
    
    this.socket.emit('column:created', { boardId, column });
  }

  /**
   * Listen to event
   */
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.currentBoard = null;
    }
  }
}

export const socketService = new SocketService();
