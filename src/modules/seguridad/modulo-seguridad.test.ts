import { describe, it, expect } from 'vitest';
import {
  sanitizeInput,
  detectInjection,
  encrypt,
  decrypt,
  validateFileUpload,
  getCSPHeaders,
} from './modulo-seguridad';

// ─── sanitizeInput ───────────────────────────────────────────────────────────

describe('sanitizeInput', () => {
  it('preserves safe alphanumeric text and spaces', () => {
    const input = 'Hello World 123';
    expect(sanitizeInput(input)).toBe('Hello World 123');
  });

  it('escapes HTML special characters', () => {
    expect(sanitizeInput('<div>')).toBe('&lt;div&gt;');
    expect(sanitizeInput('a & b')).toBe('a &amp; b');
    expect(sanitizeInput('"quoted"')).toBe('&quot;quoted&quot;');
    expect(sanitizeInput("it's")).toBe("it&#x27;s");
  });

  it('removes script tags and their content', () => {
    const input = 'before<script>alert("xss")</script>after';
    const result = sanitizeInput(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('removes orphaned script tags', () => {
    expect(sanitizeInput('<script>')).not.toContain('<script');
    expect(sanitizeInput('</script>')).not.toContain('</script');
  });

  it('neutralizes event handlers', () => {
    const input = '<img onerror="alert(1)" src="x">';
    const result = sanitizeInput(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('neutralizes onclick event handler', () => {
    const input = '<div onclick="malicious()">text</div>';
    const result = sanitizeInput(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('malicious');
  });

  it('handles empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('handles case-insensitive script tags', () => {
    const input = '<SCRIPT>bad()</SCRIPT>';
    const result = sanitizeInput(input);
    expect(result).not.toContain('SCRIPT');
    expect(result).not.toContain('bad');
  });
});

// ─── detectInjection ─────────────────────────────────────────────────────────

describe('detectInjection', () => {
  it('detects <script> tags', () => {
    expect(detectInjection('<script>alert(1)</script>')).toBe(true);
    expect(detectInjection('<SCRIPT src="evil.js">')).toBe(true);
  });

  it('detects event handlers', () => {
    expect(detectInjection('onerror=alert(1)')).toBe(true);
    expect(detectInjection('onclick = func()')).toBe(true);
    expect(detectInjection('onload="bad"')).toBe(true);
  });

  it('detects javascript: URIs', () => {
    expect(detectInjection('javascript:alert(1)')).toBe(true);
    expect(detectInjection('JAVASCRIPT:void(0)')).toBe(true);
    expect(detectInjection('javascript :alert(1)')).toBe(true);
  });

  it('returns false for safe text', () => {
    expect(detectInjection('Hello World')).toBe(false);
    expect(detectInjection('This is normal text.')).toBe(false);
    expect(detectInjection('123 numbers and spaces')).toBe(false);
    expect(detectInjection('email@example.com')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(detectInjection('')).toBe(false);
  });

  it('detects closing script tag alone', () => {
    expect(detectInjection('</script>')).toBe(true);
  });
});

// ─── encrypt and decrypt ─────────────────────────────────────────────────────

describe('encrypt/decrypt', () => {
  it('round-trips a simple string', async () => {
    const original = 'my-secret-api-key-12345';
    const payload = await encrypt(original);

    expect(payload.ciphertext).toBeTruthy();
    expect(payload.iv).toBeTruthy();
    expect(payload.tag).toBeTruthy();

    const result = await decrypt(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(original);
    }
  });

  it('round-trips an empty string', async () => {
    const original = '';
    const payload = await encrypt(original);
    const result = await decrypt(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(original);
    }
  });

  it('round-trips unicode text', async () => {
    const original = '¡Hola Mundo! 🔐🛡️';
    const payload = await encrypt(original);
    const result = await decrypt(payload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(original);
    }
  });

  it('fails decryption with tampered ciphertext', async () => {
    const payload = await encrypt('test-data');
    // Tamper with the ciphertext
    const bytes = Uint8Array.from(atob(payload.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] = (bytes[0]! ^ 0xff);
    const tamperedCiphertext = btoa(String.fromCharCode(...bytes));

    const result = await decrypt({ ...payload, ciphertext: tamperedCiphertext });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTEGRITY_CHECK_FAILED');
      expect(result.error.module).toBe('seguridad');
    }
  });

  it('fails decryption with tampered tag', async () => {
    const payload = await encrypt('sensitive-data');
    // Tamper with the auth tag
    const bytes = Uint8Array.from(atob(payload.tag), (c) => c.charCodeAt(0));
    bytes[0] = (bytes[0]! ^ 0xff);
    const tamperedTag = btoa(String.fromCharCode(...bytes));

    const result = await decrypt({ ...payload, tag: tamperedTag });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTEGRITY_CHECK_FAILED');
    }
  });

  it('produces different ciphertexts for the same input (unique IV)', async () => {
    const data = 'same-input';
    const payload1 = await encrypt(data);
    const payload2 = await encrypt(data);
    // Different IVs mean different ciphertexts
    expect(payload1.iv).not.toBe(payload2.iv);
    expect(payload1.ciphertext).not.toBe(payload2.ciphertext);
  });
});

// ─── validateFileUpload ──────────────────────────────────────────────────────

describe('validateFileUpload', () => {
  function makeFile(name: string, size: number, type: string): File {
    const content = new Uint8Array(Math.min(size, 100));
    const blob = new Blob([content], { type });
    return new File([blob], name, { type });
  }

  it('accepts a valid .xlsx file', () => {
    const file = makeFile(
      'data.xlsx',
      1024,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid .xls file', () => {
    const file = makeFile('data.xls', 2048, 'application/vnd.ms-excel');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid .csv file with text/csv', () => {
    const file = makeFile('data.csv', 512, 'text/csv');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid .csv file with text/plain', () => {
    const file = makeFile('data.csv', 512, 'text/plain');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });

  it('rejects a file that is too large (> 50 MB)', () => {
    // Create a file object and override its size property
    const content = new Uint8Array(100);
    const blob = new Blob([content], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const file = new File([blob], 'large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    // Override size since we cannot create a 51MB blob in test
    Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });
    const result = validateFileUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_TOO_LARGE');
      expect(result.error.module).toBe('seguridad');
    }
  });

  it('rejects a file with invalid extension', () => {
    const file = makeFile('malware.exe', 1024, 'application/octet-stream');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_EXTENSION');
    }
  });

  it('rejects a file with mismatched MIME type', () => {
    const file = makeFile('fake.xlsx', 1024, 'text/html');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MIME_MISMATCH');
    }
  });

  it('accepts a file with empty MIME type (browser may not set it)', () => {
    const file = makeFile('data.csv', 1024, '');
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });

  it('accepts exactly 50 MB file', () => {
    const content = new Uint8Array(100);
    const blob = new Blob([content], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const file = new File([blob], 'exact.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    Object.defineProperty(file, 'size', { value: 50 * 1024 * 1024 });
    const result = validateFileUpload(file);
    expect(result.ok).toBe(true);
  });
});

// ─── getCSPHeaders ───────────────────────────────────────────────────────────

describe('getCSPHeaders', () => {
  it('includes script-src self without unsafe-inline or unsafe-eval in script-src', () => {
    const headers = getCSPHeaders();
    expect(headers).toContain("script-src 'self'");
    // script-src should not contain unsafe-inline or unsafe-eval
    // (style-src may have unsafe-inline, that's expected)
    expect(headers).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers).not.toContain("script-src 'self' 'unsafe-eval'");
    expect(headers).not.toContain('unsafe-eval');
  });

  it('restricts object-src to none', () => {
    const headers = getCSPHeaders();
    expect(headers).toContain("object-src 'none'");
  });

  it('restricts default-src to self', () => {
    const headers = getCSPHeaders();
    expect(headers).toContain("default-src 'self'");
  });

  it('returns a non-empty string', () => {
    expect(getCSPHeaders().length).toBeGreaterThan(0);
  });
});
