/**
 * @module document-preview
 * @description Document generation preview with download and regeneration options.
 * Validates: Requirements 10.1, 10.2
 */

/** Props for the document preview component */
export interface DocumentPreviewProps {
  /** Generated document content (Markdown) */
  content: string | null;
  /** Whether the document is currently being generated */
  isGenerating: boolean;
  /** Generation progress (0-100) */
  progress: number;
  /** Callback to trigger document generation */
  onGenerate: () => void;
  /** Callback to download the document */
  onDownload: () => void;
  /** Callback to regenerate (preserving customizations) */
  onRegenerate: () => void;
}

/**
 * Renders the document preview into the given container.
 * Shows generation status, preview, download and regenerate controls.
 * @param container - Target DOM element
 * @param props - Document state and callbacks
 */
export function renderDocumentPreview(
  container: HTMLElement,
  props: DocumentPreviewProps
): void {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'document-preview';
  section.setAttribute('aria-label', 'Vista previa del documento BSC');

  const heading = document.createElement('h2');
  heading.textContent = 'Documento BSC';
  section.appendChild(heading);

  if (props.isGenerating) {
    section.appendChild(createGeneratingState(props.progress));
  } else if (props.content) {
    section.appendChild(createPreview(props.content));
    section.appendChild(createActions(props));
  } else {
    section.appendChild(createEmptyState(props));
  }

  container.appendChild(section);
}

/** Creates the generating/loading state UI */
function createGeneratingState(progress: number): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'document-preview__generating';
  wrapper.setAttribute('aria-live', 'polite');

  const spinner = document.createElement('div');
  spinner.className = 'document-preview__spinner';
  spinner.setAttribute('role', 'status');

  const text = document.createElement('p');
  text.textContent = 'Generando documento...';

  const progressBar = document.createElement('div');
  progressBar.className = 'document-preview__progress';
  progressBar.setAttribute('role', 'progressbar');
  progressBar.setAttribute('aria-valuenow', String(progress));
  progressBar.setAttribute('aria-valuemin', '0');
  progressBar.setAttribute('aria-valuemax', '100');
  progressBar.setAttribute('aria-label', 'Progreso de generación del documento');

  const fill = document.createElement('div');
  fill.className = 'document-preview__progress-fill';
  fill.style.width = `${progress}%`;
  progressBar.appendChild(fill);

  wrapper.appendChild(spinner);
  wrapper.appendChild(text);
  wrapper.appendChild(progressBar);
  return wrapper;
}

/** Creates the document content preview */
function createPreview(content: string): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'document-preview__content';
  preview.setAttribute('role', 'article');
  preview.setAttribute('aria-label', 'Contenido del documento generado');
  preview.tabIndex = 0;

  const pre = document.createElement('pre');
  pre.className = 'document-preview__markdown';
  pre.textContent = truncatePreview(content, 5000);
  preview.appendChild(pre);

  if (content.length > 5000) {
    const note = document.createElement('p');
    note.className = 'document-preview__truncated';
    note.textContent = '... (vista previa truncada, descarga el documento completo)';
    preview.appendChild(note);
  }

  return preview;
}

/** Creates action buttons for download and regenerate */
function createActions(props: DocumentPreviewProps): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'document-preview__actions';

  const downloadBtn = document.createElement('button');
  downloadBtn.type = 'button';
  downloadBtn.className = 'btn btn-primary';
  downloadBtn.textContent = '📥 Descargar documento';
  downloadBtn.setAttribute('aria-label', 'Descargar documento BSC en formato Markdown');
  downloadBtn.addEventListener('click', props.onDownload);

  const regenBtn = document.createElement('button');
  regenBtn.type = 'button';
  regenBtn.className = 'btn btn-secondary';
  regenBtn.textContent = '🔄 Regenerar';
  regenBtn.setAttribute('aria-label', 'Regenerar documento preservando personalizaciones');
  regenBtn.addEventListener('click', props.onRegenerate);

  actions.appendChild(downloadBtn);
  actions.appendChild(regenBtn);
  return actions;
}

/** Creates the empty state when no document exists yet */
function createEmptyState(props: DocumentPreviewProps): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'document-preview__empty';

  const text = document.createElement('p');
  text.textContent = 'El documento BSC se generará a partir de tus datos, visualizaciones y objetivos.';
  wrapper.appendChild(text);

  const generateBtn = document.createElement('button');
  generateBtn.type = 'button';
  generateBtn.className = 'btn btn-primary';
  generateBtn.textContent = 'Generar documento';
  generateBtn.setAttribute('aria-label', 'Iniciar generación del documento BSC');
  generateBtn.addEventListener('click', props.onGenerate);
  wrapper.appendChild(generateBtn);

  return wrapper;
}

/** Truncates text to a maximum length */
function truncatePreview(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}
