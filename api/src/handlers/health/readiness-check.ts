/**
 * Readiness Check Lambda Handler
 * Lightweight check for load balancer readiness probes
 * Requirements: Monitoring and observability
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../../types/api';

/**
 * Simple readiness check handler
 * Returns 200 if the Lambda is ready to accept requests
 * No heavy checks - just confirms the Lambda is alive
 */
async function handleReadinessCheck(_event: APIGatewayEvent): Promise<APIGatewayResponse> {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
    body: JSON.stringify({
      ready: true,
      timestamp: new Date().toISOString(),
    }),
  };
}

/**
 * Lambda handler export
 */
export const handler = handleReadinessCheck;
