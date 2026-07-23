/**
 * @module connectivity-indicator
 * @description Online/offline status indicator component.
 * Monitors navigator.onLine and listens to 'online'/'offline' events.
 * Shows a persistent indicator when the user is offline.
 * Validates: Requirements 13.4
 */

/** Props for the connectivity indicator */
export interface ConnectivityIndicatorProps {
  /** Callback when connectivity status changes */
  onStatusChange?: (isOnline: boolean) => void;
}

/** State tracked by the connectivity indicator */
interface IndicatorState {
  isOnline: boolean;
  element: HTMLElement | null;
  onlineHandler: (() => void) | null;
  offlineHandler: (() => void) | null;
}

const state: IndicatorState = {
  isOnline: true,
  element: null,
  onlineHandler: null,
  offlineHandler: null,
};

/**
 * @description Returns the current online status.
 * @returns True if the browser is online
 */
export function isOnline(): boolean {
  return state.isOnline;
}

/**
 * @description Renders a connectivity indicator into the container.
 * Shows a banner when offline; hides when online.
 * @param container - Target DOM element
 * @param props - Connectivity indicator properties
 */
export function renderConnectivityIndicator(
  container: HTMLElement,
  props: ConnectivityIndicatorProps = {}
): void {
  cleanup();

  state.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const element = createIndicatorElement();
  container.appendChild(element);
  state.element = element;

  updateVisibility(element, state.isOnline);

  state.onlineHandler = (): void => handleStatusChange(true, element, props);
  state.offlineHandler = (): void => handleStatusChange(false, element, props);

  window.addEventListener('online', state.onlineHandler);
  window.addEventListener('offline', state.offlineHandler);
}

/**
 * @description Creates the indicator DOM element with accessible attributes.
 * @returns The indicator HTMLElement
 */
function createIndicatorElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'connectivity-indicator';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `<span class="connectivity-indicator__icon" aria-hidden="true">⚡</span>` +
    `<span class="connectivity-indicator__text">Sin conexión a internet</span>`;
  return el;
}

/**
 * @description Updates visibility based on online status.
 * @param element - The indicator element
 * @param online - Whether the browser is online
 */
function updateVisibility(element: HTMLElement, online: boolean): void {
  element.hidden = online;
  element.classList.toggle('connectivity-indicator--offline', !online);
}

/**
 * @description Handles connectivity status changes.
 * @param online - New connectivity status
 * @param element - Indicator DOM element
 * @param props - Component props with optional callback
 */
function handleStatusChange(
  online: boolean,
  element: HTMLElement,
  props: ConnectivityIndicatorProps
): void {
  state.isOnline = online;
  updateVisibility(element, online);
  props.onStatusChange?.(online);
}

/**
 * @description Removes event listeners and cleans up state.
 */
export function cleanup(): void {
  if (state.onlineHandler) {
    window.removeEventListener('online', state.onlineHandler);
  }
  if (state.offlineHandler) {
    window.removeEventListener('offline', state.offlineHandler);
  }
  state.element?.remove();
  state.element = null;
  state.onlineHandler = null;
  state.offlineHandler = null;
}
