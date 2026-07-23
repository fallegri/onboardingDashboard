import { describe, it, expect } from 'vitest';
import {
  generadorDocumento,
  generate,
  parse,
  serialize,
  regenerate,
} from '../../../src/modules/documento/generador-documento';
import type { DocumentGenerationContext } from '../../../src/modules/documento/generador-documento';
import type {
  DocumentMetadata,
  StrategicObjective,
  KPISuggestion,
  PRISMResult,
  Visualization,
  SheetData,
  DetectionResult,
  UserCustomizations,
} from '../../../src/types/session';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createTestMetadata(): DocumentMetadata {
  return {
    generationDate: '2024-01-15',
    sourceFileName: 'datos_ventas.xlsx',
    iaProvider: 'OpenAI GPT-4',
    prismScores: {
      precision: 85,
      relevance: 90,
      integrity: 78,
      sufficiency: 100,
      maintainability: 72,
    },
  };
}

function createTestObjectives(): StrategicObjective[] {
  return [
    {
      id: 'obj_1',
      name: 'Incrementar ingresos',
      description: 'Aumentar los ingresos totales en un 15%',
      perspective: 'financial',
      linkedKPIIds: ['kpi_1'],
    },
    {
      id: 'obj_2',
      name: 'Mejorar satisfacción del cliente',
      description: 'Elevar el NPS a 80 puntos',
      perspective: 'customers',
      linkedKPIIds: ['kpi_2'],
    },
  ];
}

function createTestKPIs(): KPISuggestion[] {
  return [
    {
      id: 'kpi_1',
      name: 'Ingreso Total',
      aggregation: 'sum',
      column: 'ventas',
      formula: 'SUM(ventas)',
      computedValue: 150000,
    },
    {
      id: 'kpi_2',
      name: 'Satisfacción NPS',
      aggregation: 'average',
      column: 'nps_score',
      formula: 'AVG(nps_score)',
      computedValue: 72,
    },
  ];
}

function createTestPrismResult(): PRISMResult {
  return {
    dimensions: [
      { dimension: 'precision', score: 85, observations: ['Buena precisión'], problems: [] },
      { dimension: 'relevance', score: 90, observations: ['Alta relevancia'], problems: [] },
      { dimension: 'integrity', score: 78, observations: ['Integridad aceptable'], problems: [] },
      { dimension: 'sufficiency', score: 100, observations: ['Datos suficientes'], problems: [] },
      { dimension: 'maintainability', score: 72, observations: ['Mantenibilidad moderada'], problems: [] },
    ],
    isBlockingQuality: false,
    hasLowIntegrity: false,
    hasWarningDimensions: false,
  };
}

function createTestVisualizations(): Visualization[] {
  return [
    {
      id: 'viz_1',
      type: 'bar',
      title: 'Ventas por Mes',
      config: { colors: ['#3366CC'], labels: { x: 'Mes', y: 'Ventas' }, dataRange: {} },
      dataColumns: ['mes', 'ventas'],
      isCustom: false,
    },
  ];
}

function createTestSheets(): SheetData[] {
  return [
    {
      name: 'Hoja1',
      headers: ['mes', 'ventas', 'nps_score'],
      rows: [
        ['Enero', 50000, 75],
        ['Febrero', 55000, 70],
        ['Marzo', 45000, 72],
      ],
      originalRowCount: 3,
    },
  ];
}

function createTestStructure(): DetectionResult {
  return {
    sheets: [
      {
        sheetName: 'Hoja1',
        columns: [
          { name: 'mes', detectedType: 'text', assignedType: 'text', emptyPercentage: 0, recordCount: 3, hasWarning: false },
          { name: 'ventas', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 3, hasWarning: false },
          { name: 'nps_score', detectedType: 'numeric', assignedType: 'numeric', emptyPercentage: 0, recordCount: 3, hasWarning: false },
        ],
        totalRecords: 3,
      },
    ],
    analyzedSheets: 1,
    skippedSheets: 0,
    hasValidStructure: true,
  };
}

function createFullContext(): DocumentGenerationContext {
  return {
    metadata: createTestMetadata(),
    objectives: createTestObjectives(),
    kpis: createTestKPIs(),
    prismResult: createTestPrismResult(),
    visualizations: createTestVisualizations(),
    dataSheets: createTestSheets(),
    structure: createTestStructure(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Generador_Documento', () => {
  describe('generate()', () => {
    it('should produce a valid Markdown document with all required sections', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('## Introducción');
      expect(md).toContain('## Definición de Objetivos Estratégicos');
      expect(md).toContain('## Identificación de Dimensiones del CMI');
      expect(md).toContain('## Identificación de KPIs');
      expect(md).toContain('## KPIs necesarios para el CMI');
      expect(md).toContain('## Obtención de Datos y Creación de Gráficos');
      expect(md).toContain('## Análisis Cuantitativo/Cualitativo');
    });

    it('should include metadata: date, source file, PRISM scores, IA provider', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('**Fecha de generación:** 2024-01-15');
      expect(md).toContain('**Archivo fuente:** datos_ventas.xlsx');
      expect(md).toContain('**Proveedor IA:** OpenAI GPT-4');
      expect(md).toContain('**precision**: 85/100');
      expect(md).toContain('**relevance**: 90/100');
    });

    it('should generate KPI technical sheets with code, name, objective, formula, conditions', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('Ingreso Total');
      expect(md).toContain('SUM(ventas)');
      expect(md).toContain('| Óptimo |');
      expect(md).toContain('| Aceptable |');
      expect(md).toContain('| Rechazado |');
    });

    it('should include only perspectives with valid KPIs', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('Financiera');
      expect(md).toContain('Clientes');
      // Perspectives without KPIs should show exclusion message
      expect(md).toContain('Procesos Internos');
      expect(md).toContain('Perspectiva omitida');
    });

    it('should return error for empty KPIs', async () => {
      const context = createFullContext();
      context.kpis = [];
      const result = await generate(context);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INSUFFICIENT_DATA');
    });

    it('should include data section with datasets dimensions', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('| Hoja1 | 3 | 3 |');
    });

    it('should include analysis table linking KPIs to analysis type', async () => {
      const context = createFullContext();
      const result = await generate(context);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      expect(md).toContain('| Ingreso Total | Cuantitativo |');
    });
  });

  describe('parse()', () => {
    it('should parse a generated document back to BSCDocument', async () => {
      const context = createFullContext();
      const genResult = await generate(context);
      expect(genResult.ok).toBe(true);
      if (!genResult.ok) return;

      const parseResult = parse(genResult.value);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const doc = parseResult.value;
      expect(doc.metadata.generationDate).toBe('2024-01-15');
      expect(doc.metadata.sourceFileName).toBe('datos_ventas.xlsx');
      expect(doc.metadata.iaProvider).toBe('OpenAI GPT-4');
      expect(doc.kpiIdentification.length).toBe(2);
    });

    it('should return error for empty markdown', () => {
      const result = parse('');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_MARKDOWN');
    });

    it('should return error for markdown with missing sections', () => {
      const result = parse('# Just a title\n\nSome content.');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('STRUCTURE_MISMATCH');
    });

    it('should correctly parse KPI technical sheets', async () => {
      const context = createFullContext();
      const genResult = await generate(context);
      expect(genResult.ok).toBe(true);
      if (!genResult.ok) return;

      const parseResult = parse(genResult.value);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const doc = parseResult.value;
      const firstKPI = doc.kpiIdentification[0]!;
      expect(firstKPI.fullName).toBe('Ingreso Total');
      expect(firstKPI.formula).toBe('SUM(ventas)');
      expect(firstKPI.conditions.optimal).toBeGreaterThan(0);
    });

    it('should parse analysis entries correctly', async () => {
      const context = createFullContext();
      const genResult = await generate(context);
      expect(genResult.ok).toBe(true);
      if (!genResult.ok) return;

      const parseResult = parse(genResult.value);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const doc = parseResult.value;
      expect(doc.analysis.length).toBe(2);
      expect(doc.analysis[0]!.kpiName).toBe('Ingreso Total');
    });
  });

  describe('serialize()', () => {
    it('should produce markdown from BSCDocument', async () => {
      const context = createFullContext();
      const genResult = await generate(context);
      expect(genResult.ok).toBe(true);
      if (!genResult.ok) return;

      const parseResult = parse(genResult.value);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const serialized = serialize(parseResult.value);
      expect(serialized).toContain('## Introducción');
      expect(serialized).toContain('## Identificación de KPIs');
    });

    it('round-trip: generate → parse → serialize preserves structure', async () => {
      const context = createFullContext();
      const genResult = await generate(context);
      expect(genResult.ok).toBe(true);
      if (!genResult.ok) return;

      const parseResult = parse(genResult.value);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const serialized = serialize(parseResult.value);
      // Re-parse the serialized version
      const reparseResult = parse(serialized);
      expect(reparseResult.ok).toBe(true);
      if (!reparseResult.ok) return;

      // Verify structural equality (excluding variable metadata)
      const original = parseResult.value;
      const reparsed = reparseResult.value;
      expect(reparsed.kpiIdentification.length).toBe(original.kpiIdentification.length);
      expect(reparsed.analysis.length).toBe(original.analysis.length);
      expect(reparsed.objectives.length).toBe(original.objectives.length);

      // Verify KPI details match
      for (let i = 0; i < original.kpiIdentification.length; i++) {
        expect(reparsed.kpiIdentification[i]!.code).toBe(original.kpiIdentification[i]!.code);
        expect(reparsed.kpiIdentification[i]!.fullName).toBe(original.kpiIdentification[i]!.fullName);
        expect(reparsed.kpiIdentification[i]!.formula).toBe(original.kpiIdentification[i]!.formula);
      }
    });
  });

  describe('regenerate()', () => {
    it('should preserve custom interpretation texts', async () => {
      const context = createFullContext();
      const customizations: UserCustomizations = {
        sectionTitles: {},
        interpretationTexts: { 'Ventas por Mes': 'Mi interpretación personalizada.' },
        objectiveOrder: [],
      };

      const result = await regenerate(context, customizations);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value).toContain('Mi interpretación personalizada.');
    });

    it('should preserve objective reordering', async () => {
      const context = createFullContext();
      const customizations: UserCustomizations = {
        sectionTitles: {},
        interpretationTexts: {},
        objectiveOrder: ['Mejorar satisfacción del cliente', 'Incrementar ingresos'],
      };

      const result = await regenerate(context, customizations);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const md = result.value;
      const idx1 = md.indexOf('Mejorar satisfacción del cliente');
      const idx2 = md.indexOf('Incrementar ingresos');
      expect(idx1).toBeLessThan(idx2);
    });

    it('should return error for empty KPIs', async () => {
      const context = createFullContext();
      context.kpis = [];
      const customizations: UserCustomizations = {
        sectionTitles: {},
        interpretationTexts: {},
        objectiveOrder: [],
      };

      const result = await regenerate(context, customizations);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INSUFFICIENT_DATA');
    });
  });

  describe('module export', () => {
    it('should export all interface methods', () => {
      expect(generadorDocumento.generate).toBeDefined();
      expect(generadorDocumento.parse).toBeDefined();
      expect(generadorDocumento.serialize).toBeDefined();
      expect(generadorDocumento.regenerate).toBeDefined();
    });
  });
});
