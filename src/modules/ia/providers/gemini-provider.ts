import type { Result } from '../../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../types/session';
import type { IAConfigError, IAQueryError } from '../../../types/errors';
import type { IIAProvider } from './ia-provider.interface';
import { ok, err } from '../../../types/result';
import { buildMetadataPayload } from '../motor-ia';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROVIDER_ID = 'gemini';
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const CONNECTION_TIMEOUT = 10_000;
const QUERY_TIMEOUT = 30_000;

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Creates an IAConfigError for the Gemini provider.
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
 * @description Creates an IAQueryError for the Gemini provider.
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
 * @description Tests connection to Google Gemini API with the given configuration.
 * @param config - Provider configuration with API key and model
 * @returns Result void on success, IAConfigError on failure
 */
async function testConnection(config: IAProviderConfig): Promise<Result<void, IAConfigError>> {
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

    const response = await fetch(`${baseUrl}/models?key=${config.apiKey}`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401 || response.status === 403) {
      return err(createConfigError('INVALID_API_KEY', 'La API key de Gemini es inválida.'));
    }

    if (!response.ok) {
      return err(createConfigError('PROVIDER_UNREACHABLE', `Gemini respondió con status ${response.status}.`));
    }

    return ok(undefined);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createConfigError('CONFIG_TIMEOUT', 'Timeout de 10 segundos al conectar con Gemini.'));
    }
    return err(createConfigError('PROVIDER_UNREACHABLE', 'No se pudo conectar con Gemini.'));
  }
}

/**
 * @description Sends a query to Google Gemini using only dataset metadata.
 * @param prompt - The user's question
 * @param metadata - Dataset metadata (no individual records)
 * @returns Result with IAResponse or IAQueryError
 */
async function sendQuery(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>> {
  const config = geminiProvider._activeConfig;
  if (!config) {
    return err(createQueryError('PROVIDER_ERROR', 'Gemini no está configurado.', 0));
  }

  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const metadataPayload = buildMetadataPayload(metadata);

  const body = JSON.stringify({
    contents: [{
      parts: [{ text: `Metadatos del dataset:\n${metadataPayload}\n\nConsulta: ${prompt}` }],
    }],
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT);

    const response = await fetch(
      `${baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return err(createQueryError('PROVIDER_ERROR', `Gemini respondió con status ${response.status}.`, 0));
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return ok({ content, providerId: PROVIDER_ID, timestamp: Date.now() });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return err(createQueryError('QUERY_TIMEOUT', 'Timeout de 30 segundos al consultar Gemini.', 0));
    }
    return err(createQueryError('NETWORK_ERROR', 'Error de red al consultar Gemini.', 0));
  }
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description Google Gemini provider implementing IIAProvider.
 * Requires internet connectivity. Sends queries to Gemini's generateContent API.
 */
export const geminiProvider: IIAProvider & { _activeConfig: IAProviderConfig | null } = {
  providerId: PROVIDER_ID,
  requiresInternet: true,
  testConnection,
  sendQuery,
  _activeConfig: null,
};
