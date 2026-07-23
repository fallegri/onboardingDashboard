/**
 * @vitest-environment jsdom
 */

/**
 * @module error-handler.test
 * @description Unit tests for the global error handler module.
 * Tests graceful degradation, connectivity monitoring, auto-save failure
 * notifications, clear data confirmation flow, and module error classification.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('error-handler', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    vi.resetModules();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  describe('isEssentialModule', () => {
    it('should classify carga as essential', async () => {
      const { isEssentialModule } = await import('../../src/app/error-handler');
      expect(isEssentialModule('carga')).toBe(true);
    });

    it('should classify prism as essential', async () => {
      const { isEssentialModule } = await import('../../src/app/error-handler');
      expect(isEssentialModule('prism')).toBe(true);
    });

    it('should classify visualizacion as essential', async () => {
      const { isEssentialModule } = await import('../../src/app/error-handler');
      expect(isEssentialModule('visualizacion')).toBe(true);
    });

    it('should classify documento as essential', async () => {
      const { isEssentialModule } = await import('../../src/app/error-handler');
      expect(isEssentialModule('documento')).toBe(true);
    });

    it('should not classify ia as essential', async () => {
      const { isEssentialModule } = await import('../../src/app/error-handler');
      expect(isEssentialModule('ia')).toBe(false);
    });
  });

  describe('isNonEssentialModule', () => {
    it('should classify ia as non-essential', async () => {
      const { isNonEssentialModule } = await import('../../src/app/error-handler');
      expect(isNonEssentialModule('ia')).toBe(true);
    });

    it('should classify ollama as non-essential', async () => {
      const { isNonEssentialModule } = await import('../../src/app/error-handler');
      expect(isNonEssentialModule('ollama')).toBe(true);
    });

    it('should not classify carga as non-essential', async () => {
      const { isNonEssentialModule } = await import('../../src/app/error-handler');
      expect(isNonEssentialModule('carga')).toBe(false);
    });
  });

  describe('handleModuleError', () => {
    it('should show warning toast for non-essential module failure', async () => {
      const { handleModuleError } = await import('../../src/app/error-handler');
      const error = new Error('IA service timeout');

      handleModuleError('ia', error);

      const toasts = document.querySelectorAll('.toast--warning');
      expect(toasts.length).toBe(1);
      expect(toasts[0]?.textContent).toContain('IA no está disponible');
    });

    it('should show error toast for essential module failure', async () => {
      const { handleModuleError } = await import('../../src/app/error-handler');
      const error = new Error('File parse failed');

      handleModuleError('carga', error);

      const toasts = document.querySelectorAll('.toast--error');
      expect(toasts.length).toBe(1);
      expect(toasts[0]?.textContent).toContain('carga de archivos');
    });

    it('should allow flow to continue after non-essential failure', async () => {
      const { handleModuleError, isOnline } = await import('../../src/app/error-handler');
      const error = new Error('Ollama not found');

      // Should not throw
      expect(() => handleModuleError('ollama', error)).not.toThrow();
      // App remains functional
      expect(isOnline()).toBeDefined();
    });
  });

  describe('notifyAutoSaveFailure', () => {
    it('should show error toast with auto-save failure message', async () => {
      const { notifyAutoSaveFailure } = await import('../../src/app/error-handler');

      notifyAutoSaveFailure();

      const toasts = document.querySelectorAll('.toast--error');
      expect(toasts.length).toBe(1);
      expect(toasts[0]?.textContent).toContain('guardado automático falló');
    });
  });

  describe('clearData', () => {
    it('should show confirmation dialog before clearing', async () => {
      const { clearData } = await import('../../src/app/error-handler');

      // Start clearData (it will await dialog)
      const clearPromise = clearData();

      // Confirm dialog should be shown
      const dialog = document.querySelector('.confirm-dialog');
      expect(dialog).not.toBeNull();
      expect(dialog?.textContent).toContain('Limpiar todos los datos');

      // Cancel the dialog
      const cancelBtn = document.querySelector('.confirm-dialog__cancel') as HTMLButtonElement;
      cancelBtn?.click();

      const result = await clearPromise;
      expect(result).toBe(false);
    });

    it('should clear data when user confirms', async () => {
      const { clearData } = await import('../../src/app/error-handler');

      const clearPromise = clearData();

      // Confirm the dialog
      const confirmBtn = document.querySelector('.confirm-dialog__confirm') as HTMLButtonElement;
      confirmBtn?.click();

      const result = await clearPromise;
      expect(result).toBe(true);
    });

    it('should show destructive styling on confirm button', async () => {
      const { clearData } = await import('../../src/app/error-handler');

      clearData();

      const confirmBtn = document.querySelector('.confirm-dialog__confirm');
      expect(confirmBtn?.classList.contains('btn-danger')).toBe(true);

      // Cleanup
      const cancelBtn = document.querySelector('.confirm-dialog__cancel') as HTMLButtonElement;
      cancelBtn?.click();
    });
  });

  describe('connectivity indicator', () => {
    it('should create connectivity indicator on init', async () => {
      const { initErrorHandler, destroyErrorHandler } = await import('../../src/app/error-handler');
      const container = document.getElementById('app')!;

      initErrorHandler(container);

      const indicator = container.querySelector('.connectivity-indicator');
      expect(indicator).not.toBeNull();

      destroyErrorHandler();
    });

    it('should hide indicator when online', async () => {
      // navigator.onLine defaults to true in jsdom
      const { initErrorHandler, destroyErrorHandler } = await import('../../src/app/error-handler');
      const container = document.getElementById('app')!;

      initErrorHandler(container);

      const indicator = container.querySelector('.connectivity-indicator') as HTMLElement;
      expect(indicator?.hidden).toBe(true);

      destroyErrorHandler();
    });
  });

  describe('initErrorHandler / destroyErrorHandler', () => {
    it('should set up and tear down without errors', async () => {
      const { initErrorHandler, destroyErrorHandler } = await import('../../src/app/error-handler');
      const container = document.getElementById('app')!;

      expect(() => initErrorHandler(container)).not.toThrow();
      expect(() => destroyErrorHandler()).not.toThrow();
    });
  });
});
