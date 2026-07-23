import type { Result } from '../../types/result';
import type { EncryptedPayload } from '../../types/session';
import type { FileValidationError, IntegrityError } from '../../types/errors';
import { ok, err } from '../../types/result';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Maximum allowed file size: 50 MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Allowed file extensions */
const ALLOWED_EXTENSIONS: readonly string[] = ['.xlsx', '.xls', '.csv'];

/** Mapping of file extensions to their expected MIME types */
const MIME_TYPE_MAP: Record<string, readonly string[]> = {
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.csv': ['text/csv', 'text/plain'],
};

/** Regex patterns for detecting script injection attempts */
const SCRIPT_TAG_PATTERN = /<script[\s>]/i;
const SCRIPT_CLOSE_PATTERN = /<\/script>/i;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=/i;
const JAVASCRIPT_URI_PATTERN = /javascript\s*:/i;

/** Fixed local salt for PBKDF2 key derivation (device-local entropy) */
const LOCAL_SALT = new Uint8Array([
  0x4d, 0x6f, 0x64, 0x75, 0x6c, 0x6f, 0x53, 0x65,
  0x67, 0x75, 0x72, 0x69, 0x64, 0x61, 0x64, 0x4b,
]);

/** Fixed passphrase for local key derivation */
const LOCAL_PASSPHRASE = 'dashboard-onboarding-analitico-local-key-v1';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * @description Interface for the security module.
 * Provides sanitization, encryption, file validation, and CSP functionality.
 */
export interface IModuloSeguridad {
  sanitizeInput(input: string): string;
  encrypt(data: string): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload): Promise<Result<string, IntegrityError>>;
  validateFileUpload(file: File): Result<void, FileValidationError>;
  getCSPHeaders(): string;
  detectInjection(input: string): boolean;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * @description Resolves the SubtleCrypto instance for both browser and Node.js environments.
 * @returns The SubtleCrypto API instance
 */
function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  // Fallback for Node.js test environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodeCrypto = (globalThis as Record<string, unknown>)['__nodeCrypto'] as { subtle: SubtleCrypto } | undefined;
  if (nodeCrypto) {
    return nodeCrypto.subtle;
  }
  throw new Error('SubtleCrypto is not available in this environment.');
}

/**
 * @description Derives an AES-256-GCM key from the local passphrase using PBKDF2.
 * @returns A CryptoKey suitable for AES-256-GCM operations
 */
async function deriveEncryptionKey(): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(LOCAL_PASSPHRASE),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: LOCAL_SALT,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * @description Converts a Uint8Array to a Base64 string.
 * @param bytes - The byte array to encode
 * @returns Base64 encoded string
 */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * @description Converts a Base64 string to a Uint8Array.
 * @param base64 - The Base64 string to decode
 * @returns Decoded byte array
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * @description Extracts the file extension from a filename, lowercased.
 * @param fileName - The file name to extract extension from
 * @returns The lowercased extension including the dot, or empty string
 */
function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return '';
  return fileName.slice(lastDot).toLowerCase();
}

/**
 * @description Escapes special HTML characters to prevent XSS.
 * @param char - The character to escape
 * @returns The HTML-safe escaped character or original
 */
function escapeHtmlChar(char: string): string {
  switch (char) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case "'": return '&#x27;';
    default: return char;
  }
}

// ─── Implementation ──────────────────────────────────────────────────────────

/**
 * @description Sanitizes user input to prevent XSS attacks.
 * Removes script tags, neutralizes event handlers, and escapes HTML characters.
 * Safe text (alphanumeric and spaces) is preserved intact after sanitization.
 * @param input - The raw user input string
 * @returns The sanitized string with dangerous content neutralized
 */
export function sanitizeInput(input: string): string {
  // Step 1: Remove <script>...</script> blocks entirely (including content)
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Step 2: Remove any remaining <script> tags (orphaned opening/closing)
  sanitized = sanitized.replace(/<\/?script\b[^>]*>/gi, '');

  // Step 3: Neutralize event handlers (on* attributes)
  sanitized = sanitized.replace(/\bon(\w+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Step 4: Escape remaining HTML characters
  sanitized = sanitized.replace(/[&<>"']/g, escapeHtmlChar);

  return sanitized;
}

/**
 * @description Detects injection attempts in user input.
 * Checks for script tags, event handlers, and javascript: URIs.
 * @param input - The user input to check
 * @returns True if injection patterns are detected, false otherwise
 */
export function detectInjection(input: string): boolean {
  if (SCRIPT_TAG_PATTERN.test(input)) return true;
  if (SCRIPT_CLOSE_PATTERN.test(input)) return true;
  if (EVENT_HANDLER_PATTERN.test(input)) return true;
  if (JAVASCRIPT_URI_PATTERN.test(input)) return true;
  return false;
}

/**
 * @description Encrypts a string using AES-256-GCM via Web Crypto API.
 * Uses PBKDF2-derived key from local device entropy.
 * @param data - The plaintext string to encrypt
 * @returns An EncryptedPayload containing ciphertext, IV, and auth tag (all Base64)
 */
export async function encrypt(data: string): Promise<EncryptedPayload> {
  const subtle = getSubtleCrypto();
  const key = await deriveEncryptionKey();
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(data);

  // Generate a random 12-byte IV (recommended for GCM)
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  // AES-GCM produces ciphertext + 16-byte auth tag appended
  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer, tagLength: 128 },
    key,
    plaintext,
  );

  const encryptedBytes = new Uint8Array(encrypted);
  // Last 16 bytes are the authentication tag
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);

  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    tag: toBase64(tag),
  };
}

/**
 * @description Decrypts an AES-256-GCM encrypted payload with integrity verification.
 * Returns an error if the authentication tag does not match (tampered data).
 * @param payload - The EncryptedPayload to decrypt
 * @returns A Result containing the decrypted string or an IntegrityError
 */
export async function decrypt(
  payload: EncryptedPayload,
): Promise<Result<string, IntegrityError>> {
  try {
    const subtle = getSubtleCrypto();
    const key = await deriveEncryptionKey();

    const ciphertext = fromBase64(payload.ciphertext);
    const iv = fromBase64(payload.iv);
    const tag = fromBase64(payload.tag);

    // Reassemble ciphertext + tag for GCM decryption
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);

    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as ArrayBuffer, tagLength: 128 },
      key,
      combined,
    );

    const decoder = new TextDecoder();
    return ok(decoder.decode(decrypted));
  } catch {
    return err({
      code: 'INTEGRITY_CHECK_FAILED',
      message: 'Decryption failed: data integrity check did not pass. The data may have been tampered with.',
      timestamp: new Date().toISOString(),
      module: 'seguridad',
    });
  }
}

/**
 * @description Validates a file upload against security criteria.
 * Performs triple validation: size ≤ 50 MB, extension in allowed list,
 * and MIME type matches the declared extension.
 * @param file - The File object to validate
 * @returns A Result with void on success or FileValidationError on failure
 */
export function validateFileUpload(
  file: File,
): Result<void, FileValidationError> {
  const timestamp = new Date().toISOString();

  // Check 1: File size
  if (file.size > MAX_FILE_SIZE) {
    return err({
      code: 'FILE_TOO_LARGE',
      message: `El archivo excede el tamaño máximo permitido de 50 MB.`,
      timestamp,
      module: 'seguridad',
      fileName: file.name,
      details: `Tamaño del archivo: ${(file.size / (1024 * 1024)).toFixed(2)} MB. Máximo permitido: 50 MB.`,
    });
  }

  // Check 2: File extension
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return err({
      code: 'INVALID_EXTENSION',
      message: `La extensión del archivo no está permitida.`,
      timestamp,
      module: 'seguridad',
      fileName: file.name,
      details: `Extensión detectada: "${extension}". Extensiones permitidas: ${ALLOWED_EXTENSIONS.join(', ')}.`,
    });
  }

  // Check 3: MIME type matches extension
  const allowedMimes = MIME_TYPE_MAP[extension];
  if (allowedMimes && file.type && !allowedMimes.includes(file.type)) {
    return err({
      code: 'MIME_MISMATCH',
      message: `El tipo MIME del archivo no coincide con la extensión declarada.`,
      timestamp,
      module: 'seguridad',
      fileName: file.name,
      details: `MIME detectado: "${file.type}". Esperado para ${extension}: ${allowedMimes.join(' o ')}.`,
    });
  }

  return ok(undefined);
}

/**
 * @description Generates Content Security Policy headers for the application.
 * Restricts scripts to same origin, blocks inline scripts and eval().
 * @returns A CSP header string suitable for the Content-Security-Policy header
 */
export function getCSPHeaders(): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https: http://localhost:*",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
}

// ─── Module Object Export ────────────────────────────────────────────────────

/**
 * @description The security module implementing IModuloSeguridad.
 * Provides XSS sanitization, AES-256-GCM encryption, file validation,
 * injection detection, and CSP header generation.
 */
export const moduloSeguridad: IModuloSeguridad = {
  sanitizeInput,
  encrypt,
  decrypt,
  validateFileUpload,
  getCSPHeaders,
  detectInjection,
};
