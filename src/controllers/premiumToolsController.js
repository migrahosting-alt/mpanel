import integrationService from '../services/integrationService.js';
import seoService from '../services/seoService.js';
import oneClickInstallerService from '../services/oneClickInstallerService.js';
import aiBuilderService from '../services/aiBuilderService.js';
import logger from '../config/logger.js';
import { validateRequest } from '../middleware/validation.js';
import Joi from 'joi';

/**
 * Premium Tools Controller
 * Handles all premium tool operations
 */
class PremiumToolsController {
  // ============================================
  // Integration Management
  // ============================================

  /**
   * Connect Google Analytics
   */
  async connectGoogleAnalytics(req, res) {
    try {
      const { websiteId, measurementId, propertyId, apiKey } = req.body;

      const result = await integrationService.connectGoogleAnalytics(websiteId, {
        measurementId,
        propertyId,
        apiKey
      });

      res.json({
        success: true,
        message: 'Google Analytics connected successfully',
        integration: result
      });
    } catch (error) {
      logger.error('Error connecting Google Analytics:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Connect Google Search Console
   */
  async connectGoogleSearchConsole(req, res) {
    try {
      const { websiteId, siteUrl, verificationToken } = req.body;

      const result = await integrationService.connectGoogleSearchConsole(websiteId, {
        siteUrl,
        verificationToken
      });

      res.json({
        success: true,
        message: 'Google Search Console connected (verification pending)',
        integration: result
      });
    } catch (error) {
      logger.error('Error connecting Google Search Console:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Connect Google My Business
   */
  async connectGoogleMyBusiness(req, res) {
    try {
      const { websiteId, locationId, accountId, apiKey } = req.body;

      const result = await integrationService.connectGoogleMyBusiness(websiteId, {
        locationId,
        accountId,
        apiKey
      });

      res.json({
        success: true,
        message: 'Google My Business connected successfully',
        integration: result
      });
    } catch (error) {
      logger.error('Error connecting Google My Business:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Connect Facebook Pixel
   */
  async connectFacebookPixel(req, res) {
    try {
      const { websiteId, pixelId, accessToken } = req.body;

      const result = await integrationService.connectFacebookPixel(websiteId, {
        pixelId,
        accessToken
      });

      res.json({
        success: true,
        message: 'Facebook Pixel connected successfully',
        integration: result
      });
    } catch (error) {
      logger.error('Error connecting Facebook Pixel:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Connect social media
   */
  async connectSocialMedia(req, res) {
    try {
      const { websiteId, platform, accountId, accessToken, refreshToken } = req.body;

      const result = await integrationService.connectSocialMedia(websiteId, {
        platform,
        accountId,
        accessToken,
        refreshToken
      });

      res.json({
        success: true,
        message: `${platform} connected successfully`,
        integration: result
      });
    } catch (error) {
      logger.error('Error connecting social media:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all integrations for a website
   */
  async getIntegrations(req, res) {
    try {
      const { websiteId } = req.params;

      const integrations = await integrationService.getIntegrations(parseInt(websiteId));

      res.json({
        success: true,
        integrations
      });
    } catch (error) {
      logger.error('Error getting integrations:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Disconnect integration
   */
  async disconnectIntegration(req, res) {
    try {
      const { integrationId } = req.params;

      await integrationService.disconnectIntegration(parseInt(integrationId));

      res.json({
        success: true,
        message: 'Integration disconnected successfully'
      });
    } catch (error) {
      logger.error('Error disconnecting integration:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get Google Analytics data
   */
  async getAnalyticsData(req, res) {
    try {
      const { integrationId } = req.params;
      const { startDate, endDate, metrics } = req.query;

      const data = await integrationService.getGoogleAnalyticsData(parseInt(integrationId), {
        startDate,
        endDate,
        metrics: metrics ? metrics.split(',') : undefined
      });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error('Error getting analytics data:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // SEO Tools
  // ============================================

  /**
   * Analyze SEO
   */
  async analyzeSEO(req, res) {
    try {
      const { websiteId } = req.params;

      const analysis = await seoService.analyzeSEO(parseInt(websiteId));

      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      logger.error('Error analyzing SEO:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update meta tags
   */
  async updateMetaTags(req, res) {
    try {
      const { websiteId } = req.params;
      const { title, description, keywords, robots, ogTitle, ogDescription, ogImage } = req.body;

      const result = await seoService.updateMetaTags(parseInt(websiteId), {
        title,
        description,
        keywords,
        robots,
        ogTitle,
        ogDescription,
        ogImage
      });

      res.json({
        success: true,
        message: 'Meta tags updated successfully',
        result
      });
    } catch (error) {
      logger.error('Error updating meta tags:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate sitemap
   */
  async generateSitemap(req, res) {
    try {
      const { websiteId } = req.params;

      const result = await seoService.generateSitemap(parseInt(websiteId));

      res.json({
        success: true,
        message: 'Sitemap generated successfully',
        sitemap: result
      });
    } catch (error) {
      logger.error('Error generating sitemap:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Generate robots.txt
   */
  async generateRobotsTxt(req, res) {
    try {
      const { websiteId } = req.params;
      const { userAgents, disallow, allow, crawlDelay } = req.body;

      const result = await seoService.generateRobotsTxt(parseInt(websiteId), {
        userAgents,
        disallow,
        allow,
        crawlDelay
      });

      res.json({
        success: true,
        message: 'robots.txt generated successfully',
        content: result
      });
    } catch (error) {
      logger.error('Error generating robots.txt:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Submit sitemap to search engines
   */
  async submitSitemap(req, res) {
    try {
      const { websiteId } = req.params;

      const result = await seoService.submitSitemap(parseInt(websiteId));

      res.json({
        success: true,
        message: 'Sitemap submitted to search engines',
        result
      });
    } catch (error) {
      logger.error('Error submitting sitemap:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get keyword rankings
   */
  async getKeywordRankings(req, res) {
    try {
      const { websiteId } = req.params;

      const rankings = await seoService.getKeywordRankings(parseInt(websiteId));

      res.json({
        success: true,
        rankings
      });
    } catch (error) {
      logger.error('Error getting keyword rankings:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // One-Click Installers
  // ============================================

  /**
   * Get available installers
   */
  async getAvailableInstallers(req, res) {
    try {
      const installers = oneClickInstallerService.getAvailableInstallers();

      res.json({
        success: true,
        installers
      });
    } catch (error) {
      logger.error('Error getting installers:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Install WordPress
   */
  async installWordPress(req, res) {
    try {
      const {
        websiteId,
        databaseId,
        adminUser,
        adminPassword,
        adminEmail,
        siteTitle,
        siteUrl,
        locale
      } = req.body;

      const result = await oneClickInstallerService.installWordPress({
        websiteId,
        databaseId,
        adminUser,
        adminPassword,
        adminEmail,
        siteTitle,
        siteUrl,
        locale
      });

      res.json({
        success: true,
        message: 'WordPress installation started',
        result
      });
    } catch (error) {
      logger.error('Error installing WordPress:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Install application
   */
  async installApplication(req, res) {
    try {
      const { app } = req.params;
      const config = req.body;

      const result = await oneClickInstallerService.installApplication(app, config);

      res.json({
        success: true,
        message: `${app} installation started`,
        result
      });
    } catch (error) {
      logger.error('Error installing application:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get installation status
   */
  async getInstallationStatus(req, res) {
    try {
      const { installationId } = req.params;

      const status = await oneClickInstallerService.getInstallationStatus(parseInt(installationId));

      res.json({
        success: true,
        status
      });
    } catch (error) {
      logger.error('Error getting installation status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all installations for a website
   */
  async getInstallations(req, res) {
    try {
      const { websiteId } = req.params;

      const installations = await oneClickInstallerService.getInstallations(parseInt(websiteId));

      res.json({
        success: true,
        installations
      });
    } catch (error) {
      logger.error('Error getting installations:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // ============================================
  // AI Website Builder
  // ============================================

  /**
   * Get available templates
   */
  async getAvailableTemplates(req, res) {
    try {
      const templates = aiBuilderService.getAvailableTemplates();

      res.json({
        success: true,
        templates
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get available color schemes
   */
  async getAvailableColorSchemes(req, res) {
    try {
      const colorSchemes = aiBuilderService.getAvailableColorSchemes();

      res.json({
        success: true,
        colorSchemes
      });
    } catch (error) {
      logger.error('Error getting color schemes:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create AI website
   */
  async createAIWebsite(req, res) {
    try {
      const {
        websiteId,
        businessType,
        businessName,
        businessDescription,
        template,
        colorScheme,
        features,
        language
      } = req.body;

      const result = await aiBuilderService.createWebsite({
        websiteId,
        businessType,
        businessName,
        businessDescription,
        template,
        colorScheme,
        features,
        language
      });

      res.json({
        success: true,
        message: 'AI website generated successfully',
        result
      });
    } catch (error) {
      logger.error('Error creating AI website:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get AI builder project
   */
  async getAIProject(req, res) {
    try {
      const { projectId } = req.params;

      const project = await aiBuilderService.getProject(parseInt(projectId));

      res.json({
        success: true,
        project
      });
    } catch (error) {
      logger.error('Error getting AI project:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all AI projects for a website
   */
  async getAIProjects(req, res) {
    try {
      const { websiteId } = req.params;

      const projects = await aiBuilderService.getProjects(parseInt(websiteId));

      res.json({
        success: true,
        projects
      });
    } catch (error) {
      logger.error('Error getting AI projects:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

// Validation schemas
export const premiumToolsValidation = {
  connectGoogleAnalytics: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      measurementId: Joi.string().required(),
      propertyId: Joi.string().required(),
      apiKey: Joi.string().required()
    })
  },

  connectGoogleSearchConsole: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      siteUrl: Joi.string().uri().required(),
      verificationToken: Joi.string().required()
    })
  },

  connectGoogleMyBusiness: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      locationId: Joi.string().required(),
      accountId: Joi.string().required(),
      apiKey: Joi.string().required()
    })
  },

  connectFacebookPixel: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      pixelId: Joi.string().required(),
      accessToken: Joi.string().required()
    })
  },

  connectSocialMedia: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      platform: Joi.string().valid('facebook', 'twitter', 'instagram', 'linkedin').required(),
      accountId: Joi.string().required(),
      accessToken: Joi.string().required(),
      refreshToken: Joi.string().optional()
    })
  },

  updateMetaTags: {
    body: Joi.object({
      title: Joi.string().max(70).optional(),
      description: Joi.string().max(160).optional(),
      keywords: Joi.string().optional(),
      robots: Joi.string().optional(),
      ogTitle: Joi.string().optional(),
      ogDescription: Joi.string().optional(),
      ogImage: Joi.string().uri().optional()
    })
  },

  generateRobotsTxt: {
    body: Joi.object({
      userAgents: Joi.array().items(Joi.string()).optional(),
      disallow: Joi.array().items(Joi.string()).optional(),
      allow: Joi.array().items(Joi.string()).optional(),
      crawlDelay: Joi.number().optional()
    })
  },

  installWordPress: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      databaseId: Joi.number().integer().required(),
      adminUser: Joi.string().alphanum().min(3).required(),
      adminPassword: Joi.string().min(8).required(),
      adminEmail: Joi.string().email().required(),
      siteTitle: Joi.string().required(),
      siteUrl: Joi.string().uri().required(),
      locale: Joi.string().default('en_US')
    })
  },

  createAIWebsite: {
    body: Joi.object({
      websiteId: Joi.number().integer().required(),
      businessType: Joi.string().required(),
      businessName: Joi.string().required(),
      businessDescription: Joi.string().max(500).optional(),
      template: Joi.string().valid('business', 'ecommerce', 'portfolio', 'blog', 'landing', 'restaurant').required(),
      colorScheme: Joi.string().optional(),
      features: Joi.array().items(Joi.string()).optional(),
      language: Joi.string().default('en')
    })
  }
};

export default new PremiumToolsController();
