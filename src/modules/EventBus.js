/**
 * EventBus - Decoupled component communication
 */
class EventBus {
  constructor() {
    this.events = new Map();
  }

  /**
   * Subscribe to event
   */
  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event).add(callback);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from event
   */
  off(event, callback) {
    const callbacks = this.events.get(event);
    if (callbacks) callbacks.delete(callback);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * One-time subscription
   */
  once(event, callback) {
    const unsubscribe = this.on(event, (data) => {
      callback(data);
      unsubscribe();
    });
    return unsubscribe;
  }
}

export const eventBus = new EventBus();

// Event constants
export const EVENTS = {
  CARD_CREATED: 'card:created',
  CARD_UPDATED: 'card:updated',
  CARD_MOVED: 'card:moved',
  CARD_DELETED: 'card:deleted',
  COLUMN_CREATED: 'column:created',
  COLUMN_UPDATED: 'column:updated',
  BOARD_LOADED: 'board:loaded',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',
  NOTIFICATION: 'notification'
};
