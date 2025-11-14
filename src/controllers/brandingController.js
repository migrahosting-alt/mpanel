import brandingService from '../services/brandingService.js';
import logger from '../config/logger.js';
import multer from 'multer';

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

/**
 * Get tenant branding
 */
export const getBranding = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const branding = await brandingService.getBranding(tenantId);
    res.json(branding);
  } catch (error) {
    logger.error('Error in getBranding:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update tenant branding
 */
export const updateBranding = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const branding = await brandingService.updateBranding(tenantId, req.body);
    res.json(branding);
  } catch (error) {
    logger.error('Error in updateBranding:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Upload logo
 */
export const uploadLogo = [
  upload.single('logo'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { tenantId } = req.user;
      const logoUrl = await brandingService.uploadLogo(tenantId, req.file);
      
      res.json({ logoUrl });
    } catch (error) {
      logger.error('Error in uploadLogo:', error);
      res.status(500).json({ error: error.message });
    }
  }
];

/**
 * Upload favicon
 */
export const uploadFavicon = [
  upload.single('favicon'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { tenantId } = req.user;
      const faviconUrl = await brandingService.uploadFavicon(tenantId, req.file);
      
      res.json({ faviconUrl });
    } catch (error) {
      logger.error('Error in uploadFavicon:', error);
      res.status(500).json({ error: error.message });
    }
  }
];

/**
 * Update theme
 */
export const updateTheme = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { theme } = req.body;

    if (!theme || typeof theme !== 'object') {
      return res.status(400).json({ error: 'Invalid theme configuration' });
    }

    const branding = await brandingService.updateBranding(tenantId, { theme });
    res.json({ theme: branding.theme });
  } catch (error) {
    logger.error('Error in updateTheme:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get theme CSS
 */
export const getThemeCSS = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const branding = await brandingService.getBranding(tenantId);
    const css = brandingService.generateThemeCSS(branding.theme);
    
    res.setHeader('Content-Type', 'text/css');
    res.send(css);
  } catch (error) {
    logger.error('Error in getThemeCSS:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update custom CSS
 */
export const updateCustomCSS = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { customCss } = req.body;

    const branding = await brandingService.updateBranding(tenantId, { customCss });
    res.json({ customCss: branding.custom_css });
  } catch (error) {
    logger.error('Error in updateCustomCSS:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update custom domain
 */
export const updateCustomDomain = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { customDomain } = req.body;

    if (!customDomain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Validate domain
    const isValid = await brandingService.validateCustomDomain(customDomain);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or already in use domain' });
    }

    const branding = await brandingService.updateBranding(tenantId, { customDomain });
    res.json({ customDomain: branding.custom_domain });
  } catch (error) {
    logger.error('Error in updateCustomDomain:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get email template preview
 */
export const getEmailTemplatePreview = async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { templateName, variables } = req.body;

    if (!templateName) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const html = await brandingService.getEmailTemplate(
      tenantId,
      templateName,
      variables || {}
    );
    
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('Error in getEmailTemplatePreview:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Reset to default branding
 */
export const resetBranding = async (req, res) => {
  try {
    const { tenantId } = req.user;
    
    const query = `
      UPDATE tenant_branding
      SET is_active = false, updated_at = NOW()
      WHERE tenant_id = $1
      RETURNING *
    `;
    
    await db.query(query, [tenantId]);
    
    // Clear cache
    await cache.del(CacheNamespace.USER, `branding:${tenantId}`);
    
    const branding = await brandingService.getBranding(tenantId);
    res.json(branding);
  } catch (error) {
    logger.error('Error in resetBranding:', error);
    res.status(500).json({ error: error.message });
  }
};
