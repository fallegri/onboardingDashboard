import { describe, it, expect, beforeEach } from 'vitest';
import { moduloDeteccion, inferType, analyzeStructure, reassignColumnType } from '../../../src/modules/deteccion/modulo-deteccion';
import type { SheetData } from '../../../src/types/session';

// ─── Helper Factories ────────────────────────────────────────────────────────

function createSheet(overrides: Partial<SheetData> = {}): SheetData {
  return {
    name: 'Sheet1',
    headers: ['Name', 'Age', 'Date', 'Active'],
    rows: [
      ['Alice', 25, '2024-01-15', true],
      ['Bob', 30, '2024-02-20', false],
      ['Charlie', 35, '2024-03-10', true],
    ],
    originalRowCount: 3,
    ...overrides,
  };
}

function createNumericSheet(): SheetData {
  return {
    name: 'Numbers',
    headers: ['Value', 'Score'],
    rows: Array.from({ length: 100 }, (_, i) => [i * 1.5, i * 10]),
    originalRowCount: 100,
  };
}

function createEmptyColumnSheet(): SheetData {
  return {
    name: 'Sparse',
    headers: ['Full', 'MostlyEmpty'],
    rows: [
      ['data1', null],
      ['data2', null],
      ['data3', null],
      ['data4', 'value'],
      ['data5', null],
      ['data6', null],
      ['data7', null],
      ['data8', null],
      ['data9', null],
      ['data10', null],
    ],
    originalRowCount: 10,
  };
}

// ─── inferType Tests ─────────────────────────────────────────────────────────

describe('inferType', () => {
  describe('numeric detection', () => {
    it('should detect integers', () => {
      expect(inferType(42)).toBe('numeric');
    });

    it('should detect floats', () => {
      expect(inferType(3.14)).toBe('numeric');
    });

    it('should detect numeric strings', () => {
      expect(inferType('123')).toBe('numeric');
      expect(inferType('3.14')).toBe('numeric');
      expect(inferType('-42.5')).toBe('numeric');
    });

    it('should detect negative numbers', () => {
      expect(inferType(-100)).toBe('numeric');
    });
  });

  describe('date detection', () => {
    it('should detect ISO date format YYYY-MM-DD', () => {
      expect(inferType('2024-01-15')).toBe('date');
    });

    it('should detect ISO datetime format', () => {
      expect(inferType('2024-01-15T10:30:00')).toBe('date');
    });

    it('should detect ISO datetime without seconds', () => {
      expect(inferType('2024-01-15T10:30')).toBe('date');
    });

    it('should detect DD/MM/YYYY format', () => {
      expect(inferType('15/01/2024')).toBe('date');
    });

    it('should detect MM/DD/YYYY format', () => {
      expect(inferType('01/15/2024')).toBe('date');
    });

    it('should detect Date objects', () => {
      expect(inferType(new Date('2024-01-15'))).toBe('date');
    });

    it('should not detect invalid dates', () => {
      expect(inferType('not-a-date')).toBe('text');
    });
  });

  describe('boolean detection', () => {
    it('should detect boolean true/false', () => {
      expect(inferType(true)).toBe('boolean');
      expect(inferType(false)).toBe('boolean');
    });

    it('should detect string true/false', () => {
      expect(inferType('true')).toBe('boolean');
      expect(inferType('false')).toBe('boolean');
    });

    it('should detect 1/0 as boolean', () => {
      expect(inferType(1)).toBe('boolean');
      expect(inferType(0)).toBe('boolean');
    });

    it('should detect yes/no', () => {
      expect(inferType('yes')).toBe('boolean');
      expect(inferType('no')).toBe('boolean');
    });

    it('should detect sí/no (Spanish)', () => {
      expect(inferType('sí')).toBe('boolean');
      expect(inferType('si')).toBe('boolean');
    });

    it('should detect verdadero/falso', () => {
      expect(inferType('verdadero')).toBe('boolean');
      expect(inferType('falso')).toBe('boolean');
    });
  });

  describe('text detection', () => {
    it('should detect plain text', () => {
      expect(inferType('hello world')).toBe('text');
    });

    it('should detect empty values as text', () => {
      expect(inferType(null)).toBe('text');
      expect(inferType(undefined)).toBe('text');
      expect(inferType('')).toBe('text');
      expect(inferType('   ')).toBe('text');
    });
  });
});

// ─── analyzeStructure Tests ──────────────────────────────────────────────────

describe('analyzeStructure', () => {
  beforeEach(() => {
    // Reset module state between tests by analyzing a minimal sheet
  });

  it('should analyze a basic sheet with mixed types', async () => {
    const sheet = createSheet();
    const result = await analyzeStructure([sheet]);

    expect(result.sheets).toHaveLength(1);
    expect(result.analyzedSheets).toBe(1);
    expect(result.skippedSheets).toBe(0);
    expect(result.hasValidStructure).toBe(true);

    const sheetStructure = result.sheets[0]!;
    expect(sheetStructure.sheetName).toBe('Sheet1');
    expect(sheetStructure.columns).toHaveLength(4);
    expect(sheetStructure.totalRecords).toBe(3);
  });

  it('should detect column types correctly via majority rule', async () => {
    const sheet = createNumericSheet();
    const result = await analyzeStructure([sheet]);

    const columns = result.sheets[0]!.columns;
    expect(columns[0]!.detectedType).toBe('numeric');
    expect(columns[1]!.detectedType).toBe('numeric');
  });

  it('should calculate empty percentage correctly', async () => {
    const sheet = createEmptyColumnSheet();
    const result = await analyzeStructure([sheet]);

    const columns = result.sheets[0]!.columns;
    // Full column: 0% empty
    expect(columns[0]!.emptyPercentage).toBe(0);
    // MostlyEmpty column: 9/10 = 90% empty
    expect(columns[1]!.emptyPercentage).toBe(90);
  });

  it('should set hasWarning when emptyPercentage > 30', async () => {
    const sheet = createEmptyColumnSheet();
    const result = await analyzeStructure([sheet]);

    const columns = result.sheets[0]!.columns;
    expect(columns[0]!.hasWarning).toBe(false); // 0%
    expect(columns[1]!.hasWarning).toBe(true); // 90%
  });

  it('should not set hasWarning when emptyPercentage is exactly 30', async () => {
    const sheet: SheetData = {
      name: 'Threshold',
      headers: ['Col'],
      rows: [
        ['a'], ['b'], ['c'], ['d'], ['e'],
        ['f'], ['g'], [null], [null], [null],
      ],
      originalRowCount: 10,
    };
    const result = await analyzeStructure([sheet]);
    const col = result.sheets[0]!.columns[0]!;
    // 3/10 = 30% exactly → hasWarning should be false
    expect(col.emptyPercentage).toBe(30);
    expect(col.hasWarning).toBe(false);
  });

  it('should set hasWarning when emptyPercentage is just above 30', async () => {
    // 4/10 = 40% → should warn
    const sheet: SheetData = {
      name: 'AboveThreshold',
      headers: ['Col'],
      rows: [
        ['a'], ['b'], ['c'], ['d'], ['e'],
        ['f'], [null], [null], [null], [null],
      ],
      originalRowCount: 10,
    };
    const result = await analyzeStructure([sheet]);
    const col = result.sheets[0]!.columns[0]!;
    expect(col.emptyPercentage).toBe(40);
    expect(col.hasWarning).toBe(true);
  });

  it('should analyze up to 50 sheets and skip the rest', async () => {
    const sheets: SheetData[] = Array.from({ length: 55 }, (_, i) => ({
      name: `Sheet${i + 1}`,
      headers: ['Col1'],
      rows: [['data']],
      originalRowCount: 1,
    }));

    const result = await analyzeStructure(sheets);

    expect(result.analyzedSheets).toBe(50);
    expect(result.skippedSheets).toBe(5);
    expect(result.sheets).toHaveLength(50);
  });

  it('should throw NO_VALID_STRUCTURE when no sheet has tabular structure', async () => {
    const emptySheet: SheetData = {
      name: 'Empty',
      headers: ['Col1'],
      rows: [],
      originalRowCount: 0,
    };

    await expect(analyzeStructure([emptySheet])).rejects.toMatchObject({
      code: 'NO_VALID_STRUCTURE',
    });
  });

  it('should throw NO_VALID_STRUCTURE when headers are empty', async () => {
    const noHeaders: SheetData = {
      name: 'NoHeaders',
      headers: [],
      rows: [['data']],
      originalRowCount: 1,
    };

    await expect(analyzeStructure([noHeaders])).rejects.toMatchObject({
      code: 'NO_VALID_STRUCTURE',
    });
  });

  it('should report hasValidStructure = true when at least one sheet is valid', async () => {
    const invalidSheet: SheetData = {
      name: 'Invalid',
      headers: [],
      rows: [],
      originalRowCount: 0,
    };
    const validSheet = createSheet();

    const result = await analyzeStructure([invalidSheet, validSheet]);
    expect(result.hasValidStructure).toBe(true);
  });

  it('should handle sheets with all-empty columns', async () => {
    const sheet: SheetData = {
      name: 'AllEmpty',
      headers: ['Empty1', 'Empty2'],
      rows: [[null, ''], [undefined, '  '], [null, null]],
      originalRowCount: 3,
    };

    const result = await analyzeStructure([sheet]);
    const columns = result.sheets[0]!.columns;

    expect(columns[0]!.emptyPercentage).toBe(100);
    expect(columns[0]!.detectedType).toBe('text');
    expect(columns[0]!.hasWarning).toBe(true);
    expect(columns[0]!.recordCount).toBe(0);
  });

  it('should count recordCount as non-empty values', async () => {
    const sheet: SheetData = {
      name: 'Mixed',
      headers: ['Data'],
      rows: [['a'], [null], ['b'], [''], ['c']],
      originalRowCount: 5,
    };

    const result = await analyzeStructure([sheet]);
    const col = result.sheets[0]!.columns[0]!;
    // 3 non-empty values: 'a', 'b', 'c'
    expect(col.recordCount).toBe(3);
  });
});

// ─── reassignColumnType Tests ────────────────────────────────────────────────

describe('reassignColumnType', () => {
  it('should allow type reassignment after analysis', async () => {
    const sheet = createNumericSheet();
    const result = await analyzeStructure([sheet]);

    expect(result.sheets[0]!.columns[0]!.assignedType).toBe('numeric');

    reassignColumnType(0, 0, 'text');
    expect(result.sheets[0]!.columns[0]!.assignedType).toBe('text');
  });

  it('should handle invalid sheet index gracefully', async () => {
    const sheet = createSheet();
    await analyzeStructure([sheet]);

    // Should not throw
    reassignColumnType(99, 0, 'text');
  });

  it('should handle invalid column index gracefully', async () => {
    const sheet = createSheet();
    await analyzeStructure([sheet]);

    // Should not throw
    reassignColumnType(0, 99, 'text');
  });

  it('should reassign to any valid DataType', async () => {
    const sheet = createSheet();
    const result = await analyzeStructure([sheet]);

    reassignColumnType(0, 0, 'date');
    expect(result.sheets[0]!.columns[0]!.assignedType).toBe('date');

    reassignColumnType(0, 0, 'boolean');
    expect(result.sheets[0]!.columns[0]!.assignedType).toBe('boolean');

    reassignColumnType(0, 0, 'numeric');
    expect(result.sheets[0]!.columns[0]!.assignedType).toBe('numeric');
  });
});

// ─── Module Object Tests ─────────────────────────────────────────────────────

describe('moduloDeteccion module object', () => {
  it('should expose MAX_SHEETS as 50', () => {
    expect(moduloDeteccion.MAX_SHEETS).toBe(50);
  });

  it('should expose all interface methods', () => {
    expect(typeof moduloDeteccion.analyzeStructure).toBe('function');
    expect(typeof moduloDeteccion.reassignColumnType).toBe('function');
    expect(typeof moduloDeteccion.inferType).toBe('function');
  });
});

// ─── Type Inference Majority Rule Tests ──────────────────────────────────────

describe('type inference majority rule', () => {
  it('should assign numeric when >60% are numeric', async () => {
    // Use values >= 2 to avoid boolean detection of 0/1
    const rows = Array.from({ length: 10 }, (_, i) =>
      i < 7 ? [String((i + 2) * 10)] : ['text_val']
    );
    const sheet: SheetData = {
      name: 'MajorityNumeric',
      headers: ['Mixed'],
      rows,
      originalRowCount: 10,
    };

    const result = await analyzeStructure([sheet]);
    expect(result.sheets[0]!.columns[0]!.detectedType).toBe('numeric');
  });

  it('should default to text when no type has >60% majority', async () => {
    // 4 numeric, 3 date, 3 text out of 10 → no majority
    const rows: unknown[][] = [
      ['100'], ['200'], ['300'], ['400'],
      ['2024-01-01'], ['2024-02-01'], ['2024-03-01'],
      ['hello'], ['world'], ['foo'],
    ];
    const sheet: SheetData = {
      name: 'NoMajority',
      headers: ['Mixed'],
      rows,
      originalRowCount: 10,
    };

    const result = await analyzeStructure([sheet]);
    expect(result.sheets[0]!.columns[0]!.detectedType).toBe('text');
  });

  it('should detect boolean column when >60% are boolean values', async () => {
    const rows: unknown[][] = [
      ['true'], ['false'], ['yes'], ['no'],
      ['sí'], ['verdadero'], ['falso'],
      ['random_text'], ['another_text'], ['text3'],
    ];
    const sheet: SheetData = {
      name: 'BooleanMajority',
      headers: ['Flags'],
      rows,
      originalRowCount: 10,
    };

    const result = await analyzeStructure([sheet]);
    expect(result.sheets[0]!.columns[0]!.detectedType).toBe('boolean');
  });

  it('should detect date column when >60% are dates', async () => {
    const rows: unknown[][] = [
      ['2024-01-01'], ['2024-02-01'], ['2024-03-01'],
      ['2024-04-01'], ['2024-05-01'], ['2024-06-01'],
      ['2024-07-01'], ['not-a-date'], ['text'], ['more text'],
    ];
    const sheet: SheetData = {
      name: 'DateMajority',
      headers: ['Dates'],
      rows,
      originalRowCount: 10,
    };

    const result = await analyzeStructure([sheet]);
    expect(result.sheets[0]!.columns[0]!.detectedType).toBe('date');
  });
});
