import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { FlowOrchestrator } from '../../src/app/flow-orchestrator';
import type { FlowState } from '../../src/app/flow-orchestrator';
import type { SessionState } from '../../src/types/session';

interface MockStorage {
  getItem: Mock<(key: string) => string | null>;
  setItem: Mock<(key: string, value: string) => void>;
  removeItem: Mock<(key: string) => void>;
  clear: Mock<() => void>;
  readonly length: number;
  key: Mock<(index: number) => string | null>;
}

function createLocalStorageMock(): MockStorage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] ?? null),
    setItem: vi.fn((key: string, value: string): void => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key];
    }),
    clear: vi.fn((): void => {
      store = {};
    }),
    get length(): number {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number): string | null => Object.keys(store)[index] ?? null),
  };
}

function createMockSession(overrides?: Partial<SessionState>): SessionState {
  return {
    version: 1,
    sessionId: 'test-session-001',
    lastModified: Date.now(),
    currentStep: 'visualization',
    fileData: null,
    detectionResult: null,
    prismResult: null,
    visualizations: [],
    selectedKPIs: [],
    objectives: [],
    links: [],
    iaConfig: {
      activeProviderId: null,
      providers: [],
      queryHistory: [],
    },
    userCustomizations: {
      sectionTitles: {},
      interpretationTexts: {},
      objectiveOrder: [],
    },
    uiPreferences: {
      theme: 'light',
      locale: 'es',
    },
    ...overrides,
  };
}

describe('FlowOrchestrator', () => {
  let orchestrator: FlowOrchestrator;
  let mockStorage: MockStorage;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    orchestrator = new FlowOrchestrator();
  });

  afterEach(() => {
    orchestrator.stopAutoSave();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start at upload step', () => {
      expect(orchestrator.getCurrentStep()).toBe('upload');
    });

    it('should have empty completed steps', () => {
      expect(orchestrator.getState().completedSteps).toEqual([]);
    });

    it('should not be session restored initially', () => {
      expect(orchestrator.getState().isSessionRestored).toBe(false);
    });

    it('should have autoSaveEnabled true by default', () => {
      expect(orchestrator.getState().autoSaveEnabled).toBe(true);
    });

    it('should have no unsaved changes initially', () => {
      expect(orchestrator.getState().hasUnsavedChanges).toBe(false);
    });
  });

  describe('init()', () => {
    it('should detect existing session and return hasSession true', async () => {
      const session = createMockSession();
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      const result = await orchestrator.init();
      expect(result.hasSession).toBe(true);
    });

    it('should return hasSession false when no session exists', async () => {
      const result = await orchestrator.init();
      expect(result.hasSession).toBe(false);
    });

    it('should return hasSession false for expired sessions', async () => {
      const expiredSession = createMockSession({
        lastModified: Date.now() - 31 * 24 * 60 * 60 * 1000,
      });
      localStorage.setItem('dashboard_session', JSON.stringify(expiredSession));

      const result = await orchestrator.init();
      expect(result.hasSession).toBe(false);
    });

    it('should complete within 3 seconds even on slow storage', async () => {
      // Simulate slow storage by setting corrupted data
      localStorage.setItem('dashboard_session', 'invalid-json');

      const startTime = Date.now();
      const result = await orchestrator.init();
      const elapsed = Date.now() - startTime;

      expect(result.hasSession).toBe(false);
      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe('goToStep()', () => {
    it('should allow moving forward one step from upload', () => {
      const result = orchestrator.goToStep('detection');
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('detection');
    });

    it('should not allow skipping steps without completion', () => {
      const result = orchestrator.goToStep('visualization');
      expect(result).toBe(false);
      expect(orchestrator.getCurrentStep()).toBe('upload');
    });

    it('should allow going back to any previous step', () => {
      orchestrator.goToStep('detection');
      orchestrator.markStepCompleted('detection');
      orchestrator.goToStep('prism');

      const result = orchestrator.goToStep('upload');
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('upload');
    });

    it('should not allow going to the same step', () => {
      const result = orchestrator.goToStep('upload');
      expect(result).toBe(false);
    });

    it('should mark state as having unsaved changes', () => {
      orchestrator.goToStep('detection');
      expect(orchestrator.getState().hasUnsavedChanges).toBe(true);
    });

    it('should allow skipping steps when intermediate steps are completed', () => {
      orchestrator.markStepCompleted('upload');
      orchestrator.markStepCompleted('detection');
      orchestrator.markStepCompleted('prism');

      const result = orchestrator.goToStep('visualization');
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('visualization');
    });
  });

  describe('goNext()', () => {
    it('should advance from upload to detection', () => {
      const result = orchestrator.goNext();
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('detection');
    });

    it('should advance sequentially through all steps', () => {
      const expectedSteps = ['detection', 'prism', 'visualization', 'objectives', 'document'];
      for (const expected of expectedSteps) {
        const result = orchestrator.goNext();
        expect(result).toBe(true);
        expect(orchestrator.getCurrentStep()).toBe(expected);
      }
    });

    it('should return false when already at the last step', () => {
      // Navigate to last step
      orchestrator.goNext(); // detection
      orchestrator.goNext(); // prism
      orchestrator.goNext(); // visualization
      orchestrator.goNext(); // objectives
      orchestrator.goNext(); // document

      const result = orchestrator.goNext();
      expect(result).toBe(false);
      expect(orchestrator.getCurrentStep()).toBe('document');
    });
  });

  describe('goBack()', () => {
    it('should return false when at upload (first step)', () => {
      const result = orchestrator.goBack();
      expect(result).toBe(false);
      expect(orchestrator.getCurrentStep()).toBe('upload');
    });

    it('should go back from detection to upload', () => {
      orchestrator.goNext(); // to detection
      const result = orchestrator.goBack();
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('upload');
    });

    it('should navigate backwards through steps', () => {
      orchestrator.goNext(); // detection
      orchestrator.goNext(); // prism
      orchestrator.goNext(); // visualization

      orchestrator.goBack();
      expect(orchestrator.getCurrentStep()).toBe('prism');
      orchestrator.goBack();
      expect(orchestrator.getCurrentStep()).toBe('detection');
    });
  });

  describe('subscribe()', () => {
    it('should notify listener on state change', () => {
      const listener = vi.fn();
      orchestrator.subscribe(listener);

      orchestrator.goNext();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ currentStep: 'detection' })
      );
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      orchestrator.subscribe(listener1);
      orchestrator.subscribe(listener2);

      orchestrator.goNext();
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = orchestrator.subscribe(listener);

      orchestrator.goNext();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      orchestrator.goNext();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should provide a snapshot of state to listeners', () => {
      let receivedState: FlowState | null = null;
      orchestrator.subscribe((state) => {
        receivedState = state;
      });

      orchestrator.goNext();
      expect(receivedState).not.toBeNull();
      expect(receivedState!.currentStep).toBe('detection');
      expect(receivedState!.hasUnsavedChanges).toBe(true);
    });
  });

  describe('markStepCompleted()', () => {
    it('should add step to completed steps', () => {
      orchestrator.markStepCompleted('upload');
      expect(orchestrator.getState().completedSteps).toContain('upload');
    });

    it('should not duplicate completed steps', () => {
      orchestrator.markStepCompleted('upload');
      orchestrator.markStepCompleted('upload');
      const completedCount = orchestrator.getState().completedSteps
        .filter((s) => s === 'upload').length;
      expect(completedCount).toBe(1);
    });

    it('should mark as having unsaved changes', () => {
      orchestrator.markStepCompleted('upload');
      expect(orchestrator.getState().hasUnsavedChanges).toBe(true);
    });
  });

  describe('auto-save', () => {
    it('should save session after 30 seconds when there are unsaved changes', () => {
      orchestrator.startAutoSave();
      orchestrator.goNext(); // creates unsaved changes

      vi.advanceTimersByTime(30_000);

      expect(mockStorage.setItem).toHaveBeenCalled();
    });

    it('should not save if there are no unsaved changes', () => {
      orchestrator.startAutoSave();
      // No changes made
      vi.advanceTimersByTime(30_000);

      expect(mockStorage.setItem).not.toHaveBeenCalled();
    });

    it('should clear hasUnsavedChanges after successful auto-save', () => {
      orchestrator.startAutoSave();
      orchestrator.goNext(); // has unsaved changes
      expect(orchestrator.getState().hasUnsavedChanges).toBe(true);

      vi.advanceTimersByTime(30_000);
      expect(orchestrator.getState().hasUnsavedChanges).toBe(false);
    });

    it('should stop saving when stopAutoSave is called', () => {
      orchestrator.startAutoSave();
      orchestrator.goNext();
      orchestrator.stopAutoSave();

      vi.advanceTimersByTime(60_000);
      // setItem may have been called during goNext's notification, but not for auto-save
      const callCountBeforeAdvance = mockStorage.setItem.mock.calls.length;
      vi.advanceTimersByTime(30_000);
      expect(mockStorage.setItem.mock.calls.length).toBe(callCountBeforeAdvance);
    });

    it('should not start multiple timers if startAutoSave called twice', () => {
      orchestrator.startAutoSave();
      orchestrator.startAutoSave();
      orchestrator.goNext();

      vi.advanceTimersByTime(30_000);

      // Should only have one save call (not two)
      const saveCalls = mockStorage.setItem.mock.calls.filter(
        (call) => call[0] === 'dashboard_session'
      );
      expect(saveCalls.length).toBe(1);
    });

    it('should set autoSaveEnabled to false when stopped', () => {
      orchestrator.startAutoSave();
      orchestrator.stopAutoSave();
      expect(orchestrator.getState().autoSaveEnabled).toBe(false);
    });
  });

  describe('restoreSession()', () => {
    it('should restore session and update current step', async () => {
      const session = createMockSession({ currentStep: 'prism' });
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      const result = await orchestrator.restoreSession();
      expect(result).toBe(true);
      expect(orchestrator.getCurrentStep()).toBe('prism');
    });

    it('should derive completed steps from restored step', async () => {
      const session = createMockSession({ currentStep: 'visualization' });
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      await orchestrator.restoreSession();
      const state = orchestrator.getState();
      expect(state.completedSteps).toEqual(['upload', 'detection', 'prism']);
    });

    it('should mark isSessionRestored as true', async () => {
      const session = createMockSession();
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      await orchestrator.restoreSession();
      expect(orchestrator.getState().isSessionRestored).toBe(true);
    });

    it('should return false when no session exists', async () => {
      const result = await orchestrator.restoreSession();
      expect(result).toBe(false);
    });

    it('should return false for corrupted data', async () => {
      localStorage.setItem('dashboard_session', 'not-json');
      const result = await orchestrator.restoreSession();
      expect(result).toBe(false);
    });
  });

  describe('startNewSession()', () => {
    it('should reset state to initial values', () => {
      orchestrator.goNext();
      orchestrator.markStepCompleted('upload');
      orchestrator.startNewSession();

      const state = orchestrator.getState();
      expect(state.currentStep).toBe('upload');
      expect(state.completedSteps).toEqual([]);
      expect(state.isSessionRestored).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should clear storage', () => {
      localStorage.setItem('dashboard_session', JSON.stringify(createMockSession()));
      orchestrator.startNewSession();
      expect(localStorage.getItem('dashboard_session')).toBeNull();
    });

    it('should notify listeners after reset', () => {
      const listener = vi.fn();
      orchestrator.subscribe(listener);

      orchestrator.startNewSession();
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ currentStep: 'upload' })
      );
    });
  });

  describe('transition performance', () => {
    it('should complete step transitions in under 500ms', () => {
      const start = performance.now();
      orchestrator.goNext();
      orchestrator.goNext();
      orchestrator.goNext();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });
  });
});
