import type { PRISMDimension } from '../../types/common';
import type {
  SheetData,
  DetectionResult,
  DimensionScore,
  ProblemDetail,
  PRISMResult,
} from '../../types/session';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the PRISM quality evaluation engine.
 * Evaluates data quality across 5 dimensions: Precision, Relevance,
 * Integrity, Sufficiency, and Maintainability.
 * All evaluations are deterministic and idempotent.
 */
export interface IMotorPRISM {
  evaluate(structure: DetectionResult, data: SheetData[]): PRISMResult;
  recalculateDimension(
    dimension: PRISMDimension,
    structure: DetectionResult,
    data: SheetData[],
  ): DimensionScore;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum problems to report per dimension */
const MAX_PROBLEMS_PER_DIMENSION = 10;

/** Threshold below which warnings are triggered */
const WARNING_THRESHOLD = 60;

/** Threshold below which integrity is considered low */
const LOW_INTEGRITY_THRESHOLD = 30;

/** Default sufficiency threshold (minimum records expected) */
const SUFFICIENCY_ROW_THRESHOLD = 100;

/** Maximum sample size for type consistency checks */
const MAX_SAMPLE_SIZE = 1000;

// ─── Precision Helpers ───────────────────────────────────────────────────────

/**
 * @description Checks if a value is consistent with the assigned column type.
 * @param value - The cell value to check
 * @param assignedType - The expected type for this column
 * @returns True if the value is consistent with the assigned type
 */
function isConsistentWithType(value: unknown, assignedType: string): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;

  switch (assignedType) {
    case 'numeric':
      return typeof value === 'number' || !isNaN(parseFloat(String(value)));
    case 'boolean':
      return isBooleanLike(value);
    case 'date':
      return isDateLike(value);
    case 'text':
      return true;
    default:
      return true;
  }
}

/**
 * @description Checks if a value looks like a boolean.
 * @param value - The value to check
 * @returns True if it represents a boolean
 */
function isBooleanLike(value: unknown): boolean {
  if (typeof value === 'boolean') return true;
  if (typeof value === 'number') return value === 0 || value === 1;
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    return ['true', 'false', '1', '0', 'yes', 'no', 'sí', 'si'].includes(norm);
  }
  return false;
}

/**
 * @description Checks if a value looks like a date.
 * @param value - The value to check
 * @returns True if it represents a date
 */
function isDateLike(value: unknown): boolean {
  if (value instanceof Date) return !isNaN(value.getTime());
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const isoPattern = /^\d{4}-\d{2}-\d{2}/;
  const slashPattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
  return isoPattern.test(trimmed) || slashPattern.test(trimmed);
}

// ─── Dimension Evaluators ────────────────────────────────────────────────────

/**
 * @description Evaluates the Precision dimension.
 * Formula: 100 - (inconsistencies / total × 100)
 * Measures type consistency of values against their assigned column types.
 * @param structure - The detected structure
 * @param data - The sheet data
 * @returns DimensionScore for precision
 */
function evaluatePrecision(
  structure: DetectionResult,
  data: SheetData[],
): DimensionScore {
  let totalValues = 0;
  let inconsistencies = 0;
  const problems: ProblemDetail[] = [];

  for (let sheetIdx = 0; sheetIdx < structure.sheets.length; sheetIdx++) {
    const sheetStructure = structure.sheets[sheetIdx]!;
    const sheetData = data[sheetIdx];
    if (!sheetData) continue;

    for (let colIdx = 0; colIdx < sheetStructure.columns.length; colIdx++) {
      const col = sheetStructure.columns[colIdx]!;
      const sample = sheetData.rows.slice(0, MAX_SAMPLE_SIZE);
      let colInconsistencies = 0;

      for (const row of sample) {
        const value = row[colIdx];
        if (value === null || value === undefined) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        totalValues++;
        if (!isConsistentWithType(value, col.assignedType)) {
          inconsistencies++;
          colInconsistencies++;
        }
      }

      if (colInconsistencies > 0 && problems.length < MAX_PROBLEMS_PER_DIMENSION) {
        problems.push({
          location: `${sheetStructure.sheetName}:${col.name}`,
          description: `${colInconsistencies} valores inconsistentes con tipo ${col.assignedType}`,
          impact: Math.round((colInconsistencies / sample.length) * 100),
        });
      }
    }
  }

  const score = totalValues === 0
    ? 0
    : clampScore(Math.round(100 - (inconsistencies / totalValues) * 100));

  const observations = buildPrecisionObservations(score, inconsistencies, totalValues);

  return {
    dimension: 'precision',
    score,
    observations,
    problems: score <= WARNING_THRESHOLD ? problems.slice(0, MAX_PROBLEMS_PER_DIMENSION) : [],
  };
}

/**
 * @description Builds observations for the precision dimension.
 * @param score - The calculated score
 * @param inconsistencies - Number of inconsistencies found
 * @param total - Total values checked
 * @returns Array of observation strings
 */
function buildPrecisionObservations(
  score: number,
  inconsistencies: number,
  total: number,
): string[] {
  const observations: string[] = [];
  observations.push(`Se verificaron ${total} valores contra sus tipos asignados.`);
  if (inconsistencies > 0) {
    observations.push(`Se encontraron ${inconsistencies} inconsistencias de tipo.`);
  }
  if (score >= 80) {
    observations.push('Los datos muestran alta consistencia de tipos.');
  } else if (score >= 60) {
    observations.push('Se detectaron algunas inconsistencias de tipos.');
  } else {
    observations.push('Se detectan problemas significativos de consistencia de tipos.');
  }
  return observations;
}

/**
 * @description Evaluates the Relevance dimension.
 * Formula: (useful_columns / total_columns) × 100
 * A column is "useful" if it has less than 80% empty values.
 * @param structure - The detected structure
 * @returns DimensionScore for relevance
 */
function evaluateRelevance(structure: DetectionResult): DimensionScore {
  let totalColumns = 0;
  let usefulColumns = 0;
  const problems: ProblemDetail[] = [];

  for (const sheet of structure.sheets) {
    for (const col of sheet.columns) {
      totalColumns++;
      if (col.emptyPercentage < 80) {
        usefulColumns++;
      } else if (problems.length < MAX_PROBLEMS_PER_DIMENSION) {
        problems.push({
          location: `${sheet.sheetName}:${col.name}`,
          description: `Columna con ${col.emptyPercentage.toFixed(1)}% valores vacíos`,
          impact: Math.round(col.emptyPercentage),
        });
      }
    }
  }

  const score = totalColumns === 0
    ? 0
    : clampScore(Math.round((usefulColumns / totalColumns) * 100));

  const observations = buildRelevanceObservations(score, usefulColumns, totalColumns);

  return {
    dimension: 'relevance',
    score,
    observations,
    problems: score <= WARNING_THRESHOLD ? problems.slice(0, MAX_PROBLEMS_PER_DIMENSION) : [],
  };
}

/**
 * @description Builds observations for the relevance dimension.
 * @param score - The calculated score
 * @param useful - Number of useful columns
 * @param total - Total columns
 * @returns Array of observation strings
 */
function buildRelevanceObservations(
  score: number,
  useful: number,
  total: number,
): string[] {
  const observations: string[] = [];
  observations.push(`${useful} de ${total} columnas contienen datos útiles.`);
  if (score >= 80) {
    observations.push('La mayoría de las columnas contienen datos relevantes.');
  } else if (score >= 60) {
    observations.push('Algunas columnas tienen exceso de valores vacíos.');
  } else {
    observations.push('Muchas columnas carecen de datos útiles.');
  }
  return observations;
}

/**
 * @description Evaluates the Integrity dimension.
 * Formula: (present_values / total_cells) × 100
 * @param structure - The detected structure
 * @param data - The sheet data
 * @returns DimensionScore for integrity
 */
function evaluateIntegrity(
  structure: DetectionResult,
  data: SheetData[],
): DimensionScore {
  let totalCells = 0;
  let presentValues = 0;
  const problems: ProblemDetail[] = [];

  for (let sheetIdx = 0; sheetIdx < structure.sheets.length; sheetIdx++) {
    const sheetStructure = structure.sheets[sheetIdx]!;
    const sheetData = data[sheetIdx];
    if (!sheetData) continue;

    for (let colIdx = 0; colIdx < sheetStructure.columns.length; colIdx++) {
      const col = sheetStructure.columns[colIdx]!;
      const colCells = sheetData.rows.length;
      totalCells += colCells;
      const presentCount = col.recordCount;
      presentValues += presentCount;

      if (col.emptyPercentage > 50 && problems.length < MAX_PROBLEMS_PER_DIMENSION) {
        problems.push({
          location: `${sheetStructure.sheetName}:${col.name}`,
          description: `${col.emptyPercentage.toFixed(1)}% de valores ausentes`,
          impact: Math.round(col.emptyPercentage),
        });
      }
    }
  }

  const score = totalCells === 0
    ? 0
    : clampScore(Math.round((presentValues / totalCells) * 100));

  const observations = buildIntegrityObservations(score, presentValues, totalCells);

  return {
    dimension: 'integrity',
    score,
    observations,
    problems: score <= WARNING_THRESHOLD ? problems.slice(0, MAX_PROBLEMS_PER_DIMENSION) : [],
  };
}

/**
 * @description Builds observations for the integrity dimension.
 * @param score - The calculated score
 * @param present - Number of present values
 * @param total - Total cells
 * @returns Array of observation strings
 */
function buildIntegrityObservations(
  score: number,
  present: number,
  total: number,
): string[] {
  const observations: string[] = [];
  observations.push(`${present} de ${total} celdas contienen valores.`);
  if (score >= 80) {
    observations.push('Los datos tienen alta completitud.');
  } else if (score >= 60) {
    observations.push('Existen vacíos moderados en los datos.');
  } else if (score >= 30) {
    observations.push('Se detectan vacíos significativos en los datos.');
  } else {
    observations.push('Los datos tienen graves problemas de completitud.');
  }
  return observations;
}

/**
 * @description Evaluates the Sufficiency dimension.
 * Formula: min(records / threshold × 100, 100)
 * Uses the maximum records count across all sheets.
 * @param structure - The detected structure
 * @returns DimensionScore for sufficiency
 */
function evaluateSufficiency(structure: DetectionResult): DimensionScore {
  let maxRecords = 0;
  const problems: ProblemDetail[] = [];

  for (const sheet of structure.sheets) {
    if (sheet.totalRecords > maxRecords) {
      maxRecords = sheet.totalRecords;
    }

    if (sheet.totalRecords < SUFFICIENCY_ROW_THRESHOLD && problems.length < MAX_PROBLEMS_PER_DIMENSION) {
      problems.push({
        location: sheet.sheetName,
        description: `Solo ${sheet.totalRecords} registros (umbral: ${SUFFICIENCY_ROW_THRESHOLD})`,
        impact: Math.round(100 - (sheet.totalRecords / SUFFICIENCY_ROW_THRESHOLD) * 100),
      });
    }
  }

  const score = clampScore(
    Math.round(Math.min((maxRecords / SUFFICIENCY_ROW_THRESHOLD) * 100, 100)),
  );

  const observations = buildSufficiencyObservations(score, maxRecords);

  return {
    dimension: 'sufficiency',
    score,
    observations,
    problems: score <= WARNING_THRESHOLD ? problems.slice(0, MAX_PROBLEMS_PER_DIMENSION) : [],
  };
}

/**
 * @description Builds observations for the sufficiency dimension.
 * @param score - The calculated score
 * @param maxRecords - Maximum records found
 * @returns Array of observation strings
 */
function buildSufficiencyObservations(score: number, maxRecords: number): string[] {
  const observations: string[] = [];
  observations.push(`Máximo de ${maxRecords} registros (umbral: ${SUFFICIENCY_ROW_THRESHOLD}).`);
  if (score >= 100) {
    observations.push('La cantidad de datos es suficiente para análisis confiable.');
  } else if (score >= 60) {
    observations.push('La cantidad de datos es moderada para análisis.');
  } else {
    observations.push('La cantidad de datos es insuficiente para análisis robusto.');
  }
  return observations;
}

/**
 * @description Evaluates the Maintainability dimension.
 * Heuristics: naming conventions (descriptive headers) + format consistency.
 * @param structure - The detected structure
 * @returns DimensionScore for maintainability
 */
function evaluateMaintainability(structure: DetectionResult): DimensionScore {
  let totalColumns = 0;
  let wellNamedColumns = 0;
  const problems: ProblemDetail[] = [];

  for (const sheet of structure.sheets) {
    for (const col of sheet.columns) {
      totalColumns++;
      const nameScore = evaluateColumnName(col.name);

      if (nameScore >= 0.5) {
        wellNamedColumns++;
      } else if (problems.length < MAX_PROBLEMS_PER_DIMENSION) {
        problems.push({
          location: `${sheet.sheetName}:${col.name}`,
          description: describeNamingIssue(col.name),
          impact: Math.round((1 - nameScore) * 100),
        });
      }
    }
  }

  const score = totalColumns === 0
    ? 0
    : clampScore(Math.round((wellNamedColumns / totalColumns) * 100));

  const observations = buildMaintainabilityObservations(score, wellNamedColumns, totalColumns);

  return {
    dimension: 'maintainability',
    score,
    observations,
    problems: score <= WARNING_THRESHOLD ? problems.slice(0, MAX_PROBLEMS_PER_DIMENSION) : [],
  };
}

/**
 * @description Evaluates the quality of a column name using naming heuristics.
 * Checks: length >= 3, not generic, contains word-like characters.
 * @param name - The column header name
 * @returns Score between 0 and 1
 */
function evaluateColumnName(name: string): number {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 0;
  if (trimmed.length < 3) return 0.2;

  let nameScore = 0.5;

  // Bonus for descriptive length (3-30 chars)
  if (trimmed.length >= 3 && trimmed.length <= 30) {
    nameScore += 0.2;
  }

  // Bonus for word characters (not purely numbers or symbols)
  if (/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(trimmed)) {
    nameScore += 0.2;
  }

  // Penalty for generic names
  const genericNames = ['col', 'column', 'field', 'data', 'value', 'var'];
  if (genericNames.includes(trimmed.toLowerCase())) {
    nameScore -= 0.3;
  }

  return Math.max(0, Math.min(1, nameScore));
}

/**
 * @description Describes the naming issue for a column.
 * @param name - The column name
 * @returns A human-readable description of the issue
 */
function describeNamingIssue(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Nombre de columna vacío';
  if (trimmed.length < 3) return `Nombre demasiado corto: "${trimmed}"`;
  return `Nombre poco descriptivo: "${trimmed}"`;
}

/**
 * @description Builds observations for the maintainability dimension.
 * @param score - The calculated score
 * @param wellNamed - Number of well-named columns
 * @param total - Total columns
 * @returns Array of observation strings
 */
function buildMaintainabilityObservations(
  score: number,
  wellNamed: number,
  total: number,
): string[] {
  const observations: string[] = [];
  observations.push(`${wellNamed} de ${total} columnas tienen nombres descriptivos.`);
  if (score >= 80) {
    observations.push('Los encabezados son claros y descriptivos.');
  } else if (score >= 60) {
    observations.push('Algunos encabezados podrían ser más descriptivos.');
  } else {
    observations.push('Los encabezados requieren mejoras significativas en naming.');
  }
  return observations;
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * @description Clamps a score to the valid integer range [0, 100].
 * @param value - The raw score value
 * @returns Integer clamped between 0 and 100
 */
function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * @description Determines if all dimension scores are zero (blocking quality).
 * @param dimensions - Array of dimension scores
 * @returns True if all scores are 0
 */
function checkIsBlockingQuality(dimensions: DimensionScore[]): boolean {
  return dimensions.every((dim) => dim.score === 0);
}

/**
 * @description Checks if the integrity dimension has a low score (< 30).
 * @param dimensions - Array of dimension scores
 * @returns True if integrity score < 30
 */
function checkHasLowIntegrity(dimensions: DimensionScore[]): boolean {
  const integrity = dimensions.find((dim) => dim.dimension === 'integrity');
  return integrity !== undefined && integrity.score < LOW_INTEGRITY_THRESHOLD;
}

/**
 * @description Checks if any dimension has a score <= 60.
 * @param dimensions - Array of dimension scores
 * @returns True if any dimension has a warning-level score
 */
function checkHasWarningDimensions(dimensions: DimensionScore[]): boolean {
  return dimensions.some((dim) => dim.score <= WARNING_THRESHOLD);
}

// ─── Main Evaluation ─────────────────────────────────────────────────────────

/**
 * @description Evaluates data quality across all 5 PRISM dimensions.
 * This function is deterministic and idempotent: calling it twice
 * with the same inputs always produces identical results.
 * @param structure - The detected file structure from Módulo_Detección
 * @param data - The sheet data from Módulo_Carga
 * @returns Complete PRISMResult with scores, flags, and problems
 */
function evaluate(structure: DetectionResult, data: SheetData[]): PRISMResult {
  const dimensions: DimensionScore[] = [
    evaluatePrecision(structure, data),
    evaluateRelevance(structure),
    evaluateIntegrity(structure, data),
    evaluateSufficiency(structure),
    evaluateMaintainability(structure),
  ];

  return {
    dimensions,
    isBlockingQuality: checkIsBlockingQuality(dimensions),
    hasLowIntegrity: checkHasLowIntegrity(dimensions),
    hasWarningDimensions: checkHasWarningDimensions(dimensions),
  };
}

/**
 * @description Recalculates a single PRISM dimension for partial re-evaluation.
 * Useful when the user corrects data and wants to see updated scores
 * without re-running the entire evaluation.
 * @param dimension - The specific dimension to recalculate
 * @param structure - The updated structure
 * @param data - The updated sheet data
 * @returns Updated DimensionScore for the specified dimension
 */
function recalculateDimension(
  dimension: PRISMDimension,
  structure: DetectionResult,
  data: SheetData[],
): DimensionScore {
  switch (dimension) {
    case 'precision':
      return evaluatePrecision(structure, data);
    case 'relevance':
      return evaluateRelevance(structure);
    case 'integrity':
      return evaluateIntegrity(structure, data);
    case 'sufficiency':
      return evaluateSufficiency(structure);
    case 'maintainability':
      return evaluateMaintainability(structure);
  }
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The PRISM evaluation engine implementing IMotorPRISM.
 * Evaluates data quality in 5 dimensions: Precision, Relevance,
 * Integrity, Sufficiency, and Maintainability.
 * All evaluations are pure functions, deterministic, and idempotent.
 */
export const motorPRISM: IMotorPRISM = {
  evaluate,
  recalculateDimension,
};
