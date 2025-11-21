/**
 * Request ID Middleware
 * Adds unique request IDs for distributed tracing and log correlation
 */

import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';

/**
 * Request ID middleware
 * Generates or uses existing X-Request-ID header
 */
export function requestIdMiddleware(req, res, next) {
  // Get request ID from header or generate new one
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Store on request object
  req.id = requestId;
  
  // Set response header
  res.setHeader('X-Request-ID', requestId);
  
  // Add to logger context
  req.log = logger.child({ requestId });
  
  next();
}

/**
 * Request logging middleware
 * Logs all incoming requests with request ID
 */
export function requestLoggingMiddleware(req, res, next) {
  const startTime = Date.now();
  
  // Log request
  req.log.info({
    type: 'request',
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    req.log.info({
      type: 'response',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length')
    });
  });
  
  next();
}

export default {
  requestIdMiddleware,
  requestLoggingMiddleware
};
