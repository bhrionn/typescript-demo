/**
 * Metrics Collection Middleware for Lambda Functions
 * Collects performance and usage metrics
 * Requirements: Monitoring and observability
 * Following SOLID principles: Single Responsibility
 */

import { APIGatewayEvent, APIGatewayResponse } from '../types/api';
import { createLogger } from './logging';

/**
 * Metric data point
 */
interface MetricDataPoint {
  timestamp: number;
  value: number;
  labels?: Record<string, string>;
}

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * Metric definition
 */
interface Metric {
  name: string;
  type: MetricType;
  description: string;
  data: MetricDataPoint[];
}

/**
 * Metrics store
 */
class MetricsStore {
  private metrics: Map<string, Metric> = new Map();
  private readonly maxDataPoints = 1000;

  /**
   * Record a counter metric
   */
  recordCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.ensureMetric(name, MetricType.COUNTER, `Counter metric: ${name}`);
    this.addDataPoint(name, value, labels);
  }

  /**
   * Record a gauge metric
   */
  recordGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.ensureMetric(name, MetricType.GAUGE, `Gauge metric: ${name}`);
    this.addDataPoint(name, value, labels);
  }

  /**
   * Record a histogram metric (for timing)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.ensureMetric(name, MetricType.HISTOGRAM, `Histogram metric: ${name}`);
    this.addDataPoint(name, value, labels);
  }

  /**
   * Ensure metric exists
   */
  private ensureMetric(name: string, type: MetricType, description: string): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name,
        type,
        description,
        data: [],
      });
    }
  }

  /**
   * Add data point to metric
   */
  private addDataPoint(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) return;

    metric.data.push({
      timestamp: Date.now(),
      value,
      labels,
    });

    // Limit data points to prevent memory issues
    if (metric.data.length > this.maxDataPoints) {
      metric.data.shift();
    }
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, Metric> {
    return new Map(this.metrics);
  }

  /**
   * Get metric by name
   */
  getMetric(name: string): Metric | undefined {
    return this.metrics.get(name);
  }

  /**
   * Get aggregated metrics summary
   */
  getMetricsSummary(): Record<string, unknown> {
    const summary: Record<string, unknown> = {};

    for (const [name, metric] of this.metrics) {
      if (metric.data.length === 0) continue;

      const values = metric.data.map((d) => d.value);
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;

      switch (metric.type) {
        case MetricType.COUNTER:
          summary[name] = {
            type: 'counter',
            total: sum,
            count,
          };
          break;

        case MetricType.GAUGE:
          summary[name] = {
            type: 'gauge',
            current: values[values.length - 1],
            min: Math.min(...values),
            max: Math.max(...values),
            avg: sum / count,
          };
          break;

        case MetricType.HISTOGRAM: {
          const sorted = [...values].sort((a, b) => a - b);
          summary[name] = {
            type: 'histogram',
            count,
            sum,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: sum / count,
            p50: sorted[Math.floor(count * 0.5)],
            p95: sorted[Math.floor(count * 0.95)],
            p99: sorted[Math.floor(count * 0.99)],
          };
          break;
        }
      }
    }

    return summary;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
  }
}

/**
 * Global metrics store
 */
const metricsStore = new MetricsStore();

/**
 * Lambda handler type
 */
export type MetricsWrappedHandler = (event: APIGatewayEvent) => Promise<APIGatewayResponse>;

/**
 * Metrics middleware
 * Collects performance and usage metrics for each request
 *
 * @param handler - Lambda handler function
 * @returns Wrapped handler with metrics collection
 *
 * @example
 * ```typescript
 * export const handler = compose(
 *   metricsMiddleware,
 *   async (event) => {
 *     // Handler logic
 *     return { statusCode: 200, body: '{}' };
 *   }
 * );
 * ```
 */
export function metricsMiddleware(handler: MetricsWrappedHandler): MetricsWrappedHandler {
  return async (event: APIGatewayEvent): Promise<APIGatewayResponse> => {
    const startTime = Date.now();
    const path = event.path || 'unknown';
    const method = event.httpMethod || 'unknown';

    const logger = createLogger({
      middleware: 'metricsMiddleware',
      requestId: event.requestContext?.requestId,
    });

    try {
      // Record request count
      metricsStore.recordCounter('http_requests_total', 1, { path, method });

      // Execute handler
      const response = await handler(event);

      // Record response time
      const duration = Date.now() - startTime;
      metricsStore.recordHistogram('http_request_duration_ms', duration, {
        path,
        method,
        status: response.statusCode.toString(),
      });

      // Record status code
      metricsStore.recordCounter('http_response_status_total', 1, {
        path,
        method,
        status: response.statusCode.toString(),
      });

      // Record success/error
      if (response.statusCode >= 200 && response.statusCode < 400) {
        metricsStore.recordCounter('http_requests_success_total', 1, { path, method });
      } else {
        metricsStore.recordCounter('http_requests_error_total', 1, {
          path,
          method,
          status: response.statusCode.toString(),
        });
      }

      logger.debug('Metrics recorded', { duration, statusCode: response.statusCode });

      return response;
    } catch (error) {
      // Record error
      const duration = Date.now() - startTime;
      metricsStore.recordHistogram('http_request_duration_ms', duration, {
        path,
        method,
        status: '500',
      });
      metricsStore.recordCounter('http_requests_error_total', 1, { path, method });

      logger.error('Request failed, metrics recorded', { duration, error });

      throw error;
    }
  };
}

/**
 * Get metrics store (for metrics endpoint)
 */
export function getMetricsStore(): MetricsStore {
  return metricsStore;
}

/**
 * Record custom metric
 */
export function recordMetric(
  name: string,
  value: number,
  type: MetricType = MetricType.COUNTER,
  labels?: Record<string, string>
): void {
  switch (type) {
    case MetricType.COUNTER:
      metricsStore.recordCounter(name, value, labels);
      break;
    case MetricType.GAUGE:
      metricsStore.recordGauge(name, value, labels);
      break;
    case MetricType.HISTOGRAM:
      metricsStore.recordHistogram(name, value, labels);
      break;
  }
}
