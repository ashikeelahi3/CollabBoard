// Theme Manager - Dark/Light mode toggle
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'light';
    this.applyTheme(this.currentTheme);
  }

  toggle() {
    this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  getCurrentTheme() {
    return this.currentTheme;
  }
}

export const themeManager = new ThemeManager();
