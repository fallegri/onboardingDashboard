import type { SessionState } from '../types/session';
import type { StorageError } from '../types/errors';
import type { Result } from '../types/result';
import { ok, err } from '../types/result';

/** localStorage key for session data */
const SESSION_KEY = 'dashboard_session';

/** 30 days in milliseconds */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @description Manages localStorage persistence for session state.
 * Implements IStorageManager with 100 MB limit, 30-day expiration,
 * and 80% usage warning threshold.
 */
export class StorageManager {
  /** Maximum storage limit in bytes (100 MB) */
  readonly MAX_STORAGE = 104_857_600;

  /** Warning threshold as a fraction (80%) */
  readonly WARNING_THRESHOLD = 0.8;

  /**
   * @description Saves the session state to localStorage as JSON.
   * Updates lastModified timestamp before persisting.
   * @param state - The complete SessionState to persist
   * @returns Result<void, StorageError> indicating success or failure
   */
  saveSession(state: SessionState): Result<void, StorageError> {
    try {
      const updatedState: SessionState = {
        ...state,
        lastModified: Date.now(),
      };
      const serialized = JSON.stringify(updatedState);

      const sizeInBytes = new TextEncoder().encode(serialized).byteLength;
      if (sizeInBytes > this.MAX_STORAGE) {
        return err(this.createError('QUOTA_EXCEEDED', sizeInBytes));
      }

      localStorage.setItem(SESSION_KEY, serialized);
      return ok(undefined);
    } catch (error) {
      const usedBytes = this.getStorageSizeBytes();
      if (
        error instanceof DOMException &&
        error.name === 'QuotaExceededError'
      ) {
        return err(this.createError('QUOTA_EXCEEDED', usedBytes));
      }
      return err(this.createError('WRITE_FAILED', usedBytes));
    }
  }

  /**
   * @description Loads the session state from localStorage.
   * Returns null if no session exists.
   * @returns Result<SessionState | null, StorageError>
   */
  loadSession(): Result<SessionState | null, StorageError> {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw === null) {
        return ok(null);
      }

      const parsed = JSON.parse(raw) as SessionState;
      return ok(parsed);
    } catch {
      const usedBytes = this.getStorageSizeBytes();
      return err(this.createError('DATA_CORRUPTED', usedBytes));
    }
  }

  /**
   * @description Calculates the current storage usage as a percentage (0-100).
   * Based on the size of the session data relative to MAX_STORAGE.
   * @returns Number between 0 and 100 representing usage percent
   */
  getUsagePercent(): number {
    const usedBytes = this.getStorageSizeBytes();
    return (usedBytes / this.MAX_STORAGE) * 100;
  }

  /**
   * @description Clears all application data from localStorage.
   * @returns Result<void, StorageError> indicating success or failure
   */
  clearAll(): Result<void, StorageError> {
    try {
      localStorage.removeItem(SESSION_KEY);
      return ok(undefined);
    } catch {
      return err(this.createError('CLEAR_FAILED', 0));
    }
  }

  /**
   * @description Checks whether the stored session has expired (older than 30 days).
   * Returns false if no session exists.
   * @returns true if the session's lastModified is older than 30 days
   */
  isSessionExpired(): boolean {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw === null) {
        return false;
      }

      const parsed = JSON.parse(raw) as SessionState;
      const age = Date.now() - parsed.lastModified;
      return age > SESSION_MAX_AGE_MS;
    } catch {
      return false;
    }
  }

  /**
   * @description Calculates the byte size of the stored session data.
   * @returns Size in bytes of the stored session, 0 if nothing stored
   */
  private getStorageSizeBytes(): number {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw === null) {
      return 0;
    }
    return new TextEncoder().encode(raw).byteLength;
  }

  /**
   * @description Creates a typed StorageError with consistent structure.
   * @param code - The specific error code
   * @param storageUsedBytes - Current storage usage in bytes
   * @returns A fully formed StorageError object
   */
  private createError(
    code: StorageError['code'],
    storageUsedBytes: number
  ): StorageError {
    return {
      code,
      message: this.getErrorMessage(code),
      timestamp: new Date().toISOString(),
      module: 'storage',
      storageUsedBytes,
    };
  }

  /**
   * @description Maps error codes to user-friendly messages.
   * @param code - The error code to translate
   * @returns Human-readable error message
   */
  private getErrorMessage(code: StorageError['code']): string {
    const messages: Record<StorageError['code'], string> = {
      QUOTA_EXCEEDED:
        'El almacenamiento ha superado el límite de 100 MB. Libere espacio o exporte datos.',
      WRITE_FAILED:
        'No se pudo guardar la sesión. Verifique los permisos del navegador.',
      READ_FAILED:
        'No se pudo leer la sesión almacenada.',
      SESSION_EXPIRED:
        'La sesión ha expirado tras 30 días de inactividad.',
      DATA_CORRUPTED:
        'Los datos de la sesión están corruptos y no pueden ser recuperados.',
      CLEAR_FAILED:
        'No se pudieron eliminar los datos almacenados.',
    };
    return messages[code];
  }
}
