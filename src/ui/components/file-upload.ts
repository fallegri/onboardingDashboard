/**
 * @module file-upload
 * @description File upload component with drag-and-drop, progress, and validation.
 * Supports .xlsx, .xls, .csv, .docx, .pdf files up to 50 MB.
 * Validates: Requirements 10.1, 10.2, 10.3, 10.5
 */

/** Props for the file upload component */
export interface FileUploadProps {
  /** Callback when a valid file is selected */
  onFileSelected: (file: File) => void;
  /** Upload progress (0-100), null when idle */
  progress: number | null;
  /** Error message to display, null when no error */
  error: string | null;
  /** Accepted file extensions */
  acceptedFormats?: string[];
  /** Max file size in bytes (default 50 MB) */
  maxSize?: number;
}

const DEFAULT_FORMATS = ['.xlsx', '.xls', '.csv', '.docx', '.pdf'];
const DEFAULT_MAX_SIZE = 52_428_800; // 50 MB

/**
 * Renders the file upload component with drag-and-drop zone.
 * @param container - Target DOM element
 * @param props - Upload configuration and callbacks
 */
export function renderFileUpload(
  container: HTMLElement,
  props: FileUploadProps
): void {
  container.innerHTML = '';
  const formats = props.acceptedFormats ?? DEFAULT_FORMATS;
  const maxSize = props.maxSize ?? DEFAULT_MAX_SIZE;

  const wrapper = document.createElement('div');
  wrapper.className = 'file-upload';

  const dropZone = createDropZone(formats, props, maxSize);
  const input = createFileInput(formats, props, maxSize);
  const progressBar = createProgressBar(props.progress);
  const errorEl = createErrorDisplay(props.error);

  wrapper.appendChild(dropZone);
  wrapper.appendChild(input);
  if (props.progress !== null) wrapper.appendChild(progressBar);
  if (props.error) wrapper.appendChild(errorEl);

  container.appendChild(wrapper);
}

/** Creates the drag-and-drop zone element */
function createDropZone(
  formats: string[],
  props: FileUploadProps,
  maxSize: number
): HTMLElement {
  const zone = document.createElement('div');
  zone.className = 'file-upload__drop-zone';
  zone.setAttribute('role', 'button');
  zone.setAttribute('tabindex', '0');
  zone.setAttribute('aria-label', 'Zona de carga de archivos. Arrastra un archivo o presiona para seleccionar.');

  const icon = document.createElement('span');
  icon.className = 'file-upload__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '📁';

  const text = document.createElement('p');
  text.className = 'file-upload__text';
  text.textContent = 'Arrastra tu archivo aquí o haz clic para seleccionar';

  const hint = document.createElement('p');
  hint.className = 'file-upload__hint';
  hint.textContent = `Formatos: ${formats.join(', ')} · Máximo: ${formatSize(maxSize)}`;

  zone.appendChild(icon);
  zone.appendChild(text);
  zone.appendChild(hint);

  setupDropEvents(zone, props, formats, maxSize);
  setupKeyboardActivation(zone);

  return zone;
}

/** Sets up drag-and-drop event listeners */
function setupDropEvents(
  zone: HTMLElement,
  props: FileUploadProps,
  formats: string[],
  maxSize: number
): void {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('file-upload__drop-zone--active');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('file-upload__drop-zone--active');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('file-upload__drop-zone--active');
    const file = e.dataTransfer?.files[0];
    if (file) validateAndEmit(file, formats, maxSize, props);
  });

  zone.addEventListener('click', () => {
    const input = zone.parentElement?.querySelector<HTMLInputElement>('.file-upload__input');
    input?.click();
  });
}

/** Allows keyboard activation of the drop zone */
function setupKeyboardActivation(zone: HTMLElement): void {
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      zone.click();
    }
  });
}

/** Creates the hidden file input element */
function createFileInput(
  formats: string[],
  props: FileUploadProps,
  maxSize: number
): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'file';
  input.className = 'file-upload__input visually-hidden';
  input.accept = formats.join(',');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) validateAndEmit(file, formats, maxSize, props);
  });

  return input;
}

/** Validates file and calls the onFileSelected callback */
function validateAndEmit(
  file: File,
  formats: string[],
  maxSize: number,
  props: FileUploadProps
): void {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!formats.includes(ext)) return;
  if (file.size > maxSize) return;
  props.onFileSelected(file);
}

/** Creates a progress bar element */
function createProgressBar(progress: number | null): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'file-upload__progress';
  wrapper.setAttribute('role', 'progressbar');
  wrapper.setAttribute('aria-valuenow', String(progress ?? 0));
  wrapper.setAttribute('aria-valuemin', '0');
  wrapper.setAttribute('aria-valuemax', '100');
  wrapper.setAttribute('aria-label', 'Progreso de carga del archivo');

  const fill = document.createElement('div');
  fill.className = 'file-upload__progress-fill';
  fill.style.width = `${progress ?? 0}%`;

  const text = document.createElement('span');
  text.className = 'file-upload__progress-text';
  text.textContent = `${progress ?? 0}%`;

  wrapper.appendChild(fill);
  wrapper.appendChild(text);
  return wrapper;
}

/** Creates an inline error display */
function createErrorDisplay(error: string | null): HTMLElement {
  const el = document.createElement('p');
  el.className = 'file-upload__error';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'assertive');
  el.textContent = error ?? '';
  return el;
}

/** Formats bytes to a human-readable string */
function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${Math.round(bytes / 1_048_576)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
