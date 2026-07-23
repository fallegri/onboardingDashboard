/**
 * @module prism-panel
 * @description PRISM quality evaluation panel.
 * Displays dimension scores, problem details, and continue/correct actions.
 * Validates: Requirements 10.1, 10.2
 */

import type { PRISMDimension } from '../../types/common';
import type { PRISMResult, DimensionScore } from '../../types/session';

/** Props for the PRISM panel component */
export interface PrismPanelProps {
  /** PRISM evaluation result */
  result: PRISMResult;
  /** Callback to continue to next step */
  onContinue: () => void;
  /** Callback to go back and correct data */
  onCorrect: () => void;
}

/** Human-readable dimension labels */
const DIMENSION_LABELS: Record<PRISMDimension, string> = {
  precision: 'Precisión',
  relevance: 'Relevancia',
  integrity: 'Integridad',
  sufficiency: 'Suficiencia',
  maintainability: 'Mantenibilidad',
};

/**
 * Renders the PRISM quality panel into the given container.
 * @param container - Target DOM element
 * @param props - PRISM result and action callbacks
 */
export function renderPrismPanel(
  container: HTMLElement,
  props: PrismPanelProps
): void {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'prism-panel';
  section.setAttribute('aria-label', 'Evaluación de calidad PRISM');

  const heading = document.createElement('h2');
  heading.className = 'prism-panel__heading';
  heading.textContent = 'Evaluación de Calidad PRISM';
  section.appendChild(heading);

  if (props.result.isBlockingQuality) {
    section.appendChild(createBlockingAlert());
  }

  const grid = createScoreGrid(props.result.dimensions);
  section.appendChild(grid);

  const problems = createProblemsList(props.result.dimensions);
  if (problems) section.appendChild(problems);

  const actions = createActions(props);
  section.appendChild(actions);

  container.appendChild(section);
}

/** Creates a blocking quality alert banner */
function createBlockingAlert(): HTMLElement {
  const alert = document.createElement('div');
  alert.className = 'prism-panel__alert';
  alert.setAttribute('role', 'alert');
  alert.textContent = 'La calidad de los datos es insuficiente para continuar. Todos los puntajes son 0. Por favor, corrige los datos e intenta de nuevo.';
  return alert;
}

/** Creates the dimension score grid */
function createScoreGrid(dimensions: DimensionScore[]): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'prism-panel__grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', 'Puntajes por dimensión');

  dimensions.forEach((dim) => {
    const card = createDimensionCard(dim);
    grid.appendChild(card);
  });

  return grid;
}

/** Creates a single dimension score card */
function createDimensionCard(dim: DimensionScore): HTMLElement {
  const card = document.createElement('div');
  card.className = `prism-panel__card ${getScoreClass(dim.score)}`;
  card.setAttribute('role', 'listitem');

  const label = document.createElement('h3');
  label.className = 'prism-panel__dim-label';
  label.textContent = DIMENSION_LABELS[dim.dimension];

  const score = document.createElement('span');
  score.className = 'prism-panel__score';
  score.textContent = String(dim.score);
  score.setAttribute('aria-label', `${DIMENSION_LABELS[dim.dimension]}: ${dim.score} de 100`);

  const bar = document.createElement('div');
  bar.className = 'prism-panel__bar';
  bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-valuenow', String(dim.score));
  bar.setAttribute('aria-valuemin', '0');
  bar.setAttribute('aria-valuemax', '100');

  const fill = document.createElement('div');
  fill.className = 'prism-panel__bar-fill';
  fill.style.width = `${dim.score}%`;
  bar.appendChild(fill);

  card.appendChild(label);
  card.appendChild(score);
  card.appendChild(bar);

  if (dim.observations.length > 0) {
    const obs = document.createElement('p');
    obs.className = 'prism-panel__observation';
    obs.textContent = dim.observations[0] ?? '';
    card.appendChild(obs);
  }

  return card;
}

/** Returns a CSS class based on the score level */
function getScoreClass(score: number): string {
  if (score >= 80) return 'prism-panel__card--good';
  if (score >= 60) return 'prism-panel__card--fair';
  return 'prism-panel__card--poor';
}

/** Creates the problems list section */
function createProblemsList(dimensions: DimensionScore[]): HTMLElement | null {
  const allProblems = dimensions.flatMap((d) =>
    d.problems.map((p) => ({ ...p, dimension: DIMENSION_LABELS[d.dimension] }))
  );
  if (allProblems.length === 0) return null;

  const section = document.createElement('details');
  section.className = 'prism-panel__problems';

  const summary = document.createElement('summary');
  summary.textContent = `Problemas encontrados (${allProblems.length})`;
  section.appendChild(summary);

  const list = document.createElement('ul');
  list.setAttribute('role', 'list');

  allProblems.slice(0, 20).forEach((problem) => {
    const li = document.createElement('li');
    li.className = 'prism-panel__problem-item';
    li.textContent = `[${problem.dimension}] ${problem.location}: ${problem.description}`;
    list.appendChild(li);
  });

  section.appendChild(list);
  return section;
}

/** Creates the action buttons (continue/correct) */
function createActions(props: PrismPanelProps): HTMLElement {
  const actions = document.createElement('div');
  actions.className = 'prism-panel__actions';

  const correctBtn = document.createElement('button');
  correctBtn.type = 'button';
  correctBtn.className = 'btn btn-secondary';
  correctBtn.textContent = 'Corregir datos';
  correctBtn.setAttribute('aria-label', 'Volver para corregir los datos del archivo');
  correctBtn.addEventListener('click', props.onCorrect);

  const continueBtn = document.createElement('button');
  continueBtn.type = 'button';
  continueBtn.className = 'btn btn-primary';
  continueBtn.textContent = 'Continuar';
  continueBtn.disabled = props.result.isBlockingQuality;
  continueBtn.setAttribute('aria-label', 'Continuar al siguiente paso');
  continueBtn.addEventListener('click', props.onContinue);

  actions.appendChild(correctBtn);
  actions.appendChild(continueBtn);
  return actions;
}
