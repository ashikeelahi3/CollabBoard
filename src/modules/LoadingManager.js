/**
 * Loading State Manager
 */
class LoadingManager {
  constructor() {
    this.activeLoaders = new Set();
  }

  /**
   * Show loading spinner on button
   * @param {HTMLElement} button - Button element
   * @param {string} text - Loading text (optional)
   */
  showButtonLoading(button, text = 'Loading...') {
    if (!button) return;

    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
      <span class="spinner"></span>
      <span>${text}</span>
    `;
    button.classList.add('loading');
  }

  /**
   * Hide loading spinner from button
   * @param {HTMLElement} button - Button element
   */
  hideButtonLoading(button) {
    if (!button) return;

    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
    button.classList.remove('loading');
    delete button.dataset.originalText;
  }

  /**
   * Show full-screen loading overlay
   * @param {string} message - Loading message
   */
  showOverlay(message = 'Loading...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div class="loading-content">
        <div class="spinner-large"></div>
        <p>${message}</p>
      </div>
    `;
    overlay.id = 'loading-overlay';
    document.body.appendChild(overlay);
    this.activeLoaders.add('overlay');
  }

  /**
   * Hide full-screen loading overlay
   */
  hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.remove();
      this.activeLoaders.delete('overlay');
    }
  }

  /**
   * Show skeleton loader in element
   * @param {HTMLElement} element - Container element
   * @param {number} count - Number of skeleton items
   */
  showSkeleton(element, count = 3) {
    if (!element) return;

    element.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const skeleton = document.createElement('div');
      skeleton.className = 'skeleton-item';
      skeleton.innerHTML = `
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-text"></div>
        <div class="skeleton-line skeleton-text short"></div>
      `;
      element.appendChild(skeleton);
    }
  }

  /**
   * Wrap async function with loading state
   * @param {Function} fn - Async function
   * @param {HTMLElement} button - Button element (optional)
   */
  async withLoading(fn, button = null) {
    if (button) this.showButtonLoading(button);
    
    try {
      const result = await fn();
      return result;
    } finally {
      if (button) this.hideButtonLoading(button);
    }
  }
}

// Global instance
window.loadingManager = new LoadingManager();

export default LoadingManager;
