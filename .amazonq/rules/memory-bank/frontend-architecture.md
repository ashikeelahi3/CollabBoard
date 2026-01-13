# Frontend Architecture & State Management

## ES6 Modules Architecture

### Module Structure
```
src/
├── modules/
│   ├── core/
│   │   ├── EventBus.js        # Central event system
│   │   ├── StateManager.js    # Application state management
│   │   ├── ApiClient.js       # HTTP client with auth
│   │   └── Router.js          # Client-side routing
│   ├── components/
│   │   ├── Board.js           # Board component
│   │   ├── Column.js          # Column component
│   │   ├── Card.js            # Card component
│   │   ├── Modal.js           # Modal dialogs
│   │   └── Notification.js    # Toast notifications
│   ├── services/
│   │   ├── SocketService.js   # WebSocket management
│   │   ├── AuthService.js     # Authentication
│   │   └── CacheService.js    # Client-side caching
│   └── utils/
│       ├── dom.js             # DOM utilities
│       ├── validation.js      # Input validation
│       └── helpers.js         # General helpers
└── styles/
    ├── main.css               # Global styles
    ├── components/            # Component-specific styles
    └── themes/                # Theme variations
```

## State Management System

### Central State Manager
```javascript
// modules/core/StateManager.js - Centralized state management
class StateManager {
  constructor() {
    this.state = {
      user: null,
      currentBoard: null,
      boards: [],
      columns: [],
      cards: [],
      ui: {
        loading: false,
        selectedCard: null,
        dragState: null,
        notifications: []
      }
    };
    
    this.subscribers = new Map();
    this.history = [];
    this.maxHistorySize = 50;
  }

  // Subscribe to state changes
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    // Return unsubscribe function
    return () => {
      const pathSubscribers = this.subscribers.get(path);
      if (pathSubscribers) {
        pathSubscribers.delete(callback);
      }
    };
  }

  // Get state value by path
  get(path) {
    return this.getNestedValue(this.state, path);
  }

  // Set state value and notify subscribers
  set(path, value) {
    const oldValue = this.get(path);
    
    // Save to history for undo functionality
    this.saveToHistory(path, oldValue, value);
    
    // Update state
    this.setNestedValue(this.state, path, value);
    
    // Notify subscribers
    this.notifySubscribers(path, value, oldValue);
  }

  // Update state with partial object
  update(path, updates) {
    const currentValue = this.get(path) || {};
    const newValue = { ...currentValue, ...updates };
    this.set(path, newValue);
  }

  // Array operations
  push(path, item) {
    const array = this.get(path) || [];
    this.set(path, [...array, item]);
  }

  remove(path, predicate) {
    const array = this.get(path) || [];
    const filtered = array.filter(item => !predicate(item));
    this.set(path, filtered);
  }

  // Batch updates for performance
  batch(updates) {
    const oldValues = {};
    
    // Collect old values
    Object.keys(updates).forEach(path => {
      oldValues[path] = this.get(path);
    });

    // Apply all updates
    Object.entries(updates).forEach(([path, value]) => {
      this.setNestedValue(this.state, path, value);
    });

    // Notify all subscribers
    Object.entries(updates).forEach(([path, value]) => {
      this.notifySubscribers(path, value, oldValues[path]);
    });
  }

  // Helper methods
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  notifySubscribers(path, newValue, oldValue) {
    // Notify exact path subscribers
    const pathSubscribers = this.subscribers.get(path);
    if (pathSubscribers) {
      pathSubscribers.forEach(callback => {
        callback(newValue, oldValue, path);
      });
    }

    // Notify parent path subscribers
    const pathParts = path.split('.');
    for (let i = pathParts.length - 1; i > 0; i--) {
      const parentPath = pathParts.slice(0, i).join('.');
      const parentSubscribers = this.subscribers.get(parentPath);
      if (parentSubscribers) {
        parentSubscribers.forEach(callback => {
          callback(this.get(parentPath), undefined, parentPath);
        });
      }
    }
  }

  saveToHistory(path, oldValue, newValue) {
    this.history.push({
      path,
      oldValue,
      newValue,
      timestamp: Date.now()
    });

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  // Undo last change
  undo() {
    const lastChange = this.history.pop();
    if (lastChange) {
      this.setNestedValue(this.state, lastChange.path, lastChange.oldValue);
      this.notifySubscribers(lastChange.path, lastChange.oldValue, lastChange.newValue);
    }
  }
}

// Global state manager instance
export const stateManager = new StateManager();
```

### Event Bus for Component Communication
```javascript
// modules/core/EventBus.js - Decoupled component communication
class EventBus {
  constructor() {
    this.events = new Map();
  }

  // Subscribe to event
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  // Unsubscribe from event
  off(event, callback) {
    const eventCallbacks = this.events.get(event);
    if (eventCallbacks) {
      eventCallbacks.delete(callback);
    }
  }

  // Emit event to all subscribers
  emit(event, data) {
    const eventCallbacks = this.events.get(event);
    if (eventCallbacks) {
      eventCallbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  // One-time event subscription
  once(event, callback) {
    const unsubscribe = this.on(event, (data) => {
      callback(data);
      unsubscribe();
    });
    return unsubscribe;
  }

  // Clear all event listeners
  clear() {
    this.events.clear();
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Common events
export const EVENTS = {
  // Card events
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_MOVED: 'card:moved',
  CARD_DELETED: 'card:deleted',
  
  // Board events
  BOARD_LOADED: 'board:loaded',
  BOARD_UPDATED: 'board:updated',
  
  // UI events
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  NOTIFICATION_SHOW: 'notification:show',
  
  // User events
  USER_JOINED: 'user:joined',
  USER_LEFT: 'user:left'
};
```

## Component Architecture

### Base Component Class
```javascript
// modules/core/Component.js - Base component with lifecycle
export class Component {
  constructor(element, props = {}) {
    this.element = element;
    this.props = props;
    this.state = {};
    this.subscriptions = [];
    this.eventListeners = [];
    
    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.componentDidMount();
  }

  // Lifecycle methods
  componentDidMount() {
    // Override in subclasses
  }

  componentWillUnmount() {
    // Cleanup subscriptions and event listeners
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
  }

  // State management
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  // Subscribe to global state
  subscribe(path, callback) {
    const unsubscribe = stateManager.subscribe(path, callback);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  // Add event listener with cleanup tracking
  addEventListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  // Template rendering
  render() {
    // Override in subclasses
  }

  // Utility methods
  $(selector) {
    return this.element.querySelector(selector);
  }

  $$(selector) {
    return this.element.querySelectorAll(selector);
  }

  // Destroy component
  destroy() {
    this.componentWillUnmount();
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}
```

### Board Component Implementation
```javascript
// modules/components/Board.js - Main board component
import { Component } from '../core/Component.js';
import { stateManager } from '../core/StateManager.js';
import { eventBus, EVENTS } from '../core/EventBus.js';
import { Column } from './Column.js';
import { socketService } from '../services/SocketService.js';

export class Board extends Component {
  constructor(element, props) {
    super(element, props);
    this.columns = new Map();
    this.boardId = props.boardId;
  }

  componentDidMount() {
    // Subscribe to board state changes
    this.subscribe('currentBoard', (board) => {
      if (board) {
        this.renderBoard(board);
      }
    });

    // Subscribe to real-time events
    eventBus.on(EVENTS.CARD_MOVED, this.handleCardMoved.bind(this));
    eventBus.on(EVENTS.USER_JOINED, this.handleUserJoined.bind(this));

    // Load board data
    this.loadBoard();
  }

  async loadBoard() {
    try {
      stateManager.set('ui.loading', true);
      
      const response = await apiClient.get(`/api/boards/${this.boardId}`);
      const board = response.data;
      
      stateManager.set('currentBoard', board);
      stateManager.set('columns', board.columns);
      stateManager.set('cards', this.flattenCards(board.columns));
      
      // Join socket room for real-time updates
      socketService.joinBoard(this.boardId);
      
    } catch (error) {
      console.error('Failed to load board:', error);
      eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
        type: 'error',
        message: 'Failed to load board'
      });
    } finally {
      stateManager.set('ui.loading', false);
    }
  }

  renderBoard(board) {
    this.element.innerHTML = `
      <div class="board-header">
        <h1 class="board-title">${board.title}</h1>
        <div class="board-actions">
          <button class="btn-add-column">+ Add Column</button>
          <button class="btn-board-settings">⚙️</button>
        </div>
      </div>
      <div class="board-content">
        <div class="columns-container" id="columns-container">
          <!-- Columns will be rendered here -->
        </div>
      </div>
    `;

    this.renderColumns(board.columns);
    this.bindBoardEvents();
  }

  renderColumns(columns) {
    const container = this.$('#columns-container');
    container.innerHTML = '';

    // Clear existing column components
    this.columns.forEach(column => column.destroy());
    this.columns.clear();

    // Create new column components
    columns.forEach(columnData => {
      const columnElement = document.createElement('div');
      container.appendChild(columnElement);

      const column = new Column(columnElement, {
        columnData,
        boardId: this.boardId
      });

      this.columns.set(columnData._id, column);
    });
  }

  bindBoardEvents() {
    // Add column button
    const addColumnBtn = this.$('.btn-add-column');
    if (addColumnBtn) {
      this.addEventListener(addColumnBtn, 'click', this.handleAddColumn.bind(this));
    }

    // Board settings button
    const settingsBtn = this.$('.btn-board-settings');
    if (settingsBtn) {
      this.addEventListener(settingsBtn, 'click', this.handleBoardSettings.bind(this));
    }
  }

  handleAddColumn() {
    eventBus.emit(EVENTS.MODAL_OPEN, {
      type: 'add-column',
      boardId: this.boardId
    });
  }

  handleBoardSettings() {
    eventBus.emit(EVENTS.MODAL_OPEN, {
      type: 'board-settings',
      boardId: this.boardId
    });
  }

  handleCardMoved(data) {
    // Update local state optimistically
    const cards = stateManager.get('cards');
    const cardIndex = cards.findIndex(card => card._id === data.cardId);
    
    if (cardIndex !== -1) {
      const updatedCards = [...cards];
      updatedCards[cardIndex] = {
        ...updatedCards[cardIndex],
        column: data.targetColumnId,
        position: data.position
      };
      
      stateManager.set('cards', updatedCards);
    }
  }

  handleUserJoined(data) {
    eventBus.emit(EVENTS.NOTIFICATION_SHOW, {
      type: 'info',
      message: `${data.username} joined the board`
    });
  }

  flattenCards(columns) {
    return columns.reduce((allCards, column) => {
      return allCards.concat(column.cards || []);
    }, []);
  }
}
```

## Client-Side Routing

### Simple Router Implementation
```javascript
// modules/core/Router.js - Client-side routing
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.currentComponent = null;
    
    window.addEventListener('popstate', this.handlePopState.bind(this));
    window.addEventListener('DOMContentLoaded', this.handleInitialRoute.bind(this));
  }

  // Define route
  route(path, component, options = {}) {
    this.routes.set(path, { component, options });
  }

  // Navigate to route
  navigate(path, state = {}) {
    if (path !== this.currentRoute) {
      history.pushState(state, '', path);
      this.loadRoute(path);
    }
  }

  // Replace current route
  replace(path, state = {}) {
    history.replaceState(state, '', path);
    this.loadRoute(path);
  }

  // Go back
  back() {
    history.back();
  }

  // Load route component
  async loadRoute(path) {
    const route = this.findRoute(path);
    
    if (!route) {
      this.loadNotFound();
      return;
    }

    try {
      // Cleanup current component
      if (this.currentComponent && this.currentComponent.destroy) {
        this.currentComponent.destroy();
      }

      // Extract route parameters
      const params = this.extractParams(route.pattern, path);
      
      // Load new component
      const ComponentClass = route.component;
      const container = document.getElementById('app');
      
      this.currentComponent = new ComponentClass(container, {
        params,
        query: this.getQueryParams()
      });
      
      this.currentRoute = path;
      
    } catch (error) {
      console.error('Route loading error:', error);
      this.loadError();
    }
  }

  findRoute(path) {
    for (let [pattern, route] of this.routes) {
      if (this.matchRoute(pattern, path)) {
        return { pattern, ...route };
      }
    }
    return null;
  }

  matchRoute(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    
    if (patternParts.length !== pathParts.length) {
      return false;
    }
    
    return patternParts.every((part, index) => {
      return part.startsWith(':') || part === pathParts[index];
    });
  }

  extractParams(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    const params = {};
    
    patternParts.forEach((part, index) => {
      if (part.startsWith(':')) {
        const paramName = part.slice(1);
        params[paramName] = pathParts[index];
      }
    });
    
    return params;
  }

  getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const query = {};
    for (let [key, value] of params) {
      query[key] = value;
    }
    return query;
  }

  handlePopState() {
    this.loadRoute(window.location.pathname);
  }

  handleInitialRoute() {
    this.loadRoute(window.location.pathname);
  }

  loadNotFound() {
    document.getElementById('app').innerHTML = '<h1>404 - Page Not Found</h1>';
  }

  loadError() {
    document.getElementById('app').innerHTML = '<h1>Error loading page</h1>';
  }
}

// Global router instance
export const router = new Router();

// Define application routes
router.route('/', LoginComponent);
router.route('/dashboard', DashboardComponent);
router.route('/board/:id', BoardComponent);
```