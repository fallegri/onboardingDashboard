/**
 * @module confirm-dialog
 * @description Confirmation dialog component for destructive actions.
 * Used before operations like "Limpiar datos" to prevent accidental data loss.
 * Validates: Requirements 8.8
 */

/** Options for the confirmation dialog */
export interface ConfirmDialogOptions {
  /** Dialog title */
  title: string;
  /** Descriptive message explaining the consequences */
  message: string;
  /** Text for the confirm button */
  confirmText?: string;
  /** Text for the cancel button */
  cancelText?: string;
  /** Whether the action is destructive (affects button styling) */
  destructive?: boolean;
}

/**
 * @description Shows a modal confirmation dialog and returns a promise.
 * Resolves to true if the user confirms, false if cancelled.
 * Traps focus within the dialog for accessibility compliance.
 * @param options - Dialog configuration options
 * @returns Promise resolving to the user's choice
 */
export function showConfirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = createOverlay();
    const dialog = createDialogElement(options, resolve, overlay);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    focusFirstButton(dialog);
  });
}

/**
 * @description Creates the overlay backdrop element.
 * @returns The overlay HTMLElement
 */
function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-dialog-overlay';
  overlay.setAttribute('role', 'presentation');
  return overlay;
}

/**
 * @description Creates the dialog element with title, message, and action buttons.
 * @param options - Dialog options
 * @param resolve - Promise resolver
 * @param overlay - Parent overlay for removal
 * @returns The dialog HTMLElement
 */
function createDialogElement(
  options: ConfirmDialogOptions,
  resolve: (value: boolean) => void,
  overlay: HTMLElement
): HTMLElement {
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
  dialog.setAttribute('aria-describedby', 'confirm-dialog-message');

  const title = document.createElement('h2');
  title.id = 'confirm-dialog-title';
  title.className = 'confirm-dialog__title';
  title.textContent = options.title;

  const message = document.createElement('p');
  message.id = 'confirm-dialog-message';
  message.className = 'confirm-dialog__message';
  message.textContent = options.message;

  const actions = createActions(options, resolve, overlay);

  dialog.appendChild(title);
  dialog.appendChild(message);
  dialog.appendChild(actions);

  dialog.addEventListener('keydown', (evt) => {
    handleDialogKeydown(evt, resolve, overlay);
  });

  return dialog;
}

/**
 * @description Creates the action buttons for confirm and cancel.
 * @param options - Dialog options
 * @param resolve - Promise resolver
 * @param overlay - Parent overlay for removal
 * @returns Action container element
 */
function createActions(
  options: ConfirmDialogOptions,
  resolve: (value: boolean) => void,
  overlay: HTMLElement
): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'confirm-dialog__actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary confirm-dialog__cancel';
  cancelBtn.textContent = options.cancelText ?? 'Cancelar';
  cancelBtn.addEventListener('click', () => closeDialog(overlay, resolve, false));

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  const btnClass = options.destructive ? 'btn btn-danger' : 'btn btn-primary';
  confirmBtn.className = `${btnClass} confirm-dialog__confirm`;
  confirmBtn.textContent = options.confirmText ?? 'Confirmar';
  confirmBtn.addEventListener('click', () => closeDialog(overlay, resolve, true));

  actions.appendChild(cancelBtn);
  actions.appendChild(confirmBtn);
  return actions;
}

/**
 * @description Handles keyboard events inside the dialog (Escape to cancel).
 * @param evt - Keyboard event
 * @param resolve - Promise resolver
 * @param overlay - Parent overlay for removal
 */
function handleDialogKeydown(
  evt: KeyboardEvent,
  resolve: (value: boolean) => void,
  overlay: HTMLElement
): void {
  if (evt.key === 'Escape') {
    closeDialog(overlay, resolve, false);
  }
}

/**
 * @description Closes the dialog, removes overlay, and resolves the promise.
 * @param overlay - Overlay element to remove
 * @param resolve - Promise resolver
 * @param result - User's choice (true = confirmed, false = cancelled)
 */
function closeDialog(
  overlay: HTMLElement,
  resolve: (value: boolean) => void,
  result: boolean
): void {
  overlay.remove();
  resolve(result);
}

/**
 * @description Focuses the first button in the dialog for keyboard access.
 * @param dialog - Dialog element containing buttons
 */
function focusFirstButton(dialog: HTMLElement): void {
  const firstBtn = dialog.querySelector('button');
  firstBtn?.focus();
}
