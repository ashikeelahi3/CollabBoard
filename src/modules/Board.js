/**
 * Board Component - Displays board with columns and cards
 */
import { stateManager } from './StateManager.js';
import { eventBus, EVENTS } from './EventBus.js';
import { apiClient } from './ApiClient.js';

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
    
    container.innerHTML = `
      <div class="board-header">
        <div class="board-info">
          <button class="btn-back" id="back-to-dashboard">← Back</button>
          <h2>${this.board.title}</h2>
          <span class="board-role">${this.board.userRole}</span>
        </div>
        <div class="board-actions">
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
    return `
      <div class="column" data-column-id="${column._id}">
        <div class="column-header">
          <h3>${column.title}</h3>
          <span class="card-count">${column.cards?.length || 0}</span>
        </div>
        <div class="column-cards" data-column-id="${column._id}">
          ${column.cards?.map(card => this.renderCard(card)).join('') || ''}
        </div>
        ${this.board.userRole !== 'viewer' ? `
          <button class="btn-add-card" data-column-id="${column._id}">
            + Add Card
          </button>
        ` : ''}
      </div>
    `;
  }

  renderCard(card) {
    return `
      <div class="card" data-card-id="${card._id}" draggable="${this.board.userRole !== 'viewer'}">
        <div class="card-content">
          <h4>${card.title}</h4>
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
        document.getElementById('board-view').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.querySelector('.app-header').style.display = 'block';
      };
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

    // Card click to view details
    document.querySelectorAll('.card').forEach(card => {
      card.onclick = () => {
        const cardId = card.dataset.cardId;
        this.showCardDetails(cardId);
      };
    });
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

  showCardDetails(cardId) {
    eventBus.emit(EVENTS.MODAL_OPEN, { type: 'card-details', cardId });
    // TODO: Implement card details modal
    console.log('Card details:', cardId);
  }

  async createColumn() {
    try {
      const title = document.getElementById('column-title').value;
      await apiClient.post('/columns', { 
        title, 
        boardId: this.boardId 
      });
      
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
      
      await apiClient.post('/cards', { 
        title, 
        description, 
        columnId 
      });
      
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
}
