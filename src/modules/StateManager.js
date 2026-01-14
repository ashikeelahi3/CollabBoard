/**
 * StateManager - Centralized state management with subscriptions
 */
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
        activeModal: null
      }
    };
    this.subscribers = new Map();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(path, callback) {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }
    this.subscribers.get(path).add(callback);

    return () => {
      const subs = this.subscribers.get(path);
      if (subs) subs.delete(callback);
    };
  }

  /**
   * Get state value by path
   */
  get(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this.state);
  }

  /**
   * Set state value and notify subscribers
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {};
      return obj[key];
    }, this.state);
    
    target[lastKey] = value;
    this.notify(path, value);
  }

  /**
   * Update state with partial object
   */
  update(path, updates) {
    const current = this.get(path) || {};
    this.set(path, { ...current, ...updates });
  }

  /**
   * Notify subscribers
   */
  notify(path, value) {
    const subs = this.subscribers.get(path);
    if (subs) {
      subs.forEach(callback => callback(value));
    }
  }

  /**
   * Reset state
   */
  reset() {
    this.state = {
      user: null,
      currentBoard: null,
      boards: [],
      columns: [],
      cards: [],
      ui: { loading: false, selectedCard: null, activeModal: null }
    };
  }
}

export const stateManager = new StateManager();
