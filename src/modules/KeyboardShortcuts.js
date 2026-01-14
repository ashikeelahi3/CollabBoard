/**
 * Keyboard Shortcuts Manager
 */
class KeyboardShortcuts {
  constructor() {
    this.shortcuts = new Map();
    this.init();
  }

  init() {
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
    this.registerDefaultShortcuts();
  }

  registerDefaultShortcuts() {
    // ESC - Close modals
    this.register('Escape', () => {
      const modal = document.querySelector('.modal');
      if (modal) modal.remove();
    });

    // Ctrl+N - New card (when on board)
    this.register('n', () => {
      if (document.getElementById('board-view').classList.contains('hidden')) return;
      const addCardBtn = document.querySelector('.add-card-btn');
      if (addCardBtn) addCardBtn.click();
    }, { ctrl: true });

    // Ctrl+B - Back to dashboard
    this.register('b', () => {
      const backBtn = document.querySelector('.back-btn');
      if (backBtn) backBtn.click();
    }, { ctrl: true });

    // Ctrl+K - Create new board
    this.register('k', () => {
      if (!document.getElementById('dashboard').classList.contains('hidden')) {
        window.app?.showCreateBoardModal();
      }
    }, { ctrl: true });

    // ? - Show shortcuts help
    this.register('?', () => {
      this.showHelp();
    }, { shift: true });
  }

  register(key, callback, options = {}) {
    const shortcutKey = this.getShortcutKey(key, options);
    this.shortcuts.set(shortcutKey, { callback, options });
  }

  getShortcutKey(key, options) {
    const parts = [];
    if (options.ctrl) parts.push('ctrl');
    if (options.shift) parts.push('shift');
    if (options.alt) parts.push('alt');
    parts.push(key.toLowerCase());
    return parts.join('+');
  }

  handleKeyPress(event) {
    // Don't trigger shortcuts when typing in inputs
    if (event.target.matches('input, textarea')) return;

    const key = event.key.toLowerCase();
    const shortcutKey = this.getShortcutKey(key, {
      ctrl: event.ctrlKey || event.metaKey,
      shift: event.shiftKey,
      alt: event.altKey
    });

    const shortcut = this.shortcuts.get(shortcutKey);
    if (shortcut) {
      event.preventDefault();
      shortcut.callback(event);
    }
  }

  showHelp() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <div class="shortcuts-list">
          <div class="shortcut-item">
            <kbd>Esc</kbd>
            <span>Close modal</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>N</kbd>
            <span>New card (on board)</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>B</kbd>
            <span>Back to dashboard</span>
          </div>
          <div class="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>K</kbd>
            <span>Create new board</span>
          </div>
          <div class="shortcut-item">
            <kbd>?</kbd>
            <span>Show this help</span>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Got it!</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Global instance
window.keyboardShortcuts = new KeyboardShortcuts();

export default KeyboardShortcuts;
