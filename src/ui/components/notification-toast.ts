/**
 * @module notification-toast
 * @description Toast notification component for degraded functionality alerts.
 * Displays within 5 seconds and auto-dismisses after a configurable duration.
 * Validates: Requirements 13.1, 13.7
 */

/** Severity level for toast notifications */
export type ToastSeverity = 'info' | 'warning' | 'error';

/** Options for creating a toast notification */
export interface ToastOptions {
  /** Message to display to the user */
  message: string;
  /** Severity level (affects styling) */
  severity: ToastSeverity;
  /** Auto-dismiss duration in ms (default: 5000) */
  duration?: number;
  /** Whether the toast can be manually dismissed (default: true) */
  dismissible?: boolean;
}

/** Maximum number of simultaneous toasts */
const MAX_TOASTS = 5;

/** Default auto-dismiss duration in ms */
const DEFAULT_DURATION_MS = 5_000;

/** Container element for all toasts */
let toastContainer: HTMLElement | null = null;

/** Active toast timeout references for cleanup */
const activeTimers: Map<HTMLElement, ReturnType<typeof setTimeout>> = new Map();

/**
 * @description Ensures the toast container exists in the DOM.
 * @returns The toast container element
 */
function ensureContainer(): HTMLElement {
  if (toastContainer && document.body.contains(toastContainer)) {
    return toastContainer;
  }
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('aria-label', 'Notificaciones');
  toastContainer.setAttribute('role', 'region');
  document.body.appendChild(toastContainer);
  return toastContainer;
}

/**
 * @description Shows a toast notification to the user.
 * The notification appears within the 5-second requirement.
 * @param options - Toast display options
 * @returns The created toast element (for programmatic dismiss)
 */
export function showToast(options: ToastOptions): HTMLElement {
  const container = ensureContainer();
  enforceMaxToasts(container);

  const toast = createToastElement(options);
  container.appendChild(toast);

  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const timer = setTimeout(() => dismissToast(toast), duration);
  activeTimers.set(toast, timer);

  return toast;
}

/**
 * @description Dismisses a specific toast with fade-out animation.
 * @param toast - The toast element to remove
 */
export function dismissToast(toast: HTMLElement): void {
  const timer = activeTimers.get(toast);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(toast);
  }
  toast.classList.add('toast--exiting');
  setTimeout(() => toast.remove(), 300);
}

/**
 * @description Dismisses all active toasts immediately.
 */
export function dismissAllToasts(): void {
  for (const [toast, timer] of activeTimers) {
    clearTimeout(timer);
    toast.remove();
  }
  activeTimers.clear();
}

/**
 * @description Enforces the maximum number of visible toasts.
 * Removes the oldest toast if the limit is reached.
 * @param container - The toast container element
 */
function enforceMaxToasts(container: HTMLElement): void {
  while (container.children.length >= MAX_TOASTS) {
    const oldest = container.firstElementChild as HTMLElement;
    if (oldest) dismissToast(oldest);
  }
}

/**
 * @description Creates a toast DOM element with accessible attributes.
 * @param options - Toast configuration options
 * @returns The created toast HTMLElement
 */
function createToastElement(options: ToastOptions): HTMLElement {
  const toast = document.createElement('div');
  toast.className = `toast toast--${options.severity}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = getSeverityIcon(options.severity);

  const msg = document.createElement('span');
  msg.className = 'toast__message';
  msg.textContent = options.message;

  toast.appendChild(icon);
  toast.appendChild(msg);

  if (options.dismissible !== false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast__dismiss';
    btn.setAttribute('aria-label', 'Cerrar notificación');
    btn.textContent = '✕';
    btn.addEventListener('click', () => dismissToast(toast));
    toast.appendChild(btn);
  }

  return toast;
}

/**
 * @description Maps severity level to a display icon character.
 * @param severity - The toast severity level
 * @returns Icon character string
 */
function getSeverityIcon(severity: ToastSeverity): string {
  const icons: Record<ToastSeverity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
  };
  return icons[severity];
}
