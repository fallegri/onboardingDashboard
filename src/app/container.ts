import { LogService } from '../infrastructure/log-service';
import { StorageManager } from '../infrastructure/storage-manager';
import { moduloSeguridad } from '../modules/seguridad/modulo-seguridad';
import type { IModuloSeguridad } from '../modules/seguridad/modulo-seguridad';
import { createModuloCarga } from '../modules/carga/modulo-carga';
import type { IModuloCarga } from '../modules/carga/modulo-carga';
import { moduloDeteccion } from '../modules/deteccion/modulo-deteccion';
import type { IModuloDeteccion } from '../modules/deteccion/modulo-deteccion';
import { motorPRISM } from '../modules/prism/motor-prism';
import type { IMotorPRISM } from '../modules/prism/motor-prism';
import { catalogoVisualizacion } from '../modules/visualizacion/catalogo-visualizacion';
import type { ICatalogoVisualizacion } from '../modules/visualizacion/catalogo-visualizacion';
import { moduloObjetivos } from '../modules/objetivos/modulo-objetivos';
import type { IModuloObjetivos } from '../modules/objetivos/modulo-objetivos';
import { motorIA, registerProvider } from '../modules/ia/motor-ia';
import type { IMotorIA } from '../modules/ia/motor-ia';
import { generadorDocumento } from '../modules/documento/generador-documento';
import type { IGeneradorDocumento } from '../modules/documento/generador-documento';
import { openaiProvider } from '../modules/ia/providers/openai-provider';
import { geminiProvider } from '../modules/ia/providers/gemini-provider';
import { claudeProvider } from '../modules/ia/providers/claude-provider';
import { ollamaProvider } from '../modules/ia/providers/ollama-provider';
import type { IIAProvider } from '../modules/ia/providers/ia-provider.interface';
import { FlowOrchestrator } from './flow-orchestrator';

// ─── Container Interface ─────────────────────────────────────────────────────

/**
 * @description Typed application container holding all module instances.
 * Provides centralized access to every module via its public interface.
 */
export interface AppContainer {
  readonly logService: LogService;
  readonly storageManager: StorageManager;
  readonly moduloSeguridad: IModuloSeguridad;
  readonly moduloCarga: IModuloCarga;
  readonly moduloDeteccion: IModuloDeteccion;
  readonly motorPRISM: IMotorPRISM;
  readonly catalogoVisualizacion: ICatalogoVisualizacion;
  readonly moduloObjetivos: IModuloObjetivos;
  readonly motorIA: IMotorIA;
  readonly generadorDocumento: IGeneradorDocumento;
  readonly flowOrchestrator: FlowOrchestrator;
}

// ─── Provider Registration ───────────────────────────────────────────────────

/**
 * @description Registers the four built-in IA providers with the Motor_IA module.
 * Each provider implements IIAProvider and is added via registerProvider().
 * @param providers - Array of IIAProvider implementations to register
 */
function registerIAProviders(providers: IIAProvider[]): void {
  for (const provider of providers) {
    registerProvider(provider);
  }
}

// ─── Infrastructure Layer ────────────────────────────────────────────────────

/**
 * @description Creates the infrastructure services (LogService, StorageManager).
 * @returns Object containing logService and storageManager instances
 */
function createInfrastructure(): { logService: LogService; storageManager: StorageManager } {
  const logService = new LogService();
  const storageManager = new StorageManager();
  return { logService, storageManager };
}

// ─── Module Wiring ───────────────────────────────────────────────────────────

/**
 * @description Creates the Módulo_Carga with Módulo_Seguridad injected.
 * @param seguridad - The security module used for file validation
 * @returns An IModuloCarga instance with security dependency wired
 */
function wireCargaModule(seguridad: IModuloSeguridad): IModuloCarga {
  return createModuloCarga(seguridad);
}

/**
 * @description Creates the FlowOrchestrator with StorageManager injected.
 * @param storageManager - The storage manager for session persistence
 * @returns A FlowOrchestrator instance
 */
function wireFlowOrchestrator(storageManager: StorageManager): FlowOrchestrator {
  return new FlowOrchestrator(storageManager);
}

// ─── Container Factory ───────────────────────────────────────────────────────

/**
 * @description Creates and wires the complete application container.
 * This is the Composition Root: all module instantiation and dependency
 * wiring happens here. No module creates its own dependencies.
 *
 * Wiring:
 * - Módulo_Seguridad → Módulo_Carga (file validation)
 * - Módulo_Seguridad → Motor_IA (API key encryption)
 * - StorageManager → FlowOrchestrator (session persistence)
 * - LogService → transversal (available to all modules)
 * - 4 IA providers registered: OpenAI, Gemini, Claude, Ollama
 *
 * @returns A fully wired AppContainer with all modules ready to use
 */
export function createContainer(): AppContainer {
  const { logService, storageManager } = createInfrastructure();

  registerIAProviders([
    openaiProvider,
    geminiProvider,
    claudeProvider,
    ollamaProvider,
  ]);

  const moduloCarga = wireCargaModule(moduloSeguridad);
  const flowOrchestrator = wireFlowOrchestrator(storageManager);

  return {
    logService,
    storageManager,
    moduloSeguridad,
    moduloCarga,
    moduloDeteccion,
    motorPRISM,
    catalogoVisualizacion,
    moduloObjetivos,
    motorIA,
    generadorDocumento,
    flowOrchestrator,
  };
}
