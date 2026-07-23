/**
 * @description Enumerated data types detected in file columns.
 * Used by Módulo_Detección to classify column values.
 */
export type DataType = 'numeric' | 'text' | 'date' | 'boolean';

/**
 * @description The four perspectives of the Balanced Scorecard (BSC/CMI).
 * Used by Módulo_Objetivos and Generador_Documento.
 */
export type BSCPerspective = 'financial' | 'customers' | 'internal_processes' | 'learning_growth';

/**
 * @description The five dimensions of the PRISM data quality methodology.
 * Each dimension evaluates a specific aspect of dataset quality.
 */
export type PRISMDimension = 'precision' | 'relevance' | 'integrity' | 'sufficiency' | 'maintainability';

/**
 * @description Types of charts available for visualization suggestions.
 * Used by Catálogo_Visualización for generating chart recommendations.
 */
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'pivot';

/**
 * @description Aggregation operations used for KPI calculations.
 * Applied to numeric and temporal columns for generating KPI values.
 */
export type AggregationType = 'sum' | 'average' | 'count' | 'rate' | 'min' | 'max';

/**
 * @description Steps of the onboarding flow.
 * Represents the current stage of the user's analysis session.
 */
export type FlowStep = 'upload' | 'detection' | 'prism' | 'visualization' | 'objectives' | 'document';

/**
 * @description Theme options for the UI.
 */
export type Theme = 'light' | 'dark';
