export type DisplayTheme = 'space' | 'sky';
export const themeStorageKey = 'spacehealth-display-theme-v1';

export function normalizeTheme(value: unknown): DisplayTheme {
  return value === 'sky' ? 'sky' : 'space';
}

export function applyTheme(theme: DisplayTheme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'space' ? '#f7f5fc' : '#eff7fb');
}

export function initializeTheme() {
  let theme: DisplayTheme = 'space';
  try { theme = normalizeTheme(JSON.parse(localStorage.getItem(themeStorageKey) || 'null')); } catch { /* default space display */ }
  applyTheme(theme);
}
