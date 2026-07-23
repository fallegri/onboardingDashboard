/**
 * @module app-shell
 * @description Main application shell that orchestrates the UI.
 * Renders the current step component, progress indicator, and theme toggle.
 * Manages layout regions and step transitions (< 500ms).
 * Validates: Requirements 10.1, 10.2, 10.4, 10.6, 10.7
 */

import type { FlowStep, Theme } from '../types/common';
import { renderProgressIndicator } from './components/progress-indicator';
import { renderThemeToggle, applyTheme, getStoredTheme } from './components/theme-toggle';
import { renderFileUpload } from './components/file-upload';
import { renderStructureTable } from './components/structure-table';
import { renderPrismPanel } from './components/prism-panel';
import { renderChartGallery } from './components/chart-gallery';
import { renderObjectivesForm } from './components/objectives-form';
import { renderDocumentPreview } from './components/document-preview';

/** Application state relevant to the shell */
export interface AppShellState {
  currentStep: FlowStep;
  theme: Theme;
}

/** Callbacks the shell needs from the application layer */
export interface AppShellCallbacks {
  onStepChange: (step: FlowStep) => void;
  onThemeChange: (theme: Theme) => void;
  getStepProps: (step: FlowStep) => unknown;
}

/**
 * Initializes the app shell into the given root element.
 * Creates the structural layout: header (progress + theme), main content area.
 * @param root - Root container element (e.g., #app)
 * @param state - Current application state
 * @param callbacks - Shell callbacks for state changes
 */
export function renderAppShell(
  root: HTMLElement,
  state: AppShellState,
  callbacks: AppShellCallbacks
): void {
  root.innerHTML = '';
  root.className = 'app-container';

  const header = createHeader(state, callbacks);
  const main = createMain(state, callbacks);
  const skipLink = createSkipLink();

  root.appendChild(skipLink);
  root.appendChild(header);
  root.appendChild(main);

  applyTheme(state.theme);
}

/** Creates the skip-to-content link for keyboard users */
function createSkipLink(): HTMLElement {
  const link = document.createElement('a');
  link.href = '#main-content';
  link.className = 'visually-hidden';
  link.textContent = 'Saltar al contenido principal';
  link.addEventListener('focus', () => link.classList.remove('visually-hidden'));
  link.addEventListener('blur', () => link.classList.add('visually-hidden'));
  return link;
}

/** Creates the header region with progress and theme toggle */
function createHeader(state: AppShellState, callbacks: AppShellCallbacks): HTMLElement {
  const header = document.createElement('header');
  header.className = 'app-shell__header';
  header.setAttribute('role', 'banner');

  const progressContainer = document.createElement('div');
  progressContainer.className = 'app-shell__progress';
  renderProgressIndicator(progressContainer, {
    currentStep: state.currentStep,
    onStepClick: callbacks.onStepChange,
  });

  const themeContainer = document.createElement('div');
  themeContainer.className = 'app-shell__theme';
  renderThemeToggle(themeContainer, {
    currentTheme: state.theme,
    onToggle: callbacks.onThemeChange,
  });

  header.appendChild(progressContainer);
  header.appendChild(themeContainer);
  return header;
}

/** Creates the main content area and renders the active step */
function createMain(state: AppShellState, callbacks: AppShellCallbacks): HTMLElement {
  const main = document.createElement('main');
  main.id = 'main-content';
  main.className = 'app-shell__main';
  main.setAttribute('role', 'main');
  main.setAttribute('aria-live', 'polite');

  renderStepContent(main, state.currentStep, callbacks);
  return main;
}

/** Renders the appropriate step component into the main area */
function renderStepContent(
  container: HTMLElement,
  step: FlowStep,
  callbacks: AppShellCallbacks
): void {
  const props = callbacks.getStepProps(step);
  const renderers: Record<FlowStep, () => void> = {
    upload: () => renderFileUpload(container, props as Parameters<typeof renderFileUpload>[1]),
    detection: () => renderStructureTable(container, props as Parameters<typeof renderStructureTable>[1]),
    prism: () => renderPrismPanel(container, props as Parameters<typeof renderPrismPanel>[1]),
    visualization: () => renderChartGallery(container, props as Parameters<typeof renderChartGallery>[1]),
    objectives: () => renderObjectivesForm(container, props as Parameters<typeof renderObjectivesForm>[1]),
    document: () => renderDocumentPreview(container, props as Parameters<typeof renderDocumentPreview>[1]),
  };

  renderers[step]();
}

/**
 * Initializes the app shell with stored preferences.
 * Reads theme from localStorage and applies it immediately.
 */
export function initializeShell(): AppShellState {
  const theme = getStoredTheme();
  applyTheme(theme);

  return {
    currentStep: 'upload',
    theme,
  };
}
