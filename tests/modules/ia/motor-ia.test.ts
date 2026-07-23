import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IIAProvider } from '../../../src/modules/ia/providers/ia-provider.interface';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../src/types/session';
import type { IAConfigError, IAQueryError } from '../../../src/types/errors';
import type { Result } from '../../../src/types/result';
import { ok, err } from '../../../src/types/result';
import {
  motorIA,
  registerProvider,
  resetState,
  buildMetadataPayload,
  getQueryHistory,
  getActiveProviderId,
} from '../../../src/modules/ia/motor-ia';

// ─── Mock Providers ──────────────────────────────────────────────────────────

function createMockProvider(options: {
  providerId: string;
  requiresInternet: boolean;
  testConnectionResult?: Result<void, IAConfigError>;
  sendQueryResult?: Result<IAResponse, IAQueryError>;
  sendQueryDelay?: number;
}): IIAProvider & { _activeConfig: IAProviderConfig | null } {
  return {
    providerId: options.providerId,
    requiresInternet: options.requiresInternet,
    _activeConfig: null,
    testConnection: vi.fn(async (): Promise<Result<void, IAConfigError>> => {
      return options.testConnectionResult ?? ok(undefined);
    }),
    sendQuery: vi.fn(async (): Promise<Result<IAResponse, IAQueryError>> => {
      if (options.sendQueryDelay) {
        await new Promise((r) => setTimeout(r, options.sendQueryDelay));
      }
      return options.sendQueryResult ?? ok({
        content: 'Test response',
        providerId: options.providerId,
        timestamp: Date.now(),
      });
    }),
  };
}

function createSampleConfig(providerId: string): IAProviderConfig {
  return {
    providerId,
    apiKey: 'test-api-key-12345',
    model: 'test-model',
    baseUrl: 'http://localhost:9999',
  };
}

function createSampleMetadata(): DatasetMetadata {
  return {
    columnNames: ['revenue', 'month', 'category'],
    columnTypes: ['numeric', 'date', 'text'],
    rowCount: 1000,
    statistics: {
      revenue: {
        mean: 5000,
        median: 4500,
        min: 100,
        max: 20000,
        count: 950,
        nullCount: 50,
        distinctCount: 800,
      },
      month: {
        count: 1000,
        nullCount: 0,
        distinctCount: 12,
      },
      category: {
        count: 1000,
        nullCount: 10,
        distinctCount: 5,
      },
    },
  };
}

// ─── Mock seguridad encrypt ──────────────────────────────────────────────────

vi.mock('../../../src/modules/seguridad/modulo-seguridad', () => ({
  moduloSeguridad: {
    encrypt: vi.fn(async (data: string) => ({
      ciphertext: btoa(data),
      iv: 'mock-iv',
      tag: 'mock-tag',
    })),
    decrypt: vi.fn(async () => ok('decrypted')),
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Motor_IA', () => {
  beforeEach(() => {
    resetState();
  });

  describe('configureProvider()', () => {
    it('should configure a provider successfully with valid config', async () => {
      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
      });
      registerProvider(mockProvider);

      const config = createSampleConfig('openai');
      const result = await motorIA.configureProvider(config);

      expect(result.ok).toBe(true);
      expect(getActiveProviderId()).toBe('openai');
    });

    it('should reject unknown provider', async () => {
      const config = createSampleConfig('unknown-provider');
      const result = await motorIA.configureProvider(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      }
    });

    it('should reject invalid API key without storing it', async () => {
      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
        testConnectionResult: err({
          code: 'INVALID_API_KEY',
          message: 'Invalid key',
          timestamp: new Date().toISOString(),
          module: 'ia',
          providerId: 'openai',
        }),
      });
      registerProvider(mockProvider);

      const config = createSampleConfig('openai');
      const result = await motorIA.configureProvider(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_API_KEY');
      }

      // Verify the key was NOT stored
      const available = motorIA.getAvailableProviders(true);
      expect(available).toHaveLength(0);
    });

    it('should handle connection timeout', async () => {
      const mockProvider = createMockProvider({
        providerId: 'gemini',
        requiresInternet: true,
        testConnectionResult: err({
          code: 'CONFIG_TIMEOUT',
          message: 'Timeout',
          timestamp: new Date().toISOString(),
          module: 'ia',
          providerId: 'gemini',
        }),
      });
      registerProvider(mockProvider);

      const config = createSampleConfig('gemini');
      const result = await motorIA.configureProvider(config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('CONFIG_TIMEOUT');
      }
    });

    it('should set first configured provider as active by default', async () => {
      const mockProvider = createMockProvider({
        providerId: 'claude',
        requiresInternet: true,
      });
      registerProvider(mockProvider);

      expect(getActiveProviderId()).toBeNull();

      const config = createSampleConfig('claude');
      await motorIA.configureProvider(config);

      expect(getActiveProviderId()).toBe('claude');
    });

    it('should update existing provider config on reconfigure', async () => {
      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
      });
      registerProvider(mockProvider);

      await motorIA.configureProvider(createSampleConfig('openai'));
      await motorIA.configureProvider({
        ...createSampleConfig('openai'),
        model: 'gpt-4',
      });

      const available = motorIA.getAvailableProviders(true);
      expect(available).toHaveLength(1);
    });
  });

  describe('query()', () => {
    it('should send query and return response', async () => {
      const expectedResponse: IAResponse = {
        content: 'Analysis result',
        providerId: 'openai',
        timestamp: Date.now(),
      };

      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
        sendQueryResult: ok(expectedResponse),
      });
      registerProvider(mockProvider);
      await motorIA.configureProvider(createSampleConfig('openai'));

      const result = await motorIA.query('Analyze trends', createSampleMetadata());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('Analysis result');
        expect(result.value.providerId).toBe('openai');
      }
    });

    it('should return error when no active provider', async () => {
      const result = await motorIA.query('test', createSampleMetadata());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
      }
    });

    it('should retry once after timeout and succeed on second attempt', async () => {
      let callCount = 0;
      const mockProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
        providerId: 'openai',
        requiresInternet: true,
        _activeConfig: null,
        testConnection: vi.fn(async () => ok(undefined)),
        sendQuery: vi.fn(async (): Promise<Result<IAResponse, IAQueryError>> => {
          callCount++;
          if (callCount === 1) {
            return err({
              code: 'QUERY_TIMEOUT',
              message: 'Timeout',
              timestamp: new Date().toISOString(),
              module: 'ia',
              providerId: 'openai',
              retryCount: 0,
            });
          }
          return ok({
            content: 'Retry success',
            providerId: 'openai',
            timestamp: Date.now(),
          });
        }),
      };

      registerProvider(mockProvider);
      await motorIA.configureProvider(createSampleConfig('openai'));

      const result = await motorIA.query('test', createSampleMetadata());

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.content).toBe('Retry success');
      }
      expect(callCount).toBe(2);
    });

    it('should return RETRY_EXHAUSTED after both attempts fail', async () => {
      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
        sendQueryResult: err({
          code: 'NETWORK_ERROR',
          message: 'Network error',
          timestamp: new Date().toISOString(),
          module: 'ia',
          providerId: 'openai',
          retryCount: 0,
        }),
      });
      registerProvider(mockProvider);
      await motorIA.configureProvider(createSampleConfig('openai'));

      const result = await motorIA.query('test', createSampleMetadata());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('RETRY_EXHAUSTED');
        expect(result.error.retryCount).toBe(1);
      }
    });

    it('should not retry on non-retryable errors', async () => {
      const sendQueryMock = vi.fn(async (): Promise<Result<IAResponse, IAQueryError>> => {
        return err({
          code: 'PROVIDER_ERROR',
          message: 'Provider error',
          timestamp: new Date().toISOString(),
          module: 'ia',
          providerId: 'openai',
          retryCount: 0,
        });
      });

      const mockProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
        providerId: 'openai',
        requiresInternet: true,
        _activeConfig: null,
        testConnection: vi.fn(async () => ok(undefined)),
        sendQuery: sendQueryMock,
      };

      registerProvider(mockProvider);
      await motorIA.configureProvider(createSampleConfig('openai'));

      const result = await motorIA.query('test', createSampleMetadata());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_ERROR');
      }
      // Should only have been called once (no retry)
      expect(sendQueryMock).toHaveBeenCalledTimes(1);
    });

    it('should store successful query responses in history', async () => {
      const mockProvider = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
        sendQueryResult: ok({
          content: 'Response 1',
          providerId: 'openai',
          timestamp: Date.now(),
        }),
      });
      registerProvider(mockProvider);
      await motorIA.configureProvider(createSampleConfig('openai'));

      await motorIA.query('q1', createSampleMetadata());
      await motorIA.query('q2', createSampleMetadata());

      const history = getQueryHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('switchProvider()', () => {
    it('should switch to a configured provider', async () => {
      const mockOpenAI = createMockProvider({ providerId: 'openai', requiresInternet: true });
      const mockClaude = createMockProvider({ providerId: 'claude', requiresInternet: true });
      registerProvider(mockOpenAI);
      registerProvider(mockClaude);

      await motorIA.configureProvider(createSampleConfig('openai'));
      await motorIA.configureProvider(createSampleConfig('claude'));

      const result = motorIA.switchProvider('claude');

      expect(result.ok).toBe(true);
      expect(getActiveProviderId()).toBe('claude');
    });

    it('should preserve query history after switching', async () => {
      const mockOpenAI = createMockProvider({
        providerId: 'openai',
        requiresInternet: true,
        sendQueryResult: ok({
          content: 'OpenAI response',
          providerId: 'openai',
          timestamp: Date.now(),
        }),
      });
      const mockClaude = createMockProvider({ providerId: 'claude', requiresInternet: true });
      registerProvider(mockOpenAI);
      registerProvider(mockClaude);

      await motorIA.configureProvider(createSampleConfig('openai'));
      await motorIA.configureProvider(createSampleConfig('claude'));

      // Query with OpenAI
      await motorIA.query('test', createSampleMetadata());
      expect(getQueryHistory()).toHaveLength(1);

      // Switch to Claude
      motorIA.switchProvider('claude');

      // History should still be intact
      const history = getQueryHistory();
      expect(history).toHaveLength(1);
      expect(history[0]!.providerId).toBe('openai');
    });

    it('should fail when switching to unregistered provider', () => {
      const result = motorIA.switchProvider('nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      }
    });

    it('should fail when switching to unconfigured provider', () => {
      const mockProvider = createMockProvider({ providerId: 'gemini', requiresInternet: true });
      registerProvider(mockProvider);

      const result = motorIA.switchProvider('gemini');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_NOT_FOUND');
      }
    });
  });

  describe('checkOllamaAvailability()', () => {
    it('should return boolean (delegated to ollama provider)', async () => {
      // In test environment, fetch will fail, so should return false
      const result = await motorIA.checkOllamaAvailability();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAvailableProviders()', () => {
    it('should return all configured providers when online', async () => {
      const mockOpenAI = createMockProvider({ providerId: 'openai', requiresInternet: true });
      const mockOllama = createMockProvider({ providerId: 'ollama', requiresInternet: false });
      registerProvider(mockOpenAI);
      registerProvider(mockOllama);

      await motorIA.configureProvider(createSampleConfig('openai'));
      await motorIA.configureProvider(createSampleConfig('ollama'));

      const available = motorIA.getAvailableProviders(true);
      expect(available).toHaveLength(2);
    });

    it('should return only local providers when offline', async () => {
      const mockOpenAI = createMockProvider({ providerId: 'openai', requiresInternet: true });
      const mockOllama = createMockProvider({ providerId: 'ollama', requiresInternet: false });
      registerProvider(mockOpenAI);
      registerProvider(mockOllama);

      await motorIA.configureProvider(createSampleConfig('openai'));
      await motorIA.configureProvider(createSampleConfig('ollama'));

      const available = motorIA.getAvailableProviders(false);
      expect(available).toHaveLength(1);
      expect(available[0]!.providerId).toBe('ollama');
    });

    it('should return empty array when nothing configured', () => {
      const available = motorIA.getAvailableProviders(true);
      expect(available).toHaveLength(0);
    });
  });

  describe('buildMetadataPayload()', () => {
    it('should contain column names, types, and row count', () => {
      const metadata = createSampleMetadata();
      const payload = buildMetadataPayload(metadata);

      expect(payload).toContain('revenue');
      expect(payload).toContain('month');
      expect(payload).toContain('category');
      expect(payload).toContain('numeric');
      expect(payload).toContain('date');
      expect(payload).toContain('text');
      expect(payload).toContain('1000');
    });

    it('should contain statistical summaries', () => {
      const metadata = createSampleMetadata();
      const payload = buildMetadataPayload(metadata);

      expect(payload).toContain('media=5000');
      expect(payload).toContain('mediana=4500');
      expect(payload).toContain('min=100');
      expect(payload).toContain('max=20000');
    });

    it('should NOT contain individual record values', () => {
      const metadata = createSampleMetadata();
      const payload = buildMetadataPayload(metadata);

      // The payload should only have metadata, not row data
      // This is a structural check - individual values like specific row entries would not appear
      expect(payload).not.toContain('row[');
      expect(payload).not.toContain('record');
      expect(payload).not.toContain('value[');
    });
  });
});
