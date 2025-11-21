import express from 'express';
import premiumToolsController, { premiumToolsValidation } from '../controllers/premiumToolsController.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Integration Routes
// ============================================

/**
 * @route   POST /api/premium/integrations/google-analytics
 * @desc    Connect Google Analytics
 * @access  Private
 */
router.post(
  '/integrations/google-analytics',
  validateRequest(premiumToolsValidation.connectGoogleAnalytics),
  premiumToolsController.connectGoogleAnalytics.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/integrations/google-search-console
 * @desc    Connect Google Search Console
 * @access  Private
 */
router.post(
  '/integrations/google-search-console',
  validateRequest(premiumToolsValidation.connectGoogleSearchConsole),
  premiumToolsController.connectGoogleSearchConsole.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/integrations/google-my-business
 * @desc    Connect Google My Business
 * @access  Private
 */
router.post(
  '/integrations/google-my-business',
  validateRequest(premiumToolsValidation.connectGoogleMyBusiness),
  premiumToolsController.connectGoogleMyBusiness.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/integrations/facebook-pixel
 * @desc    Connect Facebook Pixel
 * @access  Private
 */
router.post(
  '/integrations/facebook-pixel',
  validateRequest(premiumToolsValidation.connectFacebookPixel),
  premiumToolsController.connectFacebookPixel.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/integrations/social-media
 * @desc    Connect social media account
 * @access  Private
 */
router.post(
  '/integrations/social-media',
  validateRequest(premiumToolsValidation.connectSocialMedia),
  premiumToolsController.connectSocialMedia.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/integrations/:websiteId
 * @desc    Get all integrations for a website
 * @access  Private
 */
router.get(
  '/integrations/:websiteId',
  premiumToolsController.getIntegrations.bind(premiumToolsController)
);

/**
 * @route   DELETE /api/premium/integrations/:integrationId
 * @desc    Disconnect integration
 * @access  Private
 */
router.delete(
  '/integrations/:integrationId',
  premiumToolsController.disconnectIntegration.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/analytics/:integrationId
 * @desc    Get Google Analytics data
 * @access  Private
 */
router.get(
  '/analytics/:integrationId',
  premiumToolsController.getAnalyticsData.bind(premiumToolsController)
);

// ============================================
// SEO Routes
// ============================================

/**
 * @route   GET /api/premium/seo/:websiteId/analyze
 * @desc    Analyze website SEO
 * @access  Private
 */
router.get(
  '/seo/:websiteId/analyze',
  premiumToolsController.analyzeSEO.bind(premiumToolsController)
);

/**
 * @route   PUT /api/premium/seo/:websiteId/meta-tags
 * @desc    Update meta tags
 * @access  Private
 */
router.put(
  '/seo/:websiteId/meta-tags',
  validateRequest(premiumToolsValidation.updateMetaTags),
  premiumToolsController.updateMetaTags.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/seo/:websiteId/sitemap
 * @desc    Generate sitemap
 * @access  Private
 */
router.post(
  '/seo/:websiteId/sitemap',
  premiumToolsController.generateSitemap.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/seo/:websiteId/robots-txt
 * @desc    Generate robots.txt
 * @access  Private
 */
router.post(
  '/seo/:websiteId/robots-txt',
  validateRequest(premiumToolsValidation.generateRobotsTxt),
  premiumToolsController.generateRobotsTxt.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/seo/:websiteId/submit-sitemap
 * @desc    Submit sitemap to search engines
 * @access  Private
 */
router.post(
  '/seo/:websiteId/submit-sitemap',
  premiumToolsController.submitSitemap.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/seo/:websiteId/keywords
 * @desc    Get keyword rankings
 * @access  Private
 */
router.get(
  '/seo/:websiteId/keywords',
  premiumToolsController.getKeywordRankings.bind(premiumToolsController)
);

// ============================================
// One-Click Installer Routes
// ============================================

/**
 * @route   GET /api/premium/installers
 * @desc    Get available installers
 * @access  Private
 */
router.get(
  '/installers',
  premiumToolsController.getAvailableInstallers.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/installers/wordpress
 * @desc    Install WordPress
 * @access  Private
 */
router.post(
  '/installers/wordpress',
  validateRequest(premiumToolsValidation.installWordPress),
  premiumToolsController.installWordPress.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/installers/:app
 * @desc    Install application
 * @access  Private
 */
router.post(
  '/installers/:app',
  premiumToolsController.installApplication.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/installations/:installationId
 * @desc    Get installation status
 * @access  Private
 */
router.get(
  '/installations/:installationId',
  premiumToolsController.getInstallationStatus.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/installations/website/:websiteId
 * @desc    Get all installations for a website
 * @access  Private
 */
router.get(
  '/installations/website/:websiteId',
  premiumToolsController.getInstallations.bind(premiumToolsController)
);

// ============================================
// AI Website Builder Routes
// ============================================

/**
 * @route   GET /api/premium/ai-builder/templates
 * @desc    Get available templates
 * @access  Private
 */
router.get(
  '/ai-builder/templates',
  premiumToolsController.getAvailableTemplates.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/ai-builder/color-schemes
 * @desc    Get available color schemes
 * @access  Private
 */
router.get(
  '/ai-builder/color-schemes',
  premiumToolsController.getAvailableColorSchemes.bind(premiumToolsController)
);

/**
 * @route   POST /api/premium/ai-builder/create
 * @desc    Create AI website
 * @access  Private
 */
router.post(
  '/ai-builder/create',
  validateRequest(premiumToolsValidation.createAIWebsite),
  premiumToolsController.createAIWebsite.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/ai-builder/projects/:projectId
 * @desc    Get AI builder project
 * @access  Private
 */
router.get(
  '/ai-builder/projects/:projectId',
  premiumToolsController.getAIProject.bind(premiumToolsController)
);

/**
 * @route   GET /api/premium/ai-builder/projects/website/:websiteId
 * @desc    Get all AI projects for a website
 * @access  Private
 */
router.get(
  '/ai-builder/projects/website/:websiteId',
  premiumToolsController.getAIProjects.bind(premiumToolsController)
);

export default router;

