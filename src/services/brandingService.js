import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';
import logger from '../config/logger.js';
import { cache, CacheTTL, CacheNamespace } from './cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Branding Service
 * Manages white-label customization and tenant branding
 */
class BrandingService {
  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/branding');
    this.defaultTheme = {
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
      accentColor: '#10b981',
      backgroundColor: '#ffffff',
      textColor: '#1f2937',
      linkColor: '#3b82f6',
      errorColor: '#ef4444',
      successColor: '#10b981',
      warningColor: '#f59e0b',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '0.5rem'
    };
  }

  /**
   * Initialize upload directory
   */
  async initialize() {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      logger.info('Branding upload directory initialized');
    } catch (error) {
      logger.error('Error initializing branding directory:', error);
    }
  }

  /**
   * Get tenant branding configuration
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object>} Branding configuration
   */
  async getBranding(tenantId) {
    const cacheKey = `branding:${tenantId}`;
    
    // Try cache first
    const cached = await cache.get(CacheNamespace.USER, cacheKey);
    if (cached) return cached;

    try {
      const query = `
        SELECT 
          id,
          tenant_id,
          company_name,
          logo_url,
          favicon_url,
          theme,
          custom_css,
          custom_domain,
          email_from_name,
          email_from_address,
          support_email,
          support_phone,
          footer_text,
          privacy_policy_url,
          terms_of_service_url,
          meta_title,
          meta_description,
          meta_keywords,
          social_links,
          is_active,
          created_at,
          updated_at
        FROM tenant_branding
        WHERE tenant_id = $1 AND is_active = true
        LIMIT 1
      `;

      const result = await db.query(query, [tenantId]);
      
      if (result.rows.length === 0) {
        // Return default branding
        return this._getDefaultBranding(tenantId);
      }

      const branding = {
        ...result.rows[0],
        theme: result.rows[0].theme || this.defaultTheme
      };

      // Cache for 1 day
      await cache.set(CacheNamespace.USER, cacheKey, branding, CacheTTL.DAY);
      
      return branding;
    } catch (error) {
      logger.error('Error getting branding:', error);
      throw new Error('Failed to retrieve branding configuration');
    }
  }

  /**
   * Update tenant branding
   * @param {string} tenantId - Tenant ID
   * @param {Object} branding - Branding configuration
   * @returns {Promise<Object>} Updated branding
   */
  async updateBranding(tenantId, branding) {
    try {
      const {
        companyName,
        theme,
        customCss,
        customDomain,
        emailFromName,
        emailFromAddress,
        supportEmail,
        supportPhone,
        footerText,
        privacyPolicyUrl,
        termsOfServiceUrl,
        metaTitle,
        metaDescription,
        metaKeywords,
        socialLinks
      } = branding;

      // Check if branding exists
      const checkQuery = 'SELECT id FROM tenant_branding WHERE tenant_id = $1';
      const checkResult = await db.query(checkQuery, [tenantId]);

      let query;
      let values;

      if (checkResult.rows.length > 0) {
        // Update existing
        query = `
          UPDATE tenant_branding SET
            company_name = COALESCE($2, company_name),
            theme = COALESCE($3::jsonb, theme),
            custom_css = COALESCE($4, custom_css),
            custom_domain = COALESCE($5, custom_domain),
            email_from_name = COALESCE($6, email_from_name),
            email_from_address = COALESCE($7, email_from_address),
            support_email = COALESCE($8, support_email),
            support_phone = COALESCE($9, support_phone),
            footer_text = COALESCE($10, footer_text),
            privacy_policy_url = COALESCE($11, privacy_policy_url),
            terms_of_service_url = COALESCE($12, terms_of_service_url),
            meta_title = COALESCE($13, meta_title),
            meta_description = COALESCE($14, meta_description),
            meta_keywords = COALESCE($15, meta_keywords),
            social_links = COALESCE($16::jsonb, social_links),
            updated_at = NOW()
          WHERE tenant_id = $1
          RETURNING *
        `;
        values = [
          tenantId,
          companyName,
          theme ? JSON.stringify(theme) : null,
          customCss,
          customDomain,
          emailFromName,
          emailFromAddress,
          supportEmail,
          supportPhone,
          footerText,
          privacyPolicyUrl,
          termsOfServiceUrl,
          metaTitle,
          metaDescription,
          metaKeywords,
          socialLinks ? JSON.stringify(socialLinks) : null
        ];
      } else {
        // Insert new
        query = `
          INSERT INTO tenant_branding (
            tenant_id, company_name, theme, custom_css, custom_domain,
            email_from_name, email_from_address, support_email, support_phone,
            footer_text, privacy_policy_url, terms_of_service_url,
            meta_title, meta_description, meta_keywords, social_links
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `;
        values = [
          tenantId,
          companyName,
          theme ? JSON.stringify(theme) : JSON.stringify(this.defaultTheme),
          customCss,
          customDomain,
          emailFromName,
          emailFromAddress,
          supportEmail,
          supportPhone,
          footerText,
          privacyPolicyUrl,
          termsOfServiceUrl,
          metaTitle,
          metaDescription,
          metaKeywords,
          socialLinks ? JSON.stringify(socialLinks) : null
        ];
      }

      const result = await db.query(query, values);
      
      // Invalidate cache
      await cache.del(CacheNamespace.USER, `branding:${tenantId}`);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating branding:', error);
      throw new Error('Failed to update branding configuration');
    }
  }

  /**
   * Upload logo
   * @param {string} tenantId - Tenant ID
   * @param {Object} file - Uploaded file
   * @returns {Promise<string>} Logo URL
   */
  async uploadLogo(tenantId, file) {
    try {
      const filename = `logo-${tenantId}-${Date.now()}${path.extname(file.originalname)}`;
      const filepath = path.join(this.uploadDir, filename);
      
      await fs.writeFile(filepath, file.buffer);
      
      const logoUrl = `/uploads/branding/${filename}`;
      
      // Update database
      const query = `
        UPDATE tenant_branding 
        SET logo_url = $1, updated_at = NOW()
        WHERE tenant_id = $2
        RETURNING logo_url
      `;
      
      await db.query(query, [logoUrl, tenantId]);
      
      // Invalidate cache
      await cache.del(CacheNamespace.USER, `branding:${tenantId}`);
      
      return logoUrl;
    } catch (error) {
      logger.error('Error uploading logo:', error);
      throw new Error('Failed to upload logo');
    }
  }

  /**
   * Upload favicon
   * @param {string} tenantId - Tenant ID
   * @param {Object} file - Uploaded file
   * @returns {Promise<string>} Favicon URL
   */
  async uploadFavicon(tenantId, file) {
    try {
      const filename = `favicon-${tenantId}-${Date.now()}${path.extname(file.originalname)}`;
      const filepath = path.join(this.uploadDir, filename);
      
      await fs.writeFile(filepath, file.buffer);
      
      const faviconUrl = `/uploads/branding/${filename}`;
      
      // Update database
      const query = `
        UPDATE tenant_branding 
        SET favicon_url = $1, updated_at = NOW()
        WHERE tenant_id = $2
        RETURNING favicon_url
      `;
      
      await db.query(query, [faviconUrl, tenantId]);
      
      // Invalidate cache
      await cache.del(CacheNamespace.USER, `branding:${tenantId}`);
      
      return faviconUrl;
    } catch (error) {
      logger.error('Error uploading favicon:', error);
      throw new Error('Failed to upload favicon');
    }
  }

  /**
   * Generate CSS from theme
   * @param {Object} theme - Theme configuration
   * @returns {string} Generated CSS
   */
  generateThemeCSS(theme) {
    return `
:root {
  --primary-color: ${theme.primaryColor || this.defaultTheme.primaryColor};
  --secondary-color: ${theme.secondaryColor || this.defaultTheme.secondaryColor};
  --accent-color: ${theme.accentColor || this.defaultTheme.accentColor};
  --background-color: ${theme.backgroundColor || this.defaultTheme.backgroundColor};
  --text-color: ${theme.textColor || this.defaultTheme.textColor};
  --link-color: ${theme.linkColor || this.defaultTheme.linkColor};
  --error-color: ${theme.errorColor || this.defaultTheme.errorColor};
  --success-color: ${theme.successColor || this.defaultTheme.successColor};
  --warning-color: ${theme.warningColor || this.defaultTheme.warningColor};
  --font-family: ${theme.fontFamily || this.defaultTheme.fontFamily};
  --border-radius: ${theme.borderRadius || this.defaultTheme.borderRadius};
}

body {
  font-family: var(--font-family);
  background-color: var(--background-color);
  color: var(--text-color);
}

a {
  color: var(--link-color);
}

.btn-primary {
  background-color: var(--primary-color);
  border-radius: var(--border-radius);
}

.btn-secondary {
  background-color: var(--secondary-color);
  border-radius: var(--border-radius);
}

.alert-error {
  color: var(--error-color);
}

.alert-success {
  color: var(--success-color);
}

.alert-warning {
  color: var(--warning-color);
}
    `.trim();
  }

  /**
   * Get email template with branding
   * @param {string} tenantId - Tenant ID
   * @param {string} templateName - Template name
   * @param {Object} variables - Template variables
   * @returns {Promise<string>} Rendered email HTML
   */
  async getEmailTemplate(tenantId, templateName, variables = {}) {
    try {
      const branding = await this.getBranding(tenantId);
      
      // Load base template
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
      let template = await fs.readFile(templatePath, 'utf-8');
      
      // Replace branding variables
      template = template
        .replace(/{{companyName}}/g, branding.company_name || 'MPanel')
        .replace(/{{logoUrl}}/g, branding.logo_url || '')
        .replace(/{{primaryColor}}/g, branding.theme?.primaryColor || this.defaultTheme.primaryColor)
        .replace(/{{supportEmail}}/g, branding.support_email || '')
        .replace(/{{footerText}}/g, branding.footer_text || '');
      
      // Replace custom variables
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, variables[key]);
      });
      
      return template;
    } catch (error) {
      logger.error('Error getting email template:', error);
      throw new Error('Failed to load email template');
    }
  }

  /**
   * Validate custom domain
   * @param {string} domain - Domain name
   * @returns {Promise<boolean>} Is valid
   */
  async validateCustomDomain(domain) {
    // Basic domain validation
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
    
    if (!domainRegex.test(domain)) {
      return false;
    }
    
    // Check if domain is already in use
    const query = `
      SELECT id FROM tenant_branding 
      WHERE custom_domain = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [domain]);
    
    return result.rows.length === 0;
  }

  /**
   * Get default branding
   * @private
   */
  _getDefaultBranding(tenantId) {
    return {
      tenant_id: tenantId,
      company_name: 'MPanel',
      logo_url: null,
      favicon_url: null,
      theme: this.defaultTheme,
      custom_css: null,
      custom_domain: null,
      email_from_name: 'MPanel',
      email_from_address: process.env.DEFAULT_FROM_EMAIL,
      support_email: process.env.SUPPORT_EMAIL,
      support_phone: null,
      footer_text: '© 2024 MPanel. All rights reserved.',
      privacy_policy_url: null,
      terms_of_service_url: null,
      meta_title: 'MPanel - Hosting Control Panel',
      meta_description: 'Professional hosting control panel',
      meta_keywords: null,
      social_links: null,
      is_active: true
    };
  }
}

export default new BrandingService();
