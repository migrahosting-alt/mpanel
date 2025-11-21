import Joi from 'joi';

/**
 * Validation Schemas
 * Input validation rules for all API endpoints
 */

// Common schemas
export const email = Joi.string().email().required();
export const password = Joi.string().min(8).max(128).required();
export const uuid = Joi.string().uuid().required();
export const positiveInteger = Joi.number().integer().min(1);
export const boolean = Joi.boolean();

// Auth schemas
export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    .messages({
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character'
    }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required()
    .messages({
      'any.only': 'Passwords must match'
    }),
  firstName: Joi.string().min(1).max(100),
  lastName: Joi.string().min(1).max(100),
  company: Joi.string().max(255),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  tenantId: Joi.number().integer().min(1)
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

// Product schemas
export const productSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(2000),
  sku: Joi.string().max(100).required(),
  price: Joi.number().min(0).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  billingCycle: Joi.string().valid('monthly', 'yearly', 'one-time').required(),
  category: Joi.string().max(100),
  type: Joi.string().valid('hosting', 'domain', 'ssl', 'addon').required(),
  active: Joi.boolean().default(true),
  metadata: Joi.object(),
  features: Joi.array().items(Joi.string())
});

// Invoice schemas
export const invoiceSchema = Joi.object({
  userId: Joi.number().integer().min(1).required(),
  amount: Joi.number().min(0).required(),
  currency: Joi.string().length(3).uppercase().default('USD'),
  dueDate: Joi.date().iso().required(),
  items: Joi.array().items(Joi.object({
    description: Joi.string().required(),
    quantity: Joi.number().integer().min(1).required(),
    unitPrice: Joi.number().min(0).required()
  })),
  notes: Joi.string().max(1000)
});

// Domain schemas
export const domainSchema = Joi.object({
  domainName: Joi.string().domain().required(),
  registrar: Joi.string().max(100),
  registeredAt: Joi.date().iso(),
  expiresAt: Joi.date().iso().required(),
  autoRenew: Joi.boolean().default(true),
  nameservers: Joi.array().items(Joi.string().domain()).max(10),
  status: Joi.string().valid('active', 'pending', 'expired', 'suspended', 'deleted')
});

// SSL Certificate schemas
export const sslSchema = Joi.object({
  domain: Joi.string().domain().required(),
  type: Joi.string().valid('letsencrypt', 'custom', 'wildcard').required(),
  autoRenew: Joi.boolean().default(true),
  certificate: Joi.string(),
  privateKey: Joi.string(),
  chain: Joi.string()
});

// DNS Zone schemas
export const dnsZoneSchema = Joi.object({
  zoneName: Joi.string().domain().required(),
  type: Joi.string().valid('master', 'slave').default('master'),
  ttl: Joi.number().integer().min(60).max(86400).default(3600)
});

export const dnsRecordSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA').required(),
  content: Joi.string().required(),
  ttl: Joi.number().integer().min(60).max(86400).default(3600),
  priority: Joi.number().integer().min(0).max(65535),
  weight: Joi.number().integer().min(0).max(65535),
  port: Joi.number().integer().min(0).max(65535)
});

// Backup schemas
export const backupSchema = Joi.object({
  resourceType: Joi.string().valid('website', 'database', 'email', 'full').required(),
  resourceId: Joi.number().integer().min(1),
  schedule: Joi.string().valid('manual', 'daily', 'weekly', 'monthly'),
  retention: Joi.number().integer().min(1).max(365).default(30),
  destination: Joi.string().valid('local', 's3', 'ftp').default('local')
});

// Website schemas
export const websiteSchema = Joi.object({
  domainId: Joi.number().integer().min(1).required(),
  serverId: Joi.number().integer().min(1),
  documentRoot: Joi.string().max(500),
  phpVersion: Joi.string().valid('7.4', '8.0', '8.1', '8.2', '8.3'),
  sslEnabled: Joi.boolean().default(false),
  status: Joi.string().valid('active', 'suspended', 'deleted').default('active')
});

// Database schemas
export const databaseSchema = Joi.object({
  name: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).min(1).max(64).required(),
  type: Joi.string().valid('mysql', 'postgresql', 'mongodb').required(),
  username: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).max(32),
  password: Joi.string().min(8).max(128),
  size: Joi.number().integer().min(0)
});

// Email schemas
export const emailAccountSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  quota: Joi.number().integer().min(0).default(1024), // MB
  forwardTo: Joi.string().email(),
  autoresponder: Joi.object({
    enabled: Joi.boolean(),
    subject: Joi.string().max(200),
    body: Joi.string().max(5000)
  })
});

// Monitoring schemas
export const monitoringSchema = Joi.object({
  resourceType: Joi.string().valid('server', 'website', 'database', 'service').required(),
  resourceId: Joi.number().integer().min(1).required(),
  checkInterval: Joi.number().integer().min(60).max(3600).default(300),
  alertThreshold: Joi.object({
    cpu: Joi.number().min(0).max(100),
    memory: Joi.number().min(0).max(100),
    disk: Joi.number().min(0).max(100),
    responseTime: Joi.number().min(0)
  }),
  notificationChannels: Joi.array().items(Joi.string().valid('email', 'sms', 'webhook', 'slack'))
});

// API Key schemas
export const apiKeySchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  permissions: Joi.array().items(Joi.string().valid(
    'read', 'write', 'delete', 'admin',
    'billing', 'hosting', 'dns', 'email', 'databases'
  )).required(),
  expiresAt: Joi.date().iso(),
  ipWhitelist: Joi.array().items(Joi.string().ip())
});

// Branding schemas
export const brandingSchema = Joi.object({
  companyName: Joi.string().max(255),
  theme: Joi.object({
    primaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    secondaryColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    accentColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    backgroundColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    textColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    linkColor: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/),
    fontFamily: Joi.string().max(200)
  }),
  customDomain: Joi.string().domain(),
  emailFromName: Joi.string().max(255),
  emailFromAddress: Joi.string().email(),
  supportEmail: Joi.string().email(),
  supportPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  footerText: Joi.string().max(1000),
  socialLinks: Joi.object({
    facebook: Joi.string().uri(),
    twitter: Joi.string().uri(),
    linkedin: Joi.string().uri(),
    instagram: Joi.string().uri()
  })
});

// Quota schemas
export const quotaSchema = Joi.object({
  requestsPerHour: Joi.number().integer().min(-1),
  requestsPerDay: Joi.number().integer().min(-1),
  requestsPerMonth: Joi.number().integer().min(-1),
  maxStorage: Joi.number().integer().min(-1),
  maxBandwidth: Joi.number().integer().min(-1),
  maxDomains: Joi.number().integer().min(-1),
  maxWebsites: Joi.number().integer().min(-1),
  maxDatabases: Joi.number().integer().min(-1),
  maxEmailAccounts: Joi.number().integer().min(-1),
  overageAllowed: Joi.boolean(),
  overageRate: Joi.number().min(0)
});

// Pagination schema
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().max(50),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware
 */
export const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    // Replace with validated and sanitized values
    req[property] = value;
    next();
  };
};
