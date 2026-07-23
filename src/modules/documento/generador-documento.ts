import type { BSCPerspective, PRISMDimension } from '../../types/common';
import type {
  BSCDocument,
  BSCDimensionSection,
  BSCObjectivesSection,
  KPITechnicalSheet,
  DocumentMetadata,
  DataSectionContent,
  DatasetInfo,
  TransformationEntry,
  ChartEntry,
  AnalysisEntry,
  ThresholdConditions,
  StrategicObjective,
  KPISuggestion,
  Visualization,
  SheetData,
  DetectionResult,
  PRISMResult,
  UserCustomizations,
} from '../../types/session';
import type { DocumentError, ParseError } from '../../types/errors';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum generation time in milliseconds (30 seconds) */
const MAX_GENERATION_TIME_MS = 30_000;

/** All BSC perspectives in display order */
const BSC_PERSPECTIVES: BSCPerspective[] = [
  'financial',
  'customers',
  'internal_processes',
  'learning_growth',
];

/** Perspective display names in Spanish */
const PERSPECTIVE_NAMES: Record<BSCPerspective, string> = {
  financial: 'Financiera',
  customers: 'Clientes',
  internal_processes: 'Procesos Internos',
  learning_growth: 'Aprendizaje y Crecimiento',
};

/** Required document section headers */
const SECTION_HEADERS = {
  introduction: '## Introducción',
  objectives: '## Definición de Objetivos Estratégicos',
  dimensions: '## Identificación de Dimensiones del CMI',
  kpiIdentification: '## Identificación de KPIs',
  kpiDetails: '## KPIs necesarios para el CMI',
  dataSection: '## Obtención de Datos y Creación de Gráficos',
  analysis: '## Análisis Cuantitativo/Cualitativo',
} as const;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Context required to generate a BSC document.
 */
export interface DocumentGenerationContext {
  metadata: DocumentMetadata;
  objectives: StrategicObjective[];
  kpis: KPISuggestion[];
  prismResult: PRISMResult;
  visualizations: Visualization[];
  dataSheets: SheetData[];
  structure: DetectionResult;
}

/**
 * @description Interface for the BSC document generator module.
 * Generates, parses, serializes, and regenerates Markdown documents.
 */
export interface IGeneradorDocumento {
  generate(context: DocumentGenerationContext): Promise<Result<string, DocumentError>>;
  parse(markdown: string): Result<BSCDocument, ParseError>;
  regenerate(
    context: DocumentGenerationContext,
    customizations: UserCustomizations,
  ): Promise<Result<string, DocumentError>>;
  serialize(document: BSCDocument): string;
}

// ─── Error Helpers ───────────────────────────────────────────────────────────

/**
 * @description Creates a DocumentError with the given code and message.
 * @param code - Error code
 * @param message - Human-readable message
 * @returns A DocumentError object
 */
function createDocumentError(
  code: DocumentError['code'],
  message: string,
): DocumentError {
  return { code, message, timestamp: new Date().toISOString(), module: 'documento' };
}

/**
 * @description Creates a ParseError with the given code and message.
 * @param code - Error code
 * @param message - Human-readable message
 * @param missingSections - Optional list of missing sections
 * @returns A ParseError object
 */
function createParseError(
  code: ParseError['code'],
  message: string,
  missingSections?: string[],
): ParseError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'documento',
    missingSections,
  };
}

// ─── KPI Code Generation ─────────────────────────────────────────────────────

/**
 * @description Generates an abbreviated code for a KPI based on its name.
 * @param name - The KPI display name
 * @param index - The index for uniqueness
 * @returns An abbreviated code string
 */
function generateKPICode(name: string, index: number): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0);
  const abbreviation = words
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
    .slice(0, 4);
  return `KPI-${abbreviation}${String(index + 1).padStart(2, '0')}`;
}

// ─── Threshold Calculation ───────────────────────────────────────────────────

/**
 * @description Computes threshold conditions for a KPI from its computed value.
 * @param computedValue - The current computed KPI value
 * @returns ThresholdConditions with optimal, acceptable, and rejected levels
 */
function computeThresholds(computedValue: number | null): ThresholdConditions {
  const base = computedValue ?? 100;
  return {
    optimal: Math.round(base * 1.2),
    acceptable: Math.round(base * 0.8),
    rejected: Math.round(base * 0.5),
  };
}

// ─── Technical Sheet Builder ─────────────────────────────────────────────────

/**
 * @description Builds a KPI technical sheet from a suggestion and objective.
 * @param kpi - The KPI suggestion
 * @param objectiveName - Name of the associated objective
 * @param index - KPI index for code generation
 * @returns A KPITechnicalSheet
 */
function buildTechnicalSheet(
  kpi: KPISuggestion,
  objectiveName: string,
  index: number,
): KPITechnicalSheet {
  return {
    code: generateKPICode(kpi.name, index),
    fullName: kpi.name,
    objectiveName,
    formula: kpi.formula,
    conditions: computeThresholds(kpi.computedValue),
  };
}

// ─── Objective to KPI Mapping ────────────────────────────────────────────────

/**
 * @description Finds the objective name associated with a KPI.
 * @param kpiId - The KPI identifier
 * @param objectives - Array of strategic objectives
 * @returns The objective name or a default label
 */
function findObjectiveForKPI(
  kpiId: string,
  objectives: StrategicObjective[],
): string {
  const linked = objectives.find((obj) =>
    obj.linkedKPIIds.includes(kpiId),
  );
  return linked ? linked.name : 'Sin objetivo vinculado';
}

// ─── Perspective Grouping ────────────────────────────────────────────────────

/**
 * @description Groups KPI technical sheets by BSC perspective.
 * @param sheets - Array of KPI technical sheets
 * @param objectives - Array of strategic objectives
 * @param kpis - Original KPI suggestions
 * @returns Map of perspective to technical sheets
 */
function groupSheetsByPerspective(
  sheets: KPITechnicalSheet[],
  objectives: StrategicObjective[],
  kpis: KPISuggestion[],
): Map<BSCPerspective, KPITechnicalSheet[]> {
  const grouped = new Map<BSCPerspective, KPITechnicalSheet[]>();
  for (const perspective of BSC_PERSPECTIVES) {
    grouped.set(perspective, []);
  }

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i]!;
    const kpi = kpis[i]!;
    const linkedObj = objectives.find((obj) =>
      obj.linkedKPIIds.includes(kpi.id),
    );
    const perspective = linkedObj?.perspective ?? 'financial';
    grouped.get(perspective)!.push(sheet);
  }

  return grouped;
}

// ─── Markdown Generation Helpers ─────────────────────────────────────────────

/**
 * @description Renders the metadata header as Markdown.
 * @param metadata - Document metadata
 * @returns Markdown string for metadata
 */
function renderMetadata(metadata: DocumentMetadata): string {
  const prismLines = Object.entries(metadata.prismScores)
    .map(([dim, score]) => `- **${dim}**: ${score}/100`)
    .join('\n');
  return [
    '# Cuadro de Mando Integral (BSC)',
    '',
    `**Fecha de generación:** ${metadata.generationDate}`,
    `**Archivo fuente:** ${metadata.sourceFileName}`,
    `**Proveedor IA:** ${metadata.iaProvider}`,
    '',
    '### Puntajes PRISM',
    '',
    prismLines,
    '',
  ].join('\n');
}

/**
 * @description Renders the introduction section.
 * @param introduction - Introduction text content
 * @returns Markdown string for introduction
 */
function renderIntroduction(introduction: string): string {
  return [SECTION_HEADERS.introduction, '', introduction, ''].join('\n');
}

/**
 * @description Renders the objectives section as Markdown.
 * @param objectives - Array of BSC objectives sections
 * @returns Markdown string for objectives
 */
function renderObjectives(objectives: BSCObjectivesSection[]): string {
  const lines = [SECTION_HEADERS.objectives, ''];
  for (const obj of objectives) {
    lines.push(`### ${obj.name}`);
    lines.push('');
    lines.push(`**Perspectiva:** ${PERSPECTIVE_NAMES[obj.perspective]}`);
    lines.push('');
    lines.push(obj.description);
    lines.push('');
    lines.push('**Acciones:**');
    lines.push('');
    for (const action of obj.actions) {
      lines.push(`- ${action}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @description Renders the dimensions section as Markdown.
 * @param dimensions - Array of BSC dimension sections
 * @returns Markdown string for dimensions
 */
function renderDimensions(dimensions: BSCDimensionSection[]): string {
  const lines = [SECTION_HEADERS.dimensions, ''];
  for (const dim of dimensions) {
    const name = PERSPECTIVE_NAMES[dim.perspective];
    lines.push(`### ${name}`);
    lines.push('');
    if (!dim.included) {
      lines.push(`*Perspectiva omitida: ${dim.exclusionReason ?? 'Sin KPIs válidos'}*`);
      lines.push('');
      continue;
    }
    for (const kpi of dim.kpis) {
      lines.push(`- **${kpi.code}** - ${kpi.fullName}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @description Renders a single KPI technical sheet as Markdown.
 * @param sheet - The KPI technical sheet
 * @returns Markdown string for the technical sheet
 */
function renderTechnicalSheet(sheet: KPITechnicalSheet): string {
  return [
    `### ${sheet.code} - ${sheet.fullName}`,
    '',
    `| Campo | Valor |`,
    `| --- | --- |`,
    `| Código | ${sheet.code} |`,
    `| Nombre | ${sheet.fullName} |`,
    `| Objetivo | ${sheet.objectiveName} |`,
    `| Fórmula | ${sheet.formula} |`,
    `| Óptimo | ${sheet.conditions.optimal} |`,
    `| Aceptable | ${sheet.conditions.acceptable} |`,
    `| Rechazado | ${sheet.conditions.rejected} |`,
    '',
  ].join('\n');
}

/**
 * @description Renders the KPI identification section.
 * @param sheets - Array of KPI technical sheets
 * @returns Markdown string for KPI identification
 */
function renderKPIIdentification(sheets: KPITechnicalSheet[]): string {
  const lines = [SECTION_HEADERS.kpiIdentification, ''];
  lines.push('| Código | Nombre | Objetivo |');
  lines.push('| --- | --- | --- |');
  for (const sheet of sheets) {
    lines.push(`| ${sheet.code} | ${sheet.fullName} | ${sheet.objectiveName} |`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * @description Renders the KPI details section with full technical sheets.
 * @param sheets - Array of KPI technical sheets
 * @returns Markdown string for KPI details
 */
function renderKPIDetails(sheets: KPITechnicalSheet[]): string {
  const lines = [SECTION_HEADERS.kpiDetails, ''];
  for (const sheet of sheets) {
    lines.push(renderTechnicalSheet(sheet));
  }
  return lines.join('\n');
}

/**
 * @description Renders the data section as Markdown.
 * @param dataSection - Data section content
 * @returns Markdown string for data section
 */
function renderDataSection(dataSection: DataSectionContent): string {
  const lines = [SECTION_HEADERS.dataSection, ''];

  lines.push('### Datasets');
  lines.push('');
  lines.push('| Nombre | Filas | Columnas |');
  lines.push('| --- | --- | --- |');
  for (const ds of dataSection.datasets) {
    lines.push(`| ${ds.name} | ${ds.rows} | ${ds.columns} |`);
  }
  lines.push('');

  if (dataSection.transformations.length > 0) {
    lines.push('### Transformaciones');
    lines.push('');
    for (const tr of dataSection.transformations) {
      lines.push(`- **${tr.description}**: ${tr.input} → ${tr.output}`);
    }
    lines.push('');
  }

  if (dataSection.charts.length > 0) {
    lines.push('### Gráficos');
    lines.push('');
    for (const chart of dataSection.charts) {
      lines.push(`#### ${chart.title} (${chart.type})`);
      lines.push('');
      lines.push(chart.interpretation);
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * @description Renders the analysis section as a Markdown table.
 * @param analysis - Array of analysis entries
 * @returns Markdown string for analysis section
 */
function renderAnalysis(analysis: AnalysisEntry[]): string {
  const lines = [SECTION_HEADERS.analysis, ''];
  lines.push('| KPI | Tipo de Análisis | Herramienta |');
  lines.push('| --- | --- | --- |');
  for (const entry of analysis) {
    const type = entry.analysisType === 'quantitative' ? 'Cuantitativo' : 'Cualitativo';
    lines.push(`| ${entry.kpiName} | ${type} | ${entry.tool} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─── Document Assembly ───────────────────────────────────────────────────────

/**
 * @description Assembles a full BSC document from its parts.
 * @param doc - The BSCDocument object
 * @returns Complete Markdown string
 */
function assembleDocument(doc: BSCDocument): string {
  const parts: string[] = [
    renderMetadata(doc.metadata),
    renderIntroduction(doc.introduction),
    renderObjectives(doc.objectives),
    renderDimensions(doc.dimensions),
    renderKPIIdentification(doc.kpiIdentification),
    renderKPIDetails(doc.kpiIdentification),
    renderDataSection(doc.dataSection),
    renderAnalysis(doc.analysis),
  ];
  return parts.join('\n');
}

// ─── Context to BSCDocument Conversion ───────────────────────────────────────

/**
 * @description Builds the introduction text from the context.
 * @param context - Document generation context
 * @returns Introduction paragraph
 */
function buildIntroduction(context: DocumentGenerationContext): string {
  const fileName = context.metadata.sourceFileName;
  const kpiCount = context.kpis.length;
  const objCount = context.objectives.length;
  return (
    `Este documento presenta el Cuadro de Mando Integral generado a partir ` +
    `del análisis del archivo "${fileName}". Se identificaron ${kpiCount} KPIs ` +
    `vinculados a ${objCount} objetivos estratégicos.`
  );
}

/**
 * @description Builds objectives sections from the context.
 * @param context - Document generation context
 * @returns Array of BSCObjectivesSection
 */
function buildObjectivesSections(
  context: DocumentGenerationContext,
): BSCObjectivesSection[] {
  return context.objectives.map((obj) => ({
    name: obj.name,
    description: obj.description,
    perspective: obj.perspective,
    actions: [`Monitorear KPIs vinculados a "${obj.name}"`],
  }));
}

/**
 * @description Builds dimension sections filtering by valid KPIs.
 * @param technicalSheets - Array of KPI technical sheets
 * @param objectives - Strategic objectives
 * @param kpis - KPI suggestions
 * @returns Array of BSCDimensionSection
 */
function buildDimensionSections(
  technicalSheets: KPITechnicalSheet[],
  objectives: StrategicObjective[],
  kpis: KPISuggestion[],
): BSCDimensionSection[] {
  const grouped = groupSheetsByPerspective(technicalSheets, objectives, kpis);
  return BSC_PERSPECTIVES.map((perspective) => {
    const kpisForPerspective = grouped.get(perspective) ?? [];
    const included = kpisForPerspective.length > 0;
    return {
      perspective,
      kpis: kpisForPerspective,
      included,
      exclusionReason: included
        ? undefined
        : 'No se identificaron KPIs para esta perspectiva',
    };
  });
}

/**
 * @description Builds the data section content from context.
 * @param context - Document generation context
 * @returns DataSectionContent
 */
function buildDataSection(context: DocumentGenerationContext): DataSectionContent {
  const datasets: DatasetInfo[] = context.dataSheets.map((sheet) => ({
    name: sheet.name,
    rows: sheet.rows.length,
    columns: sheet.headers.length,
  }));

  const charts: ChartEntry[] = context.visualizations.map((viz) => ({
    title: viz.title,
    type: viz.type,
    interpretation: `Gráfico de tipo ${viz.type} mostrando datos de ${viz.dataColumns.join(', ')}.`,
  }));

  return { datasets, transformations: [], charts };
}

/**
 * @description Builds analysis entries from KPIs.
 * @param kpis - KPI suggestions
 * @returns Array of AnalysisEntry
 */
function buildAnalysisEntries(kpis: KPISuggestion[]): AnalysisEntry[] {
  return kpis.map((kpi) => ({
    kpiName: kpi.name,
    analysisType: kpi.aggregation === 'count' || kpi.aggregation === 'rate'
      ? 'qualitative' as const
      : 'quantitative' as const,
    tool: `Operación: ${kpi.aggregation} sobre columna "${kpi.column}"`,
  }));
}

/**
 * @description Converts a DocumentGenerationContext into a BSCDocument.
 * @param context - Generation context
 * @returns BSCDocument structure
 */
function contextToDocument(context: DocumentGenerationContext): BSCDocument {
  const technicalSheets = context.kpis.map((kpi, index) => {
    const objName = findObjectiveForKPI(kpi.id, context.objectives);
    return buildTechnicalSheet(kpi, objName, index);
  });

  const dimensions = buildDimensionSections(
    technicalSheets,
    context.objectives,
    context.kpis,
  );

  return {
    metadata: context.metadata,
    introduction: buildIntroduction(context),
    objectives: buildObjectivesSections(context),
    dimensions,
    kpiIdentification: technicalSheets,
    dataSection: buildDataSection(context),
    analysis: buildAnalysisEntries(context.kpis),
  };
}

// ─── Markdown Parsing ────────────────────────────────────────────────────────

/**
 * @description Extracts a section's content between two headers.
 * @param markdown - Full markdown text
 * @param header - Section header to find
 * @param nextHeaders - Possible next headers that end this section
 * @returns Section content or null if not found
 */
function extractSection(
  markdown: string,
  header: string,
  nextHeaders: string[],
): string | null {
  const headerIndex = markdown.indexOf(header);
  if (headerIndex === -1) return null;

  const contentStart = headerIndex + header.length;
  let contentEnd = markdown.length;

  for (const next of nextHeaders) {
    const nextIndex = markdown.indexOf(next, contentStart);
    if (nextIndex !== -1 && nextIndex < contentEnd) {
      contentEnd = nextIndex;
    }
  }

  return markdown.slice(contentStart, contentEnd).trim();
}

/**
 * @description Parses the metadata block from Markdown.
 * @param markdown - Full markdown text
 * @returns DocumentMetadata or null if parsing fails
 */
function parseMetadata(markdown: string): DocumentMetadata | null {
  const dateMatch = markdown.match(/\*\*Fecha de generación:\*\*\s*(.+)/);
  const fileMatch = markdown.match(/\*\*Archivo fuente:\*\*\s*(.+)/);
  const providerMatch = markdown.match(/\*\*Proveedor IA:\*\*\s*(.+)/);

  if (!dateMatch || !fileMatch || !providerMatch) return null;

  const prismScores = parsePrismScores(markdown);
  if (!prismScores) return null;

  return {
    generationDate: dateMatch[1]!.trim(),
    sourceFileName: fileMatch[1]!.trim(),
    iaProvider: providerMatch[1]!.trim(),
    prismScores,
  };
}

/**
 * @description Parses PRISM scores from the metadata block.
 * @param markdown - Full markdown text
 * @returns Record of dimension scores or null
 */
function parsePrismScores(
  markdown: string,
): Record<PRISMDimension, number> | null {
  const dimensions: PRISMDimension[] = [
    'precision', 'relevance', 'integrity', 'sufficiency', 'maintainability',
  ];
  const scores: Partial<Record<PRISMDimension, number>> = {};

  for (const dim of dimensions) {
    const regex = new RegExp(`\\*\\*${dim}\\*\\*:\\s*(\\d+)/100`);
    const match = markdown.match(regex);
    if (!match) return null;
    scores[dim] = parseInt(match[1]!, 10);
  }

  return scores as Record<PRISMDimension, number>;
}

/**
 * @description Parses objectives sections from Markdown content.
 * @param content - Objectives section content
 * @returns Array of BSCObjectivesSection
 */
function parseObjectives(content: string): BSCObjectivesSection[] {
  const sections = content.split(/(?=^### )/m).filter((s) => s.trim());
  return sections.map((section) => {
    const nameMatch = section.match(/^### (.+)/m);
    const perspMatch = section.match(/\*\*Perspectiva:\*\*\s*(.+)/);
    const descLines = section.split('\n').filter((l) =>
      !l.startsWith('#') && !l.startsWith('**') && !l.startsWith('-') && l.trim(),
    );
    const actionLines = section.split('\n')
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim());

    const perspName = perspMatch?.[1]?.trim() ?? '';
    const perspective = findPerspectiveByName(perspName);

    return {
      name: nameMatch?.[1]?.trim() ?? '',
      description: descLines.join(' ').trim(),
      perspective,
      actions: actionLines,
    };
  });
}

/**
 * @description Finds a BSCPerspective by its Spanish display name.
 * @param name - Spanish perspective name
 * @returns The matching BSCPerspective or 'financial' as default
 */
function findPerspectiveByName(name: string): BSCPerspective {
  for (const [key, value] of Object.entries(PERSPECTIVE_NAMES)) {
    if (value === name) return key as BSCPerspective;
  }
  return 'financial';
}

/**
 * @description Parses dimension sections from Markdown content.
 * @param content - Dimensions section content
 * @returns Array of BSCDimensionSection
 */
function parseDimensions(content: string): BSCDimensionSection[] {
  const sections = content.split(/(?=^### )/m).filter((s) => s.trim());
  return sections.map((section) => {
    const nameMatch = section.match(/^### (.+)/m);
    const name = nameMatch?.[1]?.trim() ?? '';
    const perspective = findPerspectiveByName(name);
    const omittedMatch = section.match(/\*Perspectiva omitida: (.+)\*/);

    if (omittedMatch) {
      return {
        perspective,
        kpis: [],
        included: false,
        exclusionReason: omittedMatch[1]?.trim(),
      };
    }

    const kpiLines = section.split('\n')
      .filter((l) => l.startsWith('- **'));
    const kpis: KPITechnicalSheet[] = kpiLines.map((line) => {
      const match = line.match(/- \*\*(.+?)\*\* - (.+)/);
      return {
        code: match?.[1] ?? '',
        fullName: match?.[2] ?? '',
        objectiveName: '',
        formula: '',
        conditions: { optimal: 0, acceptable: 0, rejected: 0 },
      };
    });

    return { perspective, kpis, included: true };
  });
}

/**
 * @description Parses the KPI identification table from Markdown.
 * Used as fallback when KPI details section is missing.
 * @param content - KPI identification section content
 * @returns Array of partial KPITechnicalSheet
 */
export function parseKPIIdentificationTable(content: string): KPITechnicalSheet[] {
  const lines = content.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c);
    return {
      code: cells[0] ?? '',
      fullName: cells[1] ?? '',
      objectiveName: cells[2] ?? '',
      formula: '',
      conditions: { optimal: 0, acceptable: 0, rejected: 0 },
    };
  });
}

/**
 * @description Parses KPI detail sections with full technical sheets.
 * @param content - KPI details section content
 * @returns Array of KPITechnicalSheet
 */
function parseKPIDetails(content: string): KPITechnicalSheet[] {
  const sections = content.split(/(?=^### )/m).filter((s) => s.trim());
  return sections.map((section) => {
    const rows = section.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
    const fields = new Map<string, string>();

    for (const row of rows) {
      const cells = row.split('|').map((c) => c.trim()).filter((c) => c);
      if (cells.length >= 2) {
        fields.set(cells[0]!, cells[1]!);
      }
    }

    return {
      code: fields.get('Código') ?? '',
      fullName: fields.get('Nombre') ?? '',
      objectiveName: fields.get('Objetivo') ?? '',
      formula: fields.get('Fórmula') ?? '',
      conditions: {
        optimal: parseInt(fields.get('Óptimo') ?? '0', 10),
        acceptable: parseInt(fields.get('Aceptable') ?? '0', 10),
        rejected: parseInt(fields.get('Rechazado') ?? '0', 10),
      },
    };
  });
}

/**
 * @description Parses the data section from Markdown content.
 * @param content - Data section content
 * @returns DataSectionContent
 */
function parseDataSection(content: string): DataSectionContent {
  const datasets = parseDatasetTable(content);
  const transformations = parseTransformations(content);
  const charts = parseCharts(content);
  return { datasets, transformations, charts };
}

/**
 * @description Parses the datasets table from data section.
 * @param content - Data section content
 * @returns Array of DatasetInfo
 */
function parseDatasetTable(content: string): DatasetInfo[] {
  const datasetsSection = extractSection(content, '### Datasets', ['### Transformaciones', '### Gráficos']);
  if (!datasetsSection) return [];

  const lines = datasetsSection.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c);
    return {
      name: cells[0] ?? '',
      rows: parseInt(cells[1] ?? '0', 10),
      columns: parseInt(cells[2] ?? '0', 10),
    };
  });
}

/**
 * @description Parses transformation entries from data section.
 * @param content - Data section content
 * @returns Array of TransformationEntry
 */
function parseTransformations(content: string): TransformationEntry[] {
  const section = extractSection(content, '### Transformaciones', ['### Gráficos']);
  if (!section) return [];

  return section.split('\n')
    .filter((l) => l.startsWith('- **'))
    .map((line) => {
      const match = line.match(/- \*\*(.+?)\*\*:\s*(.+?)\s*→\s*(.+)/);
      return {
        description: match?.[1] ?? '',
        input: match?.[2] ?? '',
        output: match?.[3] ?? '',
      };
    });
}

/**
 * @description Parses chart entries from data section.
 * @param content - Data section content
 * @returns Array of ChartEntry
 */
function parseCharts(content: string): ChartEntry[] {
  const section = extractSection(content, '### Gráficos', []);
  if (!section) return [];

  const chartSections = section.split(/(?=^#### )/m).filter((s) => s.trim());
  return chartSections.map((cs) => {
    const titleMatch = cs.match(/^#### (.+?) \((.+?)\)/m);
    const lines = cs.split('\n').filter((l) =>
      !l.startsWith('#') && l.trim(),
    );
    return {
      title: titleMatch?.[1] ?? '',
      type: (titleMatch?.[2] ?? 'bar') as ChartEntry['type'],
      interpretation: lines.join(' ').trim(),
    };
  });
}

/**
 * @description Parses the analysis table from Markdown content.
 * @param content - Analysis section content
 * @returns Array of AnalysisEntry
 */
function parseAnalysisTable(content: string): AnalysisEntry[] {
  const lines = content.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
  if (lines.length < 2) return [];

  return lines.slice(1).map((line) => {
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c);
    const typeStr = cells[1] ?? '';
    const analysisType = typeStr === 'Cuantitativo' ? 'quantitative' as const : 'qualitative' as const;
    return {
      kpiName: cells[0] ?? '',
      analysisType,
      tool: cells[2] ?? '',
    };
  });
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * @description Generates a BSC document in Markdown format from the context.
 * Completes within 30 seconds for any supported dataset size.
 * @param context - Full document generation context
 * @returns Result containing Markdown string or DocumentError
 */
export async function generate(
  context: DocumentGenerationContext,
): Promise<Result<string, DocumentError>> {
  const startTime = Date.now();

  try {
    if (context.kpis.length === 0) {
      return err(createDocumentError(
        'INSUFFICIENT_DATA',
        'Se requiere al menos un KPI para generar el documento.',
      ));
    }

    const document = contextToDocument(context);
    const markdown = assembleDocument(document);

    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_GENERATION_TIME_MS) {
      return err(createDocumentError(
        'GENERATION_TIMEOUT',
        `La generación excedió el límite de ${MAX_GENERATION_TIME_MS / 1000} segundos.`,
      ));
    }

    return ok(markdown);
  } catch (error) {
    return err(createDocumentError(
      'GENERATION_FAILED',
      `Error durante la generación: ${String(error)}`,
    ));
  }
}

/**
 * @description Parses a BSC Markdown document back into a BSCDocument structure.
 * Used for round-trip validation.
 * @param markdown - The Markdown string to parse
 * @returns Result containing BSCDocument or ParseError
 */
export function parse(markdown: string): Result<BSCDocument, ParseError> {
  if (!markdown || markdown.trim().length === 0) {
    return err(createParseError('INVALID_MARKDOWN', 'El documento está vacío.'));
  }

  const metadata = parseMetadata(markdown);
  if (!metadata) {
    return err(createParseError(
      'STRUCTURE_MISMATCH',
      'No se pudieron extraer los metadatos del documento.',
    ));
  }

  const allHeaders = Object.values(SECTION_HEADERS);
  const missingSections: string[] = [];
  for (const header of allHeaders) {
    if (!markdown.includes(header)) {
      missingSections.push(header);
    }
  }

  if (missingSections.length > 0) {
    return err(createParseError(
      'MISSING_SECTIONS',
      `Faltan secciones obligatorias: ${missingSections.join(', ')}`,
      missingSections,
    ));
  }

  const introContent = extractSection(markdown, SECTION_HEADERS.introduction, [SECTION_HEADERS.objectives]) ?? '';
  const objContent = extractSection(markdown, SECTION_HEADERS.objectives, [SECTION_HEADERS.dimensions]) ?? '';
  const dimContent = extractSection(markdown, SECTION_HEADERS.dimensions, [SECTION_HEADERS.kpiIdentification]) ?? '';
  const kpiDetContent = extractSection(markdown, SECTION_HEADERS.kpiDetails, [SECTION_HEADERS.dataSection]) ?? '';
  const dataContent = extractSection(markdown, SECTION_HEADERS.dataSection, [SECTION_HEADERS.analysis]) ?? '';
  const analysisContent = extractSection(markdown, SECTION_HEADERS.analysis, []) ?? '';

  const document: BSCDocument = {
    metadata,
    introduction: introContent,
    objectives: parseObjectives(objContent),
    dimensions: parseDimensions(dimContent),
    kpiIdentification: parseKPIDetails(kpiDetContent),
    dataSection: parseDataSection(dataContent),
    analysis: parseAnalysisTable(analysisContent),
  };

  return ok(document);
}

/**
 * @description Serializes a BSCDocument back to Markdown format.
 * Used as the second step in round-trip validation.
 * @param document - The BSCDocument to serialize
 * @returns Complete Markdown string
 */
export function serialize(document: BSCDocument): string {
  return assembleDocument(document);
}

/**
 * @description Regenerates a document preserving user customizations.
 * Applies custom titles, interpretation texts, and objective ordering.
 * @param context - Updated generation context
 * @param customizations - User's edits to preserve
 * @returns Result containing Markdown string or DocumentError
 */
export async function regenerate(
  context: DocumentGenerationContext,
  customizations: UserCustomizations,
): Promise<Result<string, DocumentError>> {
  const startTime = Date.now();

  try {
    if (context.kpis.length === 0) {
      return err(createDocumentError(
        'INSUFFICIENT_DATA',
        'Se requiere al menos un KPI para regenerar el documento.',
      ));
    }

    const document = contextToDocument(context);
    const customizedDoc = applyCustomizations(document, customizations);
    const markdown = assembleDocument(customizedDoc);

    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_GENERATION_TIME_MS) {
      return err(createDocumentError(
        'GENERATION_TIMEOUT',
        `La regeneración excedió el límite de ${MAX_GENERATION_TIME_MS / 1000} segundos.`,
      ));
    }

    return ok(markdown);
  } catch (error) {
    return err(createDocumentError(
      'GENERATION_FAILED',
      `Error durante la regeneración: ${String(error)}`,
    ));
  }
}

// ─── Customization Application ───────────────────────────────────────────────

/**
 * @description Applies user customizations to a BSCDocument.
 * @param document - The base document
 * @param customizations - User's edits
 * @returns Modified BSCDocument with customizations applied
 */
function applyCustomizations(
  document: BSCDocument,
  customizations: UserCustomizations,
): BSCDocument {
  const customizedObjectives = applyObjectiveOrder(
    document.objectives,
    customizations.objectiveOrder,
  );

  const customizedIntroduction = customizations.sectionTitles['introduction']
    ? document.introduction
    : document.introduction;

  const customizedCharts = applyChartCustomizations(
    document.dataSection.charts,
    customizations.interpretationTexts,
  );

  return {
    ...document,
    introduction: customizedIntroduction,
    objectives: customizedObjectives,
    dataSection: {
      ...document.dataSection,
      charts: customizedCharts,
    },
  };
}

/**
 * @description Reorders objectives according to user preference.
 * @param objectives - Original objectives array
 * @param order - Array of objective names in desired order
 * @returns Reordered objectives array
 */
function applyObjectiveOrder(
  objectives: BSCObjectivesSection[],
  order: string[],
): BSCObjectivesSection[] {
  if (order.length === 0) return objectives;

  const ordered: BSCObjectivesSection[] = [];
  for (const name of order) {
    const found = objectives.find((obj) => obj.name === name);
    if (found) ordered.push(found);
  }

  // Append any objectives not in the order list
  for (const obj of objectives) {
    if (!order.includes(obj.name)) ordered.push(obj);
  }

  return ordered;
}

/**
 * @description Applies custom interpretation texts to chart entries.
 * @param charts - Original chart entries
 * @param interpretationTexts - Map of chart title to custom text
 * @returns Modified chart entries
 */
function applyChartCustomizations(
  charts: ChartEntry[],
  interpretationTexts: Record<string, string>,
): ChartEntry[] {
  return charts.map((chart) => {
    const customText = interpretationTexts[chart.title];
    if (customText) {
      return { ...chart, interpretation: customText };
    }
    return chart;
  });
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The BSC document generator implementing IGeneradorDocumento.
 * Generates, parses, serializes, and regenerates Markdown BSC documents
 * with support for round-trip preservation and user customizations.
 */
export const generadorDocumento: IGeneradorDocumento = {
  generate,
  parse,
  regenerate,
  serialize,
};
