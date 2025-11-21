import db from '../db/index.js';
import logger from '../config/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SEO Service
 * Manages SEO optimization, meta tags, sitemaps, and robots.txt
 */
class SEOService {
  /**
   * Analyze website SEO
   * @param {number} websiteId - Website ID
   * @returns {Promise<Object>} SEO analysis
   */
  async analyzeSEO(websiteId) {
    try {
      const query = `
        SELECT 
          w.*,
          d.domain_name
        FROM websites w
        JOIN domains d ON d.id = w.domain_id
        WHERE w.id = $1
      `;

      const result = await db.query(query, [websiteId]);
      
      if (result.rows.length === 0) {
        throw new Error('Website not found');
      }

      const website = result.rows[0];
      const domainName = website.domain_name;

      // SEO analysis (in production, this would crawl the site)
      const analysis = {
        score: 75, // out of 100
        issues: [],
        recommendations: [],
        meta: {
          title: website.meta_title || null,
          description: website.meta_description || null,
          keywords: website.meta_keywords || null,
          robots: website.robots_meta || 'index, follow'
        },
        technical: {
          ssl: website.ssl_enabled,
          sitemap: await this.checkSitemapExists(websiteId),
          robotsTxt: await this.checkRobotsTxtExists(websiteId),
          mobileOptimized: true,
          pageSpeed: {
            desktop: 82,
            mobile: 78
          }
        },
        onPage: {
          headings: { h1: 1, h2: 5, h3: 8 },
          images: { total: 12, withAlt: 10, withoutAlt: 2 },
          links: { internal: 45, external: 12, broken: 0 }
        },
        content: {
          wordCount: 1250,
          readability: 'Good',
          keywordDensity: 2.4
        }
      };

      // Add issues
      if (!website.ssl_enabled) {
        analysis.issues.push({
          severity: 'high',
          type: 'security',
          message: 'SSL certificate not installed',
          fix: 'Install SSL certificate to enable HTTPS'
        });
      }

      if (!website.meta_title) {
        analysis.issues.push({
          severity: 'high',
          type: 'meta',
          message: 'Missing meta title',
          fix: 'Add a descriptive meta title (50-60 characters)'
        });
      }

      if (!website.meta_description) {
        analysis.issues.push({
          severity: 'medium',
          type: 'meta',
          message: 'Missing meta description',
          fix: 'Add a compelling meta description (150-160 characters)'
        });
      }

      if (!analysis.technical.sitemap) {
        analysis.issues.push({
          severity: 'medium',
          type: 'technical',
          message: 'No sitemap.xml found',
          fix: 'Generate and submit sitemap to search engines'
        });
      }

      // Add recommendations
      analysis.recommendations.push(
        'Optimize images for web (compress and use modern formats like WebP)',
        'Add structured data (Schema.org) for better search results',
        'Improve internal linking structure',
        'Add alt text to all images',
        'Reduce page load time to under 3 seconds'
      );

      return analysis;
    } catch (error) {
      logger.error('Error analyzing SEO:', error);
      throw new Error('Failed to analyze SEO');
    }
  }

  /**
   * Update SEO meta tags
   * @param {number} websiteId - Website ID
   * @param {Object} meta - Meta tags
   * @returns {Promise<Object>} Updated website
   */
  async updateMetaTags(websiteId, meta) {
    try {
      const { title, description, keywords, robots, ogTitle, ogDescription, ogImage } = meta;

      const query = `
        UPDATE websites SET
          meta_title = COALESCE($2, meta_title),
          meta_description = COALESCE($3, meta_description),
          meta_keywords = COALESCE($4, meta_keywords),
          robots_meta = COALESCE($5, robots_meta),
          og_title = COALESCE($6, og_title),
          og_description = COALESCE($7, og_description),
          og_image = COALESCE($8, og_image),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await db.query(query, [
        websiteId,
        title,
        description,
        keywords,
        robots,
        ogTitle,
        ogDescription,
        ogImage
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating meta tags:', error);
      throw new Error('Failed to update meta tags');
    }
  }

  /**
   * Generate sitemap.xml
   * @param {number} websiteId - Website ID
   * @returns {Promise<string>} Sitemap XML
   */
  async generateSitemap(websiteId) {
    try {
      const query = `
        SELECT 
          w.*,
          d.domain_name
        FROM websites w
        JOIN domains d ON d.id = w.domain_id
        WHERE w.id = $1
      `;

      const result = await db.query(query, [websiteId]);
      
      if (result.rows.length === 0) {
        throw new Error('Website not found');
      }

      const website = result.rows[0];
      const domainName = website.domain_name;
      const protocol = website.ssl_enabled ? 'https' : 'http';
      const baseUrl = `${protocol}://${domainName}`;

      // In production, this would crawl the site for all pages
      const pages = [
        { url: '/', lastmod: new Date().toISOString(), priority: '1.0', changefreq: 'daily' },
        { url: '/about', lastmod: new Date().toISOString(), priority: '0.8', changefreq: 'weekly' },
        { url: '/services', lastmod: new Date().toISOString(), priority: '0.8', changefreq: 'weekly' },
        { url: '/contact', lastmod: new Date().toISOString(), priority: '0.7', changefreq: 'monthly' }
      ];

      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      pages.forEach(page => {
        sitemap += '  <url>\n';
        sitemap += `    <loc>${baseUrl}${page.url}</loc>\n`;
        sitemap += `    <lastmod>${page.lastmod}</lastmod>\n`;
        sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
        sitemap += `    <priority>${page.priority}</priority>\n`;
        sitemap += '  </url>\n';
      });

      sitemap += '</urlset>';

      // Save sitemap to website directory
      const sitemapPath = path.join(website.document_root, 'sitemap.xml');
      await fs.writeFile(sitemapPath, sitemap);

      // Record in database
      await db.query(
        'UPDATE websites SET sitemap_generated_at = NOW() WHERE id = $1',
        [websiteId]
      );

      return sitemap;
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      throw new Error('Failed to generate sitemap');
    }
  }

  /**
   * Generate robots.txt
   * @param {number} websiteId - Website ID
   * @param {Object} config - Robots.txt configuration
   * @returns {Promise<string>} Robots.txt content
   */
  async generateRobotsTxt(websiteId, config = {}) {
    try {
      const { userAgents = ['*'], disallow = [], allow = [], crawlDelay } = config;

      const query = `
        SELECT 
          w.*,
          d.domain_name
        FROM websites w
        JOIN domains d ON d.id = w.domain_id
        WHERE w.id = $1
      `;

      const result = await db.query(query, [websiteId]);
      
      if (result.rows.length === 0) {
        throw new Error('Website not found');
      }

      const website = result.rows[0];
      const domainName = website.domain_name;
      const protocol = website.ssl_enabled ? 'https' : 'http';

      let robotsTxt = '';

      userAgents.forEach(ua => {
        robotsTxt += `User-agent: ${ua}\n`;
        
        allow.forEach(path => {
          robotsTxt += `Allow: ${path}\n`;
        });
        
        disallow.forEach(path => {
          robotsTxt += `Disallow: ${path}\n`;
        });
        
        if (crawlDelay) {
          robotsTxt += `Crawl-delay: ${crawlDelay}\n`;
        }
        
        robotsTxt += '\n';
      });

      robotsTxt += `Sitemap: ${protocol}://${domainName}/sitemap.xml\n`;

      // Save robots.txt to website directory
      const robotsPath = path.join(website.document_root, 'robots.txt');
      await fs.writeFile(robotsPath, robotsTxt);

      return robotsTxt;
    } catch (error) {
      logger.error('Error generating robots.txt:', error);
      throw new Error('Failed to generate robots.txt');
    }
  }

  /**
   * Submit sitemap to search engines
   * @param {number} websiteId - Website ID
   * @returns {Promise<Object>} Submission results
   */
  async submitSitemap(websiteId) {
    try {
      const query = `
        SELECT 
          w.*,
          d.domain_name
        FROM websites w
        JOIN domains d ON d.id = w.domain_id
        WHERE w.id = $1
      `;

      const result = await db.query(query, [websiteId]);
      
      if (result.rows.length === 0) {
        throw new Error('Website not found');
      }

      const website = result.rows[0];
      const domainName = website.domain_name;
      const protocol = website.ssl_enabled ? 'https' : 'http';
      const sitemapUrl = `${protocol}://${domainName}/sitemap.xml`;

      // In production, this would ping search engines
      const results = {
        google: {
          submitted: true,
          url: `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
          timestamp: new Date().toISOString()
        },
        bing: {
          submitted: true,
          url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
          timestamp: new Date().toISOString()
        }
      };

      // Record submission
      await db.query(
        'UPDATE websites SET sitemap_submitted_at = NOW() WHERE id = $1',
        [websiteId]
      );

      return results;
    } catch (error) {
      logger.error('Error submitting sitemap:', error);
      throw new Error('Failed to submit sitemap');
    }
  }

  /**
   * Check if sitemap exists
   * @private
   */
  async checkSitemapExists(websiteId) {
    try {
      const result = await db.query(
        'SELECT sitemap_generated_at FROM websites WHERE id = $1',
        [websiteId]
      );
      return result.rows[0]?.sitemap_generated_at !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if robots.txt exists
   * @private
   */
  async checkRobotsTxtExists(websiteId) {
    try {
      const result = await db.query(
        'SELECT document_root FROM websites WHERE id = $1',
        [websiteId]
      );
      
      if (result.rows.length === 0) return false;
      
      const robotsPath = path.join(result.rows[0].document_root, 'robots.txt');
      await fs.access(robotsPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get keyword rankings (mock data for now)
   * @param {number} websiteId - Website ID
   * @returns {Promise<Array>} Keyword rankings
   */
  async getKeywordRankings(websiteId) {
    try {
      // In production, this would integrate with SEO tools like SEMrush or Ahrefs
      return [
        { keyword: 'web hosting', position: 12, volume: 12000, difficulty: 78 },
        { keyword: 'vps hosting', position: 8, volume: 5400, difficulty: 65 },
        { keyword: 'cloud hosting', position: 25, volume: 8900, difficulty: 72 }
      ];
    } catch (error) {
      logger.error('Error getting keyword rankings:', error);
      throw new Error('Failed to retrieve keyword rankings');
    }
  }
}

export default new SEOService();
