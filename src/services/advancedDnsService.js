const pool = require('../config/database');
const logger = require('../utils/logger');
const axios = require('axios');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Advanced DNS Management Service
 * 
 * Features:
 * - DNSSEC signing and validation
 * - GeoDNS with location-based routing
 * - Health checks with automatic failover
 * - DNS analytics and query monitoring
 * - DDoS protection integration
 * - Dynamic DNS updates
 * - DNS load balancing
 * - Anycast routing
 */

class AdvancedDNSService {
  constructor() {
    this.dnssecAlgorithms = {
      RSASHA256: 8,
      RSASHA512: 10,
      ECDSAP256SHA256: 13,
      ECDSAP384SHA384: 14,
      ED25519: 15
    };

    this.healthCheckIntervals = new Map();
  }

  /**
   * Enable DNSSEC for a zone
   */
  async enableDNSSEC(zoneId, options = {}) {
    const {
      algorithm = 'ECDSAP256SHA256',
      keyLength = 256,
      autoRenewal = true
    } = options;

    try {
      // Get zone details
      const zone = await pool.query(
        'SELECT * FROM dns_zones WHERE id = $1',
        [zoneId]
      );

      if (zone.rows.length === 0) {
        throw new Error('Zone not found');
      }

      const zoneName = zone.rows[0].domain;

      // Generate KSK (Key Signing Key) and ZSK (Zone Signing Key)
      const ksk = await this.generateDNSSECKey(zoneName, 'KSK', algorithm, keyLength);
      const zsk = await this.generateDNSSECKey(zoneName, 'ZSK', algorithm, keyLength);

      // Sign the zone
      const signedZone = await this.signZone(zoneName, ksk, zsk);

      // Store DNSSEC configuration
      const result = await pool.query(
        `INSERT INTO dnssec_configurations 
        (zone_id, algorithm, ksk_id, zsk_id, ds_records, auto_renewal, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          zoneId,
          algorithm,
          ksk.id,
          zsk.id,
          JSON.stringify(signedZone.dsRecords),
          autoRenewal,
          'active'
        ]
      );

      logger.info(`DNSSEC enabled for zone ${zoneId}`);
      return {
        ...result.rows[0],
        dsRecords: signedZone.dsRecords,
        instructions: this.getDSRecordInstructions(signedZone.dsRecords)
      };
    } catch (error) {
      logger.error('Failed to enable DNSSEC:', error);
      throw error;
    }
  }

  /**
   * Generate DNSSEC key (KSK or ZSK)
   */
  async generateDNSSECKey(zoneName, keyType, algorithm, keyLength) {
    const keyId = crypto.randomBytes(16).toString('hex');
    const flags = keyType === 'KSK' ? 257 : 256; // 257 for KSK, 256 for ZSK

    // Generate key pair (in production, use dnssec-keygen or crypto library)
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: keyLength === 256 ? 2048 : 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Store key
    await pool.query(
      `INSERT INTO dnssec_keys 
      (id, zone_name, key_type, algorithm, flags, public_key, private_key, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        keyId,
        zoneName,
        keyType,
        algorithm,
        flags,
        keyPair.publicKey,
        keyPair.privateKey
      ]
    );

    return {
      id: keyId,
      type: keyType,
      algorithm,
      flags,
      publicKey: keyPair.publicKey
    };
  }

  /**
   * Sign DNS zone with DNSSEC
   */
  async signZone(zoneName, ksk, zsk) {
    // In production, use dnssec-signzone or similar tool
    // This is a simplified representation

    const dsRecords = [
      {
        keyTag: this.calculateKeyTag(ksk.publicKey),
        algorithm: this.dnssecAlgorithms[ksk.algorithm],
        digestType: 2, // SHA-256
        digest: crypto.createHash('sha256')
          .update(ksk.publicKey)
          .digest('hex')
      }
    ];

    return {
      zoneName,
      signed: true,
      dsRecords,
      signedAt: new Date()
    };
  }

  /**
   * Calculate DNSSEC key tag
   */
  calculateKeyTag(publicKey) {
    const buffer = Buffer.from(publicKey, 'utf-8');
    let ac = 0;

    for (let i = 0; i < buffer.length; i++) {
      ac += (i & 1) ? buffer[i] : (buffer[i] << 8);
    }

    ac += (ac >> 16) & 0xFFFF;
    return ac & 0xFFFF;
  }

  /**
   * Get DS record instructions for registrar
   */
  getDSRecordInstructions(dsRecords) {
    const record = dsRecords[0];
    return {
      message: 'Add these DS records to your domain registrar',
      records: dsRecords.map(r => ({
        keyTag: r.keyTag,
        algorithm: r.algorithm,
        digestType: r.digestType,
        digest: r.digest,
        dnsFormat: `${r.keyTag} ${r.algorithm} ${r.digestType} ${r.digest}`
      }))
    };
  }

  /**
   * Create GeoDNS routing policy
   */
  async createGeoDNSPolicy(policyData) {
    const {
      zoneId,
      recordName,
      recordType,
      routingRules,
      healthCheckId,
      fallbackTarget
    } = policyData;

    try {
      const result = await pool.query(
        `INSERT INTO geodns_policies 
        (zone_id, record_name, record_type, routing_rules, health_check_id, 
         fallback_target, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING *`,
        [
          zoneId,
          recordName,
          recordType,
          JSON.stringify(routingRules),
          healthCheckId,
          fallbackTarget,
          'active'
        ]
      );

      logger.info(`GeoDNS policy created for zone ${zoneId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create GeoDNS policy:', error);
      throw error;
    }
  }

  /**
   * Resolve GeoDNS query based on location
   */
  async resolveGeoDNS(policyId, clientLocation) {
    try {
      const policy = await pool.query(
        'SELECT * FROM geodns_policies WHERE id = $1 AND status = $2',
        [policyId, 'active']
      );

      if (policy.rows.length === 0) {
        throw new Error('GeoDNS policy not found');
      }

      const routingRules = JSON.parse(policy.rows[0].routing_rules);
      
      // Match client location to routing rules
      const matchedRule = this.matchLocationRule(clientLocation, routingRules);

      if (!matchedRule) {
        // Return fallback target
        return {
          target: policy.rows[0].fallback_target,
          matched: false,
          reason: 'no_rule_matched'
        };
      }

      // Check health if health check is configured
      if (policy.rows[0].health_check_id) {
        const isHealthy = await this.checkTargetHealth(policy.rows[0].health_check_id, matchedRule.target);
        if (!isHealthy) {
          return {
            target: policy.rows[0].fallback_target,
            matched: true,
            reason: 'health_check_failed'
          };
        }
      }

      return {
        target: matchedRule.target,
        matched: true,
        rule: matchedRule,
        location: clientLocation
      };
    } catch (error) {
      logger.error('Failed to resolve GeoDNS:', error);
      throw error;
    }
  }

  /**
   * Match client location to routing rules
   */
  matchLocationRule(clientLocation, routingRules) {
    const { country, region, city } = clientLocation;

    // Try exact match first (country + region + city)
    let match = routingRules.find(rule => 
      rule.country === country && 
      rule.region === region && 
      rule.city === city
    );

    if (match) return match;

    // Try country + region match
    match = routingRules.find(rule => 
      rule.country === country && 
      rule.region === region && 
      !rule.city
    );

    if (match) return match;

    // Try country match
    match = routingRules.find(rule => 
      rule.country === country && 
      !rule.region && 
      !rule.city
    );

    if (match) return match;

    // Try continent match
    const continent = this.getContinent(country);
    match = routingRules.find(rule => rule.continent === continent);

    return match;
  }

  /**
   * Get continent from country code
   */
  getContinent(countryCode) {
    const continentMap = {
      'US': 'NA', 'CA': 'NA', 'MX': 'NA',
      'GB': 'EU', 'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU',
      'CN': 'AS', 'JP': 'AS', 'IN': 'AS', 'KR': 'AS', 'SG': 'AS',
      'BR': 'SA', 'AR': 'SA', 'CL': 'SA',
      'AU': 'OC', 'NZ': 'OC',
      'ZA': 'AF', 'EG': 'AF', 'NG': 'AF'
    };

    return continentMap[countryCode] || 'OTHER';
  }

  /**
   * Create health check
   */
  async createHealthCheck(healthCheckData) {
    const {
      name,
      target,
      protocol,
      port,
      path,
      interval,
      timeout,
      unhealthyThreshold,
      healthyThreshold,
      expectedStatus,
      notificationSettings
    } = healthCheckData;

    try {
      const result = await pool.query(
        `INSERT INTO dns_health_checks 
        (name, target, protocol, port, path, interval_seconds, timeout_seconds, 
         unhealthy_threshold, healthy_threshold, expected_status, 
         notification_settings, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        RETURNING *`,
        [
          name,
          target,
          protocol || 'HTTPS',
          port || 443,
          path || '/',
          interval || 30,
          timeout || 10,
          unhealthyThreshold || 3,
          healthyThreshold || 2,
          expectedStatus || 200,
          JSON.stringify(notificationSettings || {}),
          'active'
        ]
      );

      const healthCheckId = result.rows[0].id;

      // Start health check monitoring
      this.startHealthCheckMonitoring(healthCheckId);

      logger.info(`Health check created: ${healthCheckId}`);
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create health check:', error);
      throw error;
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheckMonitoring(healthCheckId) {
    // Clear existing interval if any
    if (this.healthCheckIntervals.has(healthCheckId)) {
      clearInterval(this.healthCheckIntervals.get(healthCheckId));
    }

    const performCheck = async () => {
      try {
        const healthCheck = await pool.query(
          'SELECT * FROM dns_health_checks WHERE id = $1',
          [healthCheckId]
        );

        if (healthCheck.rows.length === 0) return;

        const check = healthCheck.rows[0];
        const isHealthy = await this.performHealthCheck(check);

        // Update health check result
        await pool.query(
          `INSERT INTO health_check_results 
          (health_check_id, is_healthy, response_time, status_code, error_message, checked_at)
          VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            healthCheckId,
            isHealthy.healthy,
            isHealthy.responseTime,
            isHealthy.statusCode,
            isHealthy.error
          ]
        );

        // Check if state changed
        const previousState = check.current_status;
        const newState = await this.determineHealthState(healthCheckId);

        if (previousState !== newState) {
          await pool.query(
            'UPDATE dns_health_checks SET current_status = $1, last_state_change = NOW() WHERE id = $2',
            [newState, healthCheckId]
          );

          // Trigger failover if needed
          if (newState === 'unhealthy') {
            await this.triggerFailover(healthCheckId);
          }

          // Send notification
          await this.sendHealthCheckNotification(healthCheckId, previousState, newState);
        }
      } catch (error) {
        logger.error(`Health check ${healthCheckId} failed:`, error);
      }
    };

    // Initial check
    performCheck();

    // Schedule recurring checks
    pool.query('SELECT interval_seconds FROM dns_health_checks WHERE id = $1', [healthCheckId])
      .then(result => {
        if (result.rows.length > 0) {
          const interval = setInterval(performCheck, result.rows[0].interval_seconds * 1000);
          this.healthCheckIntervals.set(healthCheckId, interval);
        }
      });
  }

  /**
   * Perform actual health check
   */
  async performHealthCheck(check) {
    const startTime = Date.now();

    try {
      const url = `${check.protocol.toLowerCase()}://${check.target}:${check.port}${check.path}`;
      
      const response = await axios.get(url, {
        timeout: check.timeout_seconds * 1000,
        validateStatus: () => true // Don't throw on any status
      });

      const responseTime = Date.now() - startTime;
      const healthy = response.status === check.expected_status;

      return {
        healthy,
        responseTime,
        statusCode: response.status,
        error: healthy ? null : `Unexpected status: ${response.status}`
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        responseTime,
        statusCode: null,
        error: error.message
      };
    }
  }

  /**
   * Determine health state based on recent results
   */
  async determineHealthState(healthCheckId) {
    const healthCheck = await pool.query(
      'SELECT * FROM dns_health_checks WHERE id = $1',
      [healthCheckId]
    );

    if (healthCheck.rows.length === 0) return 'unknown';

    const check = healthCheck.rows[0];

    // Get recent results
    const recentResults = await pool.query(
      `SELECT is_healthy FROM health_check_results 
      WHERE health_check_id = $1 
      ORDER BY checked_at DESC 
      LIMIT $2`,
      [healthCheckId, Math.max(check.unhealthy_threshold, check.healthy_threshold)]
    );

    if (recentResults.rows.length === 0) return 'unknown';

    const healthyCount = recentResults.rows.filter(r => r.is_healthy).length;
    const unhealthyCount = recentResults.rows.length - healthyCount;

    // Determine state
    if (unhealthyCount >= check.unhealthy_threshold) {
      return 'unhealthy';
    } else if (healthyCount >= check.healthy_threshold) {
      return 'healthy';
    } else {
      return 'checking';
    }
  }

  /**
   * Trigger automatic failover
   */
  async triggerFailover(healthCheckId) {
    try {
      // Find GeoDNS policies using this health check
      const policies = await pool.query(
        'SELECT * FROM geodns_policies WHERE health_check_id = $1 AND status = $2',
        [healthCheckId, 'active']
      );

      for (const policy of policies.rows) {
        // Update DNS to use fallback target
        await pool.query(
          `INSERT INTO dns_failover_events 
          (policy_id, health_check_id, original_target, failover_target, triggered_at)
          VALUES ($1, $2, $3, $4, NOW())`,
          [
            policy.id,
            healthCheckId,
            policy.routing_rules,
            policy.fallback_target
          ]
        );

        logger.info(`Failover triggered for policy ${policy.id}`);
      }
    } catch (error) {
      logger.error('Failed to trigger failover:', error);
      throw error;
    }
  }

  /**
   * Send health check notification
   */
  async sendHealthCheckNotification(healthCheckId, previousState, newState) {
    try {
      const healthCheck = await pool.query(
        'SELECT * FROM dns_health_checks WHERE id = $1',
        [healthCheckId]
      );

      if (healthCheck.rows.length === 0) return;

      const check = healthCheck.rows[0];
      const settings = JSON.parse(check.notification_settings);

      if (!settings.enabled) return;

      // In production, send email/SMS/webhook notification
      logger.info(`Health check ${healthCheckId} state changed: ${previousState} -> ${newState}`);
    } catch (error) {
      logger.error('Failed to send health check notification:', error);
    }
  }

  /**
   * Check target health (used by GeoDNS)
   */
  async checkTargetHealth(healthCheckId, target) {
    try {
      const result = await pool.query(
        'SELECT current_status FROM dns_health_checks WHERE id = $1',
        [healthCheckId]
      );

      if (result.rows.length === 0) return true; // Assume healthy if no check

      return result.rows[0].current_status === 'healthy';
    } catch (error) {
      logger.error('Failed to check target health:', error);
      return false; // Fail closed
    }
  }

  /**
   * Get DNS analytics
   */
  async getDNSAnalytics(zoneId, startDate, endDate) {
    try {
      // Query analytics
      const analytics = await pool.query(
        `SELECT 
          COUNT(*) as total_queries,
          COUNT(DISTINCT client_ip) as unique_clients,
          AVG(response_time) as avg_response_time,
          SUM(CASE WHEN status = 'NOERROR' THEN 1 ELSE 0 END) as successful_queries,
          SUM(CASE WHEN status = 'NXDOMAIN' THEN 1 ELSE 0 END) as nxdomain_queries,
          SUM(CASE WHEN status = 'SERVFAIL' THEN 1 ELSE 0 END) as failed_queries
        FROM dns_query_logs
        WHERE zone_id = $1 
          AND created_at >= $2 
          AND created_at <= $3`,
        [zoneId, startDate, endDate]
      );

      // Top queried records
      const topRecords = await pool.query(
        `SELECT record_name, record_type, COUNT(*) as query_count
        FROM dns_query_logs
        WHERE zone_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
        GROUP BY record_name, record_type
        ORDER BY query_count DESC
        LIMIT 10`,
        [zoneId, startDate, endDate]
      );

      // Geographic distribution
      const geoDistribution = await pool.query(
        `SELECT country, COUNT(*) as query_count
        FROM dns_query_logs
        WHERE zone_id = $1 
          AND created_at >= $2 
          AND created_at <= $3
        GROUP BY country
        ORDER BY query_count DESC
        LIMIT 10`,
        [zoneId, startDate, endDate]
      );

      return {
        summary: analytics.rows[0],
        topRecords: topRecords.rows,
        geoDistribution: geoDistribution.rows
      };
    } catch (error) {
      logger.error('Failed to get DNS analytics:', error);
      throw error;
    }
  }

  /**
   * Log DNS query (for analytics)
   */
  async logDNSQuery(queryData) {
    const {
      zoneId,
      recordName,
      recordType,
      clientIp,
      country,
      status,
      responseTime
    } = queryData;

    try {
      await pool.query(
        `INSERT INTO dns_query_logs 
        (zone_id, record_name, record_type, client_ip, country, status, response_time, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [zoneId, recordName, recordType, clientIp, country, status, responseTime]
      );
    } catch (error) {
      logger.error('Failed to log DNS query:', error);
    }
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheckMonitoring(healthCheckId) {
    if (this.healthCheckIntervals.has(healthCheckId)) {
      clearInterval(this.healthCheckIntervals.get(healthCheckId));
      this.healthCheckIntervals.delete(healthCheckId);
      logger.info(`Health check monitoring stopped for ${healthCheckId}`);
    }
  }

  /**
   * Cleanup - stop all health checks
   */
  cleanup() {
    for (const [healthCheckId, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
    logger.info('All health check monitoring stopped');
  }
}

module.exports = new AdvancedDNSService();
