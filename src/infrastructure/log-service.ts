import type { LogEntry, LogFilter } from '../types/session';

/**
 * @description In-memory log service that records errors, warnings, and security events.
 * Provides filtering capabilities for UI display and debugging.
 * Implements ILogService interface from the design specification.
 */
export class LogService {
  private logs: LogEntry[] = [];

  /**
   * @description Registers an error with ISO timestamp, module name, and stack trace.
   * @param module - The module that originated the error (e.g., 'carga', 'seguridad')
   * @param error - The Error object containing message and stack trace
   * @param context - Optional additional context for debugging
   * @returns void
   */
  logError(module: string, error: Error, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      module,
      level: 'error',
      message: error.message,
      stackTrace: error.stack,
      context,
    };
    this.logs.push(entry);
  }

  /**
   * @description Registers a security event (XSS attempt, CSP violation, etc.).
   * @param type - The type of security event (e.g., 'XSS_DETECTED', 'CSP_VIOLATION')
   * @param details - Human-readable description of what was detected
   * @returns void
   */
  logSecurityEvent(type: string, details: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      module: 'seguridad',
      level: 'security',
      message: `[${type}] ${details}`,
    };
    this.logs.push(entry);
  }

  /**
   * @description Retrieves log entries with optional filtering by module, level, time, and limit.
   * @param filter - Optional filter criteria for narrowing results
   * @returns Array of LogEntry matching the filter criteria
   */
  getLogs(filter?: LogFilter): LogEntry[] {
    let result = [...this.logs];

    if (!filter) {
      return result;
    }

    if (filter.module) {
      result = result.filter((log) => log.module === filter.module);
    }

    if (filter.level) {
      result = result.filter((log) => log.level === filter.level);
    }

    if (filter.since) {
      const sinceDate = new Date(filter.since).getTime();
      result = result.filter(
        (log) => new Date(log.timestamp).getTime() >= sinceDate
      );
    }

    if (filter.limit !== undefined && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }

    return result;
  }
}
