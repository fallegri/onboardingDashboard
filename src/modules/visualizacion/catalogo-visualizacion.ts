import type { ChartType, AggregationType } from '../../types/common';
import type {
  DetectionResult,
  SheetData,
  ColumnInfo,
  ChartSuggestion,
  KPISuggestion,
  Visualization,
  VisualizationConfig,
} from '../../types/session';
import type { VisualizationError } from '../../types/errors';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum custom visualizations allowed */
const MAX_CUSTOM_VISUALIZATIONS = 20;

/** Maximum title length for visualizations */
const MAX_TITLE_LENGTH = 100;

/** Preview generation timeout in milliseconds (5 seconds) */
const PREVIEW_TIMEOUT_MS = 5_000;

/** Maximum KPI suggestions */
const MAX_KPI_SUGGESTIONS = 10;

/** Minimum KPI suggestions */
const MIN_KPI_SUGGESTIONS = 3;

/** Maximum data points for preview rendering */
const MAX_PREVIEW_POINTS = 100;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the visualization catalog module.
 * Suggests charts and KPIs based on data structure, generates previews,
 * and manages custom user visualizations.
 */
export interface ICatalogoVisualizacion {
  suggestCharts(structure: DetectionResult): ChartSuggestion[];
  suggestKPIs(structure: DetectionResult, data: SheetData[]): KPISuggestion[];
  generatePreview(suggestion: ChartSuggestion, data: SheetData[]): Promise<ChartRenderData>;
  addCustomVisualization(config: CustomVisualizationInput): Result<Visualization, VisualizationError>;
  readonly MAX_CUSTOM_VISUALIZATIONS: 20;
}

/**
 * @description Input configuration for adding a custom visualization.
 */
export interface CustomVisualizationInput {
  type: ChartType;
  title: string;
  dataColumns: string[];
  colors?: string[];
  labels?: Record<string, string>;
  dataRange?: { min?: number; max?: number; startDate?: string; endDate?: string };
}

/**
 * @description Render data for a chart preview.
 */
export interface ChartRenderData {
  readonly type: ChartType;
  readonly labels: string[];
  readonly datasets: Array<{ label: string; data: number[] }>;
  readonly config: VisualizationConfig;
}

// ─── Module State ────────────────────────────────────────────────────────────

/** Internal store for custom visualizations */
let customVisualizations: Visualization[] = [];

// ─── ID Generation ───────────────────────────────────────────────────────────

/** Counter for unique IDs */
let idCounter = 0;

/**
 * @description Generates a unique identifier with the given prefix.
 * @param prefix - The prefix for the ID (e.g., 'chart', 'kpi', 'viz')
 * @returns A unique string identifier
 */
function generateId(prefix: string): string {
  idCounter++;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

// ─── Column Classification Helpers ───────────────────────────────────────────

/**
 * @description Extracts numeric columns from the detection result.
 * @param structure - The detection result
 * @returns Array of ColumnInfo with numeric type
 */
function getNumericColumns(structure: DetectionResult): Array<{ column: ColumnInfo; sheetName: string }> {
  const result: Array<{ column: ColumnInfo; sheetName: string }> = [];
  for (const sheet of structure.sheets) {
    for (const col of sheet.columns) {
      if (col.assignedType === 'numeric') {
        result.push({ column: col, sheetName: sheet.sheetName });
      }
    }
  }
  return result;
}

/**
 * @description Extracts date/temporal columns from the detection result.
 * @param structure - The detection result
 * @returns Array of ColumnInfo with date type
 */
function getDateColumns(structure: DetectionResult): Array<{ column: ColumnInfo; sheetName: string }> {
  const result: Array<{ column: ColumnInfo; sheetName: string }> = [];
  for (const sheet of structure.sheets) {
    for (const col of sheet.columns) {
      if (col.assignedType === 'date') {
        result.push({ column: col, sheetName: sheet.sheetName });
      }
    }
  }
  return result;
}

/**
 * @description Extracts text/categorical columns from the detection result.
 * @param structure - The detection result
 * @returns Array of ColumnInfo with text type
 */
function getTextColumns(structure: DetectionResult): Array<{ column: ColumnInfo; sheetName: string }> {
  const result: Array<{ column: ColumnInfo; sheetName: string }> = [];
  for (const sheet of structure.sheets) {
    for (const col of sheet.columns) {
      if (col.assignedType === 'text') {
        result.push({ column: col, sheetName: sheet.sheetName });
      }
    }
  }
  return result;
}

// ─── Chart Suggestion Logic ──────────────────────────────────────────────────

/**
 * @description Creates a bar chart suggestion from numeric and categorical columns.
 * @param numericCols - Numeric columns available
 * @param textCols - Text/categorical columns available
 * @returns A ChartSuggestion for a bar chart, or null if not applicable
 */
function suggestBarChart(
  numericCols: Array<{ column: ColumnInfo; sheetName: string }>,
  textCols: Array<{ column: ColumnInfo; sheetName: string }>,
): ChartSuggestion | null {
  if (numericCols.length === 0) return null;

  const columns: string[] = [];
  if (textCols.length > 0) columns.push(textCols[0]!.column.name);
  columns.push(numericCols[0]!.column.name);

  return {
    id: generateId('chart'),
    type: 'bar',
    title: `${numericCols[0]!.column.name} by category`,
    columns,
    rationale: 'Bar charts effectively compare numeric values across categories.',
  };
}

/**
 * @description Creates a line chart suggestion from numeric and temporal columns.
 * @param numericCols - Numeric columns available
 * @param dateCols - Date columns available
 * @returns A ChartSuggestion for a line chart, or null if not applicable
 */
function suggestLineChart(
  numericCols: Array<{ column: ColumnInfo; sheetName: string }>,
  dateCols: Array<{ column: ColumnInfo; sheetName: string }>,
): ChartSuggestion | null {
  if (numericCols.length === 0) return null;

  const columns: string[] = [];
  if (dateCols.length > 0) {
    columns.push(dateCols[0]!.column.name);
  }
  columns.push(numericCols[0]!.column.name);

  return {
    id: generateId('chart'),
    type: 'line',
    title: `${numericCols[0]!.column.name} trend over time`,
    columns,
    rationale: 'Line charts reveal trends and patterns in data over time.',
  };
}

/**
 * @description Creates a pie chart suggestion from numeric and categorical columns.
 * @param numericCols - Numeric columns available
 * @param textCols - Text/categorical columns available
 * @returns A ChartSuggestion for a pie chart, or null if not applicable
 */
function suggestPieChart(
  numericCols: Array<{ column: ColumnInfo; sheetName: string }>,
  textCols: Array<{ column: ColumnInfo; sheetName: string }>,
): ChartSuggestion | null {
  if (numericCols.length === 0 || textCols.length === 0) return null;

  return {
    id: generateId('chart'),
    type: 'pie',
    title: `${numericCols[0]!.column.name} distribution by ${textCols[0]!.column.name}`,
    columns: [textCols[0]!.column.name, numericCols[0]!.column.name],
    rationale: 'Pie charts show proportional distribution of values across categories.',
  };
}

/**
 * @description Creates a scatter plot suggestion from two numeric columns.
 * @param numericCols - Numeric columns available
 * @returns A ChartSuggestion for a scatter plot, or null if not applicable
 */
function suggestScatterChart(
  numericCols: Array<{ column: ColumnInfo; sheetName: string }>,
): ChartSuggestion | null {
  if (numericCols.length < 2) return null;

  return {
    id: generateId('chart'),
    type: 'scatter',
    title: `${numericCols[0]!.column.name} vs ${numericCols[1]!.column.name}`,
    columns: [numericCols[0]!.column.name, numericCols[1]!.column.name],
    rationale: 'Scatter plots reveal correlations between two numeric variables.',
  };
}

/**
 * @description Creates a pivot table suggestion from available columns.
 * @param numericCols - Numeric columns available
 * @param textCols - Text columns available
 * @returns A ChartSuggestion for a pivot table, or null if not applicable
 */
function suggestPivotTable(
  numericCols: Array<{ column: ColumnInfo; sheetName: string }>,
  textCols: Array<{ column: ColumnInfo; sheetName: string }>,
): ChartSuggestion | null {
  if (numericCols.length === 0 || textCols.length === 0) return null;

  const columns = [
    textCols[0]!.column.name,
    numericCols[0]!.column.name,
  ];
  if (textCols.length > 1) columns.push(textCols[1]!.column.name);

  return {
    id: generateId('chart'),
    type: 'pivot',
    title: `Summary of ${numericCols[0]!.column.name} by categories`,
    columns,
    rationale: 'Pivot tables aggregate numeric data across multiple categorical dimensions.',
  };
}

// ─── KPI Computation Helpers ─────────────────────────────────────────────────

/**
 * @description Extracts numeric values from a column across all sheets.
 * @param columnName - Name of the column to extract
 * @param data - Sheet data array
 * @returns Array of numeric values from that column
 */
function extractNumericValues(columnName: string, data: SheetData[]): number[] {
  const values: number[] = [];
  for (const sheet of data) {
    const colIdx = sheet.headers.indexOf(columnName);
    if (colIdx === -1) continue;
    for (const row of sheet.rows) {
      const val = row[colIdx];
      if (val === null || val === undefined) continue;
      const num = typeof val === 'number' ? val : parseFloat(String(val));
      if (!isNaN(num)) values.push(num);
    }
  }
  return values;
}

/**
 * @description Computes an aggregation over an array of numbers.
 * @param values - The numeric values to aggregate
 * @param aggregation - The aggregation type to apply
 * @returns The computed value, or null if not computable
 */
function computeAggregation(values: number[], aggregation: AggregationType): number | null {
  if (values.length === 0) return null;

  switch (aggregation) {
    case 'sum':
      return values.reduce((acc, v) => acc + v, 0);
    case 'average':
      return values.reduce((acc, v) => acc + v, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'rate': {
      if (values.length < 2) return null;
      const first = values[0]!;
      const last = values[values.length - 1]!;
      if (first === 0) return null;
      return ((last - first) / Math.abs(first)) * 100;
    }
  }
}

// ─── Core Implementation ─────────────────────────────────────────────────────

/**
 * @description Suggests chart types based on the detected column types.
 * Analyzes numeric, text, and date columns to recommend at least 3 chart types.
 * @param structure - The detection result from Módulo_Detección
 * @returns Array of ChartSuggestion with at least 3 suggestions
 */
export function suggestCharts(structure: DetectionResult): ChartSuggestion[] {
  const numericCols = getNumericColumns(structure);
  const dateCols = getDateColumns(structure);
  const textCols = getTextColumns(structure);

  const suggestions: ChartSuggestion[] = [];

  const bar = suggestBarChart(numericCols, textCols);
  if (bar) suggestions.push(bar);

  const line = suggestLineChart(numericCols, dateCols);
  if (line) suggestions.push(line);

  const pie = suggestPieChart(numericCols, textCols);
  if (pie) suggestions.push(pie);

  const scatter = suggestScatterChart(numericCols);
  if (scatter) suggestions.push(scatter);

  const pivot = suggestPivotTable(numericCols, textCols);
  if (pivot) suggestions.push(pivot);

  // Ensure minimum 3 suggestions with fallback generic suggestions
  while (suggestions.length < 3) {
    suggestions.push(createFallbackSuggestion(suggestions.length, structure));
  }

  return suggestions;
}

/**
 * @description Creates a fallback suggestion when not enough data-driven ones exist.
 * @param index - Index for differentiation
 * @param structure - The detection result
 * @returns A generic ChartSuggestion
 */
function createFallbackSuggestion(index: number, structure: DetectionResult): ChartSuggestion {
  const allColumns = structure.sheets.flatMap((s) => s.columns.map((c) => c.name));
  const fallbackTypes: ChartType[] = ['bar', 'line', 'pivot'];
  const chartType = fallbackTypes[index % fallbackTypes.length]!;

  return {
    id: generateId('chart'),
    type: chartType,
    title: `Data overview (${chartType})`,
    columns: allColumns.slice(0, 2),
    rationale: `A ${chartType} chart provides a general overview of available data.`,
  };
}

/**
 * @description Generates KPI suggestions based on numeric and temporal columns.
 * Produces between 3 and 10 KPI suggestions with computed values.
 * @param structure - The detection result from Módulo_Detección
 * @param data - The sheet data from Módulo_Carga
 * @returns Array of KPISuggestion with 3-10 items
 */
export function suggestKPIs(structure: DetectionResult, data: SheetData[]): KPISuggestion[] {
  const numericCols = getNumericColumns(structure);
  const dateCols = getDateColumns(structure);
  const suggestions: KPISuggestion[] = [];

  // Generate KPIs for numeric columns
  for (const { column } of numericCols) {
    if (suggestions.length >= MAX_KPI_SUGGESTIONS) break;
    const values = extractNumericValues(column.name, data);

    suggestions.push(...generateNumericKPIs(column.name, values, suggestions.length));
    if (suggestions.length >= MAX_KPI_SUGGESTIONS) break;
  }

  // Generate count KPIs for date columns
  for (const { column } of dateCols) {
    if (suggestions.length >= MAX_KPI_SUGGESTIONS) break;
    suggestions.push(createCountKPI(column.name, data));
  }

  // Ensure minimum 3 suggestions
  while (suggestions.length < MIN_KPI_SUGGESTIONS && numericCols.length > 0) {
    const col = numericCols[0]!.column;
    const values = extractNumericValues(col.name, data);
    suggestions.push(createMinMaxKPI(col.name, values, suggestions.length));
  }

  return suggestions.slice(0, MAX_KPI_SUGGESTIONS);
}

/**
 * @description Generates KPI suggestions for a single numeric column.
 * @param columnName - The column name
 * @param values - Extracted numeric values
 * @param currentCount - Current suggestion count for limiting
 * @returns Array of KPISuggestion for this column
 */
function generateNumericKPIs(columnName: string, values: number[], currentCount: number): KPISuggestion[] {
  const kpis: KPISuggestion[] = [];
  const maxToAdd = MAX_KPI_SUGGESTIONS - currentCount;

  if (maxToAdd <= 0) return kpis;

  kpis.push({
    id: generateId('kpi'),
    name: `Total ${columnName}`,
    aggregation: 'sum',
    column: columnName,
    formula: `SUM(${columnName})`,
    computedValue: computeAggregation(values, 'sum'),
  });

  if (kpis.length < maxToAdd) {
    kpis.push({
      id: generateId('kpi'),
      name: `Average ${columnName}`,
      aggregation: 'average',
      column: columnName,
      formula: `AVG(${columnName})`,
      computedValue: computeAggregation(values, 'average'),
    });
  }

  if (kpis.length < maxToAdd && values.length >= 2) {
    kpis.push({
      id: generateId('kpi'),
      name: `${columnName} rate of change`,
      aggregation: 'rate',
      column: columnName,
      formula: `((LAST(${columnName}) - FIRST(${columnName})) / ABS(FIRST(${columnName}))) * 100`,
      computedValue: computeAggregation(values, 'rate'),
    });
  }

  return kpis;
}

/**
 * @description Creates a count KPI for a date column.
 * @param columnName - The date column name
 * @param data - The sheet data
 * @returns A KPISuggestion with count aggregation
 */
function createCountKPI(columnName: string, data: SheetData[]): KPISuggestion {
  const values = extractNumericValues(columnName, data);
  let count = 0;
  for (const sheet of data) {
    const colIdx = sheet.headers.indexOf(columnName);
    if (colIdx === -1) continue;
    count += sheet.rows.filter((row) => row[colIdx] !== null && row[colIdx] !== undefined).length;
  }

  return {
    id: generateId('kpi'),
    name: `Record count (${columnName})`,
    aggregation: 'count',
    column: columnName,
    formula: `COUNT(${columnName})`,
    computedValue: count > 0 ? count : (values.length > 0 ? values.length : null),
  };
}

/**
 * @description Creates a min or max KPI as a fallback.
 * @param columnName - The column name
 * @param values - Numeric values
 * @param index - Index to alternate min/max
 * @returns A KPISuggestion with min or max aggregation
 */
function createMinMaxKPI(columnName: string, values: number[], index: number): KPISuggestion {
  const isMin = index % 2 === 0;
  const aggregation: AggregationType = isMin ? 'min' : 'max';

  return {
    id: generateId('kpi'),
    name: `${isMin ? 'Minimum' : 'Maximum'} ${columnName}`,
    aggregation,
    column: columnName,
    formula: `${aggregation.toUpperCase()}(${columnName})`,
    computedValue: computeAggregation(values, aggregation),
  };
}

/**
 * @description Generates a chart preview with real data (max 5 seconds).
 * Renders the chart data limited to MAX_PREVIEW_POINTS for performance.
 * @param suggestion - The chart suggestion to preview
 * @param data - The sheet data
 * @returns ChartRenderData with labels, datasets, and config
 */
export async function generatePreview(
  suggestion: ChartSuggestion,
  data: SheetData[],
): Promise<ChartRenderData> {
  const startTime = Date.now();

  // Find columns in the data
  const firstSheet = data[0];
  if (!firstSheet) {
    return buildEmptyPreview(suggestion.type);
  }

  const result = buildPreviewData(suggestion, firstSheet, startTime);

  // Check timeout
  if (Date.now() - startTime > PREVIEW_TIMEOUT_MS) {
    return buildEmptyPreview(suggestion.type);
  }

  return {
    type: suggestion.type,
    labels: result.labels,
    datasets: result.datasets,
    config: {
      colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      labels: {},
      dataRange: {},
    },
  };
}

/**
 * @description Builds preview data from a sheet based on chart suggestion columns.
 * @param suggestion - The chart suggestion
 * @param sheet - The sheet to extract data from
 * @param startTime - Start timestamp for timeout check
 * @returns Object with labels and datasets
 */
function buildPreviewData(
  suggestion: ChartSuggestion,
  sheet: SheetData,
  startTime: number,
): { labels: string[]; datasets: Array<{ label: string; data: number[] }> } {
  const labels: string[] = [];

  const labelColIdx = sheet.headers.indexOf(suggestion.columns[0] ?? '');
  const dataColIndices = suggestion.columns
    .slice(suggestion.type === 'scatter' ? 0 : 1)
    .map((col) => sheet.headers.indexOf(col))
    .filter((idx) => idx !== -1);

  const rowLimit = Math.min(sheet.rows.length, MAX_PREVIEW_POINTS);

  for (let i = 0; i < rowLimit; i++) {
    if (Date.now() - startTime > PREVIEW_TIMEOUT_MS) break;

    const row = sheet.rows[i]!;
    const label = labelColIdx >= 0 ? String(row[labelColIdx] ?? `Row ${i + 1}`) : `Row ${i + 1}`;
    labels.push(label);
  }

  const datasets: Array<{ label: string; data: number[] }> = [];
  for (const colIdx of dataColIndices) {
    const colData: number[] = [];
    for (let i = 0; i < rowLimit; i++) {
      const val = sheet.rows[i]![colIdx];
      const num = typeof val === 'number' ? val : parseFloat(String(val ?? '0'));
      colData.push(isNaN(num) ? 0 : num);
    }
    datasets.push({
      label: sheet.headers[colIdx] ?? `Series ${datasets.length + 1}`,
      data: colData,
    });
  }

  // Fallback: if no datasets were built from column matching
  if (datasets.length === 0 && suggestion.columns.length > 0) {
    const fallbackIdx = sheet.headers.indexOf(suggestion.columns[0] ?? '');
    if (fallbackIdx >= 0) {
      const colData: number[] = [];
      for (let i = 0; i < rowLimit; i++) {
        const val = sheet.rows[i]![fallbackIdx];
        const num = typeof val === 'number' ? val : parseFloat(String(val ?? '0'));
        colData.push(isNaN(num) ? 0 : num);
      }
      datasets.push({ label: suggestion.columns[0]!, data: colData });
    }
  }

  return { labels, datasets };
}

/**
 * @description Builds an empty preview when data is unavailable.
 * @param type - The chart type
 * @returns ChartRenderData with empty arrays
 */
function buildEmptyPreview(type: ChartType): ChartRenderData {
  return {
    type,
    labels: [],
    datasets: [],
    config: { colors: [], labels: {}, dataRange: {} },
  };
}

/**
 * @description Adds a custom visualization to the catalog.
 * Validates title length (max 100 chars) and custom count (max 20).
 * @param input - The custom visualization configuration
 * @returns Result with the created Visualization or a VisualizationError
 */
export function addCustomVisualization(
  input: CustomVisualizationInput,
): Result<Visualization, VisualizationError> {
  if (customVisualizations.length >= MAX_CUSTOM_VISUALIZATIONS) {
    return err(createVisualizationError(
      'MAX_CUSTOM_REACHED',
      `Maximum of ${MAX_CUSTOM_VISUALIZATIONS} custom visualizations reached.`,
    ));
  }

  if (!input.title || input.title.length > MAX_TITLE_LENGTH) {
    return err(createVisualizationError(
      'INVALID_TITLE_LENGTH',
      `Title must be between 1 and ${MAX_TITLE_LENGTH} characters.`,
    ));
  }

  const visualization: Visualization = {
    id: generateId('viz'),
    type: input.type,
    title: input.title,
    config: {
      colors: input.colors ?? ['#4F46E5', '#10B981', '#F59E0B'],
      labels: input.labels ?? {},
      dataRange: input.dataRange ?? {},
    },
    dataColumns: input.dataColumns,
    isCustom: true,
  };

  customVisualizations.push(visualization);
  return ok(visualization);
}

/**
 * @description Creates a VisualizationError with the given code and message.
 * @param code - The error code
 * @param message - The error message
 * @returns A VisualizationError object
 */
function createVisualizationError(
  code: VisualizationError['code'],
  message: string,
): VisualizationError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'visualizacion',
  };
}

/**
 * @description Resets the internal state (for testing purposes).
 */
export function resetState(): void {
  customVisualizations = [];
  idCounter = 0;
}

/**
 * @description Returns the current list of custom visualizations.
 * @returns Array of custom Visualization objects
 */
export function getCustomVisualizations(): Visualization[] {
  return [...customVisualizations];
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The visualization catalog implementing ICatalogoVisualizacion.
 * Suggests charts and KPIs based on detected data types, generates previews
 * with real data, and manages custom user visualizations (max 20).
 */
export const catalogoVisualizacion: ICatalogoVisualizacion = {
  suggestCharts,
  suggestKPIs,
  generatePreview,
  addCustomVisualization,
  MAX_CUSTOM_VISUALIZATIONS: 20,
};
