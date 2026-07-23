import type { FlowStep } from '../types/common';
import type { SessionState } from '../types/session';
import { StorageManager } from '../infrastructure/storage-manager';

/**
 * @description Represents the state managed by the flow orchestrator.
 * Tracks current step, completed steps, session restoration status, and auto-save.
 */
export interface FlowState {
  readonly currentStep: FlowStep;
  readonly completedSteps: FlowStep[];
  readonly isSessionRestored: boolean;
  readonly hasUnsavedChanges: boolean;
  readonly autoSaveEnabled: boolean;
}

/** Listener function type for state change subscriptions */
export type FlowStateListener = (state: FlowState) => void;

/** Ordered sequence of flow steps for navigation */
const FLOW_STEPS: readonly FlowStep[] = [
  'upload',
  'detection',
  'prism',
  'visualization',
  'objectives',
  'document',
] as const;

/** Auto-save interval in milliseconds (30 seconds) */
const AUTO_SAVE_INTERVAL_MS = 30_000;

/** Maximum time to detect a previous session (3 seconds) */
const SESSION_DETECTION_TIMEOUT_MS = 3_000;

/**
 * @description Returns the index of a step in the ordered flow sequence.
 * @param step - The flow step to look up
 * @returns Zero-based index of the step
 */
function getStepIndex(step: FlowStep): number {
  return FLOW_STEPS.indexOf(step);
}

/**
 * @description Validates whether a transition from current step to target step is allowed.
 * Transitions are allowed forward sequentially or back to any previous step.
 * @param currentStep - The step we're transitioning from
 * @param targetStep - The step we're transitioning to
 * @param completedSteps - Steps that have been completed
 * @returns True if the transition is valid
 */
function isValidTransition(
  currentStep: FlowStep,
  targetStep: FlowStep,
  completedSteps: FlowStep[]
): boolean {
  const currentIndex = getStepIndex(currentStep);
  const targetIndex = getStepIndex(targetStep);

  if (targetIndex === currentIndex) return false;
  if (targetIndex < currentIndex) return true;
  // Forward only if the step right before target is completed or is current
  return targetIndex === currentIndex + 1 || completedSteps.includes(FLOW_STEPS[targetIndex - 1]!);
}

/**
 * @description Creates the initial flow state for a new session.
 * @returns A fresh FlowState starting at 'upload'
 */
function createInitialState(): FlowState {
  return {
    currentStep: 'upload',
    completedSteps: [],
    isSessionRestored: false,
    hasUnsavedChanges: false,
    autoSaveEnabled: true,
  };
}

/**
 * @description Orchestrates the onboarding flow, managing step transitions,
 * centralized state, auto-save via StorageManager, and session detection.
 * Implements Observer pattern for UI component subscriptions.
 * 
 * Requirements: 8.2, 8.3, 10.4, 10.6, 13.3, 13.6
 */
export class FlowOrchestrator {
  private state: FlowState;
  private listeners: Set<FlowStateListener> = new Set();
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private readonly storageManager: StorageManager;

  /**
   * @description Constructs a FlowOrchestrator with an optional StorageManager.
   * @param storageManager - Storage manager for session persistence
   */
  constructor(storageManager?: StorageManager) {
    this.state = createInitialState();
    this.storageManager = storageManager ?? new StorageManager();
  }

  /**
   * @description Initializes the orchestrator by checking for an existing session.
   * Detection completes within 3 seconds. Does not restore automatically—
   * the caller decides via restoreSession() or startNewSession().
   * @returns Object indicating whether a previous session was found
   */
  async init(): Promise<{ hasSession: boolean }> {
    const result = await this.detectPreviousSession();
    return { hasSession: result };
  }

  /**
   * @description Returns the current flow step.
   * @returns The active FlowStep
   */
  getCurrentStep(): FlowStep {
    return this.state.currentStep;
  }

  /**
   * @description Returns a readonly copy of the current flow state.
   * @returns The current FlowState
   */
  getState(): FlowState {
    return { ...this.state };
  }

  /**
   * @description Navigates to a specific step if the transition is valid.
   * @param step - The target step to navigate to
   * @returns True if the transition was successful
   */
  goToStep(step: FlowStep): boolean {
    if (!isValidTransition(this.state.currentStep, step, this.state.completedSteps)) {
      return false;
    }
    this.updateState({ currentStep: step, hasUnsavedChanges: true });
    return true;
  }

  /**
   * @description Advances to the next step in the flow sequence.
   * @returns True if the advance was successful
   */
  goNext(): boolean {
    const currentIndex = getStepIndex(this.state.currentStep);
    if (currentIndex >= FLOW_STEPS.length - 1) return false;
    const nextStep = FLOW_STEPS[currentIndex + 1]!;
    this.updateState({ currentStep: nextStep, hasUnsavedChanges: true });
    return true;
  }

  /**
   * @description Goes back to the previous step in the flow sequence.
   * @returns True if the navigation was successful
   */
  goBack(): boolean {
    const currentIndex = getStepIndex(this.state.currentStep);
    if (currentIndex <= 0) return false;
    const prevStep = FLOW_STEPS[currentIndex - 1]!;
    this.updateState({ currentStep: prevStep, hasUnsavedChanges: true });
    return true;
  }

  /**
   * @description Subscribes a listener to state changes. Returns an unsubscribe function.
   * @param listener - Callback invoked on every state change
   * @returns Function that removes the subscription
   */
  subscribe(listener: FlowStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * @description Marks a step as completed, adding it to completedSteps if not already present.
   * @param step - The step to mark as completed
   */
  markStepCompleted(step: FlowStep): void {
    if (this.state.completedSteps.includes(step)) return;
    const completedSteps = [...this.state.completedSteps, step];
    this.updateState({ completedSteps, hasUnsavedChanges: true });
  }

  /**
   * @description Starts the auto-save timer (30-second interval).
   * Saves session state to StorageManager on each tick if there are unsaved changes.
   */
  startAutoSave(): void {
    if (this.autoSaveTimer !== null) return;
    this.updateState({ autoSaveEnabled: true });
    this.autoSaveTimer = setInterval(() => {
      this.performAutoSave();
    }, AUTO_SAVE_INTERVAL_MS);
  }

  /**
   * @description Stops the auto-save timer.
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer !== null) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    this.updateState({ autoSaveEnabled: false });
  }

  /**
   * @description Restores session from storage, updating flow state accordingly.
   * @returns True if session was successfully restored
   */
  async restoreSession(): Promise<boolean> {
    const loadResult = this.storageManager.loadSession();
    if (!loadResult.ok || loadResult.value === null) return false;

    const session = loadResult.value;
    this.updateState({
      currentStep: session.currentStep,
      completedSteps: this.deriveCompletedSteps(session.currentStep),
      isSessionRestored: true,
      hasUnsavedChanges: false,
    });
    return true;
  }

  /**
   * @description Starts a fresh session, clearing any stored data.
   */
  startNewSession(): void {
    this.storageManager.clearAll();
    this.state = createInitialState();
    this.notifyListeners();
  }

  /**
   * @description Detects whether a previous session exists in storage within 3 seconds.
   * @returns True if a valid (non-expired) session was found
   */
  private detectPreviousSession(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, SESSION_DETECTION_TIMEOUT_MS);

      try {
        if (this.storageManager.isSessionExpired()) {
          this.storageManager.clearAll();
          clearTimeout(timeout);
          resolve(false);
          return;
        }

        const loadResult = this.storageManager.loadSession();
        clearTimeout(timeout);

        if (loadResult.ok && loadResult.value !== null) {
          resolve(true);
        } else {
          resolve(false);
        }
      } catch {
        clearTimeout(timeout);
        resolve(false);
      }
    });
  }

  /**
   * @description Derives completed steps from the current step position.
   * All steps before the current step are considered completed.
   * @param currentStep - The step to derive completions from
   * @returns Array of completed steps
   */
  private deriveCompletedSteps(currentStep: FlowStep): FlowStep[] {
    const currentIndex = getStepIndex(currentStep);
    return FLOW_STEPS.slice(0, currentIndex) as FlowStep[];
  }

  /**
   * @description Performs auto-save if there are unsaved changes.
   * Builds a minimal SessionState and persists it via StorageManager.
   */
  private performAutoSave(): void {
    if (!this.state.hasUnsavedChanges) return;

    const sessionState = this.buildSessionState();
    const result = this.storageManager.saveSession(sessionState);

    if (result.ok) {
      this.updateState({ hasUnsavedChanges: false });
    }
  }

  /**
   * @description Builds a minimal SessionState for persistence from current flow state.
   * @returns A SessionState object suitable for storage
   */
  private buildSessionState(): SessionState {
    return {
      version: 1,
      sessionId: this.generateSessionId(),
      lastModified: Date.now(),
      currentStep: this.state.currentStep,
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
    };
  }

  /**
   * @description Generates a simple session ID based on timestamp.
   * @returns A unique session identifier string
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * @description Updates state with partial changes and notifies all listeners.
   * @param partial - Partial state to merge into current state
   */
  private updateState(partial: Partial<FlowState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * @description Notifies all subscribed listeners of the current state.
   */
  private notifyListeners(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
