import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as brandingController from '../controllers/brandingController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/branding
 * @desc Get tenant branding configuration
 */
router.get('/', brandingController.getBranding);

/**
 * @route PUT /api/branding
 * @desc Update tenant branding configuration
 * @body companyName - Company name
 * @body theme - Theme configuration object
 * @body customCss - Custom CSS styles
 * @body customDomain - Custom domain
 * @body emailFromName - Email from name
 * @body emailFromAddress - Email from address
 * @body supportEmail - Support email
 * @body supportPhone - Support phone
 * @body footerText - Footer text
 * @body privacyPolicyUrl - Privacy policy URL
 * @body termsOfServiceUrl - Terms of service URL
 * @body metaTitle - Meta title
 * @body metaDescription - Meta description
 * @body metaKeywords - Meta keywords
 * @body socialLinks - Social media links object
 */
router.put('/', brandingController.updateBranding);

/**
 * @route POST /api/branding/logo
 * @desc Upload logo
 * @formdata logo - Logo image file (max 5MB)
 */
router.post('/logo', brandingController.uploadLogo);

/**
 * @route POST /api/branding/favicon
 * @desc Upload favicon
 * @formdata favicon - Favicon image file (max 5MB)
 */
router.post('/favicon', brandingController.uploadFavicon);

/**
 * @route PUT /api/branding/theme
 * @desc Update theme configuration
 * @body theme - Theme object with color scheme
 */
router.put('/theme', brandingController.updateTheme);

/**
 * @route GET /api/branding/theme.css
 * @desc Get compiled theme CSS
 */
router.get('/theme.css', brandingController.getThemeCSS);

/**
 * @route PUT /api/branding/custom-css
 * @desc Update custom CSS
 * @body customCss - Custom CSS string
 */
router.put('/custom-css', brandingController.updateCustomCSS);

/**
 * @route PUT /api/branding/custom-domain
 * @desc Update custom domain
 * @body customDomain - Custom domain name
 */
router.put('/custom-domain', brandingController.updateCustomDomain);

/**
 * @route POST /api/branding/email-preview
 * @desc Preview email template with branding
 * @body templateName - Email template name
 * @body variables - Template variables object
 */
router.post('/email-preview', brandingController.getEmailTemplatePreview);

/**
 * @route POST /api/branding/reset
 * @desc Reset to default branding
 */
router.post('/reset', brandingController.resetBranding);

export default router;

