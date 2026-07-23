import type { Result } from '../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../types/session';
import type { IAConfigError, IAQueryError } from '../../types/errors';
import type { IIAProvider } from './providers/ia-provider.interface';
import { ok, err } from '../../types/result';
import { moduloSeguridad } from '../seguridad/modulo-seguridad';
import { checkAvailability as checkOllamaAvailabilityFn } from './providers/ollama-provider';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Delay before retry in milliseconds */
const RETRY_DELAY = 2_000;

/** Maximum retries for a query */
const MAX_RETRIES = 1;

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the IA motor module.
 * Manages IA provider configuration, queries, switching, and availability checks.
 */
export interface IMotorIA {
  configureProvider(config: IAProviderConfig): Promise<Result<void, IAConfigError>>;
  query(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>>;
  switchProvider(providerId: string): Result<void, IAConfigError>;
  checkOllamaAvailability(): Promise<boolean>;
  getAvailableProviders(isOnline: boolean): IAProviderConfig[];
}

// ─── Module State ────────────────────────────────────────────────────────────

/** Registry of available IA providers */
let providers: Map<string, IIAProvider> = new Map();

/** Configured provider configs (with encrypted API keys stored) */
let configuredProviders: IAProviderConfig[] = [];

/** Currently active provider ID */
let activeProviderId: string | null = null;

/** Query history preserved across provider switches */
let queryHistory: IAResponse[] = [];

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Creates an IAConfigError with the given code and message.
 * @param code - The error code
 * @param message - Human-readable error message
 * @param providerId - The provider that caused the error
 * @returns An IAConfigError object
 */
function createConfigError(
  code: IAConfigError['code'],
  message: string,
  providerId: string,
): IAConfigError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'ia',
    providerId,
  };
}

/**
 * @description Creates an IAQueryError with the given code and message.
 * @param code - The error code
 * @param message - Human-readable error message
 * @param providerId - The provider that failed
 * @param retryCount - Number of retries attempted
 * @returns An IAQueryError object
 */
function createQueryError(
  code: IAQueryError['code'],
  message: string,
  providerId: string,
  retryCount: number,
): IAQueryError {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
    module: 'ia',
    providerId,
    retryCount,
  };
}

/**
 * @description Waits for a specified duration in milliseconds.
 * @param ms - Milliseconds to wait
 * @returns A promise that resolves after the delay
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Public Utility ──────────────────────────────────────────────────────────

/**
 * @description Builds a metadata-only payload string from DatasetMetadata.
 * Ensures no individual record values are included in the payload.
 * @param metadata - The dataset metadata to serialize
 * @returns A formatted string containing only metadata information
 */
export function buildMetadataPayload(metadata: DatasetMetadata): string {
  const lines: string[] = [
    `Columnas: ${metadata.columnNames.join(', ')}`,
    `Tipos: ${metadata.columnTypes.join(', ')}`,
    `Filas: ${metadata.rowCount}`,
    '',
    'Estadísticas por columna:',
  ];

  for (const colName of metadata.columnNames) {
    const stats = metadata.statistics[colName];
    if (stats) {
      const parts: string[] = [`  ${colName}:`];
      if (stats.mean !== undefined) parts.push(`    media=${stats.mean}`);
      if (stats.median !== undefined) parts.push(`    mediana=${stats.median}`);
      if (stats.min !== undefined) parts.push(`    min=${stats.min}`);
      if (stats.max !== undefined) parts.push(`    max=${stats.max}`);
      if (stats.count !== undefined) parts.push(`    count=${stats.count}`);
      if (stats.nullCount !== undefined) parts.push(`    nulls=${stats.nullCount}`);
      if (stats.distinctCount !== undefined) parts.push(`    distintos=${stats.distinctCount}`);
      lines.push(parts.join('\n'));
    }
  }

  return lines.join('\n');
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

/**
 * @description Configures an IA provider with connectivity validation and API key encryption.
 * Timeout of 10 seconds for the test connection. Rejects invalid API keys without storing them.
 * @param config - The provider configuration including API key and model
 * @returns Result void on success, IAConfigError on failure
 */
export async function configureProvider(
  config: IAProviderConfig,
): Promise<Result<void, IAConfigError>> {
  const provider = providers.get(config.providerId);
  if (!provider) {
    return err(createConfigError(
      'PROVIDER_NOT_FOUND',
      `Proveedor "${config.providerId}" no está registrado.`,
      config.providerId,
    ));
  }

  // Test connection (provider handles its own 10 sec timeout)
  const connectionResult = await provider.testConnection(config);
  if (!connectionResult.ok) {
    // Invalid API key: do NOT store
    return connectionResult;
  }

  // Encrypt API key before storing via Módulo_Seguridad
  const encryptedPayload = await moduloSeguridad.encrypt(config.apiKey);
  const encryptedKey = JSON.stringify(encryptedPayload);

  // Store config with encrypted key reference
  const storedConfig: IAProviderConfig = {
    providerId: config.providerId,
    apiKey: encryptedKey,
    model: config.model,
    baseUrl: config.baseUrl,
  };

  // Update or add the provider config
  const existingIndex = configuredProviders.findIndex(
    (p) => p.providerId === config.providerId,
  );
  if (existingIndex >= 0) {
    configuredProviders[existingIndex] = storedConfig;
  } else {
    configuredProviders.push(storedConfig);
  }

  // Set provider's active config (with plain key for API calls)
  setProviderActiveConfig(provider, config);

  // Set as active provider if none is active
  if (!activeProviderId) {
    activeProviderId = config.providerId;
  }

  return ok(undefined);
}

/**
 * @description Sends a query to the active IA provider with metadata only.
 * Implements timeout of 30 seconds + 1 retry after 2 second delay.
 * @param prompt - The user's question or analysis request
 * @param metadata - Dataset metadata (column names, types, row count, statistics)
 * @returns Result containing IAResponse or IAQueryError
 */
export async function query(
  prompt: string,
  metadata: DatasetMetadata,
): Promise<Result<IAResponse, IAQueryError>> {
  if (!activeProviderId) {
    return err(createQueryError(
      'PROVIDER_ERROR',
      'No hay proveedor de IA activo configurado.',
      'none',
      0,
    ));
  }

  const provider = providers.get(activeProviderId);
  if (!provider) {
    return err(createQueryError(
      'PROVIDER_ERROR',
      `Proveedor "${activeProviderId}" no encontrado.`,
      activeProviderId,
      0,
    ));
  }

  // First attempt
  const firstResult = await provider.sendQuery(prompt, metadata);
  if (firstResult.ok) {
    queryHistory.push(firstResult.value);
    return firstResult;
  }

  // If timeout or network error, retry once after 2 second delay
  const retryableCodes: IAQueryError['code'][] = ['QUERY_TIMEOUT', 'NETWORK_ERROR'];
  if (retryableCodes.includes(firstResult.error.code)) {
    await delay(RETRY_DELAY);

    const retryResult = await provider.sendQuery(prompt, metadata);
    if (retryResult.ok) {
      queryHistory.push(retryResult.value);
      return retryResult;
    }

    // Both attempts failed
    return err(createQueryError(
      'RETRY_EXHAUSTED',
      `Fallo tras ${MAX_RETRIES} reintento(s): ${retryResult.error.message}`,
      activeProviderId,
      MAX_RETRIES,
    ));
  }

  // Non-retryable error (e.g., PROVIDER_ERROR)
  return firstResult;
}

/**
 * @description Switches the active IA provider, preserving query history.
 * @param providerId - The provider ID to switch to
 * @returns Result void on success, IAConfigError if provider not configured
 */
export function switchProvider(providerId: string): Result<void, IAConfigError> {
  const providerExists = providers.has(providerId);
  if (!providerExists) {
    return err(createConfigError(
      'PROVIDER_NOT_FOUND',
      `Proveedor "${providerId}" no está registrado.`,
      providerId,
    ));
  }

  const isConfigured = configuredProviders.some(
    (p) => p.providerId === providerId,
  );
  if (!isConfigured) {
    return err(createConfigError(
      'PROVIDER_NOT_FOUND',
      `Proveedor "${providerId}" no está configurado.`,
      providerId,
    ));
  }

  // Switch preserving history
  activeProviderId = providerId;
  return ok(undefined);
}

/**
 * @description Checks Ollama availability at localhost:11434 with 5 second timeout.
 * @returns True if Ollama is reachable, false otherwise
 */
export async function checkOllamaAvailability(): Promise<boolean> {
  return checkOllamaAvailabilityFn();
}

/**
 * @description Returns available providers filtered by connectivity status.
 * Disables cloud providers (requiresInternet=true) when offline.
 * @param isOnline - Whether the browser has internet connectivity
 * @returns Array of configured providers available given the connectivity state
 */
export function getAvailableProviders(isOnline: boolean): IAProviderConfig[] {
  if (isOnline) {
    return [...configuredProviders];
  }

  // Offline: return only providers that don't require internet
  return configuredProviders.filter((config) => {
    const provider = providers.get(config.providerId);
    return provider && !provider.requiresInternet;
  });
}

/**
 * @description Returns the current query history.
 * @returns Array of IAResponse from all queries in the session
 */
export function getQueryHistory(): IAResponse[] {
  return [...queryHistory];
}

/**
 * @description Returns the currently active provider ID.
 * @returns The active provider ID or null if none is set
 */
export function getActiveProviderId(): string | null {
  return activeProviderId;
}

// ─── Provider Registration ───────────────────────────────────────────────────

/**
 * @description Registers an IA provider implementation.
 * Used for dependency injection: allows registering mock or real providers.
 * @param provider - The IIAProvider implementation to register
 */
export function registerProvider(provider: IIAProvider): void {
  providers.set(provider.providerId, provider);
}

/**
 * @description Sets the active config on a provider implementation.
 * @param provider - The provider to configure
 * @param config - The provider configuration with plain API key
 */
function setProviderActiveConfig(provider: IIAProvider, config: IAProviderConfig): void {
  // Use type assertion to set _activeConfig on concrete providers
  const mutableProvider = provider as IIAProvider & { _activeConfig: IAProviderConfig | null };
  if ('_activeConfig' in mutableProvider) {
    mutableProvider._activeConfig = config;
  }
}

/**
 * @description Resets the module internal state. Used for testing.
 */
export function resetState(): void {
  providers = new Map();
  configuredProviders = [];
  activeProviderId = null;
  queryHistory = [];
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The IA motor module implementing IMotorIA.
 * Manages provider configuration, query execution with retry logic,
 * provider switching with history preservation, and connectivity checks.
 */
export const motorIA: IMotorIA = {
  configureProvider,
  query,
  switchProvider,
  checkOllamaAvailability,
  getAvailableProviders,
};
