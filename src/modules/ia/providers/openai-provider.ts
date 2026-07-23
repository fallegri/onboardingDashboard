import type { Result } from '../../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../types/session';
import type { IAConfigError, IAQueryError } from '../../../types/errors';
import type { IIAProvider } from './ia-provider.interface';
import { ok, err } from '../../../types/result';
import { buildMetadataPayload } from '../motor-ia';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_ID = 'openai';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const CONNECTION_TIMEOUT = 10_000;
const QUERY_TIMEOUT = 30_000;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Creates an IAConfigError for the OpenAI provider.
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
 * @description Creates an IAQueryError for the OpenAI provider.
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
 * @description Tests connection to OpenAI API with the given configuration.
 * @param config - Provider configuration with API key and model
 * @returns Result void on success, IAConfigError on failure
 */
async function testConnection(config: IAProviderConfig): Promise<Result<void, IAConfigError>> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      return err(createConfigError('INVALID_API_KEY', 'La API key de OpenAI es inválida.'));
    }

    if (!response.ok) {
      return err(createConfigError('PROVIDER_UNREACHABLE', `OpenAI respondió con status ${response.status}.`));
    }

    return ok(undefined);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createConfigError('CONFIG_TIMEOUT', 'Timeout de 10 segundos al conectar con OpenAI.'));
    }
    return err(createConfigError('PROVIDER_UNREACHABLE', 'No se pudo conectar con OpenAI.'));
  }
}

/**
 * @description Sends a query to OpenAI using only dataset metadata.
 * @param prompt - The user's question
 * @param metadata - Dataset metadata (no individual records)
 * @returns Result with IAResponse or IAQueryError
 */
async function sendQuery(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>> {
  const config = openaiProvider._activeConfig;
  if (!config) {
    return err(createQueryError('PROVIDER_ERROR', 'OpenAI no está configurado.', 0));
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const metadataPayload = buildMetadataPayload(metadata);

  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: `Analiza los siguientes metadatos del dataset:\n${metadataPayload}` },
      { role: 'user', content: prompt },
    ],
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(createQueryError('PROVIDER_ERROR', `OpenAI respondió con status ${response.status}.`, 0));
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? '';

    return ok({ content, providerId: PROVIDER_ID, timestamp: Date.now() });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createQueryError('QUERY_TIMEOUT', 'Timeout de 30 segundos al consultar OpenAI.', 0));
    }
    return err(createQueryError('NETWORK_ERROR', 'Error de red al consultar OpenAI.', 0));
  }
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description OpenAI provider implementing IIAProvider.
 * Requires internet connectivity. Sends queries to OpenAI's chat completions API.
 */
export const openaiProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
  providerId: PROVIDER_ID,
  requiresInternet: true,
  testConnection,
  sendQuery,
  _activeConfig: null,
};
