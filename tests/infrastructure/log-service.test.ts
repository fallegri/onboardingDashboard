import { describe, it, expect, beforeEach } from 'vitest';
import { LogService } from '../../src/infrastructure/log-service';

describe('LogService', () => {
  let service: LogService;

  beforeEach(() => {
    service = new LogService();
  });

  describe('logError', () => {
    it('should record an error with timestamp, module, and stack trace', () => {
      const error = new Error('Something went wrong');
      service.logError('carga', error);

      const logs = service.getLogs();
      expect(logs).toHaveLength(1);
      const entry = logs[0]!;
      expect(entry.level).toBe('error');
      expect(entry.module).toBe('carga');
      expect(entry.message).toBe('Something went wrong');
      expect(entry.stackTrace).toBeDefined();
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });

    it('should include optional context in the log entry', () => {
      const error = new Error('Parsing failed');
      const context = { fileName: 'data.csv', lineNumber: 42 };
      service.logError('deteccion', error, context);

      const logs = service.getLogs();
      expect(logs[0]!.context).toEqual(context);
    });

    it('should accumulate multiple error logs', () => {
      service.logError('carga', new Error('Error 1'));
      service.logError('prism', new Error('Error 2'));
      service.logError('seguridad', new Error('Error 3'));

      expect(service.getLogs()).toHaveLength(3);
    });
  });

  describe('logSecurityEvent', () => {
    it('should record a security event with type and details', () => {
      service.logSecurityEvent('XSS_DETECTED', 'Script tag found in input');

      const logs = service.getLogs();
      expect(logs).toHaveLength(1);
      const entry = logs[0]!;
      expect(entry.level).toBe('security');
      expect(entry.module).toBe('seguridad');
      expect(entry.message).toBe(
        '[XSS_DETECTED] Script tag found in input'
      );
      expect(entry.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      service.logError('carga', new Error('File read error'));
      service.logSecurityEvent('CSP_VIOLATION', 'Inline script blocked');
      service.logError('prism', new Error('Calculation failed'));
    });

    it('should return all logs when no filter is provided', () => {
      expect(service.getLogs()).toHaveLength(3);
    });

    it('should filter by module', () => {
      const logs = service.getLogs({ module: 'carga' });
      expect(logs).toHaveLength(1);
      expect(logs[0]!.module).toBe('carga');
    });

    it('should filter by level', () => {
      const logs = service.getLogs({ level: 'security' });
      expect(logs).toHaveLength(1);
      expect(logs[0]!.level).toBe('security');
    });

    it('should filter by since timestamp', () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      const logs = service.getLogs({ since: pastDate });
      expect(logs).toHaveLength(3);

      const futureDate = new Date(Date.now() + 60000).toISOString();
      const futureLogs = service.getLogs({ since: futureDate });
      expect(futureLogs).toHaveLength(0);
    });

    it('should limit results to the most recent entries', () => {
      const logs = service.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
      expect(logs[0]!.module).toBe('seguridad');
      expect(logs[1]!.module).toBe('prism');
    });

    it('should combine multiple filter criteria', () => {
      const logs = service.getLogs({ module: 'carga', level: 'error' });
      expect(logs).toHaveLength(1);
      expect(logs[0]!.module).toBe('carga');
      expect(logs[0]!.level).toBe('error');
    });

    it('should return empty array when no logs match', () => {
      const logs = service.getLogs({ module: 'nonexistent' });
      expect(logs).toHaveLength(0);
    });
  });
});
