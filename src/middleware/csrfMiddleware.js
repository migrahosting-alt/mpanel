import crypto from 'crypto';
import logger from '../config/logger.js';

/**
 * CSRF Protection Middleware
 * Generates and validates CSRF tokens for state-changing requests
 */

const CSRF_SECRET = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate CSRF token
 * @param {string} sessionId - Session identifier
 * @returns {string} CSRF token
 */
export const generateToken = (sessionId) => {
  const timestamp = Date.now().toString();
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const data = `${sessionId}:${timestamp}:${token}`;
  
  const hmac = crypto.createHmac('sha256', CSRF_SECRET);
  hmac.update(data);
  const signature = hmac.digest('hex');
  
  return Buffer.from(`${data}:${signature}`).toString('base64');
};

/**
 * Validate CSRF token
 * @param {string} token - CSRF token to validate
 * @param {string} sessionId - Current session identifier
 * @returns {boolean} Is valid
 */
export const validateToken = (token, sessionId) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return false;
    }
    
    const [tokenSessionId, timestamp, randomToken, signature] = parts;
    
    // Verify session matches
    if (tokenSessionId !== sessionId) {
      return false;
    }
    
    // Verify timestamp (token valid for 1 hour)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    if (now - tokenTime > maxAge) {
      return false;
    }
    
    // Verify HMAC signature
    const data = `${tokenSessionId}:${timestamp}:${randomToken}`;
    const hmac = crypto.createHmac('sha256', CSRF_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('CSRF token validation error:', error);
    return false;
  }
};

/**
 * CSRF middleware
 * Validates CSRF tokens on state-changing requests
 */
export const csrfProtection = (options = {}) => {
  const {
    excludePaths = ['/api/auth/login', '/api/auth/register', '/api/webhooks'],
    headerName = 'x-csrf-token',
    cookieName = 'csrf-token',
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS']
  } = options;
  
  return (req, res, next) => {
    // Skip for excluded paths
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }
    
    // Skip for safe methods
    if (ignoreMethods.includes(req.method)) {
      // Generate and attach token for safe requests
      const sessionId = req.session?.id || req.user?.id || req.ip;
      const token = generateToken(sessionId);
      
      res.setHeader(headerName, token);
      res.cookie(cookieName, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 1000 // 1 hour
      });
      
      return next();
    }
    
    // Validate token for state-changing requests
    const token = req.headers[headerName] || req.cookies[cookieName] || req.body._csrf;
    const sessionId = req.session?.id || req.user?.id || req.ip;
    
    if (!token) {
      return res.status(403).json({
        error: 'CSRF token missing',
        message: 'CSRF token is required for this request'
      });
    }
    
    if (!validateToken(token, sessionId)) {
      return res.status(403).json({
        error: 'CSRF token invalid',
        message: 'Invalid or expired CSRF token'
      });
    }
    
    next();
  };
};

/**
 * Generate CSRF token endpoint
 */
export const getCsrfToken = (req, res) => {
  const sessionId = req.session?.id || req.user?.id || req.ip;
  const token = generateToken(sessionId);
  
  res.json({ csrfToken: token });
};
