import type { Result } from '../../../types/result';
import type { IAProviderConfig, DatasetMetadata, IAResponse } from '../../../types/session';
import type { IAConfigError, IAQueryError } from '../../../types/errors';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface that each IA provider must implement.
 * Provides a common contract for testing connections and sending queries.
 */
export interface IIAProvider {
  /** Unique identifier for this provider */
  readonly providerId: string;

  /** Whether this provider requires internet connectivity */
  readonly requiresInternet: boolean;

  /**
   * @description Tests the connection to the provider with the given config.
   * @param config - The provider configuration including API key
   * @returns Result void on success or IAConfigError on failure
   */
  testConnection(config: IAProviderConfig): Promise<Result<void, IAConfigError>>;

  /**
   * @description Sends a query to the provider with dataset metadata only.
   * @param prompt - The user's question or request
   * @param metadata - Dataset metadata (column names, types, row count, statistics)
   * @returns Result containing the IAResponse or IAQueryError
   */
  sendQuery(prompt: string, metadata: DatasetMetadata): Promise<Result<IAResponse, IAQueryError>>;
}
