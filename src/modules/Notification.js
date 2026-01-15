/**
 * Notification System - Toast notifications
 */
class Notification {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // Create notification container
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Type: success, error, info, warning
   * @param {number} duration - Auto-dismiss duration in ms (0 = no auto-dismiss)
   */
  show(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = this.getIcon(type);
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close">&times;</button>
    `;

    // Close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.remove(notification));

    // Add to container
    this.container.appendChild(notification);

    // Trigger animation
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this.remove(notification), duration);
    }

    return notification;
  }

  remove(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  getIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || icons.info;
  }

  success(message, duration = 3000) {
    return this.show(message, 'success', duration);
  }

  error(message, duration = 4000) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration = 3500) {
    return this.show(message, 'warning', duration);
  }

  info(message, duration = 3000) {
    return this.show(message, 'info', duration);
  }
}

// Global instance
window.notification = new Notification();

export default Notification;
