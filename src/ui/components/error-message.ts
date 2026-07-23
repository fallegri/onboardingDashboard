/**
 * @module error-message
 * @description Non-technical error display component.
 * Shows user-friendly messages with suggested actions.
 * Preserves data context for recovery.
 * Validates: Requirements 10.5
 */

/** Props for the error message component */
export interface ErrorMessageProps {
  /** User-friendly title (non-technical) */
  title: string;
  /** Description of what happened in plain language */
  description: string;
  /** Suggested actions the user can take */
  suggestions: string[];
  /** Optional retry callback */
  onRetry?: () => void;
  /** Optional dismiss callback */
  onDismiss?: () => void;
}

/**
 * Renders an accessible error message into the given container.
 * Uses role="alert" for screen reader announcement.
 * @param container - Target DOM element
 * @param props - Error display properties
 */
export function renderErrorMessage(
  container: HTMLElement,
  props: ErrorMessageProps
): void {
  container.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'error-message';
  wrapper.setAttribute('role', 'alert');
  wrapper.setAttribute('aria-live', 'assertive');
  wrapper.setAttribute('aria-atomic', 'true');

  const header = createErrorHeader(props);
  const body = createErrorBody(props);
  const actions = createErrorActions(props);

  wrapper.appendChild(header);
  wrapper.appendChild(body);
  wrapper.appendChild(actions);
  container.appendChild(wrapper);
}

/** Creates the error header with icon and title */
function createErrorHeader(props: ErrorMessageProps): HTMLElement {
  const header = document.createElement('div');
  header.className = 'error-message__header';

  const icon = document.createElement('span');
  icon.className = 'error-message__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⚠️';

  const title = document.createElement('h3');
  title.className = 'error-message__title';
  title.textContent = props.title;

  header.appendChild(icon);
  header.appendChild(title);
  return header;
}

/** Creates the error body with description and suggestions */
function createErrorBody(props: ErrorMessageProps): HTMLElement {
  const body = document.createElement('div');
  body.className = 'error-message__body';

  const desc = document.createElement('p');
  desc.className = 'error-message__description';
  desc.textContent = props.description;
  body.appendChild(desc);

  if (props.suggestions.length > 0) {
    const sugLabel = document.createElement('p');
    sugLabel.className = 'error-message__sug-label';
    sugLabel.textContent = 'Puedes intentar lo siguiente:';
    body.appendChild(sugLabel);

    const list = document.createElement('ul');
    list.className = 'error-message__suggestions';
    for (const suggestion of props.suggestions) {
      const li = document.createElement('li');
      li.textContent = suggestion;
      list.appendChild(li);
    }
    body.appendChild(list);
  }

  return body;
}

/** Creates action buttons for retry and dismiss */
function createErrorActions(props: ErrorMessageProps): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'error-message__actions';

  if (props.onRetry) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-primary error-message__retry';
    retryBtn.textContent = 'Intentar de nuevo';
    retryBtn.addEventListener('click', props.onRetry);
    actions.appendChild(retryBtn);
  }

  if (props.onDismiss) {
    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = 'btn btn-secondary error-message__dismiss';
    dismissBtn.textContent = 'Cerrar';
    dismissBtn.setAttribute('aria-label', 'Cerrar mensaje de error');
    dismissBtn.addEventListener('click', props.onDismiss);
    actions.appendChild(dismissBtn);
  }

  return actions;
}

/**
 * Maps a technical error code to a user-friendly message.
 * @param code - Machine-readable error code
 * @returns User-friendly error props
 */
export function mapErrorToUserMessage(code: string): Pick<ErrorMessageProps, 'title' | 'description' | 'suggestions'> {
  const errorMap: Record<string, Pick<ErrorMessageProps, 'title' | 'description' | 'suggestions'>> = {
    INVALID_FORMAT: {
      title: 'Formato de archivo no compatible',
      description: 'El archivo seleccionado no es un formato que podamos procesar.',
      suggestions: ['Usa un archivo Excel (.xlsx, .xls), CSV (.csv), Word (.docx) o PDF (.pdf)', 'Verifica que el archivo no esté dañado'],
    },
    FILE_TOO_LARGE: {
      title: 'El archivo es demasiado grande',
      description: 'El archivo supera el límite de tamaño permitido (50 MB).',
      suggestions: ['Divide el archivo en partes más pequeñas', 'Elimina hojas o columnas que no necesites'],
    },
    FILE_EMPTY: {
      title: 'El archivo está vacío',
      description: 'No encontramos datos para analizar en este archivo.',
      suggestions: ['Verifica que el archivo contenga datos', 'Selecciona otro archivo con información'],
    },
    NETWORK_ERROR: {
      title: 'Problema de conexión',
      description: 'No pudimos conectarnos al servicio solicitado.',
      suggestions: ['Verifica tu conexión a internet', 'Intenta de nuevo en unos momentos'],
    },
  };

  return errorMap[code] ?? {
    title: 'Algo salió mal',
    description: 'Ocurrió un problema inesperado al procesar tu solicitud.',
    suggestions: ['Intenta la acción de nuevo', 'Si el problema persiste, recarga la página'],
  };
}
