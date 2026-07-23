/**
 * @module theme-toggle
 * @description Dark/light mode toggle component.
 * Operable by keyboard and mouse, persists preference.
 * Validates: Requirements 10.7
 */

import type { Theme } from '../../types/common';

/** Props for the theme toggle component */
export interface ThemeToggleProps {
  currentTheme: Theme;
  onToggle: (theme: Theme) => void;
}

/**
 * Renders a theme toggle button into the given container.
 * Uses aria-pressed for screen reader support, keyboard operable.
 * @param container - Target DOM element
 * @param props - Current theme and toggle callback
 */
export function renderThemeToggle(
  container: HTMLElement,
  props: ThemeToggleProps
): void {
  container.innerHTML = '';
  const isDark = props.currentTheme === 'dark';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';
  button.setAttribute('aria-pressed', String(isDark));
  button.setAttribute('aria-label', isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
  button.tabIndex = 0;

  const icon = document.createElement('span');
  icon.className = 'theme-toggle__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = isDark ? '☀️' : '🌙';

  const label = document.createElement('span');
  label.className = 'theme-toggle__label';
  label.textContent = isDark ? 'Modo claro' : 'Modo oscuro';

  button.appendChild(icon);
  button.appendChild(label);

  button.addEventListener('click', () => handleToggle(props));
  button.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(props);
    }
  });

  container.appendChild(button);
}

/** Toggles between light and dark theme */
function handleToggle(props: ThemeToggleProps): void {
  const newTheme: Theme = props.currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  props.onToggle(newTheme);
}

/**
 * Applies the theme to the document root element.
 * @param theme - Theme to apply ('light' or 'dark')
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Reads the stored theme preference from localStorage.
 * Defaults to 'light' if no preference is stored.
 */
export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('ui-theme');
  return stored === 'dark' ? 'dark' : 'light';
}
