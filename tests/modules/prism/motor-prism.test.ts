import { describe, it, expect } from 'vitest';
import { motorPRISM } from '../../../src/modules/prism/motor-prism';
import type { DetectionResult, SheetData } from '../../../src/types/session';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createSheetData(overrides: Partial<SheetData> = {}): SheetData {
  return {
    name: 'Sheet1',
    headers: ['Name', 'Age', 'Email'],
    rows: [
      ['Alice', 30, 'alice@example.com'],
      ['Bob', 25, 'bob@example.com'],
      ['Charlie', 35, 'charlie@example.com'],
    ],
    originalRowCount: 3,
    ...overrides,
  };
}

function createDetectionResult(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    sheets: [
      {
        sheetName: 'Sheet1',
        columns: [
          { name: 'Name', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 3, hasWarning: false },
          { name: 'Age', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 3, hasWarning: false },
          { name: 'Email', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 3, hasWarning: false },
        ],
        totalRecords: 3,
      },
    ],
    analyzedSheets: 1,
    skippedSheets: 0,
    hasValidStructure: true,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Motor_PRISM', () => {
  describe('evaluate()', () => {
    it('should return all 5 dimensions', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const result = motorPRISM.evaluate(structure, data);

      expect(result.dimensions).toHaveLength(5);
      const dimensionNames = result.dimensions.map((d) => d.dimension);
      expect(dimensionNames).toContain('precision');
      expect(dimensionNames).toContain('relevance');
      expect(dimensionNames).toContain('integrity');
      expect(dimensionNames).toContain('sufficiency');
      expect(dimensionNames).toContain('maintainability');
    });

    it('should produce integer scores in [0, 100]', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const result = motorPRISM.evaluate(structure, data);

      for (const dim of result.dimensions) {
        expect(Number.isInteger(dim.score)).toBe(true);
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
      }
    });

    it('should be idempotent (same result on repeated calls)', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const result1 = motorPRISM.evaluate(structure, data);
      const result2 = motorPRISM.evaluate(structure, data);

      expect(result1).toEqual(result2);
    });

    it('should set isBlockingQuality=true when all scores are 0', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [],
          totalRecords: 0,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: [],
        rows: [],
        originalRowCount: 0,
      }];

      const result = motorPRISM.evaluate(structure, data);

      expect(result.isBlockingQuality).toBe(true);
    });

    it('should set hasLowIntegrity=true when integrity < 30', () => {
      // 90% empty values → integrity ~10%
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 90, recordCount: 1, hasWarning: true },
          ],
          totalRecords: 10,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Col1'],
        rows: Array.from({ length: 10 }, (_, i) => [i === 0 ? 'val' : null]),
        originalRowCount: 10,
      }];

      const result = motorPRISM.evaluate(structure, data);

      expect(result.hasLowIntegrity).toBe(true);
    });

    it('should set hasWarningDimensions=true when any dimension <= 60', () => {
      // Few records → sufficiency will be low (3 / 100 threshold)
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const result = motorPRISM.evaluate(structure, data);

      // 3 records / 100 threshold = 3% sufficiency
      expect(result.hasWarningDimensions).toBe(true);
    });

    it('should list problems when score <= 60', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const result = motorPRISM.evaluate(structure, data);

      // Sufficiency will be low, check it has problems
      const sufficiency = result.dimensions.find((d) => d.dimension === 'sufficiency')!;
      expect(sufficiency.score).toBeLessThanOrEqual(60);
      expect(sufficiency.problems.length).toBeGreaterThan(0);
    });

    it('should not list problems when score > 60', () => {
      // 200 records → sufficiency = 100
      const manyRows = Array.from({ length: 200 }, (_, i) => [`name${i}`, i, `email${i}@test.com`]);
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Name', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 200, hasWarning: false },
            { name: 'Age', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 200, hasWarning: false },
            { name: 'Email', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 200, hasWarning: false },
          ],
          totalRecords: 200,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Name', 'Age', 'Email'],
        rows: manyRows,
        originalRowCount: 200,
      }];

      const result = motorPRISM.evaluate(structure, data);

      const sufficiency = result.dimensions.find((d) => d.dimension === 'sufficiency')!;
      expect(sufficiency.score).toBe(100);
      expect(sufficiency.problems).toHaveLength(0);
    });

    it('should limit problems to max 10 per dimension', () => {
      // Many columns with bad names
      const columns = Array.from({ length: 20 }, (_, i) => ({
        name: `x${i}`,
        detectedType: 'text' as const,
        assignedType: 'text' as const,
        emptyPercentage: 0,
        recordCount: 100,
        hasWarning: false,
      }));
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns,
          totalRecords: 100,
        }],
      });
      const rows = Array.from({ length: 100 }, () => Array(20).fill('val'));
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: columns.map((c) => c.name),
        rows,
        originalRowCount: 100,
      }];

      const result = motorPRISM.evaluate(structure, data);
      const maintainability = result.dimensions.find((d) => d.dimension === 'maintainability')!;

      if (maintainability.score <= 60) {
        expect(maintainability.problems.length).toBeLessThanOrEqual(10);
      }
    });
  });

  describe('recalculateDimension()', () => {
    it('should return the same score as full evaluate for a single dimension', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const fullResult = motorPRISM.evaluate(structure, data);
      const precision = motorPRISM.recalculateDimension('precision', structure, data);

      const fullPrecision = fullResult.dimensions.find((d) => d.dimension === 'precision')!;
      expect(precision.score).toBe(fullPrecision.score);
      expect(precision.dimension).toBe('precision');
    });

    it('should recalculate each dimension independently', () => {
      const structure = createDetectionResult();
      const data = [createSheetData()];

      const dimensions: Array<'precision' | 'relevance' | 'integrity' | 'sufficiency' | 'maintainability'> = [
        'precision', 'relevance', 'integrity', 'sufficiency', 'maintainability',
      ];

      for (const dim of dimensions) {
        const result = motorPRISM.recalculateDimension(dim, structure, data);
        expect(result.dimension).toBe(dim);
        expect(Number.isInteger(result.score)).toBe(true);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Precision dimension', () => {
    it('should score 100 when all values match their assigned type', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Number', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 3, hasWarning: false },
          ],
          totalRecords: 3,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Number'],
        rows: [[10], [20], [30]],
        originalRowCount: 3,
      }];

      const result = motorPRISM.recalculateDimension('precision', structure, data);
      expect(result.score).toBe(100);
    });

    it('should reduce score when values are inconsistent with type', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Number', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 4, hasWarning: false },
          ],
          totalRecords: 4,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Number'],
        rows: [[10], ['not a number'], [30], ['abc']],
        originalRowCount: 4,
      }];

      const result = motorPRISM.recalculateDimension('precision', structure, data);
      expect(result.score).toBe(50); // 2/4 inconsistent → 100 - 50 = 50
    });
  });

  describe('Relevance dimension', () => {
    it('should score 100 when all columns have data', () => {
      const structure = createDetectionResult();
      const result = motorPRISM.recalculateDimension('relevance', structure, [createSheetData()]);
      expect(result.score).toBe(100);
    });

    it('should reduce score when columns have >= 80% empty values', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Good', detectedType: 'text', assignedType: 'text', emptyPercentage: 10, recordCount: 90, hasWarning: false },
            { name: 'Empty', detectedType: 'text', assignedType: 'text', emptyPercentage: 85, recordCount: 15, hasWarning: true },
          ],
          totalRecords: 100,
        }],
      });

      const result = motorPRISM.recalculateDimension('relevance', structure, []);
      expect(result.score).toBe(50); // 1/2 useful
    });
  });

  describe('Integrity dimension', () => {
    it('should score 100 when all cells have values', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 5, hasWarning: false },
          ],
          totalRecords: 5,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Col1'],
        rows: [['a'], ['b'], ['c'], ['d'], ['e']],
        originalRowCount: 5,
      }];

      const result = motorPRISM.recalculateDimension('integrity', structure, data);
      expect(result.score).toBe(100);
    });

    it('should reduce score when values are missing', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 50, recordCount: 5, hasWarning: true },
          ],
          totalRecords: 10,
        }],
      });
      const data: SheetData[] = [{
        name: 'Sheet1',
        headers: ['Col1'],
        rows: Array.from({ length: 10 }, (_, i) => [i < 5 ? 'val' : null]),
        originalRowCount: 10,
      }];

      const result = motorPRISM.recalculateDimension('integrity', structure, data);
      expect(result.score).toBe(50); // 5/10 present
    });
  });

  describe('Sufficiency dimension', () => {
    it('should score 100 when records >= threshold', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 150, hasWarning: false },
          ],
          totalRecords: 150,
        }],
      });

      const result = motorPRISM.recalculateDimension('sufficiency', structure, []);
      expect(result.score).toBe(100);
    });

    it('should cap at 100 for large datasets', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 10000, hasWarning: false },
          ],
          totalRecords: 10000,
        }],
      });

      const result = motorPRISM.recalculateDimension('sufficiency', structure, []);
      expect(result.score).toBe(100);
    });

    it('should score proportionally for small datasets', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'Col1', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 50, hasWarning: false },
          ],
          totalRecords: 50,
        }],
      });

      const result = motorPRISM.recalculateDimension('sufficiency', structure, []);
      expect(result.score).toBe(50); // 50/100 * 100 = 50
    });
  });

  describe('Maintainability dimension', () => {
    it('should score high for descriptive column names', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'CustomerName', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 10, hasWarning: false },
            { name: 'OrderTotal', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 10, hasWarning: false },
            { name: 'CreatedDate', detectedType: 'date', assignedType: 'date', emptyPercentage: 0, recordCount: 10, hasWarning: false },
          ],
          totalRecords: 10,
        }],
      });

      const result = motorPRISM.recalculateDimension('maintainability', structure, []);
      expect(result.score).toBe(100);
    });

    it('should score low for short/generic column names', () => {
      const structure = createDetectionResult({
        sheets: [{
          sheetName: 'Sheet1',
          columns: [
            { name: 'x', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 10, hasWarning: false },
            { name: 'y', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 10, hasWarning: false },
          ],
          totalRecords: 10,
        }],
      });

      const result = motorPRISM.recalculateDimension('maintainability', structure, []);
      expect(result.score).toBeLessThanOrEqual(60);
    });
  });
});
