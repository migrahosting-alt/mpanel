// src/middleware/compression.js
/**
 * Advanced compression middleware with content-type awareness
 * Supports gzip, brotli, and configurable compression levels
 */

import compression from 'compression';
import logger from '../config/logger.js';

/**
 * Determine if response should be compressed
 */
function shouldCompress(req, res) {
  // Don't compress if client doesn't support it
  if (!req.headers['accept-encoding']) {
    return false;
  }

  // Don't compress already compressed files
  const contentType = res.getHeader('Content-Type');
  if (typeof contentType === 'string') {
    const uncompressibleTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-rar',
    ];

    if (uncompressibleTypes.some(type => contentType.includes(type))) {
      return false;
    }
  }

  // Use default compression filter
  return compression.filter(req, res);
}

/**
 * Compression middleware with smart defaults
 */
export const compressionMiddleware = compression({
  filter: shouldCompress,
  level: parseInt(process.env.COMPRESSION_LEVEL) || 6, // 1-9, 6 is good balance
  threshold: parseInt(process.env.COMPRESSION_THRESHOLD) || 1024, // Minimum bytes
  memLevel: 8, // Memory usage (1-9)
  strategy: 'DEFAULT_STRATEGY',
});

/**
 * Set optimal cache headers based on content type
 */
export function cacheHeaders(req, res, next) {
  const url = req.url || '';
  const contentType = res.getHeader('Content-Type') || '';

  // Static assets with hash/version in URL (immutable)
  if (
    url.match(/\.(js|css|woff|woff2|ttf|otf|eot)(\?.*)?$/) &&
    (url.includes('?v=') || url.match(/\.[a-f0-9]{8,}\./))
  ) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    next();
    return;
  }

  // Images
  if (contentType.startsWith('image/')) {
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    next();
    return;
  }

  // Fonts
  if (contentType.match(/font|woff/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    next();
    return;
  }

  // JavaScript/CSS (without hash)
  if (contentType.match(/javascript|css/)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    next();
    return;
  }

  // HTML (short cache)
  if (contentType.includes('html')) {
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // 5 minutes
    next();
    return;
  }

  // API responses (no cache by default)
  if (url.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  next();
}

/**
 * Add security and performance headers
 */
export function securityHeaders(req, res, next) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Performance hints
  res.setHeader('X-DNS-Prefetch-Control', 'on');
  
  next();
}

/**
 * ETags for conditional requests
 */
export function etagMiddleware(req, res, next) {
  const originalSend = res.send;

  res.send = function(data) {
    // Only add ETag for successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const etag = `"${Buffer.from(data).toString('base64').substring(0, 27)}"`;
      res.setHeader('ETag', etag);

      // Check If-None-Match header
      if (req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return res;
      }
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Log compression statistics
 */
export function compressionStats(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function(...args) {
    const duration = Date.now() - start;
    const size = res.getHeader('Content-Length');
    const encoding = res.getHeader('Content-Encoding');

    if (duration > 1000 || (size && size > 1000000)) {
      logger.info('Slow/Large response', {
        method: req.method,
        url: req.url,
        duration,
        size,
        encoding,
      });
    }

    return originalEnd.apply(this, args);
  };

  next();
}

export default {
  compressionMiddleware,
  cacheHeaders,
  securityHeaders,
  etagMiddleware,
  compressionStats,
};
