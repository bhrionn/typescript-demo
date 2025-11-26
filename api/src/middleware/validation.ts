/**
 * Request Validation Middleware for Lambda Functions
 * Validates request body, query parameters, and headers
 * Requirements: Input validation and security
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { ValidationError } from '../types/errors';
import { createLogger } from './logging';

/**
 * Validation rule type
 */
export type ValidationRule<T = unknown> = (value: T) => boolean | string;

/**
 * Schema field definition
 */
export interface SchemaField {
  /**
   * Field type
   */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';

  /**
   * Whether the field is required
   */
  required?: boolean;

  /**
   * Minimum length (for strings) or value (for numbers)
   */
  min?: number;

  /**
   * Maximum length (for strings) or value (for numbers)
   */
  max?: number;

  /**
   * Pattern to match (for strings)
   */
  pattern?: RegExp;

  /**
   * Allowed values (enum)
   */
  enum?: unknown[];

  /**
   * Custom validation rules
   */
  rules?: ValidationRule[];

  /**
   * Nested schema (for objects)
   */
  schema?: ValidationSchema;

  /**
   * Item schema (for arrays)
   */
  items?: SchemaField;

  /**
   * Custom error message
   */
  message?: string;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  [key: string]: SchemaField;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Validate request body
   */
  body?: ValidationSchema;

  /**
   * Validate query parameters
   */
  query?: ValidationSchema;

  /**
   * Validate headers
   */
  headers?: ValidationSchema;

  /**
   * Allow additional fields not in schema
   */
  allowAdditional?: boolean;

  /**
   * Strip unknown fields
   */
  stripUnknown?: boolean;
}

/**
 * Validation result
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  value?: unknown;
}

/**
 * Validate value against schema field
 */
function validateField(
  fieldName: string,
  value: unknown,
  field: SchemaField
): { isValid: boolean; error?: string } {
  // Check required
  if (field.required && (value === undefined || value === null || value === '')) {
    return {
      isValid: false,
      error: field.message || `${fieldName} is required`,
    };
  }

  // Allow optional fields
  if (!field.required && (value === undefined || value === null)) {
    return { isValid: true };
  }

  // Type validation
  const actualType = Array.isArray(value) ? 'array' : typeof value;
  if (actualType !== field.type && value !== undefined && value !== null) {
    return {
      isValid: false,
      error: field.message || `${fieldName} must be of type ${field.type}`,
    };
  }

  // String validation
  if (field.type === 'string' && typeof value === 'string') {
    if (field.min !== undefined && value.length < field.min) {
      return {
        isValid: false,
        error: field.message || `${fieldName} must be at least ${field.min} characters`,
      };
    }

    if (field.max !== undefined && value.length > field.max) {
      return {
        isValid: false,
        error: field.message || `${fieldName} must be at most ${field.max} characters`,
      };
    }

    if (field.pattern && !field.pattern.test(value)) {
      return {
        isValid: false,
        error: field.message || `${fieldName} does not match required pattern`,
      };
    }
  }

  // Number validation
  if (field.type === 'number' && typeof value === 'number') {
    if (field.min !== undefined && value < field.min) {
      return {
        isValid: false,
        error: field.message || `${fieldName} must be at least ${field.min}`,
      };
    }

    if (field.max !== undefined && value > field.max) {
      return {
        isValid: false,
        error: field.message || `${fieldName} must be at most ${field.max}`,
      };
    }
  }

  // Enum validation
  if (field.enum && !field.enum.includes(value)) {
    return {
      isValid: false,
      error: field.message || `${fieldName} must be one of: ${field.enum.join(', ')}`,
    };
  }

  // Array validation
  if (field.type === 'array' && Array.isArray(value)) {
    if (field.items) {
      for (let i = 0; i < value.length; i++) {
        const itemResult = validateField(`${fieldName}[${i}]`, value[i], field.items);
        if (!itemResult.isValid) {
          return itemResult;
        }
      }
    }
  }

  // Object validation
  if (field.type === 'object' && field.schema && typeof value === 'object') {
    const nestedResult = validateSchema(value as Record<string, unknown>, field.schema, {
      allowAdditional: true,
    });
    if (!nestedResult.isValid) {
      return {
        isValid: false,
        error: nestedResult.errors.join(', '),
      };
    }
  }

  // Custom rules
  if (field.rules) {
    for (const rule of field.rules) {
      const result = rule(value);
      if (result !== true) {
        return {
          isValid: false,
          error: typeof result === 'string' ? result : field.message || `${fieldName} is invalid`,
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Validate data against schema
 */
function validateSchema(
  data: Record<string, unknown>,
  schema: ValidationSchema,
  options: { allowAdditional?: boolean; stripUnknown?: boolean } = {}
): ValidationResult {
  const errors: string[] = [];
  const validated: Record<string, unknown> = {};

  // Validate each field in schema
  for (const [fieldName, fieldDef] of Object.entries(schema)) {
    const value = data[fieldName];
    const result = validateField(fieldName, value, fieldDef);

    if (!result.isValid) {
      errors.push(result.error!);
    } else if (value !== undefined) {
      validated[fieldName] = value;
    }
  }

  // Check for additional fields
  if (!options.allowAdditional && !options.stripUnknown) {
    for (const key of Object.keys(data)) {
      if (!(key in schema)) {
        errors.push(`Unknown field: ${key}`);
      }
    }
  }

  // Include additional fields if allowed
  if (options.allowAdditional || options.stripUnknown) {
    for (const [key, value] of Object.entries(data)) {
      if (!(key in schema)) {
        if (options.allowAdditional) {
          validated[key] = value;
        }
        // If stripUnknown, we simply don't include it
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    value: validated,
  };
}

/**
 * Lambda handler type
 */
export type ValidationWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Validation middleware
 * Validates request data against provided schemas
 *
 * @param options - Validation options
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * export const handler = compose(
 *   validationMiddleware({
 *     body: {
 *       email: { type: 'string', required: true, pattern: /^.+@.+\..+$/ },
 *       age: { type: 'number', min: 0, max: 150 }
 *     }
 *   }),
 *   async (event) => {
 *     // Handler logic - body is validated
 *     return { statusCode: 200, body: '{}' };
 *   }
 * );
 * ```
 */
export function validationMiddleware(options: ValidationOptions) {
  const logger = createLogger({ middleware: 'validationMiddleware' });

  return function (handler: ValidationWrappedHandler): ValidationWrappedHandler {
    return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
      const validationErrors: string[] = [];

      // Validate body
      if (options.body && event.body) {
        try {
          const bodyData = JSON.parse(event.body);
          const result = validateSchema(bodyData, options.body, {
            allowAdditional: options.allowAdditional,
            stripUnknown: options.stripUnknown,
          });

          if (!result.isValid) {
            validationErrors.push(...result.errors.map((e) => `Body: ${e}`));
          }
        } catch (error) {
          validationErrors.push('Body: Invalid JSON');
        }
      }

      // Validate query parameters
      if (options.query && event.queryStringParameters) {
        const result = validateSchema(event.queryStringParameters, options.query, {
          allowAdditional: options.allowAdditional,
          stripUnknown: options.stripUnknown,
        });

        if (!result.isValid) {
          validationErrors.push(...result.errors.map((e) => `Query: ${e}`));
        }
      }

      // Validate headers
      if (options.headers && event.headers) {
        const result = validateSchema(event.headers, options.headers, {
          allowAdditional: true, // Always allow additional headers
          stripUnknown: false,
        });

        if (!result.isValid) {
          validationErrors.push(...result.errors.map((e) => `Headers: ${e}`));
        }
      }

      // If validation failed, return error
      if (validationErrors.length > 0) {
        logger.warn('Validation failed', { errors: validationErrors });

        const error = new ValidationError(validationErrors.join('; '));
        return {
          statusCode: error.statusCode,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify(error.toJSON()),
        };
      }

      // Validation passed, execute handler
      return handler(event);
    };
  };
}

/**
 * Common validation rules
 */
export const ValidationRules = {
  /**
   * Email validation
   */
  email: (): ValidationRule<string> => (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || 'Must be a valid email address',

  /**
   * URL validation
   */
  url: (): ValidationRule<string> => (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return 'Must be a valid URL';
    }
  },

  /**
   * UUID validation
   */
  uuid: (): ValidationRule<string> => (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    'Must be a valid UUID',

  /**
   * Alphanumeric validation
   */
  alphanumeric: (): ValidationRule<string> => (value: string) =>
    /^[a-zA-Z0-9]+$/.test(value) || 'Must contain only letters and numbers',

  /**
   * Custom regex validation
   */
  matches:
    (pattern: RegExp, message?: string): ValidationRule<string> =>
    (value: string) =>
      pattern.test(value) || message || 'Does not match required pattern',
};
