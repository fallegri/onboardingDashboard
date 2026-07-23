/**
 * @description Barrel export for the Módulo_Seguridad.
 * Provides XSS sanitization, encryption/decryption, file validation,
 * injection detection, and Content Security Policy header generation.
 */
export {
  moduloSeguridad,
  sanitizeInput,
  encrypt,
  decrypt,
  validateFileUpload,
  getCSPHeaders,
  detectInjection,
} from './modulo-seguridad';

export type { IModuloSeguridad } from './modulo-seguridad';
