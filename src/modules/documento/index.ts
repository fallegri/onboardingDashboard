/**
 * @description Barrel export for the Generador_Documento module.
 * Provides BSC document generation, parsing, serialization, and regeneration.
 */
export { generadorDocumento, generate, parse, serialize, regenerate } from './generador-documento';

export type { IGeneradorDocumento, DocumentGenerationContext } from './generador-documento';
