import * as XLSX from 'xlsx';
import type { Result } from '../../types/result';
import type { FileLoadResult, SheetData } from '../../types/session';
import type { FileLoadError, FileValidationError } from '../../types/errors';
import type { IModuloSeguridad } from '../seguridad/modulo-seguridad';
import { ok, err } from '../../types/result';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the file loading module.
 * Handles file validation, parsing of Excel/CSV files, progress reporting,
 * and row truncation.
 */
export interface IModuloCarga {
  loadFile(file: File, onProgress: (percent: number) => void): Promise<Result<FileLoadResult, FileLoadError>>;
  validateFile(file: File): Result<void, FileValidationError>;
  readonly SUPPORTED_FORMATS: readonly ['.xlsx', '.xls', '.csv'];
  readonly MAX_FILE_SIZE: 52_428_800;
  readonly MAX_ROWS: 100_000;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum rows to process */
const MAX_ROWS = 100_000;

/** Supported file extensions */
const SUPPORTED_FORMATS: readonly ['.xlsx', '.xls', '.csv'] = ['.xlsx', '.xls', '.csv'];

/** Maximum file size in bytes (50 MB) */
const MAX_FILE_SIZE = 52_428_800;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Extracts the file extension from a filename, lowercased.
 * @param fileName - The file name to extract extension from
 * @returns The lowercased extension including the dot, or empty string
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * @description Reads a File object as an ArrayBuffer.
 * @param file - The file to read
 * @returns Promise resolving to the file content as ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

/**
 * @description Reads a File object as text (for CSV parsing).
 * @param file - The file to read
 * @returns Promise resolving to the file content as string
 */
async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

/**
 * @description Parses CSV text content into headers and rows.
 * @param text - Raw CSV text content
 * @returns Object with headers array and rows as 2D array
 */
function parseCSVContent(text: string): { headers: string[]; rows: unknown[][] } {
  const workbook = XLSX.read(text, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [] };
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { headers: [], rows: [] };
  }

  const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
  });

  if (jsonData.length === 0) {
    return { headers: [], rows: [] };
  }

  const headerRow = jsonData[0] as unknown[];
  const headers = headerRow.map((h) => (h != null ? String(h) : ''));
  const rows = jsonData.slice(1) as unknown[][];

  return { headers, rows };
}

/**
 * @description Parses an Excel workbook from an ArrayBuffer into sheet data.
 * Throws an error if the file cannot be parsed (corrupted/invalid).
 * @param buffer - The file content as ArrayBuffer
 * @returns Array of parsed sheet data objects
 */
function parseExcelContent(buffer: ArrayBuffer): { name: string; headers: string[]; rows: unknown[][] }[] {
  const workbook = XLSX.read(buffer, { type: 'array' });

  // If SheetJS couldn't find any sheets, the file is likely corrupt
  if (workbook.SheetNames.length === 0) {
    throw new Error('No sheets found in workbook - file may be corrupted');
  }

  const sheets: { name: string; headers: string[]; rows: unknown[][] }[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
    });

    if (jsonData.length === 0) {
      sheets.push({ name: sheetName, headers: [], rows: [] });
      continue;
    }

    const headerRow = jsonData[0] as unknown[];
    const headers = headerRow.map((h) => (h != null ? String(h) : ''));
    const rows = jsonData.slice(1) as unknown[][];

    sheets.push({ name: sheetName, headers, rows });
  }

  return sheets;
}

/**
 * @description Truncates sheets data to a maximum total row count.
 * Distributes the row budget across sheets in order.
 * @param sheets - Array of parsed sheet data
 * @param maxRows - Maximum total rows allowed
 * @returns Object with truncated sheets and whether truncation occurred
 */
function truncateSheets(
  sheets: { name: string; headers: string[]; rows: unknown[][] }[],
  maxRows: number,
): { truncatedSheets: SheetData[]; wasTruncated: boolean; totalRows: number } {
  let remainingRows = maxRows;
  let wasTruncated = false;
  const truncatedSheets: SheetData[] = [];
  let totalRows = 0;

  for (const sheet of sheets) {
    const originalRowCount = sheet.rows.length;

    if (remainingRows <= 0) {
      truncatedSheets.push({
        name: sheet.name,
        headers: sheet.headers,
        rows: [],
        originalRowCount,
      });
      if (originalRowCount > 0) {
        wasTruncated = true;
      }
      continue;
    }

    const rowsToTake = Math.min(originalRowCount, remainingRows);
    const truncatedRows = sheet.rows.slice(0, rowsToTake);

    if (rowsToTake < originalRowCount) {
      wasTruncated = true;
    }

    truncatedSheets.push({
      name: sheet.name,
      headers: sheet.headers,
      rows: truncatedRows,
      originalRowCount,
    });

    totalRows += rowsToTake;
    remainingRows -= rowsToTake;
  }

  return { truncatedSheets, wasTruncated, totalRows };
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * @description Creates a Módulo_Carga instance with injected security module dependency.
 * @param seguridad - The security module for file validation
 * @returns An IModuloCarga implementation
 */
export function createModuloCarga(seguridad: IModuloSeguridad): IModuloCarga {
  /**
   * @description Validates a file using the security module's validation.
   * Delegates to IModuloSeguridad.validateFileUpload() for triple validation.
   * @param file - The file to validate
   * @returns Result with void on success or FileValidationError on failure
   */
  function validateFile(file: File): Result<void, FileValidationError> {
    const result = seguridad.validateFileUpload(file);
    if (!result.ok) {
      // Map the security error to carga module context if needed
      const secError = result.error;
      return err({
        code: secError.code,
        message: secError.message,
        timestamp: secError.timestamp,
        module: 'carga',
        fileName: secError.fileName,
        details: secError.details,
      });
    }
    return ok(undefined);
  }

  /**
   * @description Loads and parses a file, reporting progress via callback.
   * Supports Excel (.xlsx, .xls) and CSV (.csv) formats.
   * Truncates to 100,000 rows if the file exceeds that limit.
   * Rejects empty files (0 data rows).
   * @param file - The file selected by the user
   * @param onProgress - Callback receiving progress percentage (0-100)
   * @returns Promise resolving to FileLoadResult or FileLoadError
   */
  async function loadFile(
    file: File,
    onProgress: (percent: number) => void,
  ): Promise<Result<FileLoadResult, FileLoadError>> {
    const timestamp = new Date().toISOString();

    // Step 1: Validate file (10%)
    onProgress(0);
    const validationResult = validateFile(file);
    if (!validationResult.ok) {
      return err({
        code: 'FILE_READ_ERROR',
        message: validationResult.error.message,
        timestamp,
        module: 'carga',
        fileName: file.name,
      });
    }
    onProgress(10);

    // Step 2: Read file content (10% -> 50%)
    const extension = getFileExtension(file.name);

    try {
      let parsedSheets: { name: string; headers: string[]; rows: unknown[][] }[];

      if (extension === '.csv') {
        onProgress(20);
        const text = await readFileAsText(file);
        onProgress(40);
        const csvData = parseCSVContent(text);
        parsedSheets = [{ name: 'Sheet1', ...csvData }];
      } else {
        // Excel formats (.xlsx, .xls)
        onProgress(20);
        const buffer = await readFileAsArrayBuffer(file);
        onProgress(40);
        parsedSheets = parseExcelContent(buffer);
      }

      onProgress(50);

      // Step 3: Check for empty file (0 data rows)
      const totalOriginalRows = parsedSheets.reduce(
        (sum, sheet) => sum + sheet.rows.length,
        0,
      );

      if (totalOriginalRows === 0) {
        return err({
          code: 'FILE_EMPTY',
          message: 'El archivo no contiene filas de datos. Verifique que el archivo tenga contenido además de encabezados.',
          timestamp,
          module: 'carga',
          fileName: file.name,
        });
      }

      onProgress(60);

      // Step 4: Truncate to MAX_ROWS if needed (60% -> 90%)
      const { truncatedSheets, wasTruncated, totalRows } = truncateSheets(
        parsedSheets,
        MAX_ROWS,
      );

      onProgress(90);

      // Step 5: Build result (90% -> 100%)
      const result: FileLoadResult = {
        fileName: file.name,
        fileSize: file.size,
        sheetCount: truncatedSheets.length,
        totalRows,
        wasTruncated,
        sheets: truncatedSheets,
      };

      onProgress(100);

      return ok(result);
    } catch {
      return err({
        code: 'FILE_PARSE_ERROR',
        message: 'No se pudo procesar el archivo. El archivo puede estar corrupto o tener un formato inválido.',
        timestamp,
        module: 'carga',
        fileName: file.name,
      });
    }
  }

  return {
    loadFile,
    validateFile,
    SUPPORTED_FORMATS,
    MAX_FILE_SIZE,
    MAX_ROWS,
  };
}
