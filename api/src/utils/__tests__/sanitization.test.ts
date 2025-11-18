/**
 * Unit tests for Input Sanitization Utilities
 * Requirements: 3.7
 */

import {
  sanitizeString,
  escapeHtml,
  sanitizeFileName,
  sanitizeEmail,
  sanitizeUuid,
  sanitizeInteger,
  sanitizeObject,
  sanitizeUrl,
  sanitizeSqlInput,
  sanitizePaginationParams,
} from '../sanitization';
import { ValidationError } from '../../types/errors';

describe('Sanitization Utilities', () => {
  describe('sanitizeString', () => {
    it('should remove angle brackets', () => {
      const result = sanitizeString('Hello <script>alert("xss")</script> World');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });

    it('should remove javascript: protocol', () => {
      const result = sanitizeString('javascript:alert("xss")');
      expect(result.toLowerCase()).not.toContain('javascript:');
    });

    it('should remove event handlers', () => {
      const result = sanitizeString('text onclick=alert(1)');
      expect(result.toLowerCase()).not.toMatch(/on\w+\s*=/);
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  hello world  ');
      expect(result).toBe('hello world');
    });

    it('should limit length to 10000 characters', () => {
      const longString = 'a'.repeat(15000);
      const result = sanitizeString(longString);
      expect(result.length).toBe(10000);
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const result = escapeHtml('<div class="test">Hello & goodbye</div>');
      expect(result).toBe('&lt;div class=&quot;test&quot;&gt;Hello &amp; goodbye&lt;&#x2F;div&gt;');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"double"')).toContain('&quot;');
      expect(escapeHtml("'single'")).toContain('&#x27;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    it('should return empty string for non-string input', () => {
      expect(escapeHtml(123 as any)).toBe('');
    });
  });

  describe('sanitizeFileName', () => {
    it('should remove path traversal patterns', () => {
      const result = sanitizeFileName('../../../etc/passwd');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
    });

    it('should remove path separators', () => {
      const result = sanitizeFileName('path/to/file.txt');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('should replace problematic characters with underscores', () => {
      const result = sanitizeFileName('file name!@#$.txt');
      expect(result).toBe('file_name____.txt');
    });

    it('should preserve valid characters', () => {
      const result = sanitizeFileName('valid-file_name.123.txt');
      expect(result).toBe('valid-file_name.123.txt');
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeFileName(123 as any)).toThrow(ValidationError);
    });

    it('should throw error for empty result', () => {
      expect(() => sanitizeFileName('../../..')).toThrow(ValidationError);
    });

    it('should limit filename length to 255 characters', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = sanitizeFileName(longName);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('sanitizeEmail', () => {
    it('should trim and lowercase email', () => {
      const result = sanitizeEmail('  User@Example.COM  ');
      expect(result).toBe('user@example.com');
    });

    it('should accept valid email formats', () => {
      expect(sanitizeEmail('user@example.com')).toBe('user@example.com');
      expect(sanitizeEmail('user.name@example.co.uk')).toBe('user.name@example.co.uk');
      expect(sanitizeEmail('user+tag@example.com')).toBe('user+tag@example.com');
    });

    it('should throw error for invalid email format', () => {
      expect(() => sanitizeEmail('invalid')).toThrow(ValidationError);
      expect(() => sanitizeEmail('invalid@')).toThrow(ValidationError);
      expect(() => sanitizeEmail('@example.com')).toThrow(ValidationError);
      expect(() => sanitizeEmail('user @example.com')).toThrow(ValidationError);
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeEmail(123 as any)).toThrow(ValidationError);
    });
  });

  describe('sanitizeUuid', () => {
    it('should accept valid UUID v4', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(sanitizeUuid(uuid)).toBe(uuid);
    });

    it('should trim and lowercase UUID', () => {
      const uuid = '  550E8400-E29B-41D4-A716-446655440000  ';
      expect(sanitizeUuid(uuid)).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw error for invalid UUID format', () => {
      expect(() => sanitizeUuid('invalid-uuid')).toThrow(ValidationError);
      expect(() => sanitizeUuid('123-456-789')).toThrow(ValidationError);
    });

    it('should throw error for non-v4 UUID', () => {
      // UUID v1 (note the '1' in the version position)
      expect(() => sanitizeUuid('550e8400-e29b-11d4-a716-446655440000')).toThrow(ValidationError);
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeUuid(123 as any)).toThrow(ValidationError);
    });
  });

  describe('sanitizeInteger', () => {
    it('should parse valid integer', () => {
      expect(sanitizeInteger('42')).toBe(42);
      expect(sanitizeInteger(42)).toBe(42);
      expect(sanitizeInteger('-10')).toBe(-10);
    });

    it('should throw error for non-integer input', () => {
      expect(() => sanitizeInteger('abc')).toThrow(ValidationError);
      expect(() => sanitizeInteger('12.34')).not.toThrow();
      expect(sanitizeInteger('12.34')).toBe(12); // parseInt truncates
    });

    it('should enforce minimum value', () => {
      expect(() => sanitizeInteger(5, { min: 10 })).toThrow(ValidationError);
      expect(sanitizeInteger(10, { min: 10 })).toBe(10);
      expect(sanitizeInteger(15, { min: 10 })).toBe(15);
    });

    it('should enforce maximum value', () => {
      expect(() => sanitizeInteger(15, { max: 10 })).toThrow(ValidationError);
      expect(sanitizeInteger(10, { max: 10 })).toBe(10);
      expect(sanitizeInteger(5, { max: 10 })).toBe(5);
    });

    it('should enforce both min and max', () => {
      expect(sanitizeInteger(50, { min: 1, max: 100 })).toBe(50);
      expect(() => sanitizeInteger(0, { min: 1, max: 100 })).toThrow(ValidationError);
      expect(() => sanitizeInteger(101, { min: 1, max: 100 })).toThrow(ValidationError);
    });
  });

  describe('sanitizeObject', () => {
    it('should remove null and undefined values', () => {
      const obj = { a: 1, b: null, c: undefined, d: 'value' };
      const result = sanitizeObject(obj);
      expect(result).toEqual({ a: 1, d: 'value' });
    });

    it('should sanitize string values', () => {
      const obj = { script: '<script>alert(1)</script>' };
      const result = sanitizeObject(obj);
      expect(result.script).not.toContain('<');
    });

    it('should sanitize nested objects', () => {
      const obj = { outer: { inner: '<script>xss</script>' } };
      const result = sanitizeObject(obj);
      expect(result.outer.inner).not.toContain('<');
    });

    it('should limit array size to 100 items', () => {
      const obj = { array: Array(200).fill(1) };
      const result = sanitizeObject(obj);
      expect(result.array.length).toBe(100);
    });

    it('should limit nesting depth', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: { data: 'too deep' },
                },
              },
            },
          },
        },
      };
      const result = sanitizeObject(deepObject, 5);
      expect(result.level1.level2.level3.level4.level5).toEqual({});
    });

    it('should return empty object for non-object input', () => {
      expect(sanitizeObject('string' as any)).toEqual({});
      expect(sanitizeObject(null as any)).toEqual({});
      expect(sanitizeObject(123 as any)).toEqual({});
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTP URLs', () => {
      const url = 'http://example.com';
      expect(sanitizeUrl(url)).toBe(url + '/');
    });

    it('should accept valid HTTPS URLs', () => {
      const url = 'https://example.com';
      expect(sanitizeUrl(url)).toBe(url + '/');
    });

    it('should throw error for non-allowed protocols', () => {
      expect(() => sanitizeUrl('javascript:alert(1)')).toThrow(ValidationError);
      expect(() => sanitizeUrl('file:///etc/passwd')).toThrow(ValidationError);
      expect(() => sanitizeUrl('ftp://example.com')).toThrow(ValidationError);
    });

    it('should accept custom allowed protocols', () => {
      expect(() => sanitizeUrl('ftp://example.com', ['ftp'])).not.toThrow();
    });

    it('should throw error for invalid URL format', () => {
      expect(() => sanitizeUrl('not-a-url')).toThrow(ValidationError);
      expect(() => sanitizeUrl('htp://malformed')).toThrow(ValidationError);
    });

    it('should throw error for non-string input', () => {
      expect(() => sanitizeUrl(123 as any)).toThrow(ValidationError);
    });
  });

  describe('sanitizeSqlInput', () => {
    it('should remove SQL injection patterns', () => {
      const result = sanitizeSqlInput("'; DROP TABLE users; --");
      expect(result).not.toContain("'");
      expect(result).not.toContain(';');
      expect(result).not.toContain('--');
      expect(result.toUpperCase()).not.toContain('DROP');
    });

    it('should remove SQL keywords', () => {
      const input = 'SELECT * FROM users WHERE 1=1 OR 1=1';
      const result = sanitizeSqlInput(input);
      expect(result.toUpperCase()).not.toContain('SELECT');
      expect(result.toUpperCase()).not.toContain('OR');
      // Note: WHERE is not removed by sanitizeSqlInput - only major dangerous keywords
      expect(result).toContain('1=1');
    });

    it('should remove SQL comments', () => {
      const result = sanitizeSqlInput('value -- comment');
      expect(result).not.toContain('--');
    });

    it('should remove block comments', () => {
      const result = sanitizeSqlInput('value /* comment */');
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
    });

    it('should return empty string for non-string input', () => {
      expect(sanitizeSqlInput(123 as any)).toBe('');
    });
  });

  describe('sanitizePaginationParams', () => {
    it('should use default values when not provided', () => {
      const result = sanitizePaginationParams({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should parse valid page and limit', () => {
      const result = sanitizePaginationParams({ page: '5', limit: '50' });
      expect(result).toEqual({ page: 5, limit: 50 });
    });

    it('should enforce minimum values', () => {
      expect(() => sanitizePaginationParams({ page: '0' })).toThrow(ValidationError);
      expect(() => sanitizePaginationParams({ limit: '0' })).toThrow(ValidationError);
    });

    it('should enforce maximum page value', () => {
      expect(() => sanitizePaginationParams({ page: '10001' })).toThrow(ValidationError);
    });

    it('should enforce maximum limit value', () => {
      expect(() => sanitizePaginationParams({ limit: '101' })).toThrow(ValidationError);
    });

    it('should handle numeric inputs', () => {
      const result = sanitizePaginationParams({ page: 2, limit: 30 });
      expect(result).toEqual({ page: 2, limit: 30 });
    });
  });
});
