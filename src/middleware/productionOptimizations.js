import logger from '../config/logger.js';

/**
 * Additional Production Security & Performance Middleware
 * 
 * Provides extra layers of security and performance optimizations beyond basic helmet
 */

/**
 * Security headers middleware
 * Adds additional security headers beyond helmet defaults
 */
export function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // XSS Protection (legacy but still useful for old browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy (formerly Feature-Policy)
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()');
  
  // Expect-CT (Certificate Transparency)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Expect-CT', 'max-age=86400, enforce');
  }
  
  next();
}

/**
 * Cache control middleware
 * Sets appropriate caching headers based on route
 */
export function cacheControlMiddleware(req, res, next) {
  // Never cache API responses by default
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Cache static assets aggressively
  else if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // 1 year
  }
  
  // Short cache for HTML
  else if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
  }
  
  next();
}

/**
 * Request timeout middleware
 * Prevents requests from hanging indefinitely
 */
export function requestTimeoutMiddleware(timeout = 30000) {
  return (req, res, next) => {
    // Set timeout on request
    req.setTimeout(timeout, () => {
      logger.warn('Request timeout', {
        method: req.method,
        url: req.url,
        timeout,
        requestId: req.id
      });
      
      if (!res.headersSent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: 'The request took too long to process',
          requestId: req.id,
          timeout
        });
      }
    });
    
    // Set timeout on response
    res.setTimeout(timeout, () => {
      logger.warn('Response timeout', {
        method: req.method,
        url: req.url,
        timeout,
        requestId: req.id
      });
    });
    
    next();
  };
}

/**
 * Slow response logger
 * Logs responses that take longer than threshold
 */
export function slowResponseLogger(threshold = 1000) {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Capture original end function
    const originalEnd = res.end;
    
    // Override end function
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      
      if (duration > threshold) {
        logger.warn('Slow response detected', {
          method: req.method,
          url: req.url,
          duration,
          threshold,
          statusCode: res.statusCode,
          requestId: req.id,
          userAgent: req.headers['user-agent']
        });
      }
      
      // Call original end
      originalEnd.apply(res, args);
    };
    
    next();
  };
}

/**
 * IP address logger for audit
 * Logs client IP addresses for security auditing
 */
export function ipAuditMiddleware(req, res, next) {
  // Get real IP address (supports proxies)
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
             req.headers['x-real-ip'] ||
             req.connection.remoteAddress ||
             req.socket.remoteAddress;
  
  req.clientIp = ip;
  
  // Log sensitive operations
  if (req.method !== 'GET' && req.path.startsWith('/api/')) {
    logger.info('API modification request', {
      method: req.method,
      path: req.path,
      ip,
      requestId: req.id,
      userAgent: req.headers['user-agent']
    });
  }
  
  next();
}

/**
 * Request size validator
 * Already handled in body-parser, but adds extra logging
 */
export function requestSizeLogger(req, res, next) {
  const contentLength = req.headers['content-length'];
  
  if (contentLength) {
    const sizeInMB = parseInt(contentLength, 10) / (1024 * 1024);
    
    // Log large requests
    if (sizeInMB > 5) {
      logger.warn('Large request body detected', {
        size: `${sizeInMB.toFixed(2)}MB`,
        method: req.method,
        path: req.path,
        requestId: req.id,
        contentType: req.headers['content-type']
      });
    }
  }
  
  next();
}

/**
 * Development-only middleware
 * Adds helpful debugging information in development
 */
export function developmentMiddleware(req, res, next) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Request received', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      requestId: req.id
    });
  }
  
  next();
}

/**
 * Response time header
 * Adds X-Response-Time header to all responses
 */
export function responseTimeMiddleware(req, res, next) {
  const startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(...args) {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    originalSend.apply(res, args);
  };
  
  next();
}

export default {
  securityHeadersMiddleware,
  cacheControlMiddleware,
  requestTimeoutMiddleware,
  slowResponseLogger,
  ipAuditMiddleware,
  requestSizeLogger,
  developmentMiddleware,
  responseTimeMiddleware
};
