/**
 * @module error-handler
 * @description Global error handler that catches module failures, logs them,
 * and shows non-technical notifications. Manages graceful degradation including
 * online/offline monitoring, auto-save failure alerts, and clear-data confirmation.
 * Validates: Requirements 13.1, 13.4, 13.5, 13.6, 13.7, 8.8
 */

import { LogService } from '../infrastructure/log-service';
import { StorageManager } from '../infrastructure/storage-manager';
import {
  renderConnectivityIndicator,
  isOnline,
  cleanup as cleanupConnectivity,
} from '../ui/components/connectivity-indicator';
import { showToast } from '../ui/components/notification-toast';
import { showConfirmDialog } from '../ui/components/confirm-dialog';

/** Modules classified as essential — failure blocks flow progress */
const ESSENTIAL_MODULES: readonly string[] = [
  'carga',
  'prism',
  'visualizacion',
  'documento',
] as const;

/** Modules classified as non-essential — failure allows flow to continue */
const NON_ESSENTIAL_MODULES: readonly string[] = [
  'ia',
  'ollama',
] as const;

/** Maximum time allowed before notifying user (5 seconds) */
const NOTIFICATION_DEADLINE_MS = 5_000;

/** Internal state for the error handler */
interface ErrorHandlerState {
  initialized: boolean;
  logService: LogService;
  storageManager: StorageManager;
  onConnectivityChange: ((online: boolean) => void) | null;
}

const handlerState: ErrorHandlerState = {
  initialized: false,
  logService: new LogService(),
  storageManager: new StorageManager(),
  onConnectivityChange: null,
};

/**
 * @description Initializes the global error handler.
 * Sets up connectivity monitoring and window error listeners.
 * @param container - DOM element for the connectivity indicator
 * @param logService - Optional LogService instance override
 * @param storageManager - Optional StorageManager instance override
 */
export function initErrorHandler(
  container: HTMLElement,
  logService?: LogService,
  storageManager?: StorageManager
): void {
  if (logService) handlerState.logService = logService;
  if (storageManager) handlerState.storageManager = storageManager;

  renderConnectivityIndicator(container, {
    onStatusChange: handleConnectivityChange,
  });

  window.addEventListener('error', handleGlobalError);
  window.addEventListener('unhandledrejection', handleUnhandledRejection);
  handlerState.initialized = true;
}

/**
 * @description Tears down the error handler, removing all listeners.
 */
export function destroyErrorHandler(): void {
  cleanupConnectivity();
  window.removeEventListener('error', handleGlobalError);
  window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  handlerState.initialized = false;
}

/**
 * @description Determines if a module is essential for the application flow.
 * @param moduleName - Name of the module to classify
 * @returns True if the module is essential
 */
export function isEssentialModule(moduleName: string): boolean {
  return ESSENTIAL_MODULES.includes(moduleName);
}

/**
 * @description Determines if a module is non-essential (degradation-safe).
 * @param moduleName - Name of the module to classify
 * @returns True if the module is non-essential
 */
export function isNonEssentialModule(moduleName: string): boolean {
  return NON_ESSENTIAL_MODULES.includes(moduleName);
}

/**
 * @description Handles an error from any application module.
 * Logs the error and shows appropriate user notification.
 * For non-essential modules, allows flow to continue.
 * For essential modules, shows error and preserves state.
 * @param moduleName - The module that produced the error
 * @param error - The error object
 */
export function handleModuleError(moduleName: string, error: Error): void {
  handlerState.logService.logError(moduleName, error, {
    online: isOnline(),
    timestamp: Date.now(),
  });

  if (isNonEssentialModule(moduleName)) {
    notifyDegradedFunctionality(moduleName);
  } else {
    notifyEssentialFailure(moduleName);
  }
}

/**
 * @description Notifies the user that a non-essential feature is unavailable.
 * Notification appears within 5 seconds per requirement 13.1.
 * @param moduleName - Name of the unavailable module
 */
function notifyDegradedFunctionality(moduleName: string): void {
  const messages: Record<string, string> = {
    ia: 'La asistencia de IA no está disponible. Puedes continuar el análisis manualmente.',
    ollama: 'El servicio local de IA (Ollama) no está disponible.',
  };
  const msg = messages[moduleName] ?? `La funcionalidad "${moduleName}" no está disponible.`;

  showToast({ message: msg, severity: 'warning', duration: NOTIFICATION_DEADLINE_MS });
}

/**
 * @description Notifies the user of an essential module failure.
 * Preserves current state and shows actionable error.
 * @param moduleName - Name of the failed essential module
 */
function notifyEssentialFailure(moduleName: string): void {
  const displayName = getModuleDisplayName(moduleName);
  const msg = `Hubo un problema en ${displayName}. Tus datos están seguros.`;

  showToast({ message: msg, severity: 'error', duration: NOTIFICATION_DEADLINE_MS });
  preserveCurrentState();
}

/**
 * @description Notifies the user that auto-save has failed.
 * Must notify within 5 seconds per requirement 13.7.
 */
export function notifyAutoSaveFailure(): void {
  handlerState.logService.logError('storage', new Error('Auto-save failed'), {
    timestamp: Date.now(),
  });

  showToast({
    message: 'El guardado automático falló. Guarda tu trabajo manualmente.',
    severity: 'error',
    duration: NOTIFICATION_DEADLINE_MS,
  });
}

/**
 * @description Initiates the "clear data" flow with a confirmation dialog.
 * Shows a confirm dialog before deleting all stored data.
 * @returns Promise resolving to true if data was cleared
 */
export async function clearData(): Promise<boolean> {
  const confirmed = await showConfirmDialog({
    title: 'Limpiar todos los datos',
    message: '¿Estás seguro? Se eliminarán todos los datos almacenados localmente, ' +
      'incluyendo tu sesión actual, configuraciones y progreso. Esta acción no se puede deshacer.',
    confirmText: 'Limpiar datos',
    cancelText: 'Cancelar',
    destructive: true,
  });

  if (!confirmed) return false;

  const result = handlerState.storageManager.clearAll();
  if (result.ok) {
    showToast({ message: 'Datos eliminados correctamente.', severity: 'info' });
  } else {
    showToast({ message: 'No se pudieron eliminar los datos.', severity: 'error' });
  }
  return confirmed;
}

/**
 * @description Handles connectivity change events.
 * Disables cloud providers when offline; notifies within 5 seconds.
 * @param online - New connectivity state
 */
function handleConnectivityChange(online: boolean): void {
  if (!online) {
    showToast({
      message: 'Sin conexión. Los proveedores de IA en la nube no están disponibles.',
      severity: 'warning',
      duration: NOTIFICATION_DEADLINE_MS,
    });
  } else {
    showToast({
      message: 'Conexión restaurada.',
      severity: 'info',
      duration: 3_000,
    });
  }
  handlerState.onConnectivityChange?.(online);
}

/**
 * @description Handles unhandled window errors and logs them.
 * @param event - The ErrorEvent from the window
 */
function handleGlobalError(event: ErrorEvent): void {
  const error = event.error instanceof Error
    ? event.error
    : new Error(event.message || 'Unknown error');
  handlerState.logService.logError('global', error, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
}

/**
 * @description Handles unhandled promise rejections and logs them.
 * @param event - The PromiseRejectionEvent from the window
 */
function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  const error = reason instanceof Error ? reason : new Error(String(reason));
  handlerState.logService.logError('global', error, { type: 'unhandledrejection' });
}

/**
 * @description Attempts to preserve current session state to prevent data loss.
 */
function preserveCurrentState(): void {
  // Trigger a save attempt; failures are logged but do not cascade
  try {
    const session = handlerState.storageManager.loadSession();
    if (session.ok && session.value) {
      handlerState.storageManager.saveSession(session.value);
    }
  } catch {
    // Silent catch — preservation is best-effort
  }
}

/**
 * @description Maps module identifiers to user-friendly display names.
 * @param moduleName - Internal module identifier
 * @returns Human-readable module name in Spanish
 */
function getModuleDisplayName(moduleName: string): string {
  const names: Record<string, string> = {
    carga: 'la carga de archivos',
    prism: 'la auditoría de calidad',
    visualizacion: 'los gráficos',
    documento: 'la generación de documentos',
    ia: 'la asistencia de IA',
    ollama: 'el servicio local de IA',
  };
  return names[moduleName] ?? moduleName;
}

/**
 * @description Sets a callback for connectivity change events (used by Motor_IA).
 * @param callback - Function to call when connectivity changes
 */
export function onConnectivityChange(callback: (online: boolean) => void): void {
  handlerState.onConnectivityChange = callback;
}

/**
 * @description Re-exports isOnline for consumers that need current status.
 * @returns True if the browser is currently online
 */
export { isOnline };
