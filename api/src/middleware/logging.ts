/**
 * Request Logging Middleware for Lambda Functions
 * Provides structured logging for all requests
 * Requirements: 8.16
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';

/**
 * Log level enum
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Structured log entry
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  requestId?: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private context: Record<string, unknown> = {};

  constructor(context?: Record<string, unknown>) {
    this.context = context || {};
  }

  /**
   * Add context to all subsequent logs
   */
  addContext(context: Record<string, unknown>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Log a message with specified level
   */
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...metadata,
    };

    // Use console methods for CloudWatch integration
    /* eslint-disable no-console */
    switch (level) {
      case LogLevel.ERROR:
        console.error(JSON.stringify(entry));
        break;
      case LogLevel.WARN:
        console.warn(JSON.stringify(entry));
        break;
      case LogLevel.DEBUG:
        console.debug(JSON.stringify(entry));
        break;
      default:
        console.log(JSON.stringify(entry));
    }
    /* eslint-enable no-console */
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata);
  }
}

/**
 * Lambda handler type
 */
export type LoggingWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Extract safe request information for logging
 * Excludes sensitive data like authorization headers
 */
function extractRequestInfo(event: APIGatewayEvent): Record<string, unknown> {
  return {
    method: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
    sourceIp: event.requestContext?.identity?.sourceIp,
    userAgent: event.requestContext?.identity?.userAgent,
  };
}

/**
 * Request logging middleware
 * Logs request details and response status
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with logging
 *
 * @example
 * ```typescript
 * export const handler = withLogging(async (event) => {
 *   // Handler logic
 *   return { statusCode: 200, body: '{}' };
 * });
 * ```
 */
export function withLogging(handler: LoggingWrappedHandler): LoggingWrappedHandler {
  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    const startTime = Date.now();
    const requestId = event.requestContext?.requestId || 'unknown';

    const logger = new Logger({
      requestId,
      method: event.httpMethod,
      path: event.path,
    });

    // Log incoming request
    logger.info('Incoming request', extractRequestInfo(event));

    try {
      // Execute handler
      const response = await handler(event);

      // Log successful response
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        statusCode: response.statusCode,
        duration,
      });

      return response;
    } catch (error) {
      // Log error
      const duration = Date.now() - startTime;
      logger.error('Request failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      });

      throw error;
    }
  };
}

/**
 * Create a logger instance with context
 *
 * @param context - Initial context for the logger
 * @returns Logger instance
 */
export function createLogger(context?: Record<string, unknown>): Logger {
  return new Logger(context);
}
