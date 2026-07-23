/**
 * @module structure-table
 * @description Sheet/column structure display component.
 * Shows detected columns, types, warnings, and allows type reassignment.
 * Validates: Requirements 10.1, 10.2
 */

import type { DataType } from '../../types/common';
import type { SheetStructure, ColumnInfo } from '../../types/session';

/** Props for the structure table component */
export interface StructureTableProps {
  /** Detected sheet structures */
  sheets: SheetStructure[];
  /** Active sheet index */
  activeSheet: number;
  /** Callback when user changes active sheet */
  onSheetChange: (index: number) => void;
  /** Callback when user reassigns a column type */
  onTypeChange: (sheetIndex: number, columnIndex: number, newType: DataType) => void;
}

/** Available data types for reassignment */
const DATA_TYPES: DataType[] = ['numeric', 'text', 'date', 'boolean'];

/** Human-readable labels for data types */
const TYPE_LABELS: Record<DataType, string> = {
  numeric: 'Numérico',
  text: 'Texto',
  date: 'Fecha',
  boolean: 'Booleano',
};

/**
 * Renders the structure table into the given container.
 * Shows column info per sheet with type selectors and warnings.
 * @param container - Target DOM element
 * @param props - Sheet data and callbacks
 */
export function renderStructureTable(
  container: HTMLElement,
  props: StructureTableProps
): void {
  container.innerHTML = '';

  const wrapper = document.createElement('section');
  wrapper.className = 'structure-table';
  wrapper.setAttribute('aria-label', 'Estructura detectada del archivo');

  if (props.sheets.length > 1) {
    const tabs = createSheetTabs(props);
    wrapper.appendChild(tabs);
  }

  const activeSheet = props.sheets[props.activeSheet];
  if (activeSheet) {
    const table = createColumnTable(activeSheet, props.activeSheet, props.onTypeChange);
    wrapper.appendChild(table);
  }

  container.appendChild(wrapper);
}

/** Creates tab buttons for switching between sheets */
function createSheetTabs(props: StructureTableProps): HTMLElement {
  const tabList = document.createElement('div');
  tabList.className = 'structure-table__tabs';
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', 'Hojas del archivo');

  props.sheets.forEach((sheet, index) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'structure-table__tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(index === props.activeSheet));
    tab.setAttribute('aria-controls', `sheet-panel-${index}`);
    tab.id = `sheet-tab-${index}`;
    tab.textContent = sheet.sheetName;
    tab.tabIndex = index === props.activeSheet ? 0 : -1;

    tab.addEventListener('click', () => props.onSheetChange(index));
    tab.addEventListener('keydown', (e) => handleTabKeydown(e, props, index));
    tabList.appendChild(tab);
  });

  return tabList;
}

/** Handles arrow key navigation between tabs */
function handleTabKeydown(
  e: KeyboardEvent,
  props: StructureTableProps,
  currentIndex: number
): void {
  const total = props.sheets.length;
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    props.onSheetChange((currentIndex + 1) % total);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    props.onSheetChange((currentIndex - 1 + total) % total);
  }
}

/** Creates the column info table for a given sheet */
function createColumnTable(
  sheet: SheetStructure,
  sheetIndex: number,
  onTypeChange: StructureTableProps['onTypeChange']
): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'structure-table__panel';
  panel.setAttribute('role', 'tabpanel');
  panel.id = `sheet-panel-${sheetIndex}`;
  panel.setAttribute('aria-labelledby', `sheet-tab-${sheetIndex}`);

  const summary = document.createElement('p');
  summary.className = 'structure-table__summary';
  summary.textContent = `${sheet.columns.length} columnas · ${sheet.totalRecords} registros`;
  panel.appendChild(summary);

  const table = document.createElement('table');
  table.className = 'structure-table__table';
  table.setAttribute('aria-label', `Columnas de la hoja ${sheet.sheetName}`);

  table.appendChild(createTableHeader());
  table.appendChild(createTableBody(sheet.columns, sheetIndex, onTypeChange));
  panel.appendChild(table);

  return panel;
}

/** Creates the table header row */
function createTableHeader(): HTMLElement {
  const thead = document.createElement('thead');
  const row = document.createElement('tr');
  const headers = ['Columna', 'Tipo detectado', 'Tipo asignado', 'Registros', 'Vacíos (%)'];

  headers.forEach((text) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = text;
    row.appendChild(th);
  });

  thead.appendChild(row);
  return thead;
}

/** Creates the table body with column rows */
function createTableBody(
  columns: ColumnInfo[],
  sheetIndex: number,
  onTypeChange: StructureTableProps['onTypeChange']
): HTMLElement {
  const tbody = document.createElement('tbody');

  columns.forEach((col, colIndex) => {
    const row = document.createElement('tr');
    if (col.hasWarning) row.classList.add('structure-table__row--warning');

    row.appendChild(createCell(col.name));
    row.appendChild(createCell(TYPE_LABELS[col.detectedType]));
    row.appendChild(createTypeSelector(col, sheetIndex, colIndex, onTypeChange));
    row.appendChild(createCell(String(col.recordCount)));
    row.appendChild(createEmptyCell(col));

    tbody.appendChild(row);
  });

  return tbody;
}

/** Creates a plain text table cell */
function createCell(text: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

/** Creates a cell with type selector dropdown */
function createTypeSelector(
  col: ColumnInfo,
  sheetIndex: number,
  colIndex: number,
  onTypeChange: StructureTableProps['onTypeChange']
): HTMLTableCellElement {
  const td = document.createElement('td');
  const select = document.createElement('select');
  select.className = 'structure-table__type-select';
  select.setAttribute('aria-label', `Tipo de la columna ${col.name}`);

  DATA_TYPES.forEach((type) => {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = TYPE_LABELS[type];
    option.selected = type === col.assignedType;
    select.appendChild(option);
  });

  select.addEventListener('change', () => {
    onTypeChange(sheetIndex, colIndex, select.value as DataType);
  });

  td.appendChild(select);
  return td;
}

/** Creates the empty percentage cell with warning indicator */
function createEmptyCell(col: ColumnInfo): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = `${col.emptyPercentage.toFixed(1)}%`;
  if (col.hasWarning) {
    td.classList.add('structure-table__cell--warning');
    const warn = document.createElement('span');
    warn.className = 'visually-hidden';
    warn.textContent = ' (advertencia: alto porcentaje de valores vacíos)';
    td.appendChild(warn);
  }
  return td;
}
