/**
 * @description Base error interface for all typed errors in the system.
 * All domain-specific errors extend this base.
 */
export interface BaseError {
  /** Machine-readable error code */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Timestamp of when the error occurred (ISO 8601) */
  readonly timestamp: string;
  /** Module that originated the error */
  readonly module: string;
}

/**
 * @description Error produced during file loading operations.
 * Covers parsing failures, empty files, and truncation issues.
 */
export interface FileLoadError extends BaseError {
  readonly module: 'carga';
  readonly code:
    | 'FILE_PARSE_ERROR'
    | 'FILE_EMPTY'
    | 'FILE_TRUNCATED'
    | 'FILE_READ_ERROR';
  /** Original file name that caused the error */
  readonly fileName: string;
}

/**
 * @description Error produced during file validation.
 * Covers format, size, and MIME type mismatches.
 */
export interface FileValidationError extends BaseError {
  readonly module: 'carga' | 'seguridad';
  readonly code:
    | 'INVALID_FORMAT'
    | 'FILE_TOO_LARGE'
    | 'MIME_MISMATCH'
    | 'INVALID_EXTENSION';
  /** Original file name that failed validation */
  readonly fileName: string;
  /** Additional details about the validation failure */
  readonly details: string;
}

/**
 * @description Error produced by the security module.
 * Covers XSS detection, CSP violations, and file security issues.
 */
export interface SecurityError extends BaseError {
  readonly module: 'seguridad';
  readonly code:
    | 'XSS_DETECTED'
    | 'INJECTION_DETECTED'
    | 'CSP_VIOLATION'
    | 'FILE_SECURITY_FAILED'
    | 'INTEGRITY_CHECK_FAILED';
  /** The input or field that triggered the security error */
  readonly source: string;
}

/**
 * @description Error produced during IA provider configuration.
 * Covers invalid keys, timeout, and connectivity issues.
 */
export interface IAConfigError extends BaseError {
  readonly module: 'ia';
  readonly code:
    | 'INVALID_API_KEY'
    | 'PROVIDER_UNREACHABLE'
    | 'CONFIG_TIMEOUT'
    | 'PROVIDER_NOT_FOUND'
    | 'OLLAMA_UNAVAILABLE';
  /** The provider that caused the configuration error */
  readonly providerId: string;
}

/**
 * @description Error produced during IA query execution.
 * Covers timeouts, network failures, and response parsing issues.
 */
export interface IAQueryError extends BaseError {
  readonly module: 'ia';
  readonly code:
    | 'QUERY_TIMEOUT'
    | 'NETWORK_ERROR'
    | 'RESPONSE_PARSE_ERROR'
    | 'PROVIDER_ERROR'
    | 'RETRY_EXHAUSTED';
  /** The provider that failed to respond */
  readonly providerId: string;
  /** Number of retry attempts made */
  readonly retryCount: number;
}

/**
 * @description Error produced during localStorage operations.
 * Covers quota exceeded, read/write failures, and expiration.
 */
export interface StorageError extends BaseError {
  readonly module: 'storage';
  readonly code:
    | 'QUOTA_EXCEEDED'
    | 'WRITE_FAILED'
    | 'READ_FAILED'
    | 'SESSION_EXPIRED'
    | 'DATA_CORRUPTED'
    | 'CLEAR_FAILED';
  /** Approximate storage usage in bytes at the time of error */
  readonly storageUsedBytes?: number;
}

/**
 * @description Error produced during detection of file structure.
 * Covers timeout, invalid structure, and analysis failures.
 */
export interface DetectionError extends BaseError {
  readonly module: 'deteccion';
  readonly code:
    | 'ANALYSIS_TIMEOUT'
    | 'NO_VALID_STRUCTURE'
    | 'SHEET_LIMIT_EXCEEDED'
    | 'ANALYSIS_FAILED';
}

/**
 * @description Error produced by the PRISM evaluation engine.
 */
export interface PRISMError extends BaseError {
  readonly module: 'prism';
  readonly code:
    | 'EVALUATION_FAILED'
    | 'INVALID_INPUT'
    | 'DIMENSION_CALCULATION_ERROR';
  /** The dimension that failed, if applicable */
  readonly dimension?: string;
}

/**
 * @description Error produced during document generation.
 */
export interface DocumentError extends BaseError {
  readonly module: 'documento';
  readonly code:
    | 'GENERATION_TIMEOUT'
    | 'GENERATION_FAILED'
    | 'INSUFFICIENT_DATA'
    | 'TEMPLATE_ERROR';
}

/**
 * @description Error produced when parsing a generated Markdown document.
 */
export interface ParseError extends BaseError {
  readonly module: 'documento';
  readonly code:
    | 'INVALID_MARKDOWN'
    | 'MISSING_SECTIONS'
    | 'STRUCTURE_MISMATCH';
  /** Sections that could not be parsed */
  readonly missingSections?: string[];
}

/**
 * @description Error produced in the objectives module.
 */
export interface ObjectiveError extends BaseError {
  readonly module: 'objetivos';
  readonly code:
    | 'MAX_OBJECTIVES_REACHED'
    | 'INVALID_NAME_LENGTH'
    | 'INVALID_DESCRIPTION_LENGTH'
    | 'OBJECTIVE_NOT_FOUND';
}

/**
 * @description Error produced during KPI-Objective linking.
 */
export interface LinkError extends BaseError {
  readonly module: 'objetivos';
  readonly code:
    | 'MAX_LINKS_PER_KPI'
    | 'LINK_NOT_FOUND'
    | 'KPI_NOT_FOUND'
    | 'OBJECTIVE_NOT_FOUND'
    | 'DUPLICATE_LINK';
}

/**
 * @description Error produced in the visualization catalog.
 */
export interface VisualizationError extends BaseError {
  readonly module: 'visualizacion';
  readonly code:
    | 'MAX_CUSTOM_REACHED'
    | 'INVALID_TITLE_LENGTH'
    | 'PREVIEW_TIMEOUT'
    | 'INVALID_CONFIG';
}

/**
 * @description Error produced by the integrity check during decryption.
 */
export interface IntegrityError extends BaseError {
  readonly module: 'seguridad';
  readonly code: 'INTEGRITY_CHECK_FAILED' | 'DECRYPTION_FAILED';
}

/**
 * @description Union type of all possible application errors.
 * Useful for generic error handling utilities.
 */
export type AppError =
  | FileLoadError
  | FileValidationError
  | SecurityError
  | IAConfigError
  | IAQueryError
  | StorageError
  | DetectionError
  | PRISMError
  | DocumentError
  | ParseError
  | ObjectiveError
  | LinkError
  | VisualizationError
  | IntegrityError;
