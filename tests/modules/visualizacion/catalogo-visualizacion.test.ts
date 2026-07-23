import { describe, it, expect, beforeEach } from 'vitest';
import {
  catalogoVisualizacion,
  suggestCharts,
  suggestKPIs,
  generatePreview,
  addCustomVisualization,
  resetState,
  getCustomVisualizations,
} from '../../../src/modules/visualizacion/catalogo-visualizacion';
import type { DetectionResult, SheetData, ChartSuggestion } from '../../../src/types/session';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function createMixedStructure(): DetectionResult {
  return {
    sheets: [
      {
        sheetName: 'Sales',
        columns: [
          { name: 'Date', detectedType: 'date', assignedType: 'date', emptyPercentage: 0, recordCount: 100, hasWarning: false },
          { name: 'Revenue', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 5, recordCount: 95, hasWarning: false },
          { name: 'Expenses', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 2, recordCount: 98, hasWarning: false },
          { name: 'Category', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 100, hasWarning: false },
          { name: 'Region', detectedType: 'text', assignedType: 'text', emptyPercentage: 1, recordCount: 99, hasWarning: false },
        ],
        totalRecords: 100,
      },
    ],
    analyzedSheets: 1,
    skippedSheets: 0,
    hasValidStructure: true,
  };
}

function createNumericOnlyStructure(): DetectionResult {
  return {
    sheets: [
      {
        sheetName: 'Numbers',
        columns: [
          { name: 'Value1', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 50, hasWarning: false },
          { name: 'Value2', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 50, hasWarning: false },
        ],
        totalRecords: 50,
      },
    ],
    analyzedSheets: 1,
    skippedSheets: 0,
    hasValidStructure: true,
  };
}

function createTextOnlyStructure(): DetectionResult {
  return {
    sheets: [
      {
        sheetName: 'Names',
        columns: [
          { name: 'FirstName', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 20, hasWarning: false },
          { name: 'LastName', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 20, hasWarning: false },
        ],
        totalRecords: 20,
      },
    ],
    analyzedSheets: 1,
    skippedSheets: 0,
    hasValidStructure: true,
  };
}

function createMixedSheetData(): SheetData[] {
  const rows: unknown[][] = [];
  for (let i = 0; i < 100; i++) {
    rows.push([
      `2024-01-${String(i % 28 + 1).padStart(2, '0')}`,
      Math.round(Math.random() * 10000),
      Math.round(Math.random() * 5000),
      ['Electronics', 'Clothing', 'Food'][i % 3],
      ['North', 'South', 'East', 'West'][i % 4],
    ]);
  }
  return [{ name: 'Sales', headers: ['Date', 'Revenue', 'Expenses', 'Category', 'Region'], rows, originalRowCount: 100 }];
}

function createNumericSheetData(): SheetData[] {
  const rows: unknown[][] = [];
  for (let i = 0; i < 50; i++) {
    rows.push([i * 10 + 5, i * 3 + 1]);
  }
  return [{ name: 'Numbers', headers: ['Value1', 'Value2'], rows, originalRowCount: 50 }];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Catálogo_Visualización', () => {
  beforeEach(() => {
    resetState();
  });

  describe('suggestCharts', () => {
    it('should suggest at least 3 chart types for mixed data', () => {
      const structure = createMixedStructure();
      const suggestions = suggestCharts(structure);

      expect(suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('should suggest bar, line, pie, scatter, and pivot for rich data', () => {
      const structure = createMixedStructure();
      const suggestions = suggestCharts(structure);
      const types = suggestions.map((s) => s.type);

      expect(types).toContain('bar');
      expect(types).toContain('line');
      expect(types).toContain('pie');
      expect(types).toContain('scatter');
      expect(types).toContain('pivot');
    });

    it('should produce suggestions with valid properties', () => {
      const structure = createMixedStructure();
      const suggestions = suggestCharts(structure);

      for (const suggestion of suggestions) {
        expect(suggestion.id).toBeTruthy();
        expect(suggestion.type).toMatch(/^(bar|line|pie|scatter|pivot)$/);
        expect(suggestion.title).toBeTruthy();
        expect(suggestion.columns.length).toBeGreaterThan(0);
        expect(suggestion.rationale).toBeTruthy();
      }
    });

    it('should suggest at least 3 charts even with only numeric data', () => {
      const structure = createNumericOnlyStructure();
      const suggestions = suggestCharts(structure);

      expect(suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('should suggest at least 3 charts even with only text data', () => {
      const structure = createTextOnlyStructure();
      const suggestions = suggestCharts(structure);

      expect(suggestions.length).toBeGreaterThanOrEqual(3);
    });

    it('should include scatter chart when 2+ numeric columns exist', () => {
      const structure = createNumericOnlyStructure();
      const suggestions = suggestCharts(structure);
      const types = suggestions.map((s) => s.type);

      expect(types).toContain('scatter');
    });
  });

  describe('suggestKPIs', () => {
    it('should suggest between 3 and 10 KPIs for mixed data', () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const kpis = suggestKPIs(structure, data);

      expect(kpis.length).toBeGreaterThanOrEqual(3);
      expect(kpis.length).toBeLessThanOrEqual(10);
    });

    it('should include sum and average aggregations for numeric columns', () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const kpis = suggestKPIs(structure, data);
      const aggregations = kpis.map((k) => k.aggregation);

      expect(aggregations).toContain('sum');
      expect(aggregations).toContain('average');
    });

    it('should compute non-null values for KPIs with valid data', () => {
      const structure = createNumericOnlyStructure();
      const data = createNumericSheetData();
      const kpis = suggestKPIs(structure, data);

      const withValues = kpis.filter((k) => k.computedValue !== null);
      expect(withValues.length).toBeGreaterThan(0);
    });

    it('should produce KPIs with valid properties', () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const kpis = suggestKPIs(structure, data);

      for (const kpi of kpis) {
        expect(kpi.id).toBeTruthy();
        expect(kpi.name).toBeTruthy();
        expect(['sum', 'average', 'count', 'rate', 'min', 'max']).toContain(kpi.aggregation);
        expect(kpi.column).toBeTruthy();
        expect(kpi.formula).toBeTruthy();
      }
    });

    it('should include rate aggregation when sufficient data exists', () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const kpis = suggestKPIs(structure, data);
      const aggregations = kpis.map((k) => k.aggregation);

      expect(aggregations).toContain('rate');
    });

    it('should generate at least 3 KPIs even with minimal numeric columns', () => {
      const structure = createNumericOnlyStructure();
      const data = createNumericSheetData();
      const kpis = suggestKPIs(structure, data);

      expect(kpis.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('generatePreview', () => {
    it('should generate preview data within 5 seconds', async () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const suggestions = suggestCharts(structure);
      const suggestion = suggestions[0]!;

      const startTime = Date.now();
      const preview = await generatePreview(suggestion, data);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5000);
      expect(preview.type).toBe(suggestion.type);
    });

    it('should return chart type matching the suggestion', async () => {
      const structure = createMixedStructure();
      const data = createMixedSheetData();
      const suggestions = suggestCharts(structure);

      for (const suggestion of suggestions) {
        const preview = await generatePreview(suggestion, data);
        expect(preview.type).toBe(suggestion.type);
      }
    });

    it('should include config with colors', async () => {
      const data = createMixedSheetData();
      const suggestion: ChartSuggestion = {
        id: 'test-1',
        type: 'bar',
        title: 'Test chart',
        columns: ['Category', 'Revenue'],
        rationale: 'Test',
      };

      const preview = await generatePreview(suggestion, data);
      expect(preview.config.colors.length).toBeGreaterThan(0);
    });

    it('should return empty preview for empty data', async () => {
      const suggestion: ChartSuggestion = {
        id: 'test-2',
        type: 'line',
        title: 'Empty test',
        columns: ['X', 'Y'],
        rationale: 'Test',
      };

      const preview = await generatePreview(suggestion, []);
      expect(preview.labels).toEqual([]);
      expect(preview.datasets).toEqual([]);
    });

    it('should limit data points to prevent performance issues', async () => {
      const bigData: SheetData[] = [{
        name: 'Big',
        headers: ['Label', 'Value'],
        rows: Array.from({ length: 500 }, (_, i) => [`Item ${i}`, i * 2]),
        originalRowCount: 500,
      }];

      const suggestion: ChartSuggestion = {
        id: 'test-3',
        type: 'bar',
        title: 'Big data test',
        columns: ['Label', 'Value'],
        rationale: 'Test',
      };

      const preview = await generatePreview(suggestion, bigData);
      expect(preview.labels.length).toBeLessThanOrEqual(100);
    });
  });

  describe('addCustomVisualization', () => {
    it('should add a custom visualization successfully', () => {
      const result = addCustomVisualization({
        type: 'bar',
        title: 'My Custom Chart',
        dataColumns: ['Revenue', 'Category'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.type).toBe('bar');
        expect(result.value.title).toBe('My Custom Chart');
        expect(result.value.isCustom).toBe(true);
        expect(result.value.id).toBeTruthy();
      }
    });

    it('should reject title longer than 100 characters', () => {
      const longTitle = 'A'.repeat(101);
      const result = addCustomVisualization({
        type: 'line',
        title: longTitle,
        dataColumns: ['Value1'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TITLE_LENGTH');
      }
    });

    it('should reject empty title', () => {
      const result = addCustomVisualization({
        type: 'pie',
        title: '',
        dataColumns: ['Value1'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TITLE_LENGTH');
      }
    });

    it('should accept title of exactly 100 characters', () => {
      const title = 'A'.repeat(100);
      const result = addCustomVisualization({
        type: 'scatter',
        title,
        dataColumns: ['X', 'Y'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title.length).toBe(100);
      }
    });

    it('should enforce maximum of 20 custom visualizations', () => {
      for (let i = 0; i < 20; i++) {
        const result = addCustomVisualization({
          type: 'bar',
          title: `Chart ${i + 1}`,
          dataColumns: ['Value1'],
        });
        expect(result.ok).toBe(true);
      }

      const result = addCustomVisualization({
        type: 'bar',
        title: 'Chart 21',
        dataColumns: ['Value1'],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MAX_CUSTOM_REACHED');
      }
    });

    it('should use provided colors in config', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF'];
      const result = addCustomVisualization({
        type: 'line',
        title: 'Colored Chart',
        dataColumns: ['Revenue'],
        colors,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config.colors).toEqual(colors);
      }
    });

    it('should use default colors when none provided', () => {
      const result = addCustomVisualization({
        type: 'bar',
        title: 'Default Colors',
        dataColumns: ['Revenue'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config.colors.length).toBeGreaterThan(0);
      }
    });

    it('should apply data range configuration', () => {
      const result = addCustomVisualization({
        type: 'line',
        title: 'Ranged Chart',
        dataColumns: ['Revenue'],
        dataRange: { min: 0, max: 100 },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.config.dataRange).toEqual({ min: 0, max: 100 });
      }
    });
  });

  describe('module interface', () => {
    it('should expose MAX_CUSTOM_VISUALIZATIONS as 20', () => {
      expect(catalogoVisualizacion.MAX_CUSTOM_VISUALIZATIONS).toBe(20);
    });

    it('should have all required interface methods', () => {
      expect(typeof catalogoVisualizacion.suggestCharts).toBe('function');
      expect(typeof catalogoVisualizacion.suggestKPIs).toBe('function');
      expect(typeof catalogoVisualizacion.generatePreview).toBe('function');
      expect(typeof catalogoVisualizacion.addCustomVisualization).toBe('function');
    });
  });

  describe('resetState', () => {
    it('should clear custom visualizations', () => {
      addCustomVisualization({
        type: 'bar',
        title: 'Test',
        dataColumns: ['Col'],
      });

      expect(getCustomVisualizations().length).toBe(1);
      resetState();
      expect(getCustomVisualizations().length).toBe(0);
    });
  });
});
