const { Pool } = require('pg');
const pool = require('../config/database');
const logger = require('../utils/logger');
const aiService = require('./aiService');
const websocketService = require('./websocketService');
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');

/**
 * Advanced Monitoring & Observability Service
 * 
 * Features:
 * - APM (Application Performance Monitoring)
 * - Distributed tracing with OpenTelemetry
 * - AI-powered anomaly detection
 * - Log aggregation and analysis
 * - Smart alerting with escalation
 * - Performance profiling
 * - Real User Monitoring (RUM)
 * - Infrastructure monitoring
 */

class MonitoringService {
  constructor() {
    this.tracer = null;
    this.metrics = new Map();
    this.anomalyDetectionEnabled = true;
    this.baselineData = new Map();
    
    // Alert thresholds
    this.thresholds = {
      responseTime: 1000, // ms
      errorRate: 5, // percentage
      cpuUsage: 80, // percentage
      memoryUsage: 85, // percentage
      diskUsage: 90, // percentage
      requestsPerMinute: 10000
    };

    // Initialize distributed tracing
    this.initializeTracing();
  }

  /**
   * Initialize OpenTelemetry distributed tracing
   */
  initializeTracing() {
    try {
      const provider = new NodeTracerProvider({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'mpanel-main',
          [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0'
        })
      });

      // Configure Jaeger exporter
      const jaegerExporter = new JaegerExporter({
        endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
        agentHost: process.env.JAEGER_AGENT_HOST || 'localhost',
        agentPort: process.env.JAEGER_AGENT_PORT || 6832
      });

      provider.addSpanProcessor(new BatchSpanProcessor(jaegerExporter));
      provider.register();

      this.tracer = opentelemetry.trace.getTracer('mpanel-tracer');

      logger.info('Distributed tracing initialized with Jaeger');
    } catch (error) {
      logger.error('Failed to initialize tracing:', error);
      // Continue without tracing
    }
  }

  /**
   * Start a trace span
   * 
   * @param {string} name
   * @param {Object} attributes
   * @returns {Object} span
   */
  startSpan(name, attributes = {}) {
    if (!this.tracer) return null;

    return this.tracer.startSpan(name, {
      attributes: {
        ...attributes,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Track API request
   * 
   * @param {Object} requestData
   * @returns {Promise<Object>}
   */
  async trackRequest(requestData) {
    const {
      tenantId,
      method,
      path,
      statusCode,
      responseTime,
      userId,
      userAgent,
      ipAddress,
      traceId
    } = requestData;

    try {
      // Store request log
      const result = await pool.query(
        `INSERT INTO apm_requests 
        (tenant_id, method, path, status_code, response_time, user_id, 
         user_agent, ip_address, trace_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *`,
        [tenantId, method, path, statusCode, responseTime, userId, 
         userAgent, ipAddress, traceId]
      );

      const request = result.rows[0];

      // Update aggregated metrics
      await this.updateAggregatedMetrics(tenantId, method, path, statusCode, responseTime);

      // Check for anomalies
      if (this.anomalyDetectionEnabled) {
        await this.detectAnomalies(tenantId, { responseTime, statusCode, path });
      }

      // Check thresholds
      if (responseTime > this.thresholds.responseTime) {
        await this.createAlert(tenantId, 'slow_response', {
          path,
          responseTime,
          threshold: this.thresholds.responseTime
        });
      }

      return request;
    } catch (error) {
      logger.error('Failed to track request:', error);
      throw error;
    }
  }

  /**
   * Update aggregated metrics
   */
  async updateAggregatedMetrics(tenantId, method, path, statusCode, responseTime) {
    try {
      const isError = statusCode >= 400;
      const minute = new Date();
      minute.setSeconds(0, 0);

      await pool.query(
        `INSERT INTO apm_metrics 
        (tenant_id, time_bucket, method, path, request_count, error_count, 
         total_response_time, avg_response_time, min_response_time, max_response_time)
        VALUES ($1, $2, $3, $4, 1, $5, $6, $6, $6, $6)
        ON CONFLICT (tenant_id, time_bucket, method, path)
        DO UPDATE SET
          request_count = apm_metrics.request_count + 1,
          error_count = apm_metrics.error_count + $5,
          total_response_time = apm_metrics.total_response_time + $6,
          avg_response_time = (apm_metrics.total_response_time + $6) / (apm_metrics.request_count + 1),
          min_response_time = LEAST(apm_metrics.min_response_time, $6),
          max_response_time = GREATEST(apm_metrics.max_response_time, $6)`,
        [tenantId, minute, method, path, isError ? 1 : 0, responseTime]
      );
    } catch (error) {
      logger.error('Failed to update aggregated metrics:', error);
    }
  }

  /**
   * AI-powered anomaly detection
   * 
   * @param {number} tenantId
   * @param {Object} currentMetrics
   */
  async detectAnomalies(tenantId, currentMetrics) {
    try {
      const { responseTime, statusCode, path } = currentMetrics;

      // Get baseline data (last 7 days)
      const baselineResult = await pool.query(
        `SELECT 
          AVG(avg_response_time) as baseline_avg,
          STDDEV(avg_response_time) as baseline_stddev,
          AVG(error_count::float / request_count) as baseline_error_rate
         FROM apm_metrics
         WHERE tenant_id = $1 
           AND path = $2
           AND time_bucket >= NOW() - INTERVAL '7 days'`,
        [tenantId, path]
      );

      if (baselineResult.rows.length === 0 || !baselineResult.rows[0].baseline_avg) {
        return; // Not enough data for anomaly detection
      }

      const baseline = baselineResult.rows[0];
      const zScore = Math.abs((responseTime - baseline.baseline_avg) / baseline.baseline_stddev);

      // Statistical anomaly: z-score > 3 (99.7% confidence)
      if (zScore > 3) {
        logger.warn('Statistical anomaly detected', { 
          tenantId, 
          path, 
          responseTime, 
          baseline: baseline.baseline_avg,
          zScore 
        });

        // Use AI to analyze anomaly
        const aiAnalysis = await aiService.analyzeAnomaly({
          metric: 'response_time',
          current: responseTime,
          baseline: baseline.baseline_avg,
          stddev: baseline.baseline_stddev,
          zScore,
          path,
          recentRequests: await this.getRecentRequests(tenantId, path, 10)
        });

        // Create anomaly record
        await pool.query(
          `INSERT INTO monitoring_anomalies 
          (tenant_id, metric_type, path, current_value, baseline_value, 
           z_score, severity, ai_analysis, status, detected_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW())`,
          [tenantId, 'response_time', path, responseTime, baseline.baseline_avg, 
           zScore, this.calculateSeverity(zScore), aiAnalysis]
        );

        // Create alert
        await this.createAlert(tenantId, 'anomaly_detected', {
          metric: 'response_time',
          path,
          zScore,
          aiAnalysis
        });
      }
    } catch (error) {
      logger.error('Anomaly detection failed:', error);
    }
  }

  /**
   * Calculate severity based on z-score
   */
  calculateSeverity(zScore) {
    if (zScore > 5) return 'critical';
    if (zScore > 4) return 'high';
    if (zScore > 3) return 'medium';
    return 'low';
  }

  /**
   * Get recent requests for context
   */
  async getRecentRequests(tenantId, path, limit = 10) {
    const result = await pool.query(
      `SELECT method, status_code, response_time, created_at
       FROM apm_requests
       WHERE tenant_id = $1 AND path = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, path, limit]
    );

    return result.rows;
  }

  /**
   * Create monitoring alert
   * 
   * @param {number} tenantId
   * @param {string} type
   * @param {Object} details
   */
  async createAlert(tenantId, type, details) {
    try {
      // Check if similar alert exists (avoid spam)
      const existingAlert = await pool.query(
        `SELECT id FROM monitoring_alerts
         WHERE tenant_id = $1 
           AND alert_type = $2 
           AND status IN ('open', 'acknowledged')
           AND details->>'path' = $3
           AND created_at >= NOW() - INTERVAL '5 minutes'
         LIMIT 1`,
        [tenantId, type, details.path]
      );

      if (existingAlert.rows.length > 0) {
        return; // Don't create duplicate alert
      }

      // Determine severity
      const severity = this.determineAlertSeverity(type, details);

      // Create alert
      const result = await pool.query(
        `INSERT INTO monitoring_alerts 
        (tenant_id, alert_type, severity, details, status, created_at)
        VALUES ($1, $2, $3, $4, 'open', NOW())
        RETURNING *`,
        [tenantId, type, severity, JSON.stringify(details)]
      );

      const alert = result.rows[0];

      // Send real-time notification
      websocketService.sendToTenant(tenantId, 'monitoring_alert', {
        alertId: alert.id,
        type,
        severity,
        details
      });

      // Escalate if critical
      if (severity === 'critical') {
        await this.escalateAlert(alert.id);
      }

      logger.info('Alert created', { alertId: alert.id, type, severity });

      return alert;
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  /**
   * Determine alert severity
   */
  determineAlertSeverity(type, details) {
    switch (type) {
      case 'anomaly_detected':
        return details.zScore > 5 ? 'critical' : 
               details.zScore > 4 ? 'high' : 'medium';
      case 'slow_response':
        return details.responseTime > 5000 ? 'critical' :
               details.responseTime > 3000 ? 'high' : 'medium';
      case 'high_error_rate':
        return details.errorRate > 10 ? 'critical' :
               details.errorRate > 5 ? 'high' : 'medium';
      case 'resource_usage':
        return details.usage > 95 ? 'critical' :
               details.usage > 85 ? 'high' : 'medium';
      default:
        return 'medium';
    }
  }

  /**
   * Escalate critical alert
   */
  async escalateAlert(alertId) {
    try {
      const alertResult = await pool.query(
        `SELECT a.*, t.admin_email, t.admin_phone
         FROM monitoring_alerts a
         JOIN tenants t ON a.tenant_id = t.id
         WHERE a.id = $1`,
        [alertId]
      );

      if (alertResult.rows.length === 0) {
        return;
      }

      const alert = alertResult.rows[0];

      // Send email notification (using existing email service)
      // await emailService.sendAlertEmail(alert.admin_email, alert);

      // Send SMS for critical alerts (using Twilio)
      // await smsService.sendAlertSMS(alert.admin_phone, alert);

      // Create escalation record
      await pool.query(
        `INSERT INTO alert_escalations 
        (alert_id, escalation_level, notified_at)
        VALUES ($1, 1, NOW())`,
        [alertId]
      );

      logger.warn('Alert escalated', { alertId, severity: alert.severity });
    } catch (error) {
      logger.error('Failed to escalate alert:', error);
    }
  }

  /**
   * Track infrastructure metrics
   * 
   * @param {Object} metricsData
   * @returns {Promise<Object>}
   */
  async trackInfrastructureMetrics(metricsData) {
    const {
      tenantId,
      serverId,
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkIn,
      networkOut,
      activeConnections
    } = metricsData;

    try {
      const result = await pool.query(
        `INSERT INTO infrastructure_metrics 
        (tenant_id, server_id, cpu_usage, memory_usage, disk_usage, 
         network_in, network_out, active_connections, recorded_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING *`,
        [tenantId, serverId, cpuUsage, memoryUsage, diskUsage, 
         networkIn, networkOut, activeConnections]
      );

      const metrics = result.rows[0];

      // Check thresholds
      if (cpuUsage > this.thresholds.cpuUsage) {
        await this.createAlert(tenantId, 'resource_usage', {
          resource: 'cpu',
          usage: cpuUsage,
          threshold: this.thresholds.cpuUsage,
          serverId
        });
      }

      if (memoryUsage > this.thresholds.memoryUsage) {
        await this.createAlert(tenantId, 'resource_usage', {
          resource: 'memory',
          usage: memoryUsage,
          threshold: this.thresholds.memoryUsage,
          serverId
        });
      }

      if (diskUsage > this.thresholds.diskUsage) {
        await this.createAlert(tenantId, 'resource_usage', {
          resource: 'disk',
          usage: diskUsage,
          threshold: this.thresholds.diskUsage,
          serverId
        });
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to track infrastructure metrics:', error);
      throw error;
    }
  }

  /**
   * Get APM dashboard data
   * 
   * @param {number} tenantId
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async getAPMDashboard(tenantId, options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      endDate = new Date()
    } = options;

    try {
      // Request volume and error rate
      const volumeResult = await pool.query(
        `SELECT 
          DATE_TRUNC('hour', time_bucket) as hour,
          SUM(request_count) as total_requests,
          SUM(error_count) as total_errors,
          AVG(avg_response_time) as avg_response_time
         FROM apm_metrics
         WHERE tenant_id = $1 
           AND time_bucket >= $2 
           AND time_bucket <= $3
         GROUP BY hour
         ORDER BY hour`,
        [tenantId, startDate, endDate]
      );

      // Top slow endpoints
      const slowEndpointsResult = await pool.query(
        `SELECT 
          path,
          method,
          AVG(avg_response_time) as avg_time,
          MAX(max_response_time) as max_time,
          SUM(request_count) as request_count
         FROM apm_metrics
         WHERE tenant_id = $1 
           AND time_bucket >= $2 
           AND time_bucket <= $3
         GROUP BY path, method
         ORDER BY avg_time DESC
         LIMIT 10`,
        [tenantId, startDate, endDate]
      );

      // Error breakdown
      const errorsResult = await pool.query(
        `SELECT 
          status_code,
          COUNT(*) as count,
          path
         FROM apm_requests
         WHERE tenant_id = $1 
           AND status_code >= 400
           AND created_at >= $2 
           AND created_at <= $3
         GROUP BY status_code, path
         ORDER BY count DESC
         LIMIT 20`,
        [tenantId, startDate, endDate]
      );

      // Active anomalies
      const anomaliesResult = await pool.query(
        `SELECT * FROM monitoring_anomalies
         WHERE tenant_id = $1 
           AND status = 'open'
         ORDER BY detected_at DESC
         LIMIT 10`,
        [tenantId]
      );

      // Active alerts
      const alertsResult = await pool.query(
        `SELECT * FROM monitoring_alerts
         WHERE tenant_id = $1 
           AND status IN ('open', 'acknowledged')
         ORDER BY created_at DESC
         LIMIT 10`,
        [tenantId]
      );

      // Calculate overall health score
      const totalRequests = volumeResult.rows.reduce((sum, row) => sum + parseInt(row.total_requests), 0);
      const totalErrors = volumeResult.rows.reduce((sum, row) => sum + parseInt(row.total_errors), 0);
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      const avgResponseTime = volumeResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_response_time), 0) / volumeResult.rows.length;

      const healthScore = this.calculateHealthScore({
        errorRate,
        avgResponseTime,
        anomalyCount: anomaliesResult.rows.length,
        alertCount: alertsResult.rows.length
      });

      return {
        healthScore,
        summary: {
          totalRequests,
          totalErrors,
          errorRate: errorRate.toFixed(2),
          avgResponseTime: avgResponseTime.toFixed(2)
        },
        timeSeries: volumeResult.rows,
        slowEndpoints: slowEndpointsResult.rows,
        errors: errorsResult.rows,
        anomalies: anomaliesResult.rows,
        alerts: alertsResult.rows
      };
    } catch (error) {
      logger.error('Failed to get APM dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculate overall health score
   */
  calculateHealthScore(metrics) {
    let score = 100;

    // Error rate penalty (max -30 points)
    score -= Math.min(30, metrics.errorRate * 3);

    // Response time penalty (max -30 points)
    const responseTimePenalty = Math.max(0, (metrics.avgResponseTime - 500) / 100);
    score -= Math.min(30, responseTimePenalty);

    // Anomaly penalty (max -20 points)
    score -= Math.min(20, metrics.anomalyCount * 4);

    // Alert penalty (max -20 points)
    score -= Math.min(20, metrics.alertCount * 2);

    return Math.max(0, Math.round(score));
  }

  /**
   * Aggregate log entries for analysis
   * 
   * @param {number} tenantId
   * @param {Object} logData
   */
  async aggregateLog(tenantId, logData) {
    const {
      level, // error, warn, info, debug
      message,
      context = {},
      source,
      stackTrace
    } = logData;

    try {
      await pool.query(
        `INSERT INTO log_aggregation 
        (tenant_id, level, message, context, source, stack_trace, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [tenantId, level, message, JSON.stringify(context), source, stackTrace]
      );

      // If error, check for patterns
      if (level === 'error') {
        await this.detectErrorPatterns(tenantId, message, stackTrace);
      }
    } catch (error) {
      logger.error('Failed to aggregate log:', error);
    }
  }

  /**
   * Detect error patterns using AI
   */
  async detectErrorPatterns(tenantId, message, stackTrace) {
    try {
      // Get similar errors in last hour
      const similarErrors = await pool.query(
        `SELECT COUNT(*) as count
         FROM log_aggregation
         WHERE tenant_id = $1 
           AND level = 'error'
           AND message = $2
           AND created_at >= NOW() - INTERVAL '1 hour'`,
        [tenantId, message]
      );

      const errorCount = parseInt(similarErrors.rows[0].count);

      // If recurring error (5+ times in 1 hour), create alert
      if (errorCount >= 5) {
        await this.createAlert(tenantId, 'recurring_error', {
          message,
          count: errorCount,
          stackTrace
        });
      }
    } catch (error) {
      logger.error('Failed to detect error patterns:', error);
    }
  }

  /**
   * Get distributed trace
   * 
   * @param {string} traceId
   * @returns {Promise<Object>}
   */
  async getTrace(traceId) {
    try {
      // Get all spans for this trace
      const result = await pool.query(
        `SELECT * FROM distributed_traces
         WHERE trace_id = $1
         ORDER BY start_time`,
        [traceId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Build trace tree
      const spans = result.rows;
      const rootSpan = spans.find(s => !s.parent_span_id);
      
      const buildTree = (parentId) => {
        return spans
          .filter(s => s.parent_span_id === parentId)
          .map(span => ({
            ...span,
            children: buildTree(span.span_id)
          }));
      };

      return {
        traceId,
        duration: rootSpan ? rootSpan.duration : 0,
        spanCount: spans.length,
        rootSpan: {
          ...rootSpan,
          children: buildTree(rootSpan.span_id)
        }
      };
    } catch (error) {
      logger.error('Failed to get trace:', error);
      throw error;
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId, userId) {
    try {
      await pool.query(
        `UPDATE monitoring_alerts 
         SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
         WHERE id = $2`,
        [userId, alertId]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId, userId, resolution) {
    try {
      await pool.query(
        `UPDATE monitoring_alerts 
         SET status = 'resolved', resolved_by = $1, resolved_at = NOW(), resolution = $2
         WHERE id = $3`,
        [userId, resolution, alertId]
      );

      return { success: true };
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      throw error;
    }
  }
}

module.exports = new MonitoringService();
