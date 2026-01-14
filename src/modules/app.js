/**
 * Main Application Module
 * Initializes the CollabBoard application
 */
import { stateManager } from './StateManager.js';
import { eventBus, EVENTS } from './EventBus.js';
import { apiClient } from './ApiClient.js';
import { Board } from './Board.js';
import { socketService } from './SocketService.js';

class App {
  constructor() {
    this.currentUser = null;
    this.socket = null;
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('CollabBoard initializing...');
    
    this.setupEventListeners();
    this.setupGlobalEvents();
    this.testConnection();
    await this.checkAuth();
  }

  /**
   * Setup global event handlers
   */
  setupGlobalEvents() {
    eventBus.on(EVENTS.NOTIFICATION, (data) => {
      this.showNotification(data.message, data.type);
    });
  }

  /**
   * Check if user is already authenticated
   */
  async checkAuth() {
    const token = localStorage.getItem('authToken');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        // Validate token with server
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          this.currentUser = data.user;
          
          // Hide welcome and show dashboard
          document.getElementById('loading').classList.add('hidden');
          document.getElementById('welcome').classList.add('hidden');
          this.showDashboard();
          return;
        } else {
          // Token invalid, clear storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      }
    }
    
    // No valid auth, show welcome screen
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('welcome').classList.remove('hidden');
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Login form
    const loginForm = document.querySelector('#login-form form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    // Register form
    const registerForm = document.querySelector('#register-form form');
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
    }

    // Header buttons
    document.getElementById('login-btn')?.addEventListener('click', () => {
      this.showAuthForm('login');
    });

    document.getElementById('register-btn')?.addEventListener('click', () => {
      this.showAuthForm('register');
    });
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      console.log('API Connection:', data.message);
    } catch (error) {
      console.error('API Connection failed:', error);
      // Don't show notification here, let checkAuth handle it
    }
  }

  /**
   * Show authentication form
   */
  showAuthForm(type) {
    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('auth-container').classList.remove('hidden');
    
    if (type === 'login') {
      document.getElementById('login-form').classList.remove('hidden');
      document.getElementById('register-form').classList.add('hidden');
    } else {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.remove('hidden');
    }
  }

  /**
   * Handle login form submission
   */
  async handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      this.currentUser = data.user;
      this.showNotification('Login successful!', 'success');
      
      // Hide auth forms and show dashboard
      this.showDashboard();
      
    } catch (error) {
      console.error('Login error:', error);
      this.showNotification(error.message || 'Login failed. Please try again.', 'error');
    }
  }

  /**
   * Handle register form submission
   */
  async handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (!username || !email || !password) {
      this.showNotification('Please fill in all fields', 'error');
      return;
    }

    if (password.length < 6) {
      this.showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store token and user data
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      this.currentUser = data.user;
      this.showNotification('Registration successful! Welcome!', 'success');
      
      // Hide auth forms and show dashboard
      this.showDashboard();
      
    } catch (error) {
      console.error('Register error:', error);
      this.showNotification(error.message || 'Registration failed. Please try again.', 'error');
    }
  }

  /**
   * Show notification to user
   */
  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add notification styles
    notification.style.cssText = `
      background: ${type === 'error' ? '#fee2e2' : type === 'success' ? '#dcfce7' : '#dbeafe'};
      color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#2563eb'};
      padding: 1rem;
      border-radius: 0.5rem;
      border: 1px solid ${type === 'error' ? '#fecaca' : type === 'success' ? '#bbf7d0' : '#bfdbfe'};
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-width: 300px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    `;
    
    notification.querySelector('button').style.cssText = `
      background: none;
      border: none;
      font-size: 1.2rem;
      cursor: pointer;
      margin-left: 1rem;
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  /**
   * Show dashboard after successful authentication
   */
  showDashboard() {
    // Hide all other screens
    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('auth-container').classList.add('hidden');
    
    // Show dashboard
    document.getElementById('dashboard').classList.remove('hidden');
    
    // Update header
    const navMenu = document.querySelector('.nav-menu');
    navMenu.innerHTML = `
      <span>Welcome, ${this.currentUser.username}!</span>
      <button id="logout-btn" class="btn btn-secondary">Logout</button>
    `;
    
    // Add logout handler
    document.getElementById('logout-btn').addEventListener('click', this.handleLogout.bind(this));
    
    // Connect socket
    socketService.connect();
    
    // Load boards
    this.loadBoards();
  }

  /**
   * Load user's boards
   */
  async loadBoards() {
    try {
      stateManager.set('ui.loading', true);
      const data = await apiClient.get('/boards');
      stateManager.set('boards', data.boards);
      this.renderBoards(data.boards);
    } catch (error) {
      console.error('Load boards error:', error);
      this.showNotification(error.message || 'Failed to load boards', 'error');
    } finally {
      stateManager.set('ui.loading', false);
    }
  }

  /**
   * Render boards in dashboard
   */
  renderBoards(boards) {
    const boardsGrid = document.querySelector('.boards-grid');
    
    if (boards.length === 0) {
      boardsGrid.innerHTML = `
        <div class="empty-state">
          <p>No boards yet. Create your first board to get started!</p>
        </div>
      `;
    } else {
      boardsGrid.innerHTML = boards.map(board => {
        const memberCount = 1 + (board.members?.length || 0);
        return `
          <div class="board-card" data-board-id="${board._id}" style="background: ${board.background}">
            <h3>${board.title}</h3>
            <p>${board.description || 'No description'}</p>
            <div class="board-meta">
              <span>Owner: ${board.owner.username}</span>
              <span>👥 ${memberCount} member${memberCount !== 1 ? 's' : ''}</span>
            </div>
          </div>
        `;
      }).join('');
      // Add click handlers to board cards
      document.querySelectorAll('.board-card').forEach(card => {
        card.addEventListener('click', () => {
          const boardId = card.dataset.boardId;
          this.openBoard(boardId);
        });
      });
    }

    // Always add create board button handler
    const createBtn = document.querySelector('.dashboard-header button');
    if (createBtn) {
      createBtn.onclick = () => this.showCreateBoardModal();
    }
  }

  /**
   * Show create board modal
   */
  showCreateBoardModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>Create New Board</h2>
        <form id="create-board-form">
          <div class="form-group">
            <label>Board Title</label>
            <input type="text" id="board-title" required maxlength="100">
          </div>
          <div class="form-group">
            <label>Description (optional)</label>
            <textarea id="board-description" maxlength="500"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Board</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('create-board-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.createBoard();
      modal.remove();
    });
  }

  /**
   * Create new board
   */
  async createBoard() {
    try {
      const title = document.getElementById('board-title').value;
      const description = document.getElementById('board-description').value;

      const data = await apiClient.post('/boards', { title, description });
      this.showNotification('Board created successfully!', 'success');
      eventBus.emit(EVENTS.BOARD_LOADED, data.board);
      this.loadBoards();
    } catch (error) {
      console.error('Create board error:', error);
      this.showNotification(error.message || 'Failed to create board', 'error');
    }
  }

  /**
   * Open board view
   */
  async openBoard(boardId) {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('board-view').classList.remove('hidden');
    document.querySelector('.app-header').style.display = 'none';
    
    const board = new Board(boardId);
    await board.load();
  }

  /**
   * Handle logout
   */
  handleLogout() {
    // Disconnect socket
    socketService.disconnect();
    
    // Clear storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    
    // Reset state
    this.currentUser = null;
    
    // Show welcome screen
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('welcome').classList.remove('hidden');
    
    // Reset header
    const navMenu = document.querySelector('.nav-menu');
    navMenu.innerHTML = `
      <button id="login-btn" class="btn btn-primary">Login</button>
      <button id="register-btn" class="btn btn-secondary">Register</button>
    `;
    
    // Re-setup event listeners
    this.setupEventListeners();
    
    this.showNotification('Logged out successfully', 'info');
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});