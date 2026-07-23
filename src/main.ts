import { createContainer } from './app/container';
import type { AppContainer } from './app/container';
import { renderAppShell, initializeShell } from './ui/app-shell';
import type { AppShellState, AppShellCallbacks } from './ui/app-shell';
import { initErrorHandler } from './app/error-handler';
import type { FlowStep, Theme } from './types/common';
import type { FileUploadProps } from './ui/components/file-upload';
import type { StructureTableProps } from './ui/components/structure-table';
import type { PrismPanelProps } from './ui/components/prism-panel';
import type { ChartGalleryProps } from './ui/components/chart-gallery';
import type { ObjectivesFormProps } from './ui/components/objectives-form';
import type { DocumentPreviewProps } from './ui/components/document-preview';
import './ui/styles/base.css';

/**
 * @description Application container singleton.
 */
let container: AppContainer | null = null;

/**
 * @description Current shell state managed by the app.
 */
let shellState: AppShellState;

/**
 * @description Upload progress state.
 */
let uploadProgress: number | null = null;
let uploadError: string | null = null;

/**
 * @description Returns the initialized application container.
 * @returns The AppContainer instance
 */
export function getContainer(): AppContainer {
  if (!container) {
    throw new Error('Container not initialized. Call initApp() first.');
  }
  return container;
}

/**
 * @description Renders the full app shell into the DOM.
 */
function render(): void {
  const appElement = document.getElementById('app');
  if (!appElement) return;

  const callbacks: AppShellCallbacks = {
    onStepChange: handleStepChange,
    onThemeChange: handleThemeChange,
    getStepProps: getStepProps,
  };

  renderAppShell(appElement, shellState, callbacks);
}

/**
 * @description Handles step navigation from progress indicator clicks.
 * @param step - The target step
 */
function handleStepChange(step: FlowStep): void {
  if (!container) return;
  const success = container.flowOrchestrator.goToStep(step);
  if (success) {
    shellState = { ...shellState, currentStep: step };
    render();
  }
}

/**
 * @description Handles theme toggle changes.
 * @param theme - The new theme
 */
function handleThemeChange(theme: Theme): void {
  shellState = { ...shellState, theme };
  localStorage.setItem('app_theme', theme);
  render();
}

/**
 * @description Handles file selection from the upload component.
 * @param file - The selected file
 */
async function handleFileSelected(file: File): Promise<void> {
  if (!container) return;
  uploadProgress = 0;
  uploadError = null;
  render();

  const result = await container.moduloCarga.loadFile(file, (percent: number) => {
    uploadProgress = percent;
    render();
  });

  if (result.ok) {
    uploadProgress = null;
    container.flowOrchestrator.markStepCompleted('upload');
    container.flowOrchestrator.goNext();
    shellState = { ...shellState, currentStep: 'detection' };
    render();
  } else {
    uploadProgress = null;
    uploadError = result.error.message;
    render();
  }
}

/**
 * @description Returns props for each step component.
 * @param step - Current flow step
 * @returns Props object for the step's component
 */
function getStepProps(step: FlowStep): unknown {
  switch (step) {
    case 'upload':
      return {
        onFileSelected: handleFileSelected,
        progress: uploadProgress,
        error: uploadError,
      } satisfies FileUploadProps;

    case 'detection':
      return {
        sheets: [],
        activeSheet: 0,
        onSheetChange: () => { /* handled by state */ },
        onTypeChange: () => { /* handled by state */ },
      } satisfies StructureTableProps;

    case 'prism':
      return {
        result: {
          dimensions: [],
          isBlockingQuality: false,
          hasLowIntegrity: false,
          hasWarningDimensions: false,
        },
        onContinue: () => {
          if (!container) return;
          container.flowOrchestrator.markStepCompleted('prism');
          container.flowOrchestrator.goNext();
          shellState = { ...shellState, currentStep: 'visualization' };
          render();
        },
        onCorrect: () => {
          shellState = { ...shellState, currentStep: 'detection' };
          render();
        },
      } satisfies PrismPanelProps;

    case 'visualization':
      return {
        suggestions: [],
        selectedVisualizations: [],
        onSelect: () => { /* handled by state */ },
        onAddCustom: () => { /* open custom dialog */ },
      } satisfies ChartGalleryProps;

    case 'objectives':
      return {
        objectives: [],
        availableKPIs: [],
        onCreate: () => { /* handled by module */ },
        onDelete: () => { /* handled by module */ },
        onLinkKPI: () => { /* handled by module */ },
        onUnlinkKPI: () => { /* handled by module */ },
      } satisfies ObjectivesFormProps;

    case 'document':
      return {
        content: null,
        isGenerating: false,
        progress: 0,
        onGenerate: () => { /* trigger generation */ },
        onDownload: () => { /* trigger download */ },
        onRegenerate: () => { /* trigger regeneration */ },
      } satisfies DocumentPreviewProps;
  }
}

/**
 * @description Main entry point. Creates container, initializes shell, mounts UI.
 * @returns The initialized AppContainer
 */
export async function initApp(): Promise<AppContainer> {
  container = createContainer();

  const { flowOrchestrator } = container;
  await flowOrchestrator.init();

  shellState = initializeShell();

  const appElement = document.getElementById('app');
  if (appElement) {
    initErrorHandler(appElement);
    render();
  }

  flowOrchestrator.startAutoSave();

  flowOrchestrator.subscribe((state) => {
    shellState = { ...shellState, currentStep: state.currentStep };
    render();
  });

  return container;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
