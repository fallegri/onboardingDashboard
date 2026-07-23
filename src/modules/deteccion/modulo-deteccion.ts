import type { DataType } from '../../types/common';
import type { SheetData, ColumnInfo, SheetStructure, DetectionResult } from '../../types/session';
import type { DetectionError } from '../../types/errors';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of sheets to analyze */
const MAX_SHEETS = 50;

/** Maximum sample size per column for type inference */
const MAX_SAMPLE_SIZE = 1000;

/** Majority threshold for type assignment (>60%) */
const MAJORITY_THRESHOLD = 0.6;

/** Warning threshold for empty values (>30%) */
const WARNING_THRESHOLD = 30;

/** Analysis timeout in milliseconds (30 seconds) */
const ANALYSIS_TIMEOUT_MS = 30_000;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the structure detection module.
 * Analyzes file structure: sheets, columns, data types, and empty percentages.
 */
export interface IModuloDeteccion {
  analyzeStructure(sheets: SheetData[]): Promise<DetectionResult>;
  reassignColumnType(sheetIndex: number, columnIndex: number, newType: DataType): void;
  inferType(value: unknown): DataType;
  readonly MAX_SHEETS: 50;
}

// ─── Type Detection Helpers ──────────────────────────────────────────────────

/**
 * @description Checks if a value represents a boolean.
 * Recognizes: true/false, 1/0, 'yes'/'no', 'sí'/'no', 'verdadero'/'falso'.
 * @param value - The value to check
 * @returns True if the value is boolean-like
 */
function isBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return [
      'true', 'false',
      '1', '0',
      'yes', 'no',
      'sí', 'si',
      'verdadero', 'falso',
    ].includes(normalized);
  }
  return false;
}

/**
 * @description Checks if a value represents a date.
 * Recognizes: ISO formats (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss),
 * common formats (DD/MM/YYYY, MM/DD/YYYY), and Date objects.
 * @param value - The value to check
 * @returns True if the value is date-like
 */
function isDateValue(value: unknown): boolean {
  if (value instanceof Date) return !isNaN(value.getTime());

  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // ISO date: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoPattern = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;
  if (isoPattern.test(trimmed)) {
    const parsed = new Date(trimmed);
    return !isNaN(parsed.getTime());
  }

  // Common formats: DD/MM/YYYY or MM/DD/YYYY
  const slashPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  if (slashPattern.test(trimmed)) {
    const parts = trimmed.split('/');
    const day = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const year = parseInt(parts[2]!, 10);
    // Basic range validation
    if (year >= 1900 && year <= 2100) {
      if ((month >= 1 && month <= 12 && day >= 1 && day <= 31) ||
          (day >= 1 && day <= 12 && month >= 1 && month <= 31)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * @description Checks if a value represents a numeric value.
 * Uses parseFloat and verifies the result is not NaN.
 * @param value - The value to check
 * @returns True if the value is numeric
 */
function isNumericValue(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return false;
    const parsed = parseFloat(trimmed);
    return !isNaN(parsed);
  }
  return false;
}

/**
 * @description Checks if a value is empty (null, undefined, or empty string).
 * @param value - The value to check
 * @returns True if the value is considered empty
 */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim().length === 0) return true;
  return false;
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * @description Infers the data type of a single value.
 * Priority: boolean > date > numeric > text.
 * @param value - The value to classify
 * @returns The inferred DataType
 */
export function inferType(value: unknown): DataType {
  if (isEmpty(value)) return 'text';
  if (isBooleanValue(value)) return 'boolean';
  if (isDateValue(value)) return 'date';
  if (isNumericValue(value)) return 'numeric';
  return 'text';
}

/**
 * @description Infers the column type by sampling values and applying majority rule.
 * Samples up to 1000 non-empty values, classifies each, and assigns
 * the type that exceeds 60% of the sample. Defaults to 'text' if no majority.
 * @param values - Array of column values to analyze
 * @returns The inferred DataType for the column
 */
function inferColumnType(values: unknown[]): DataType {
  // Filter out empty values
  const nonEmpty = values.filter((v) => !isEmpty(v));

  if (nonEmpty.length === 0) return 'text';

  // Sample up to MAX_SAMPLE_SIZE values
  const sample = nonEmpty.length <= MAX_SAMPLE_SIZE
    ? nonEmpty
    : nonEmpty.slice(0, MAX_SAMPLE_SIZE);

  const counts: Record<DataType, number> = {
    numeric: 0,
    text: 0,
    date: 0,
    boolean: 0,
  };

  for (const value of sample) {
    const type = inferType(value);
    counts[type]++;
  }

  const total = sample.length;
  const threshold = total * MAJORITY_THRESHOLD;

  // Check majority in priority order: boolean, date, numeric, text
  if (counts.boolean > threshold) return 'boolean';
  if (counts.date > threshold) return 'date';
  if (counts.numeric > threshold) return 'numeric';
  if (counts.text > threshold) return 'text';

  // No majority → default to text
  return 'text';
}

/**
 * @description Analyzes a single sheet and produces its structure metadata.
 * @param sheet - The sheet data to analyze
 * @returns SheetStructure with column info, types, and empty percentages
 */
function analyzeSheet(sheet: SheetData): SheetStructure {
  const columns: ColumnInfo[] = [];
  const totalRecords = sheet.rows.length;

  for (let colIdx = 0; colIdx < sheet.headers.length; colIdx++) {
    const headerName = sheet.headers[colIdx] ?? `Column_${colIdx + 1}`;
    const columnValues = sheet.rows.map((row) => row[colIdx]);

    // Count empty values
    const emptyCount = columnValues.filter((v) => isEmpty(v)).length;
    const emptyPercentage = totalRecords > 0
      ? (emptyCount / totalRecords) * 100
      : 0;

    // Infer type from column values
    const detectedType = inferColumnType(columnValues);

    // Record count = non-empty values
    const recordCount = totalRecords - emptyCount;

    const columnInfo: ColumnInfo = {
      name: headerName,
      detectedType,
      assignedType: detectedType,
      emptyPercentage: Math.round(emptyPercentage * 100) / 100,
      recordCount,
      hasWarning: emptyPercentage > WARNING_THRESHOLD,
    };

    columns.push(columnInfo);
  }

  return {
    sheetName: sheet.name,
    columns,
    totalRecords,
  };
}

/**
 * @description Checks if a sheet has valid tabular structure.
 * A valid sheet has at least 1 header and at least 1 row of data.
 * @param sheet - The sheet data to validate
 * @returns True if the sheet has valid tabular structure
 */
function hasTabularStructure(sheet: SheetData): boolean {
  return sheet.headers.length > 0 && sheet.rows.length > 0;
}

/**
 * @description Creates a DetectionError with the given code and message.
 * @param code - The error code
 * @param message - The error message
 * @returns A DetectionError object
 */
function createDetectionError(
  code: DetectionError['code'],
  message: string,
): DetectionError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'deteccion',
  };
}

// ─── Module State & Implementation ──────────────────────────────────────────

/** Internal mutable state for the detection result */
let currentResult: DetectionResult | null = null;
/** Mutable sheets array for reassignColumnType */
let mutableSheets: SheetStructure[] = [];

/**
 * @description Analyzes the structure of all sheets from a loaded file.
 * Processes up to 50 sheets, identifies columns, types, records, and empty percentages.
 * Validates that at least one sheet has tabular structure.
 * Respects a 30-second timeout.
 * @param sheets - Array of SheetData from the file loader
 * @returns DetectionResult with structure analysis
 * @throws DetectionError if timeout is exceeded or no valid structure found
 */
export async function analyzeStructure(sheets: SheetData[]): Promise<DetectionResult> {
  const startTime = Date.now();

  // Determine how many sheets to analyze (max 50)
  const sheetsToAnalyze = sheets.slice(0, MAX_SHEETS);
  const skippedSheets = Math.max(0, sheets.length - MAX_SHEETS);

  const analyzedStructures: SheetStructure[] = [];
  let foundValidStructure = false;

  for (const sheet of sheetsToAnalyze) {
    // Check timeout
    const elapsed = Date.now() - startTime;
    if (elapsed >= ANALYSIS_TIMEOUT_MS) {
      throw createDetectionError(
        'ANALYSIS_TIMEOUT',
        'El análisis excedió el tiempo máximo de 30 segundos.',
      );
    }

    const structure = analyzeSheet(sheet);
    analyzedStructures.push(structure);

    if (hasTabularStructure(sheet)) {
      foundValidStructure = true;
    }

    // Yield to event loop periodically for large datasets
    if (analyzedStructures.length % 10 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Validate: at least one sheet must have tabular structure
  if (!foundValidStructure) {
    throw createDetectionError(
      'NO_VALID_STRUCTURE',
      'No se detectó estructura tabular válida. Verifique que el archivo contenga datos organizados en columnas con encabezados.',
    );
  }

  // Store mutable state for reassignColumnType
  mutableSheets = analyzedStructures.map((s) => ({
    ...s,
    columns: s.columns.map((c) => ({ ...c })),
  }));

  const result: DetectionResult = {
    sheets: mutableSheets,
    analyzedSheets: analyzedStructures.length,
    skippedSheets,
    hasValidStructure: foundValidStructure,
  };

  currentResult = result;
  return result;
}

/**
 * @description Reassigns the type of a specific column immediately.
 * Updates the internal mutable state of the detection result.
 * @param sheetIndex - Index of the sheet (0-based)
 * @param columnIndex - Index of the column (0-based)
 * @param newType - The new DataType to assign
 */
export function reassignColumnType(
  sheetIndex: number,
  columnIndex: number,
  newType: DataType,
): void {
  if (!currentResult) return;
  const sheet = mutableSheets[sheetIndex];
  if (!sheet) return;
  const column = sheet.columns[columnIndex];
  if (!column) return;

  // Mutate the assignedType directly
  (column as { assignedType: DataType }).assignedType = newType;
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The detection module implementing IModuloDeteccion.
 * Analyzes file structure, infers column types via sampling,
 * and supports runtime type reassignment.
 */
export const moduloDeteccion: IModuloDeteccion = {
  analyzeStructure,
  reassignColumnType,
  inferType,
  MAX_SHEETS: 50,
};
