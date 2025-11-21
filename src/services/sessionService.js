/**
 * Session Management Service
 * Track and manage user sessions across devices
 */

import pool from '../db/index.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * Create user session
 */
export async function createSession(userId, tenantId, deviceInfo, ipAddress) {
  try {
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    
    // Session expires in 7 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const result = await pool.query(
      `INSERT INTO user_sessions 
       (user_id, tenant_id, session_token, refresh_token, device_name, device_type, 
        browser, os, ip_address, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        userId,
        tenantId,
        sessionToken,
        refreshToken,
        deviceInfo.name || 'Unknown Device',
        deviceInfo.type || 'desktop',
        deviceInfo.browser || 'Unknown',
        deviceInfo.os || 'Unknown',
        ipAddress,
        deviceInfo.userAgent,
        expiresAt,
      ]
    );
    
    logger.info(`Created session for user ${userId} from ${ipAddress}`);
    return result.rows[0];
  } catch (error) {
    logger.error('Error creating session:', error);
    throw error;
  }
}

/**
 * Get user sessions
 */
export async function getUserSessions(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM user_sessions 
       WHERE user_id = $1 AND active = true
       ORDER BY last_activity_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error getting user sessions:', error);
    throw error;
  }
}

/**
 * Update session activity
 */
export async function updateActivity(sessionToken) {
  try {
    await pool.query(
      'UPDATE user_sessions SET last_activity_at = NOW() WHERE session_token = $1',
      [sessionToken]
    );
  } catch (error) {
    logger.error('Error updating session activity:', error);
  }
}

/**
 * Terminate session
 */
export async function terminateSession(sessionId, userId) {
  try {
    await pool.query(
      'UPDATE user_sessions SET active = false, forced_logout = true WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
    
    logger.info(`Terminated session ${sessionId} for user ${userId}`);
    return { success: true };
  } catch (error) {
    logger.error('Error terminating session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Terminate all sessions for user (except current)
 */
export async function terminateAllSessions(userId, exceptSessionId = null) {
  try {
    const conditions = ['user_id = $1', 'active = true'];
    const params = [userId];
    
    if (exceptSessionId) {
      conditions.push('id != $2');
      params.push(exceptSessionId);
    }
    
    const result = await pool.query(
      `UPDATE user_sessions 
       SET active = false, forced_logout = true
       WHERE ${conditions.join(' AND ')}`,
      params
    );
    
    logger.info(`Terminated ${result.rowCount} sessions for user ${userId}`);
    return { success: true, terminated: result.rowCount };
  } catch (error) {
    logger.error('Error terminating all sessions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean expired sessions
 */
export async function cleanExpiredSessions() {
  try {
    const result = await pool.query(
      `UPDATE user_sessions 
       SET active = false
       WHERE expires_at < NOW() AND active = true`
    );
    
    logger.info(`Cleaned ${result.rowCount} expired sessions`);
    return { success: true, cleaned: result.rowCount };
  } catch (error) {
    logger.error('Error cleaning expired sessions:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Detect suspicious activity
 */
export async function detectSuspiciousActivity(userId, ipAddress, userAgent) {
  try {
    // Get recent sessions for this user
    const result = await pool.query(
      `SELECT ip_address, user_agent, country
       FROM user_sessions
       WHERE user_id = $1 
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    
    // Simple checks for suspicious activity
    let suspicious = false;
    const reasons = [];
    
    // Check for new IP address
    const knownIPs = result.rows.map(s => s.ip_address);
    if (!knownIPs.includes(ipAddress)) {
      suspicious = true;
      reasons.push('New IP address');
    }
    
    // Check for multiple countries in short time
    const countries = [...new Set(result.rows.map(s => s.country).filter(Boolean))];
    if (countries.length > 2) {
      suspicious = true;
      reasons.push('Multiple countries');
    }
    
    return {
      suspicious,
      reasons,
      confidence: suspicious ? (reasons.length / 3) : 0,
    };
  } catch (error) {
    logger.error('Error detecting suspicious activity:', error);
    return { suspicious: false, reasons: [], confidence: 0 };
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(tenantId) {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE active = true) as active_sessions,
        COUNT(*) FILTER (WHERE suspicious = true) as suspicious_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(*) FILTER (WHERE device_type = 'mobile') as mobile_sessions,
        COUNT(*) FILTER (WHERE device_type = 'desktop') as desktop_sessions,
        COUNT(*) FILTER (WHERE device_type = 'tablet') as tablet_sessions
       FROM user_sessions
       WHERE tenant_id = $1 
         AND created_at > NOW() - INTERVAL '30 days'`,
      [tenantId]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting session stats:', error);
    throw error;
  }
}

/**
 * Parse device info from user agent
 */
export function parseDeviceInfo(userAgent) {
  const info = {
    userAgent,
    name: 'Unknown Device',
    type: 'desktop',
    browser: 'Unknown',
    os: 'Unknown',
  };
  
  if (!userAgent) return info;
  
  // Detect mobile/tablet
  if (/mobile/i.test(userAgent)) {
    info.type = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    info.type = 'tablet';
  }
  
  // Detect browser
  if (/chrome/i.test(userAgent) && !/edg/i.test(userAgent)) {
    info.browser = 'Chrome';
  } else if (/firefox/i.test(userAgent)) {
    info.browser = 'Firefox';
  } else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) {
    info.browser = 'Safari';
  } else if (/edg/i.test(userAgent)) {
    info.browser = 'Edge';
  }
  
  // Detect OS
  if (/windows/i.test(userAgent)) {
    info.os = 'Windows';
  } else if (/mac/i.test(userAgent)) {
    info.os = 'macOS';
  } else if (/linux/i.test(userAgent)) {
    info.os = 'Linux';
  } else if (/android/i.test(userAgent)) {
    info.os = 'Android';
  } else if (/ios|iphone|ipad/i.test(userAgent)) {
    info.os = 'iOS';
  }
  
  // Generate device name
  info.name = `${info.browser} on ${info.os}`;
  
  return info;
}

export default {
  createSession,
  getUserSessions,
  updateActivity,
  terminateSession,
  terminateAllSessions,
  cleanExpiredSessions,
  detectSuspiciousActivity,
  getSessionStats,
  parseDeviceInfo,
};
