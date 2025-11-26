/**
 * Multipart Form Data Parser for Lambda Functions
 * Parses multipart/form-data without external dependencies
 * Requirements: Enhanced file upload support
 * Following SOLID principles: Single Responsibility
 */

import { ValidationError } from '../types/errors';

/**
 * Parsed multipart field
 */
export interface MultipartField {
  name: string;
  value: string;
  contentType?: string;
}

/**
 * Parsed multipart file
 */
export interface MultipartFile {
  name: string;
  filename: string;
  contentType: string;
  data: Buffer;
  size: number;
}

/**
 * Parsed multipart form data
 */
export interface ParsedMultipartData {
  fields: Record<string, string>;
  files: MultipartFile[];
}

/**
 * Parse Content-Disposition header
 */
function parseContentDisposition(header: string): {
  name?: string;
  filename?: string;
} {
  const result: { name?: string; filename?: string } = {};

  // Match name="value" or name=value patterns
  const nameMatch = header.match(/name="?([^";\r\n]+)"?/);
  if (nameMatch) {
    result.name = nameMatch[1];
  }

  // Match filename="value" or filename=value patterns
  const filenameMatch = header.match(/filename="?([^";\r\n]+)"?/);
  if (filenameMatch) {
    result.filename = filenameMatch[1];
  }

  return result;
}

/**
 * Parse Content-Type header
 */
function parseContentType(header: string): string {
  const match = header.match(/^([^;\s]+)/);
  return match ? match[1].trim() : 'application/octet-stream';
}

/**
 * Extract boundary from Content-Type header
 */
export function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/);
  return match ? match[1] || match[2] : null;
}

/**
 * Parse multipart form data
 *
 * @param body - Raw body as Buffer or base64 string
 * @param boundary - Multipart boundary string
 * @returns Parsed fields and files
 *
 * @example
 * ```typescript
 * const boundary = extractBoundary(event.headers['content-type']);
 * const parsed = parseMultipartFormData(event.body, boundary);
 * ```
 */
export function parseMultipartFormData(
  body: Buffer | string,
  boundary: string
): ParsedMultipartData {
  if (!boundary) {
    throw new ValidationError('Missing boundary in multipart request');
  }

  // Convert to Buffer if needed
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body, 'base64');

  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  // Split by boundary
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = splitBuffer(buffer, boundaryBuffer);

  for (const part of parts) {
    if (part.length === 0 || part.toString().trim() === '--') {
      continue;
    }

    // Split headers and body by double CRLF
    const headerEndIndex = findSequence(part, Buffer.from('\r\n\r\n'));
    if (headerEndIndex === -1) {
      continue;
    }

    const headersBuffer = part.slice(0, headerEndIndex);
    const bodyBuffer = part.slice(headerEndIndex + 4);

    // Parse headers
    const headers = parseHeaders(headersBuffer.toString());

    // Get Content-Disposition
    const contentDisposition = headers['content-disposition'];
    if (!contentDisposition) {
      continue;
    }

    const { name, filename } = parseContentDisposition(contentDisposition);
    if (!name) {
      continue;
    }

    // If it has a filename, it's a file
    if (filename) {
      const contentType = headers['content-type']
        ? parseContentType(headers['content-type'])
        : 'application/octet-stream';

      // Remove trailing CRLF from body
      let fileData = bodyBuffer;
      if (
        fileData.length >= 2 &&
        fileData[fileData.length - 2] === 0x0d &&
        fileData[fileData.length - 1] === 0x0a
      ) {
        fileData = fileData.slice(0, -2);
      }

      files.push({
        name,
        filename,
        contentType,
        data: fileData,
        size: fileData.length,
      });
    } else {
      // It's a regular field
      let fieldValue = bodyBuffer.toString('utf-8');
      // Remove trailing CRLF
      if (fieldValue.endsWith('\r\n')) {
        fieldValue = fieldValue.slice(0, -2);
      }
      fields[name] = fieldValue;
    }
  }

  return { fields, files };
}

/**
 * Parse headers from buffer
 */
function parseHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = headerText.split('\r\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim().toLowerCase();
      const value = line.slice(colonIndex + 1).trim();
      headers[key] = value;
    }
  }

  return headers;
}

/**
 * Split buffer by delimiter
 */
function splitBuffer(buffer: Buffer, delimiter: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index = findSequence(buffer, delimiter, start);

  while (index !== -1) {
    parts.push(buffer.slice(start, index));
    start = index + delimiter.length;
    index = findSequence(buffer, delimiter, start);
  }

  // Add remaining part
  if (start < buffer.length) {
    parts.push(buffer.slice(start));
  }

  return parts;
}

/**
 * Find sequence in buffer (Boyer-Moore-like search)
 */
function findSequence(buffer: Buffer, sequence: Buffer, start = 0): number {
  if (sequence.length === 0) return -1;
  if (start + sequence.length > buffer.length) return -1;

  for (let i = start; i <= buffer.length - sequence.length; i++) {
    let found = true;
    for (let j = 0; j < sequence.length; j++) {
      if (buffer[i + j] !== sequence[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }

  return -1;
}

/**
 * Validate multipart request
 */
export function validateMultipartRequest(contentType?: string): {
  isValid: boolean;
  boundary?: string;
  error?: string;
} {
  if (!contentType) {
    return { isValid: false, error: 'Missing Content-Type header' };
  }

  if (!contentType.includes('multipart/form-data')) {
    return { isValid: false, error: 'Content-Type must be multipart/form-data' };
  }

  const boundary = extractBoundary(contentType);
  if (!boundary) {
    return { isValid: false, error: 'Missing boundary in Content-Type' };
  }

  return { isValid: true, boundary };
}
