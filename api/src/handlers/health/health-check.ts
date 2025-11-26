/**
 * Health Check Lambda Handler
 * Provides system health status for monitoring
 * Requirements: Monitoring and observability
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../../types/api';
import { createDatabaseConnection } from '../../utils/database-connection';
import { createLogger } from '../../middleware/logging';

/**
 * Health status type
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health info
 */
interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  responseTime?: number;
}

/**
 * Health check response
 */
interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
  };
}

/**
 * Check database health
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  const startTime = Date.now();

  try {
    const db = await createDatabaseConnection();

    // Simple query to check connectivity
    await db.query('SELECT 1');
    await db.disconnect();

    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      message: 'Database connection successful',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      status: 'unhealthy',
      message: `Database connection failed: ${errorMessage}`,
      responseTime,
    };
  }
}

/**
 * Check memory health
 */
function checkMemoryHealth(): ComponentHealth {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const percentUsed = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  // Consider unhealthy if using more than 90% of heap
  if (percentUsed > 90) {
    return {
      status: 'unhealthy',
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${percentUsed}%)`,
    };
  }

  // Consider degraded if using more than 75% of heap
  if (percentUsed > 75) {
    return {
      status: 'degraded',
      message: `Elevated memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${percentUsed}%)`,
    };
  }

  return {
    status: 'healthy',
    message: `Memory usage normal: ${heapUsedMB}MB / ${heapTotalMB}MB (${percentUsed}%)`,
  };
}

/**
 * Determine overall health status
 */
function determineOverallStatus(components: {
  database: ComponentHealth;
  memory: ComponentHealth;
}): HealthStatus {
  // If any component is unhealthy, overall is unhealthy
  if (components.database.status === 'unhealthy' || components.memory.status === 'unhealthy') {
    return 'unhealthy';
  }

  // If any component is degraded, overall is degraded
  if (components.database.status === 'degraded' || components.memory.status === 'degraded') {
    return 'degraded';
  }

  // All components healthy
  return 'healthy';
}

/**
 * Main health check handler
 */
async function handleHealthCheck(event: APIGatewayEvent): Promise<APIGatewayResponse> {
  const logger = createLogger({
    handler: 'healthCheck',
    requestId: event.requestContext?.requestId,
  });

  logger.info('Health check requested');

  try {
    // Check all components
    const [databaseHealth, memoryHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkMemoryHealth(),
    ]);

    const components = {
      database: databaseHealth,
      memory: memoryHealth,
    };

    const overallStatus = determineOverallStatus(components);

    const response: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      components,
    };

    // Return appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    logger.info('Health check completed', { status: overallStatus, statusCode });

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check failed', { error: errorMessage });

    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: errorMessage,
      }),
    };
  }
}

/**
 * Lambda handler export
 */
export const handler = handleHealthCheck;
