// src/services/cdn.js
/**
 * CDN Service for static asset optimization and delivery
 * Supports multiple CDN providers (CloudFlare, AWS CloudFront, custom CDN)
 */

import crypto from 'crypto';
import path from 'path';
import logger from '../config/logger.js';

class CDNService {
  constructor() {
    this.enabled = process.env.CDN_ENABLED === 'true';
    this.provider = process.env.CDN_PROVIDER || 'cloudflare';
    this.baseUrl = process.env.CDN_BASE_URL || '';
    this.zoneId = process.env.CDN_ZONE_ID || '';
    this.apiKey = process.env.CDN_API_KEY || '';
    this.signUrls = process.env.CDN_SIGN_URLS === 'true';
    this.signSecret = process.env.CDN_SIGN_SECRET || '';
  }

  /**
   * Get CDN URL for asset
   */
  getUrl(assetPath, options = {}) {
    if (!this.enabled || !this.baseUrl) {
      return assetPath;
    }

    const {
      width,
      height,
      quality,
      format,
      expires,
    } = options;

    // Build CDN URL
    let url = `${this.baseUrl}${assetPath}`;

    // Add image optimization parameters (Cloudflare-style)
    const params = [];
    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    if (quality) params.push(`quality=${quality}`);
    if (format) params.push(`format=${format}`);

    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    // Sign URL if required
    if (this.signUrls && this.signSecret) {
      const signature = this.signUrl(url, expires);
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}signature=${signature}`;
      
      if (expires) {
        url += `&expires=${expires}`;
      }
    }

    return url;
  }

  /**
   * Generate signed URL
   */
  signUrl(url, expires = null) {
    const expiryTime = expires || Math.floor(Date.now() / 1000) + 3600;
    const message = `${url}${expiryTime}`;
    
    return crypto
      .createHmac('sha256', this.signSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Purge CDN cache for specific URLs
   */
  async purgeUrls(urls) {
    if (!this.enabled) {
      logger.info('CDN disabled, skipping purge');
      return { success: true, purged: 0 };
    }

    try {
      switch (this.provider) {
        case 'cloudflare':
          return await this.purgeCloudflare(urls);
        case 'cloudfront':
          return await this.purgeCloudFront(urls);
        default:
          logger.warn(`CDN provider ${this.provider} not supported for purge`);
          return { success: false, error: 'Provider not supported' };
      }
    } catch (error) {
      logger.error('CDN purge error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Purge Cloudflare cache
   */
  async purgeCloudflare(urls) {
    if (!this.apiKey || !this.zoneId) {
      throw new Error('Cloudflare credentials not configured');
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Cloudflare purge failed: ${JSON.stringify(result.errors)}`);
    }

    logger.info(`Purged ${urls.length} URLs from Cloudflare CDN`);
    return { success: true, purged: urls.length };
  }

  /**
   * Purge AWS CloudFront cache
   */
  async purgeCloudFront(urls) {
    // Placeholder for CloudFront integration
    logger.warn('CloudFront purge not implemented yet');
    return { success: false, error: 'Not implemented' };
  }

  /**
   * Purge all CDN cache
   */
  async purgeAll() {
    if (!this.enabled) {
      return { success: true };
    }

    try {
      switch (this.provider) {
        case 'cloudflare':
          return await this.purgeAllCloudflare();
        default:
          logger.warn(`CDN provider ${this.provider} not supported for purge all`);
          return { success: false, error: 'Provider not supported' };
      }
    } catch (error) {
      logger.error('CDN purge all error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Purge all Cloudflare cache
   */
  async purgeAllCloudflare() {
    if (!this.apiKey || !this.zoneId) {
      throw new Error('Cloudflare credentials not configured');
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ purge_everything: true }),
      }
    );

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Cloudflare purge all failed: ${JSON.stringify(result.errors)}`);
    }

    logger.info('Purged all content from Cloudflare CDN');
    return { success: true };
  }

  /**
   * Get asset optimization recommendations
   */
  getOptimizationHints(assetPath) {
    const ext = path.extname(assetPath).toLowerCase();
    
    const hints = {
      cacheTTL: 86400, // 1 day default
      compress: true,
      transform: null,
    };

    // Image optimizations
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      hints.transform = 'image';
      hints.quality = 85;
      hints.format = 'webp'; // Convert to WebP for better compression
      hints.cacheTTL = 604800; // 7 days
    }

    // JavaScript/CSS optimizations
    if (['.js', '.css'].includes(ext)) {
      hints.minify = true;
      hints.cacheTTL = 2592000; // 30 days (long cache for versioned assets)
    }

    // Font optimizations
    if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
      hints.cacheTTL = 31536000; // 1 year (fonts rarely change)
      hints.compress = false; // Fonts are pre-compressed
    }

    // Video optimizations
    if (['.mp4', '.webm', '.mov'].includes(ext)) {
      hints.cacheTTL = 604800; // 7 days
      hints.compress = false; // Videos are pre-compressed
    }

    return hints;
  }

  /**
   * Generate responsive image URLs
   */
  getResponsiveUrls(imagePath) {
    const sizes = [
      { width: 320, suffix: 'sm' },
      { width: 640, suffix: 'md' },
      { width: 1024, suffix: 'lg' },
      { width: 1920, suffix: 'xl' },
    ];

    return sizes.map(({ width, suffix }) => ({
      url: this.getUrl(imagePath, { width, quality: 85, format: 'webp' }),
      width,
      suffix,
    }));
  }

  /**
   * Get CDN statistics (if supported by provider)
   */
  async getStats(period = '1d') {
    // Placeholder for CDN analytics
    logger.info(`Fetching CDN stats for period: ${period}`);
    return {
      requests: 0,
      bandwidth: 0,
      cacheHitRate: 0,
    };
  }
}

// Export singleton instance
export const cdn = new CDNService();

export default cdn;
