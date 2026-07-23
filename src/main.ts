import { createContainer } from './app/container';
import type { AppContainer } from './app/container';

/**
 * @description Holds the application container singleton after initialization.
 * Accessible for UI components that need module references.
 */
let container: AppContainer | null = null;

/**
 * @description Returns the initialized application container.
 * Throws if called before initApp() has completed.
 * @returns The AppContainer instance
 */
export function getContainer(): AppContainer {
  if (!container) {
    throw new Error('Container not initialized. Call initApp() first.');
  }
  return container;
}

/**
 * @description Main entry point for the Dashboard Onboarding Analítico application.
 * Creates the DI container, initializes the flow orchestrator, and mounts the UI.
 * @returns The initialized AppContainer for testing or external access
 */
export async function initApp(): Promise<AppContainer> {
  container = createContainer();

  const { flowOrchestrator } = container;
  const { hasSession } = await flowOrchestrator.init();

  const appElement = document.getElementById('app');
  if (appElement) {
    appElement.innerHTML = hasSession
      ? '<h1>Dashboard Onboarding Analítico</h1><p>Sesión anterior detectada.</p>'
      : '<h1>Dashboard Onboarding Analítico</h1><p>Nueva sesión iniciada.</p>';
  }

  flowOrchestrator.startAutoSave();
  return container;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
