import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { createModuloCarga } from '../../../src/modules/carga/modulo-carga';
import type { IModuloSeguridad } from '../../../src/modules/seguridad/modulo-seguridad';
import { ok, err } from '../../../src/types/result';

// ─── Test Helpers ────────────────────────────────────────────────────────────

/**
 * @description Creates a mock File object from content and metadata.
 * @param content - The file content (string or ArrayBuffer)
 * @param name - The filename
 * @param options - File options (type, size override)
 * @returns A File-like object suitable for testing
 */
function createMockFile(
  content: string | ArrayBuffer | Uint8Array,
  name: string,
  options: { type?: string; size?: number } = {},
): File {
  const blobContent: BlobPart = content instanceof Uint8Array
    ? content.buffer as ArrayBuffer
    : content;
  const blob = new Blob([blobContent], { type: options.type ?? '' });
  const file = new File([blob], name, { type: options.type ?? '' });

  if (options.size !== undefined) {
    Object.defineProperty(file, 'size', { value: options.size });
  }

  return file;
}

/**
 * @description Creates a simple CSV file with given data.
 * @param headers - Column headers
 * @param rows - Data rows
 * @param name - File name
 * @returns A File object containing the CSV
 */
function createCSVFile(
  headers: string[],
  rows: string[][],
  name = 'test.csv',
): File {
  const lines = [headers.join(','), ...rows.map((r) => r.join(','))];
  const content = lines.join('\n');
  return createMockFile(content, name, { type: 'text/csv' });
}

/**
 * @description Creates a simple Excel file with given data using SheetJS.
 * @param sheets - Array of objects with sheet name, headers and rows
 * @param name - File name
 * @returns A File object containing the Excel workbook
 */
function createExcelFile(
  sheets: { name: string; headers: string[]; rows: unknown[][] }[],
  name = 'test.xlsx',
): File {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = [sheet.headers, ...sheet.rows];
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }

  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return createMockFile(
    new Uint8Array(buffer),
    name,
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  );
}

/**
 * @description Creates a mock IModuloSeguridad that always passes validation.
 * @returns A mock security module
 */
function createPassingSecurityMock(): IModuloSeguridad {
  return {
    sanitizeInput: vi.fn((input: string) => input),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    validateFileUpload: vi.fn(() => ok(undefined)),
    getCSPHeaders: vi.fn(() => ''),
    detectInjection: vi.fn(() => false),
  };
}

/**
 * @description Creates a mock IModuloSeguridad that fails validation.
 * @param code - Error code to return
 * @param message - Error message
 * @returns A mock security module that rejects files
 */
function createFailingSecurityMock(
  code: 'INVALID_EXTENSION' | 'FILE_TOO_LARGE' | 'MIME_MISMATCH' | 'INVALID_FORMAT',
  message: string,
): IModuloSeguridad {
  return {
    sanitizeInput: vi.fn((input: string) => input),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    validateFileUpload: vi.fn(() =>
      err({
        code,
        message,
        timestamp: new Date().toISOString(),
        module: 'seguridad' as const,
        fileName: 'test.txt',
        details: message,
      }),
    ),
    getCSPHeaders: vi.fn(() => ''),
    detectInjection: vi.fn(() => false),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Módulo_Carga', () => {
  describe('Constants', () => {
    it('should expose SUPPORTED_FORMATS as [.xlsx, .xls, .csv]', () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);

      expect(moduloCarga.SUPPORTED_FORMATS).toEqual(['.xlsx', '.xls', '.csv']);
    });

    it('should expose MAX_FILE_SIZE as 52,428,800 bytes (50 MB)', () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);

      expect(moduloCarga.MAX_FILE_SIZE).toBe(52_428_800);
    });

    it('should expose MAX_ROWS as 100,000', () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);

      expect(moduloCarga.MAX_ROWS).toBe(100_000);
    });
  });

  describe('validateFile()', () => {
    it('should delegate to IModuloSeguridad.validateFileUpload()', () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createCSVFile(['A', 'B'], [['1', '2']], 'data.csv');

      moduloCarga.validateFile(file);

      expect(seguridad.validateFileUpload).toHaveBeenCalledWith(file);
    });

    it('should return ok for valid files', () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createCSVFile(['A', 'B'], [['1', '2']], 'data.csv');

      const result = moduloCarga.validateFile(file);

      expect(result.ok).toBe(true);
    });

    it('should return error for invalid file extension', () => {
      const seguridad = createFailingSecurityMock(
        'INVALID_EXTENSION',
        'La extensión del archivo no está permitida.',
      );
      const moduloCarga = createModuloCarga(seguridad);
      const file = createMockFile('content', 'file.txt', { type: 'text/plain' });

      const result = moduloCarga.validateFile(file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_EXTENSION');
        expect(result.error.module).toBe('carga');
      }
    });

    it('should return error for oversized files', () => {
      const seguridad = createFailingSecurityMock(
        'FILE_TOO_LARGE',
        'El archivo excede el tamaño máximo permitido de 50 MB.',
      );
      const moduloCarga = createModuloCarga(seguridad);
      const file = createMockFile('x', 'big.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 60 * 1024 * 1024,
      });

      const result = moduloCarga.validateFile(file);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_TOO_LARGE');
      }
    });
  });

  describe('loadFile() - CSV', () => {
    it('should load a valid CSV file and return FileLoadResult', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createCSVFile(
        ['Name', 'Age', 'City'],
        [['Alice', '30', 'NYC'], ['Bob', '25', 'LA'], ['Carol', '35', 'SF']],
      );
      const progressCalls: number[] = [];

      const result = await moduloCarga.loadFile(file, (p) => progressCalls.push(p));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.fileName).toBe('test.csv');
        expect(result.value.fileSize).toBe(file.size);
        expect(result.value.sheetCount).toBe(1);
        expect(result.value.totalRows).toBe(3);
        expect(result.value.wasTruncated).toBe(false);
        expect(result.value.sheets).toHaveLength(1);
        expect(result.value.sheets[0]!.headers).toEqual(['Name', 'Age', 'City']);
        expect(result.value.sheets[0]!.rows).toHaveLength(3);
        expect(result.value.sheets[0]!.name).toBe('Sheet1');
      }
    });

    it('should report progress from 0 to 100', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createCSVFile(['A'], [['1'], ['2']]);
      const progressCalls: number[] = [];

      await moduloCarga.loadFile(file, (p) => progressCalls.push(p));

      expect(progressCalls[0]).toBe(0);
      expect(progressCalls[progressCalls.length - 1]).toBe(100);
      // Progress should be non-decreasing
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1]!);
      }
    });

    it('should reject empty CSV files (0 data rows)', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      // Only headers, no data rows
      const file = createCSVFile(['A', 'B', 'C'], []);

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_EMPTY');
        expect(result.error.module).toBe('carga');
        expect(result.error.fileName).toBe('test.csv');
      }
    });
  });

  describe('loadFile() - Excel', () => {
    it('should load a valid Excel file with multiple sheets', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createExcelFile([
        { name: 'Sales', headers: ['Product', 'Revenue'], rows: [['Widget', 100], ['Gadget', 200]] },
        { name: 'Costs', headers: ['Item', 'Amount'], rows: [['Rent', 500]] },
      ]);

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sheetCount).toBe(2);
        expect(result.value.totalRows).toBe(3);
        expect(result.value.sheets[0]!.name).toBe('Sales');
        expect(result.value.sheets[0]!.headers).toEqual(['Product', 'Revenue']);
        expect(result.value.sheets[0]!.rows).toHaveLength(2);
        expect(result.value.sheets[1]!.name).toBe('Costs');
        expect(result.value.sheets[1]!.rows).toHaveLength(1);
      }
    });

    it('should reject empty Excel file (only headers)', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      const file = createExcelFile([
        { name: 'Empty', headers: ['Col1', 'Col2'], rows: [] },
      ]);

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_EMPTY');
      }
    });
  });

  describe('loadFile() - Truncation', () => {
    it('should truncate to 100,000 rows and set wasTruncated = true', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);

      // Create a CSV with more than 100K rows
      const headers = ['ID', 'Value'];
      const rows: string[][] = [];
      for (let i = 0; i < 100_005; i++) {
        rows.push([String(i), String(i * 10)]);
      }
      const file = createCSVFile(headers, rows);

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalRows).toBe(100_000);
        expect(result.value.wasTruncated).toBe(true);
        expect(result.value.sheets[0]!.rows).toHaveLength(100_000);
        expect(result.value.sheets[0]!.originalRowCount).toBe(100_005);
      }
    });

    it('should not truncate files with exactly 100,000 rows', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);

      const headers = ['ID'];
      const rows: string[][] = [];
      for (let i = 0; i < 100_000; i++) {
        rows.push([String(i)]);
      }
      const file = createCSVFile(headers, rows);

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.totalRows).toBe(100_000);
        expect(result.value.wasTruncated).toBe(false);
      }
    });
  });

  describe('loadFile() - Validation delegation', () => {
    it('should reject files that fail security validation', async () => {
      const seguridad = createFailingSecurityMock(
        'INVALID_EXTENSION',
        'Formato no soportado',
      );
      const moduloCarga = createModuloCarga(seguridad);
      const file = createMockFile('hello', 'data.txt', { type: 'text/plain' });

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_READ_ERROR');
        expect(result.error.fileName).toBe('data.txt');
      }
    });
  });

  describe('loadFile() - Corrupted files', () => {
    it('should return FILE_PARSE_ERROR for corrupted Excel content', async () => {
      const seguridad = createPassingSecurityMock();
      const moduloCarga = createModuloCarga(seguridad);
      // Create a file that looks like a ZIP (xlsx is zip-based) but with corrupt content
      // PK header followed by garbage to trigger parse failure
      const corruptContent = new Uint8Array([
        0x50, 0x4B, 0x03, 0x04, // PK zip header
        0xFF, 0xFF, 0xFF, 0xFF, // Corrupt metadata
        0x00, 0x00, 0x00, 0x00,
        0xFF, 0xFF, 0xFF, 0xFF,
        0xDE, 0xAD, 0xBE, 0xEF,
      ]);
      const file = createMockFile(
        corruptContent,
        'corrupted.xlsx',
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      );

      const result = await moduloCarga.loadFile(file, () => {});

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('FILE_PARSE_ERROR');
        expect(result.error.module).toBe('carga');
        expect(result.error.fileName).toBe('corrupted.xlsx');
      }
    });
  });
});
