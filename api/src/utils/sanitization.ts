/**
 * Input Sanitization Utilities
 * Provides functions to sanitize and validate user inputs
 * Requirements: 3.7
 * Following SOLID principles: Single Responsibility
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { ValidationError } from '../types/errors';

/**
 * Sanitize string input by removing potentially dangerous characters
 * Prevents XSS and injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, 10000); // Limit length
}

/**
 * Sanitize HTML by escaping special characters
 */
export function escapeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Sanitize file name to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
  if (typeof fileName !== 'string') {
    throw new ValidationError('File name must be a string');
  }

  // Remove path separators and parent directory references
  let sanitized = fileName.replace(/\.\./g, '').replace(/[/\\]/g, '').trim();

  // Replace potentially problematic characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Ensure file name is not empty
  if (sanitized.length === 0) {
    throw new ValidationError('File name cannot be empty after sanitization');
  }

  // Limit length
  if (sanitized.length > 255) {
    const extension = sanitized.substring(sanitized.lastIndexOf('.'));
    sanitized = sanitized.substring(0, 255 - extension.length) + extension;
  }

  return sanitized;
}

/**
 * Validate and sanitize email address
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string');
  }

  const sanitized = email.trim().toLowerCase();

  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format');
  }

  return sanitized;
}

/**
 * Validate and sanitize UUID
 */
export function sanitizeUuid(uuid: string): string {
  if (typeof uuid !== 'string') {
    throw new ValidationError('UUID must be a string');
  }

  const sanitized = uuid.trim().toLowerCase();

  // UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  if (!uuidRegex.test(sanitized)) {
    throw new ValidationError('Invalid UUID format');
  }

  return sanitized;
}

/**
 * Sanitize integer input
 */
export function sanitizeInteger(input: any, options?: { min?: number; max?: number }): number {
  const num = parseInt(input, 10);

  if (isNaN(num)) {
    throw new ValidationError('Invalid integer value');
  }

  if (options?.min !== undefined && num < options.min) {
    throw new ValidationError(`Value must be at least ${options.min}`);
  }

  if (options?.max !== undefined && num > options.max) {
    throw new ValidationError(`Value must be at most ${options.max}`);
  }

  return num;
}

/**
 * Sanitize object by removing null/undefined values and limiting depth
 */
export function sanitizeObject(
  obj: any,
  maxDepth: number = 5,
  currentDepth: number = 0
): Record<string, any> {
  if (currentDepth >= maxDepth) {
    return {};
  }

  if (typeof obj !== 'object' || obj === null) {
    return {};
  }

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    // Sanitize key
    const sanitizedKey = sanitizeString(key);

    if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeObject(value, maxDepth, currentDepth + 1);
    } else if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value
        .slice(0, 100) // Limit array size
        .map((item) =>
          typeof item === 'object' ? sanitizeObject(item, maxDepth, currentDepth + 1) : item
        );
    } else if (typeof value === 'string') {
      sanitized[sanitizedKey] = sanitizeString(value);
    } else {
      sanitized[sanitizedKey] = value;
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string, allowedProtocols: string[] = ['http', 'https']): string {
  if (typeof url !== 'string') {
    throw new ValidationError('URL must be a string');
  }

  const sanitized = url.trim();

  try {
    const urlObj = new URL(sanitized);

    // Check protocol
    const protocol = urlObj.protocol.replace(':', '');
    if (!allowedProtocols.includes(protocol)) {
      throw new ValidationError(`Protocol ${protocol} is not allowed`);
    }

    return urlObj.toString();
  } catch (error) {
    throw new ValidationError('Invalid URL format');
  }
}

/**
 * Remove SQL injection patterns from input
 * Note: This is a defense-in-depth measure. Always use prepared statements!
 */
export function sanitizeSqlInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove common SQL injection patterns
  return input
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove block comment start
    .replace(/\*\//g, '') // Remove block comment end
    .replace(/\bOR\b/gi, '') // Remove OR keyword
    .replace(/\bAND\b/gi, '') // Remove AND keyword
    .replace(/\bUNION\b/gi, '') // Remove UNION keyword
    .replace(/\bSELECT\b/gi, '') // Remove SELECT keyword
    .replace(/\bDROP\b/gi, '') // Remove DROP keyword
    .replace(/\bDELETE\b/gi, '') // Remove DELETE keyword
    .replace(/\bINSERT\b/gi, '') // Remove INSERT keyword
    .replace(/\bUPDATE\b/gi, ''); // Remove UPDATE keyword
}

/**
 * Validate pagination parameters
 */
export function sanitizePaginationParams(params: { page?: any; limit?: any }): {
  page: number;
  limit: number;
} {
  const page = sanitizeInteger(params.page || 1, { min: 1, max: 10000 });
  const limit = sanitizeInteger(params.limit || 20, { min: 1, max: 100 });

  return { page, limit };
}
