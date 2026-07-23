import type { Result } from '../../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../types/session';
import type { IAConfigError, IAQueryError } from '../../../types/errors';
import type { IIAProvider } from './ia-provider.interface';
import { ok, err } from '../../../types/result';
import { buildMetadataPayload } from '../motor-ia';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_ID = 'claude';
const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const CONNECTION_TIMEOUT = 10_000;
const QUERY_TIMEOUT = 30_000;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Creates an IAConfigError for the Claude provider.
 * @param code - The error code
 * @param message - Human-readable error message
 * @returns An IAConfigError object
 */
function createConfigError(code: IAConfigError['code'], message: string): IAConfigError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'ia',
    providerId: PROVIDER_ID,
  };
}

/**
 * @description Creates an IAQueryError for the Claude provider.
 * @param code - The error code
 * @param message - Human-readable error message
 * @param retryCount - Number of retries attempted
 * @returns An IAQueryError object
 */
function createQueryError(code: IAQueryError['code'], message: string, retryCount: number): IAQueryError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'ia',
    providerId: PROVIDER_ID,
    retryCount,
  };
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * @description Tests connection to Anthropic Claude API with the given configuration.
 * @param config - Provider configuration with API key and model
 * @returns Result void on success, IAConfigError on failure
 */
async function testConnection(config: IAProviderConfig): Promise<Result<void, IAConfigError>> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'test' }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return err(createConfigError('INVALID_API_KEY', 'La API key de Claude es inválida.'));
    }

    if (!response.ok && response.status !== 400) {
      return err(createConfigError('PROVIDER_UNREACHABLE', `Claude respondió con status ${response.status}.`));
    }

    return ok(undefined);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createConfigError('CONFIG_TIMEOUT', 'Timeout de 10 segundos al conectar con Claude.'));
    }
    return err(createConfigError('PROVIDER_UNREACHABLE', 'No se pudo conectar con Claude.'));
  }
}

/**
 * @description Sends a query to Anthropic Claude using only dataset metadata.
 * @param prompt - The user's question
 * @param metadata - Dataset metadata (no individual records)
 * @returns Result with IAResponse or IAQueryError
 */
async function sendQuery(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>> {
  const config = claudeProvider._activeConfig;
  if (!config) {
    return err(createQueryError('PROVIDER_ERROR', 'Claude no está configurado.', 0));
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const metadataPayload = buildMetadataPayload(metadata);

  const body = JSON.stringify({
    model: config.model,
    max_tokens: 4096,
    system: `Analiza los siguientes metadatos del dataset:\n${metadataPayload}`,
    messages: [{ role: 'user', content: prompt }],
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

    const response = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(createQueryError('PROVIDER_ERROR', `Claude respondió con status ${response.status}.`, 0));
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text ?? '';

    return ok({ content, providerId: PROVIDER_ID, timestamp: Date.now() });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createQueryError('QUERY_TIMEOUT', 'Timeout de 30 segundos al consultar Claude.', 0));
    }
    return err(createQueryError('NETWORK_ERROR', 'Error de red al consultar Claude.', 0));
  }
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description Anthropic Claude provider implementing IIAProvider.
 * Requires internet connectivity. Sends queries to Anthropic's messages API.
 */
export const claudeProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
  providerId: PROVIDER_ID,
  requiresInternet: true,
  testConnection,
  sendQuery,
  _activeConfig: null,
};
