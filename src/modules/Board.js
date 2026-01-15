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
            '<button class="btn btn-secondary" id="manage-members-btn">👥 Manage Members</button>' : 
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
    const priorityColors = {
      low: '#95a5a6',
      medium: '#3498db',
      high: '#f39c12',
      urgent: '#e74c3c'
    };
    
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
          ${card.labels && card.labels.length > 0 ? `
            <div class="card-labels">
              ${card.labels.map(label => `
                <span class="card-label" style="background-color: ${label.color}">${label.name}</span>
              `).join('')}
            </div>
          ` : ''}
          <div class="card-meta">
            <span class="card-priority" style="background-color: ${priorityColors[card.priority || 'medium']}">
              ${(card.priority || 'medium').toUpperCase()}
            </span>
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

    // Manage members button
    const manageMembersBtn = document.getElementById('manage-members-btn');
    if (manageMembersBtn) {
      manageMembersBtn.onclick = () => this.showManageMembersModal();
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

  showManageMembersModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const membersList = this.board.members.map(member => `
      <div class="member-item">
        <div class="member-info">
          <span class="member-name">${member.user.username}</span>
          <span class="member-email">${member.user.email}</span>
        </div>
        <div class="member-actions">
          <select class="member-role-select" data-user-id="${member.user._id}">
            <option value="viewer" ${member.role === 'viewer' ? 'selected' : ''}>Viewer</option>
            <option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
          <button class="btn-icon btn-remove-member" data-user-id="${member.user._id}" title="Remove member">🗑️</button>
        </div>
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="modal-content modal-wide">
        <h2>Manage Members</h2>
        <div class="members-list">
          <div class="member-item owner-item">
            <div class="member-info">
              <span class="member-name">${this.board.owner.username} (Owner)</span>
              <span class="member-email">${this.board.owner.email}</span>
            </div>
            <div class="member-role-badge">Admin</div>
          </div>
          ${membersList || '<p class="no-members">No members yet</p>'}
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" id="add-new-member-btn">+ Add Member</button>
          <button class="btn btn-primary" id="close-members-modal">Close</button>
        </div>
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

    document.getElementById('close-members-modal').onclick = () => {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };

    document.getElementById('add-new-member-btn').onclick = () => {
      modal.remove();
      document.removeEventListener('keydown', escHandler);
      this.showAddMemberModal();
    };

    // Role change handlers
    document.querySelectorAll('.member-role-select').forEach(select => {
      select.onchange = async (e) => {
        const userId = e.target.dataset.userId;
        const newRole = e.target.value;
        await this.updateMemberRole(userId, newRole);
        modal.remove();
        document.removeEventListener('keydown', escHandler);
      };
    });

    // Remove member handlers
    document.querySelectorAll('.btn-remove-member').forEach(btn => {
      btn.onclick = async (e) => {
        const userId = e.target.dataset.userId;
        if (confirm('Remove this member from the board?')) {
          await this.removeMember(userId);
          modal.remove();
          document.removeEventListener('keydown', escHandler);
        }
      };
    });
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
            <label>Card Title *</label>
            <input type="text" id="card-title" required maxlength="200" placeholder="Enter card title">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="card-description" rows="3" maxlength="2000" placeholder="Enter card description"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Priority</label>
              <select id="card-priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="card-due-date">
            </div>
          </div>
          <div class="form-group">
            <label>Labels (comma-separated)</label>
            <input type="text" id="card-labels" placeholder="e.g., bug, feature, urgent">
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" id="cancel-card">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Card</button>
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

    document.getElementById('cancel-card').onclick = () => modal.remove();

    document.getElementById('add-card-form').onsubmit = async (e) => {
      e.preventDefault();
      await this.createCard(columnId);
      modal.remove();
      document.removeEventListener('keydown', escHandler);
    };
  }

  async deleteColumn(columnId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <h2 style="color: #dc2626;">Delete Column</h2>
        <p style="margin: 1rem 0; color: #374151;">Delete this column and all its cards? This action cannot be undone.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-column-btn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-delete-column-btn').addEventListener('click', async () => {
      try {
        await apiClient.delete(`/columns/${columnId}`);
        
        eventBus.emit(EVENTS.NOTIFICATION, {
          message: 'Column deleted successfully!',
          type: 'success'
        });
        
        await this.load();
        modal.remove();
      } catch (error) {
        console.error('Delete column error:', error);
        eventBus.emit(EVENTS.NOTIFICATION, {
          message: error.message || 'Failed to delete column',
          type: 'error'
        });
        modal.remove();
      }
    });
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
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <h2 style="color: #dc2626;">Delete Card</h2>
        <p style="margin: 1rem 0; color: #374151;">Are you sure you want to delete this card? This action cannot be undone.</p>
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete-card-btn">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-delete-card-btn').addEventListener('click', async () => {
      try {
        await apiClient.delete(`/cards/${cardId}`);
        
        eventBus.emit(EVENTS.NOTIFICATION, {
          message: 'Card deleted successfully!',
          type: 'success'
        });
        
        await this.load();
        modal.remove();
      } catch (error) {
        console.error('Delete card error:', error);
        eventBus.emit(EVENTS.NOTIFICATION, {
          message: error.message || 'Failed to delete card',
          type: 'error'
        });
        modal.remove();
      }
    });
  }

  showEditCardModal(cardId) {
    const card = this.findCardById(cardId);
    if (!card) return;

    const dueDateValue = card.dueDate ? new Date(card.dueDate).toISOString().split('T')[0] : '';
    const labelsValue = card.labels?.map(l => l.name).join(', ') || '';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Edit Card</h2>
        <form id="edit-card-form">
          <div class="form-group">
            <label>Card Title *</label>
            <input type="text" id="edit-card-title" required maxlength="200" value="${card.title}">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="edit-card-description" rows="3" maxlength="2000">${card.description || ''}</textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Priority</label>
              <select id="edit-card-priority">
                <option value="low" ${card.priority === 'low' ? 'selected' : ''}>Low</option>
                <option value="medium" ${card.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="high" ${card.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="urgent" ${card.priority === 'urgent' ? 'selected' : ''}>Urgent</option>
              </select>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="edit-card-due-date" value="${dueDateValue}">
            </div>
          </div>
          <div class="form-group">
            <label>Labels (comma-separated)</label>
            <input type="text" id="edit-card-labels" placeholder="e.g., bug, feature, urgent" value="${labelsValue}">
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

  getRandomColor() {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
    return colors[Math.floor(Math.random() * colors.length)];
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

  async updateMemberRole(userId, newRole) {
    try {
      await apiClient.put(`/boards/${this.boardId}/members/${userId}`, { role: newRole });
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Member role updated!', 
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

  async removeMember(userId) {
    try {
      await apiClient.delete(`/boards/${this.boardId}/members/${userId}`);
      
      eventBus.emit(EVENTS.NOTIFICATION, { 
        message: 'Member removed!', 
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
      const priority = document.getElementById('card-priority').value;
      const dueDate = document.getElementById('card-due-date').value;
      const labelsInput = document.getElementById('card-labels').value;
      
      const labels = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(l => l)
        .map(name => ({ name, color: this.getRandomColor() }));
      
      const data = await apiClient.post('/cards', { 
        title, 
        description, 
        columnId,
        priority,
        dueDate: dueDate || undefined,
        labels
      });
      
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

  async updateCard(cardId) {
    try {
      const title = document.getElementById('edit-card-title').value;
      const description = document.getElementById('edit-card-description').value;
      const priority = document.getElementById('edit-card-priority').value;
      const dueDate = document.getElementById('edit-card-due-date').value;
      const labelsInput = document.getElementById('edit-card-labels').value;
      
      const labels = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(l => l)
        .map(name => ({ name, color: this.getRandomColor() }));
      
      await apiClient.put(`/cards/${cardId}`, { 
        title, 
        description,
        priority,
        dueDate: dueDate || undefined,
        labels
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

  getRandomColor() {
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
    return colors[Math.floor(Math.random() * colors.length)];
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
