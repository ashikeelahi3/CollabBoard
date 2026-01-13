/**
 * Main Application Module
 * Initializes the CollabBoard application
 */

class App {
  constructor() {
    this.currentUser = null;
    this.socket = null;
    this.init();
  }

  /**
   * Initialize the application
   */
  init() {
    console.log('CollabBoard initializing...');
    
    // Check for existing authentication
    this.checkAuth();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Test API connection
    this.testConnection();
  }

  /**
   * Check if user is already authenticated
   */
  checkAuth() {
    const token = localStorage.getItem('authToken');
    if (token) {
      // TODO: Validate token with server
      console.log('Found existing auth token');
    }
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
      this.showNotification('Connection failed. Please check your internet connection.', 'error');
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
  }

  /**
   * Handle logout
   */
  handleLogout() {
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