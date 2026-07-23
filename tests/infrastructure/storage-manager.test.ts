import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { StorageManager } from '../../src/infrastructure/storage-manager';
import type { SessionState } from '../../src/types/session';

interface MockStorage {
  getItem: Mock<(key: string) => string | null>;
  setItem: Mock<(key: string, value: string) => void>;
  removeItem: Mock<(key: string) => void>;
  clear: Mock<() => void>;
  readonly length: number;
  key: Mock<(index: number) => string | null>;
}

// In-memory localStorage mock
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
    currentStep: 'upload',
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

describe('StorageManager', () => {
  let manager: StorageManager;
  let mockStorage: MockStorage;

  beforeEach(() => {
    mockStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    manager = new StorageManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constants', () => {
    it('should have MAX_STORAGE of 100 MB', () => {
      expect(manager.MAX_STORAGE).toBe(104_857_600);
    });

    it('should have WARNING_THRESHOLD of 0.8', () => {
      expect(manager.WARNING_THRESHOLD).toBe(0.8);
    });
  });

  describe('saveSession', () => {
    it('should save session state to localStorage', () => {
      const session = createMockSession();
      const result = manager.saveSession(session);

      expect(result.ok).toBe(true);
      const stored = localStorage.getItem('dashboard_session');
      expect(stored).not.toBeNull();
    });

    it('should update lastModified on save', () => {
      const session = createMockSession({ lastModified: 1000 });
      const beforeSave = Date.now();
      manager.saveSession(session);

      const stored = JSON.parse(
        localStorage.getItem('dashboard_session')!
      ) as SessionState;
      expect(stored.lastModified).toBeGreaterThanOrEqual(beforeSave);
    });

    it('should return WRITE_FAILED when localStorage throws', () => {
      mockStorage.setItem.mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      const session = createMockSession();
      const result = manager.saveSession(session);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('WRITE_FAILED');
        expect(result.error.module).toBe('storage');
      }
    });

    it('should return QUOTA_EXCEEDED for QuotaExceededError', () => {
      mockStorage.setItem.mockImplementation(() => {
        const error = new DOMException('Quota exceeded', 'QuotaExceededError');
        throw error;
      });

      const session = createMockSession();
      const result = manager.saveSession(session);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('QUOTA_EXCEEDED');
      }
    });
  });

  describe('loadSession', () => {
    it('should return null when no session exists', () => {
      const result = manager.loadSession();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('should return the stored session state', () => {
      const session = createMockSession();
      manager.saveSession(session);
      const result = manager.loadSession();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        expect(result.value!.sessionId).toBe('test-session-001');
        expect(result.value!.currentStep).toBe('upload');
      }
    });

    it('should return DATA_CORRUPTED for invalid JSON', () => {
      localStorage.setItem('dashboard_session', 'not-valid-json{{{');
      const result = manager.loadSession();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('DATA_CORRUPTED');
      }
    });
  });

  describe('getUsagePercent', () => {
    it('should return 0 when no data is stored', () => {
      expect(manager.getUsagePercent()).toBe(0);
    });

    it('should return a positive percentage after saving data', () => {
      const session = createMockSession();
      manager.saveSession(session);

      const usage = manager.getUsagePercent();
      expect(usage).toBeGreaterThan(0);
      expect(usage).toBeLessThan(1);
    });
  });

  describe('clearAll', () => {
    it('should remove all stored session data', () => {
      manager.saveSession(createMockSession());
      expect(localStorage.getItem('dashboard_session')).not.toBeNull();

      const result = manager.clearAll();
      expect(result.ok).toBe(true);
      expect(localStorage.getItem('dashboard_session')).toBeNull();
    });

    it('should return CLEAR_FAILED when removeItem throws', () => {
      mockStorage.removeItem.mockImplementation(() => {
        throw new Error('Cannot remove');
      });

      const result = manager.clearAll();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CLEAR_FAILED');
      }
    });
  });

  describe('isSessionExpired', () => {
    it('should return false when no session exists', () => {
      expect(manager.isSessionExpired()).toBe(false);
    });

    it('should return false for a recently saved session', () => {
      manager.saveSession(createMockSession());
      expect(manager.isSessionExpired()).toBe(false);
    });

    it('should return true for a session older than 30 days', () => {
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const session = createMockSession({ lastModified: thirtyOneDaysAgo });
      // Directly store to avoid lastModified update in saveSession
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      expect(manager.isSessionExpired()).toBe(true);
    });

    it('should return false for a session within 30 days', () => {
      const twentyNineDaysAgo = Date.now() - 29 * 24 * 60 * 60 * 1000;
      const session = createMockSession({ lastModified: twentyNineDaysAgo });
      localStorage.setItem('dashboard_session', JSON.stringify(session));

      expect(manager.isSessionExpired()).toBe(false);
    });

    it('should return false when stored data is corrupted', () => {
      localStorage.setItem('dashboard_session', 'corrupt-data');
      expect(manager.isSessionExpired()).toBe(false);
    });
  });
});
