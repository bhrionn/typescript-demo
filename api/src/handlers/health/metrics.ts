/**
 * Metrics Endpoint Lambda Handler
 * Exposes collected metrics for monitoring
 * Requirements: Monitoring and observability
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../../types/api';
import { getMetricsStore } from '../../middleware/metrics';
import { createLogger } from '../../middleware/logging';

/**
 * Metrics endpoint handler
 * Returns aggregated metrics in JSON format
 */
async function handleMetricsRequest(event: APIGatewayEvent): Promise<APIGatewayResponse> {
  const logger = createLogger({
    handler: 'metrics',
    requestId: event.requestContext?.requestId,
  });

  logger.info('Metrics requested');

  try {
    const metricsStore = getMetricsStore();
    const summary = metricsStore.getMetricsSummary();

    // Add system metrics
    const systemMetrics = {
      uptime: process.uptime(),
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
        external: Math.round(process.memoryUsage().external / 1024 / 1024), // MB
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
      },
      cpu: process.cpuUsage(),
    };

    const response = {
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      metrics: summary,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
      body: JSON.stringify(response, null, 2),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to retrieve metrics', { error: errorMessage });

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to retrieve metrics',
        message: errorMessage,
      }),
    };
  }
}

/**
 * Lambda handler export
 */
export const handler = handleMetricsRequest;
