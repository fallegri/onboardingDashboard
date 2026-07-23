import type { Result } from '../../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../types/session';
import type { IAConfigError, IAQueryError } from '../../../types/errors';
import type { IIAProvider } from './ia-provider.interface';
import { ok, err } from '../../../types/result';
import { buildMetadataPayload } from '../motor-ia';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_ID = 'ollama';
const DEFAULT_BASE_URL = 'http://localhost:11434';
const CONNECTION_TIMEOUT = 10_000;
const QUERY_TIMEOUT = 30_000;
const AVAILABILITY_TIMEOUT = 5_000;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Creates an IAConfigError for the Ollama provider.
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
 * @description Creates an IAQueryError for the Ollama provider.
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
 * @description Tests connection to local Ollama instance.
 * @param config - Provider configuration with base URL
 * @returns Result void on success, IAConfigError on failure
 */
async function testConnection(config: IAProviderConfig): Promise<Result<void, IAConfigError>> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(createConfigError('OLLAMA_UNAVAILABLE', `Ollama respondió con status ${response.status}.`));
    }

    return ok(undefined);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createConfigError('CONFIG_TIMEOUT', 'Timeout de 10 segundos al conectar con Ollama.'));
    }
    return err(createConfigError('OLLAMA_UNAVAILABLE', 'No se pudo conectar con Ollama en localhost:11434.'));
  }
}

/**
 * @description Sends a query to local Ollama instance using only dataset metadata.
 * @param prompt - The user's question
 * @param metadata - Dataset metadata (no individual records)
 * @returns Result with IAResponse or IAQueryError
 */
async function sendQuery(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>> {
  const config = ollamaProvider._activeConfig;
  if (!config) {
    return err(createQueryError('PROVIDER_ERROR', 'Ollama no está configurado.', 0));
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const metadataPayload = buildMetadataPayload(metadata);

  const body = JSON.stringify({
    model: config.model,
    prompt: `Metadatos del dataset:\n${metadataPayload}\n\nConsulta: ${prompt}`,
    stream: false,
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(createQueryError('PROVIDER_ERROR', `Ollama respondió con status ${response.status}.`, 0));
    }

    const data = await response.json();
    const content = data?.response ?? '';

    return ok({ content, providerId: PROVIDER_ID, timestamp: Date.now() });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createQueryError('QUERY_TIMEOUT', 'Timeout de 30 segundos al consultar Ollama.', 0));
    }
    return err(createQueryError('NETWORK_ERROR', 'Error de red al consultar Ollama.', 0));
  }
}

/**
 * @description Checks Ollama availability at localhost:11434 with 5 second timeout.
 * @returns True if Ollama is reachable, false otherwise
 */
export async function checkAvailability(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT);

    const response = await fetch(`${DEFAULT_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description Ollama local provider implementing IIAProvider.
 * Does NOT require internet connectivity. Connects to local Ollama instance.
 */
export const ollamaProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
  providerId: PROVIDER_ID,
  requiresInternet: false,
  testConnection,
  sendQuery,
  _activeConfig: null,
};
