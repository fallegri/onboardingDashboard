/**
 * @module chart-gallery
 * @description Chart suggestion gallery with previews and custom visualization add.
 * Displays chart cards, allows selection and adding custom charts.
 * Validates: Requirements 10.1, 10.2
 */

import type { ChartType } from '../../types/common';
import type { ChartSuggestion, Visualization } from '../../types/session';

/** Props for the chart gallery component */
export interface ChartGalleryProps {
  /** Suggested charts from analysis */
  suggestions: ChartSuggestion[];
  /** Already selected/saved visualizations */
  selectedVisualizations: Visualization[];
  /** Callback when a chart suggestion is selected */
  onSelect: (suggestion: ChartSuggestion) => void;
  /** Callback when user wants to add a custom chart */
  onAddCustom: () => void;
  /** Max custom visualizations allowed */
  maxCustom?: number;
}

/** Icons for chart types */
const CHART_ICONS: Record<ChartType, string> = {
  bar: '📊',
  line: '📈',
  pie: '🥧',
  scatter: '⚬',
  pivot: '📋',
};

/** Labels for chart types */
const CHART_LABELS: Record<ChartType, string> = {
  bar: 'Barras',
  line: 'Líneas',
  pie: 'Circular',
  scatter: 'Dispersión',
  pivot: 'Tabla pivote',
};

/**
 * Renders the chart gallery into the given container.
 * @param container - Target DOM element
 * @param props - Suggestions, selections, and callbacks
 */
export function renderChartGallery(
  container: HTMLElement,
  props: ChartGalleryProps
): void {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'chart-gallery';
  section.setAttribute('aria-label', 'Galería de visualizaciones sugeridas');

  const heading = document.createElement('h2');
  heading.className = 'chart-gallery__heading';
  heading.textContent = 'Visualizaciones Sugeridas';
  section.appendChild(heading);

  const grid = createChartGrid(props);
  section.appendChild(grid);

  const addBtn = createAddCustomButton(props);
  section.appendChild(addBtn);

  container.appendChild(section);
}

/** Creates the chart card grid */
function createChartGrid(props: ChartGalleryProps): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'chart-gallery__grid';
  grid.setAttribute('role', 'list');

  props.suggestions.forEach((suggestion) => {
    const card = createChartCard(suggestion, props);
    grid.appendChild(card);
  });

  return grid;
}

/** Creates a single chart suggestion card */
function createChartCard(
  suggestion: ChartSuggestion,
  props: ChartGalleryProps
): HTMLElement {
  const isSelected = props.selectedVisualizations.some((v) => v.id === suggestion.id);

  const card = document.createElement('article');
  card.className = `chart-gallery__card ${isSelected ? 'chart-gallery__card--selected' : ''}`;
  card.setAttribute('role', 'listitem');

  const header = document.createElement('div');
  header.className = 'chart-gallery__card-header';

  const icon = document.createElement('span');
  icon.className = 'chart-gallery__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = CHART_ICONS[suggestion.type];

  const type = document.createElement('span');
  type.className = 'chart-gallery__type';
  type.textContent = CHART_LABELS[suggestion.type];

  header.appendChild(icon);
  header.appendChild(type);

  const title = document.createElement('h3');
  title.className = 'chart-gallery__title';
  title.textContent = suggestion.title;

  const rationale = document.createElement('p');
  rationale.className = 'chart-gallery__rationale';
  rationale.textContent = suggestion.rationale;

  const columns = document.createElement('p');
  columns.className = 'chart-gallery__columns';
  columns.textContent = `Columnas: ${suggestion.columns.join(', ')}`;

  const selectBtn = document.createElement('button');
  selectBtn.type = 'button';
  selectBtn.className = 'btn btn-primary chart-gallery__select-btn';
  selectBtn.textContent = isSelected ? 'Seleccionado ✓' : 'Seleccionar';
  selectBtn.disabled = isSelected;
  selectBtn.setAttribute('aria-label', `Seleccionar gráfico: ${suggestion.title}`);
  selectBtn.addEventListener('click', () => props.onSelect(suggestion));

  card.appendChild(header);
  card.appendChild(title);
  card.appendChild(rationale);
  card.appendChild(columns);
  card.appendChild(selectBtn);

  return card;
}

/** Creates the "Add custom visualization" button */
function createAddCustomButton(props: ChartGalleryProps): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-gallery__add-custom';

  const maxCustom = props.maxCustom ?? 20;
  const customCount = props.selectedVisualizations.filter((v) => v.isCustom).length;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary';
  btn.textContent = '+ Agregar visualización personalizada';
  btn.disabled = customCount >= maxCustom;
  btn.setAttribute('aria-label', 'Agregar una visualización personalizada');
  btn.addEventListener('click', props.onAddCustom);

  const count = document.createElement('span');
  count.className = 'chart-gallery__custom-count';
  count.textContent = `${customCount} / ${maxCustom} personalizadas`;

  wrapper.appendChild(btn);
  wrapper.appendChild(count);
  return wrapper;
}
