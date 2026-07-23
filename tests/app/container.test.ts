import { describe, it, expect, beforeEach } from 'vitest';
import { createContainer } from '../../src/app/container';
import type { AppContainer } from '../../src/app/container';
import { resetState as resetIAState, registerProvider } from '../../src/modules/ia/motor-ia';
import { resetState as resetObjetivosState } from '../../src/modules/objetivos/modulo-objetivos';
import { resetState as resetVisualizacionState } from '../../src/modules/visualizacion/catalogo-visualizacion';
import type { IIAProvider } from '../../src/modules/ia/providers/ia-provider.interface';
import { ok } from '../../src/types/result';

describe('AppContainer', () => {
  let container: AppContainer;

  beforeEach(() => {
    resetIAState();
    resetObjetivosState();
    resetVisualizacionState();
    container = createContainer();
  });

  describe('module instantiation', () => {
    it('should create all domain modules', () => {
      expect(container.moduloSeguridad).toBeDefined();
      expect(container.moduloCarga).toBeDefined();
      expect(container.moduloDeteccion).toBeDefined();
      expect(container.motorPRISM).toBeDefined();
      expect(container.catalogoVisualizacion).toBeDefined();
      expect(container.moduloObjetivos).toBeDefined();
      expect(container.motorIA).toBeDefined();
      expect(container.generadorDocumento).toBeDefined();
    });

    it('should create infrastructure services', () => {
      expect(container.logService).toBeDefined();
      expect(container.storageManager).toBeDefined();
    });

    it('should create the flow orchestrator', () => {
      expect(container.flowOrchestrator).toBeDefined();
      expect(container.flowOrchestrator.getCurrentStep()).toBe('upload');
    });
  });

  describe('dependency wiring', () => {
    it('should wire Módulo_Seguridad into Módulo_Carga (file validation)', () => {
      const { moduloCarga } = container;
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
      const result = moduloCarga.validateFile(invalidFile);
      expect(result.ok).toBe(false);
    });

    it('should expose Módulo_Seguridad as transversal service', () => {
      expect(container.moduloSeguridad.sanitizeInput).toBeTypeOf('function');
      expect(container.moduloSeguridad.encrypt).toBeTypeOf('function');
      expect(container.moduloSeguridad.decrypt).toBeTypeOf('function');
      expect(container.moduloSeguridad.validateFileUpload).toBeTypeOf('function');
      expect(container.moduloSeguridad.detectInjection).toBeTypeOf('function');
    });

    it('should expose LogService as transversal service', () => {
      expect(container.logService.logError).toBeTypeOf('function');
      expect(container.logService.logSecurityEvent).toBeTypeOf('function');
      expect(container.logService.getLogs).toBeTypeOf('function');
    });
  });

  describe('IA provider registration', () => {
    it('should register all 4 built-in IA providers', () => {
      const { motorIA } = container;
      // No providers are "configured" yet (they need API keys),
      // but they are registered. We verify by attempting to switch.
      const openaiResult = motorIA.switchProvider('openai');
      const geminiResult = motorIA.switchProvider('gemini');
      const claudeResult = motorIA.switchProvider('claude');
      const ollamaResult = motorIA.switchProvider('ollama');

      // All should fail because they're not configured (no API key),
      // but the error should be PROVIDER_NOT_FOUND only if not registered.
      // Since they ARE registered, the error should be about configuration.
      expect(openaiResult.ok).toBe(false);
      if (!openaiResult.ok) {
        expect(openaiResult.error.message).toContain('no está configurado');
      }
      expect(geminiResult.ok).toBe(false);
      if (!geminiResult.ok) {
        expect(geminiResult.error.message).toContain('no está configurado');
      }
      expect(claudeResult.ok).toBe(false);
      if (!claudeResult.ok) {
        expect(claudeResult.error.message).toContain('no está configurado');
      }
      expect(ollamaResult.ok).toBe(false);
      if (!ollamaResult.ok) {
        expect(ollamaResult.error.message).toContain('no está configurado');
      }
    });

    it('should allow adding a new mock provider without modifying existing code', () => {
      const mockProvider: IIAProvider = {
        providerId: 'mock-provider',
        requiresInternet: false,
        testConnection: async () => ok(undefined),
        sendQuery: async () => ok({
          content: 'mock response',
          providerId: 'mock-provider',
          timestamp: Date.now(),
        }),
      };

      registerProvider(mockProvider);

      // The mock provider should now be registered
      const switchResult = container.motorIA.switchProvider('mock-provider');
      // Not configured yet but IS registered
      expect(switchResult.ok).toBe(false);
      if (!switchResult.ok) {
        expect(switchResult.error.message).toContain('no está configurado');
      }
    });
  });

  describe('module isolation', () => {
    it('should expose only public interface methods on each module', () => {
      // Verify modules expose their interface, not internal state
      const cargaKeys = Object.keys(container.moduloCarga);
      expect(cargaKeys).toContain('loadFile');
      expect(cargaKeys).toContain('validateFile');

      const prismKeys = Object.keys(container.motorPRISM);
      expect(prismKeys).toContain('evaluate');
      expect(prismKeys).toContain('recalculateDimension');

      const objetivosKeys = Object.keys(container.moduloObjetivos);
      expect(objetivosKeys).toContain('createObjective');
      expect(objetivosKeys).toContain('linkKPI');
      expect(objetivosKeys).toContain('unlinkKPI');
    });
  });
});
