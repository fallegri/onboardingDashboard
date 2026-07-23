/**
 * @module progress-indicator
 * @description Persistent step progress indicator showing current/total steps.
 * Visible without scrolling, accessible via ARIA progressbar role.
 * Validates: Requirements 10.4
 */

import type { FlowStep } from '../../types/common';

/** Labels for each flow step displayed to the user */
const STEP_LABELS: Record<FlowStep, string> = {
  upload: 'Carga de archivo',
  detection: 'Detección de estructura',
  prism: 'Evaluación PRISM',
  visualization: 'Visualización',
  objectives: 'Objetivos estratégicos',
  document: 'Documento BSC',
};

/** Ordered list of all flow steps */
const STEPS: FlowStep[] = [
  'upload', 'detection', 'prism', 'visualization', 'objectives', 'document'
];

/** Props for the progress indicator component */
export interface ProgressIndicatorProps {
  currentStep: FlowStep;
  onStepClick?: (step: FlowStep) => void;
}

/**
 * Renders a persistent progress indicator bar into the given container.
 * Shows the current step number, total, and clickable step markers.
 * @param container - Target DOM element
 * @param props - Current step and optional click handler
 */
export function renderProgressIndicator(
  container: HTMLElement,
  props: ProgressIndicatorProps
): void {
  container.innerHTML = '';
  const currentIndex = STEPS.indexOf(props.currentStep);
  const total = STEPS.length;

  const nav = createElement('nav', {
    className: 'progress-indicator',
    'aria-label': `Progreso del flujo: paso ${currentIndex + 1} de ${total}`,
    role: 'navigation',
  });

  const statusText = createElement('p', {
    className: 'progress-indicator__status',
    'aria-live': 'polite',
    textContent: `Paso ${currentIndex + 1} de ${total}: ${STEP_LABELS[props.currentStep]}`,
  });

  const track = createElement('ol', {
    className: 'progress-indicator__track',
    role: 'list',
  });

  STEPS.forEach((step, index) => {
    const item = createStepItem(step, index, currentIndex, props.onStepClick);
    track.appendChild(item);
  });

  nav.appendChild(statusText);
  nav.appendChild(track);
  container.appendChild(nav);
}

/** Creates a single step list item element */
function createStepItem(
  step: FlowStep,
  index: number,
  currentIndex: number,
  onStepClick?: (step: FlowStep) => void
): HTMLLIElement {
  const isCurrent = index === currentIndex;
  const isCompleted = index < currentIndex;
  const state = isCurrent ? 'current' : isCompleted ? 'completed' : 'pending';

  const li = createElement('li', {
    className: `progress-indicator__step progress-indicator__step--${state}`,
    'aria-current': isCurrent ? 'step' : undefined,
  });

  const button = createElement('button', {
    className: 'progress-indicator__btn',
    type: 'button',
    disabled: !isCompleted,
    'aria-label': `${STEP_LABELS[step]} - ${stateLabel(state)}`,
    tabIndex: isCompleted ? 0 : -1,
  });

  const marker = createElement('span', {
    className: 'progress-indicator__marker',
    textContent: isCompleted ? '✓' : String(index + 1),
    'aria-hidden': 'true',
  });

  const label = createElement('span', {
    className: 'progress-indicator__label',
    textContent: STEP_LABELS[step],
  });

  if (isCompleted && onStepClick) {
    button.addEventListener('click', () => onStepClick(step));
  }

  button.appendChild(marker);
  button.appendChild(label);
  li.appendChild(button);
  return li;
}

/** Returns a human-readable state label for screen readers */
function stateLabel(state: string): string {
  const labels: Record<string, string> = {
    current: 'paso actual',
    completed: 'completado',
    pending: 'pendiente',
  };
  return labels[state] ?? 'pendiente';
}

/** Utility to create an element with attributes */
function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {}
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === 'textContent') {
      el.textContent = value as string;
    } else if (key === 'className') {
      el.className = value as string;
    } else if (key === 'disabled') {
      (el as HTMLButtonElement).disabled = value as boolean;
    } else if (key === 'tabIndex') {
      el.tabIndex = value as number;
    } else if (key === 'type') {
      (el as HTMLButtonElement).type = value as 'button' | 'submit' | 'reset';
    } else {
      el.setAttribute(key, String(value));
    }
  }
  return el;
}
