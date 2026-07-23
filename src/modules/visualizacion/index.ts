/**
 * @description Barrel export for the Catálogo_Visualización module.
 * Provides chart/KPI suggestions, preview generation, and custom visualization management.
 */
export {
  catalogoVisualizacion,
  suggestCharts,
  suggestKPIs,
  generatePreview,
  addCustomVisualization,
  resetState,
  getCustomVisualizations,
} from './catalogo-visualizacion';

export type { ICatalogoVisualizacion, CustomVisualizationInput, ChartRenderData } from './catalogo-visualizacion';
