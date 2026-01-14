/**
 * Board Component - Displays board with columns and cards
 */
import { stateManager } from './StateManager.js';
import { eventBus, EVENTS } from './EventBus.js';
import { apiClient } from './ApiClient.js';
import { socketService } from './SocketService.js';

export class Board {
  constructor(boardId) {
    this.boardId = boardId;
    this.board = null;
    this.columns = [];
  }

  async load() {
    try {
      stateManager.set('ui.loading', true);
      const data = await apiClient.get(`/boards/${this.boardId}`);
      
      this.board = data.board;
      this.columns = data.columns;
      
      stateManager.set('currentBoard', this.board);
      stateManager.set('columns', this.columns);
      
      // Join socket room
      socketService.joinBoard(this.boardId);
      this.setupSocketListeners();
      
      this.render();
    } catch (error) {
      console.error('Load board error:', error);
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message, 
        type: 'error' 
      });
    } finally {
      stateManager.set('ui.loading', false);
    }
  }

  render() {
    const container = document.getElementById('board-view');
    
    // Calculate total members (owner + members array)
    const totalMembers = 1 + (this.board.members?.length || 0);
    
    container.innerHTML = `
      <div class="board-header">
        <div class="board-info">
          <button class="btn-back" id="back-to-dashboard">← Back</button>
          <h2>${this.board.title}</h2>
          <span class="board-role">${this.board.userRole}</span>
          <span class="board-members">👥 ${totalMembers} member${totalMembers !== 1 ? 's' : ''}</span>
        </div>
        <div class="board-actions">
          ${this.board.userRole === 'admin' ? 
            '<button class="btn btn-secondary" id="add-member-btn">+ Add Member</button>' : 
            ''}
          ${this.board.userRole !== 'viewer' ? 
            '<button class="btn btn-primary" id="add-column-btn">+ Add Column</button>' : 
            ''}
        </div>
      </div>
      <div class="board-columns" id="board-columns">
        ${this.columns.map(col => this.renderColumn(col)).join('')}
      </div>
    `;

    this.attachEventListeners();
  }

  renderColumn(column) {
    const canEdit = this.board.userRole !== 'viewer';
    const isAdmin = this.board.userRole === 'admin';
    
    return `
      <div class="column" data-column-id="${column._id}">
        <div class="column-header">
          <h3>${column.title}</h3>
          <div class="column-header-actions">
            <span class="card-count">${column.cards?.length || 0}</span>
            ${isAdmin ? `
              <button class="btn-icon" data-action="edit-column" data-column-id="${column._id}" title="Edit column">✏️</button>
              <button class="btn-icon" data-action="delete-column" data-column-id="${column._id}" title="Delete column">🗑️</button>
            ` : ''}
          </div>
        </div>
        <div class="column-cards" data-column-id="${column._id}">
          ${column.cards?.map(card => this.renderCard(card)).join('') || ''}
        </div>
        ${canEdit ? `
          <button class="btn-add-card" data-column-id="${column._id}">
            + Add Card
          </button>
        ` : ''}
      </div>
    `;
  }

  renderCard(card) {
    const canEdit = this.board.userRole !== 'viewer';
    return `
      <div class="card" data-card-id="${card._id}" draggable="${canEdit}">
        <div class="card-content">
          <div class="card-header-row">
            <h4>${card.title}</h4>
            ${canEdit ? `
              <div class="card-actions">
                <button class="btn-icon" onclick="event.stopPropagation()" data-action="edit" data-card-id="${card._id}" title="Edit card">✏️</button>
                <button class="btn-icon" onclick="event.stopPropagation()" data-action="delete" data-card-id="${card._id}" title="Delete card">🗑️</button>
              </div>
            ` : ''}
          </div>
          ${card.description ? `<p>${card.description.substring(0, 100)}${card.description.length > 100 ? '...' : ''}</p>` : ''}
          <div class="card-meta">
            ${card.assignedTo?.length ? `
              <span class="card-assignee">👤 ${card.assignedTo[0].username}</span>
            ` : ''}
            ${card.dueDate ? `
              <span class="card-due">📅 ${new Date(card.dueDate).toLocaleDateString()}</span>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    // Back button
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
      backBtn.onclick = () => {
        socketService.leaveBoard(this.boardId);
        this.cleanupSocketListeners();
        document.getElementById('board-view').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.querySelector('.app-header').style.display = 'block';
      };
    }

    // Add member button
    const addMemberBtn = document.getElementById('add-member-btn');
    if (addMemberBtn) {
      addMemberBtn.onclick = () => this.showAddMemberModal();
    }

    // Add column button
    const addColumnBtn = document.getElementById('add-column-btn');
    if (addColumnBtn) {
      addColumnBtn.onclick = () => this.showAddColumnModal();
    }

    // Add card buttons
    document.querySelectorAll('.btn-add-card').forEach(btn => {
      btn.onclick = (e) => {
        const columnId = e.target.dataset.columnId;
        this.showAddCardModal(columnId);
      };
    });

    // Setup drag and drop
    this.setupDragAndDrop();

    // Card action buttons
    document.querySelectorAll('.card-actions button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const cardId = btn.dataset.cardId;
        
        if (action === 'edit') {
          this.showEditCardModal(cardId);
        } else if (action === 'delete') {
          this.deleteCard(cardId);
        }
      });
    });

    // Column action buttons
    document.querySelectorAll('.column-header-actions button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const columnId = btn.dataset.columnId;
        
        if (action === 'edit-column') {
          this.showEditColumnModal(columnId);
        } else if (action === 'delete-column') {
          this.deleteColumn(columnId);
        }
      });
    });
  }

  setupDragAndDrop() {
    if (this.board.userRole === 'viewer') return;

    // Card drag events
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('dragstart', this.handleDragStart.bind(this));
      card.addEventListener('dragend', this.handleDragEnd.bind(this));
    });

    // Column drop zone events
    document.querySelectorAll('.column-cards').forEach(zone => {
      zone.addEventListener('dragover', this.handleDragOver.bind(this));
      zone.addEventListener('drop', this.handleDrop.bind(this));
      zone.addEventListener('dragenter', this.handleDragEnter.bind(this));
      zone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    });
  }

  handleDragStart(e) {
    const card = e.target.closest('.card');
    if (!card) return;

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.cardId);
    
    card.classList.add('dragging');
    this.draggedCard = card;
  }

  handleDragEnd(e) {
    const card = e.target.closest('.card');
    if (card) {
      card.classList.remove('dragging');
    }
    
    document.querySelectorAll('.column-cards').forEach(zone => {
      zone.classList.remove('drag-over');
    });
    
    this.draggedCard = null;
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  handleDragEnter(e) {
    const zone = e.target.closest('.column-cards');
    if (zone) {
      zone.classList.add('drag-over');
    }
  }

  handleDragLeave(e) {
    const zone = e.target.closest('.column-cards');
    if (zone && !zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  }

  async handleDrop(e) {
    e.preventDefault();
    
    const zone = e.target.closest('.column-cards');
    if (!zone) return;

    zone.classList.remove('drag-over');

    const cardId = e.dataTransfer.getData('text/plain');
    const targetColumnId = zone.dataset.columnId;
    
    // Find source column
    const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
    const sourceColumnId = cardElement.closest('.column-cards').dataset.columnId;

    // Don't move if same column
    if (sourceColumnId === targetColumnId) return;

    // Calculate position
    const cards = Array.from(zone.querySelectorAll('.card:not(.dragging)'));
    const position = cards.length;

    try {
      // Move card via API
      await apiClient.put(`/cards/${cardId}/move`, {
        targetColumnId,
        position
      });

      // Emit socket event
      socketService.socket.emit('card:moved', {
        cardId,
        sourceColumnId,
        targetColumnId,
        position,
        boardId: this.boardId
      });

      // Reload board
      await this.load();

      eventBus.emit(EVENTS.NOTIFICATION, {
        message: 'Card moved successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Move card error:', error);
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: error.message || 'Failed to move card',
        type: 'error'
      });
    }
  }

  showAddMemberModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Add Member</h2>
        <form id="add-member-form">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="member-email" required placeholder="user@example.com">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select id="member-role" required>
              <option value="viewer">Viewer (Read-only)</option>
              <option value="member" selected>Member (Can edit)</option>
              <option value="admin">Admin (Full access)</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-member">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Member</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.getElementById('cancel-member').onclick = () => modal.remove();

    document.getElementById('add-member-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.addMember();
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  showAddColumnModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Add Column</h2>
        <form id="add-column-form">
          <div class="form-group">
            <label>Column Title</label>
            <input type="text" id="column-title" required maxlength="50" placeholder="Enter column title">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-column">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Column</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    // Close on ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Cancel button
    document.getElementById('cancel-column').onclick = () => modal.remove();

    document.getElementById('add-column-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.createColumn();
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  showAddCardModal(columnId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Add Card</h2>
        <form id="add-card-form">
          <div class="form-group">
            <label>Card Title</label>
            <input type="text" id="card-title" required maxlength="200" placeholder="Enter card title">
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <textarea id="card-description" rows="3" maxlength="2000" placeholder="Enter card description"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-card">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Card</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    // Close on outside click
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    // Close on ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Cancel button
    document.getElementById('cancel-card').onclick = () => modal.remove();

    document.getElementById('add-card-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.createCard(columnId);
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  async deleteColumn(columnId) {
    if (!confirm('Delete this column and all its cards?')) return;

    try {
      await apiClient.delete(`/columns/${columnId}`);
      
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: 'Column deleted successfully!',
        type: 'success'
      });
      
      await this.load();
    } catch (error) {
      console.error('Delete column error:', error);
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: error.message || 'Failed to delete column',
        type: 'error'
      });
    }
  }

  showEditColumnModal(columnId) {
    const column = this.columns.find(c => c._id === columnId);
    if (!column) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Edit Column</h2>
        <form id="edit-column-form">
          <div class="form-group">
            <label>Column Title</label>
            <input type="text" id="edit-column-title" required maxlength="50" value="${column.title}">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-edit-column">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.getElementById('cancel-edit-column').onclick = () => modal.remove();

    document.getElementById('edit-column-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.updateColumn(columnId);
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  async updateColumn(columnId) {
    try {
      const title = document.getElementById('edit-column-title').value;
      
      await apiClient.put(`/columns/${columnId}`, { title });
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Column updated successfully!', 
        type: 'success' 
      });
      
      await this.load();
    } catch (error) {
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message || 'Failed to update column', 
        type: 'error' 
      });
    }
  }

  async deleteCard(cardId) {
    if (!confirm('Are you sure you want to delete this card?')) return;

    try {
      await apiClient.delete(`/cards/${cardId}`);
      
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: 'Card deleted successfully!',
        type: 'success'
      });
      
      await this.load();
    } catch (error) {
      console.error('Delete card error:', error);
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: error.message || 'Failed to delete card',
        type: 'error'
      });
    }
  }

  showEditCardModal(cardId) {
    const card = this.findCardById(cardId);
    if (!card) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Edit Card</h2>
        <form id="edit-card-form">
          <div class="form-group">
            <label>Card Title</label>
            <input type="text" id="edit-card-title" required maxlength="200" value="${card.title}">
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <textarea id="edit-card-description" rows="3" maxlength="2000">${card.description || ''}</textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-edit-card">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);

    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.getElementById('cancel-edit-card').onclick = () => modal.remove();

    document.getElementById('edit-card-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.updateCard(cardId);
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  async updateCard(cardId) {
    try {
      const title = document.getElementById('edit-card-title').value;
      const description = document.getElementById('edit-card-description').value;
      
      await apiClient.put(`/cards/${cardId}`, { 
        title, 
        description
      });
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Card updated successfully!', 
        type: 'success' 
      });
      
      await this.load();
    } catch (error) {
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message || 'Failed to update card', 
        type: 'error' 
      });
    }
  }

  findCardById(cardId) {
    for (const column of this.columns) {
      const card = column.cards?.find(c => c._id === cardId);
      if (card) return card;
    }
    return null;
  }

  showCardDetails(cardId) {
    eventBus.emit(EVENTS.MODAL_OPEN, { type: 'card-details', cardId });
    // TODO: Implement card details modal
    console.log('Card details:', cardId);
  }

  async createColumn() {
    try {
      const title = document.getElementById('column-title').value;
      const data = await apiClient.post('/columns', { 
        title, 
        boardId: this.boardId 
      });
      
      // Emit socket event
      socketService.emitColumnCreated(this.boardId, data.column);
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Column created!', 
        type: 'success' 
      });
      
      await this.load();
    } catch (error) {
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message, 
        type: 'error' 
      });
    }
  }

  async createCard(columnId) {
    try {
      const title = document.getElementById('card-title').value;
      const description = document.getElementById('card-description').value;
      
      const data = await apiClient.post('/cards', { 
        title, 
        description, 
        columnId 
      });
      
      // Emit socket event
      socketService.emitCardCreated(this.boardId, data.card);
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Card created!', 
        type: 'success' 
      });
      
      await this.load();
    } catch (error) {
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message, 
        type: 'error' 
      });
    }
  }

  async addMember() {
    try {
      const email = document.getElementById('member-email').value;
      const role = document.getElementById('member-role').value;
      
      const response = await apiClient.post(`/boards/${this.boardId}/members`, { 
        email, 
        role 
      });
      
      console.log('Member added, board data:', response.board);
      console.log('Members array:', response.board.members);
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Member added successfully!', 
        type: 'success' 
      });
      
      await this.load();
    } catch (error) {
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: error.message, 
        type: 'error' 
      });
    }
  }

  /**
   * Setup socket event listeners
   */
  setupSocketListeners() {
    this.handleUserJoined = (data) => {
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: `${data.username} joined`,
        type: 'info'
      });
    };

    this.handleUserLeft = (data) => {
      eventBus.emit(EVENTS.NOTIFICATION, {
        message: `${data.username} left`,
        type: 'info'
      });
    };

    this.handleCardCreated = () => {
      this.load();
    };

    this.handleColumnCreated = () => {
      this.load();
    };

    this.handleCardMoved = () => {
      this.load();
    };

    socketService.on('user:joined', this.handleUserJoined);
    socketService.on('user:left', this.handleUserLeft);
    socketService.on('card:created', this.handleCardCreated);
    socketService.on('column:created', this.handleColumnCreated);
    socketService.on('card:moved', this.handleCardMoved);
  }

  /**
   * Cleanup socket listeners
   */
  cleanupSocketListeners() {
    socketService.off('user:joined', this.handleUserJoined);
    socketService.off('user:left', this.handleUserLeft);
    socketService.off('card:created', this.handleCardCreated);
    socketService.off('column:created', this.handleColumnCreated);
    socketService.off('card:moved', this.handleCardMoved);
  }
}
