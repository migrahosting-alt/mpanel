import Joi from 'joi';

// Product validation schemas
export const productSchema = Joi.object({
  name: Joi.string().min(3).max(255).required(),
  description: Joi.string().max(1000).allow(''),
  type: Joi.string().valid('hosting', 'domain', 'email', 'ssl', 'addon').required(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'semi-annually', 'annually', 'biennially', 'triennially'),
  price: Joi.number().min(0).required(),
  setupFee: Joi.number().min(0).default(0),
  currency: Joi.string().length(3).default('USD'),
  taxable: Joi.boolean().default(true),
  metadata: Joi.object().default({})
});

// Invoice validation schemas
export const invoiceItemSchema = Joi.object({
  subscriptionId: Joi.string().uuid().allow(null),
  productId: Joi.string().uuid().allow(null),
  description: Joi.string().required(),
  quantity: Joi.number().integer().min(1).default(1),
  unitPrice: Joi.number().min(0).required(),
  amount: Joi.number().min(0).required(),
  taxable: Joi.boolean().default(true)
});

export const invoiceSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  invoiceNumber: Joi.string().required(),
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
  taxRate: Joi.number().min(0).max(1).required(),
  currency: Joi.string().length(3).default('USD'),
  dueDate: Joi.date().required(),
  notes: Joi.string().max(1000).allow('')
});

// Subscription validation schema
export const subscriptionSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  productId: Joi.string().uuid().required(),
  billingCycle: Joi.string().valid('monthly', 'quarterly', 'semi-annually', 'annually', 'biennially', 'triennially').required(),
  price: Joi.number().min(0).required(),
  nextBillingDate: Joi.date().required(),
  autoRenew: Joi.boolean().default(true),
  metadata: Joi.object().default({})
});

// Payment validation schema
export const paymentSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
  paymentMethod: Joi.string().valid('stripe', 'paypal', 'credit', 'bank_transfer').required(),
  paymentToken: Joi.string().allow('')
});

// TLD validation schema
export const tldSchema = Joi.object({
  tld: Joi.string().min(2).max(50).required(),
  registerPrice: Joi.number().min(0).required(),
  renewPrice: Joi.number().min(0).required(),
  transferPrice: Joi.number().min(0).required(),
  icannFee: Joi.number().min(0).default(0.18),
  minYears: Joi.number().integer().min(1).default(1),
  maxYears: Joi.number().integer().max(10).default(10),
  autoRenew: Joi.boolean().default(true)
});

// Tax rule validation schema
export const taxRuleSchema = Joi.object({
  country: Joi.string().length(2).uppercase().allow(null),
  state: Joi.string().max(100).allow(null),
  taxName: Joi.string().max(100).required(),
  taxRate: Joi.number().min(0).max(1).required(),
  isCompound: Joi.boolean().default(false),
  priority: Joi.number().integer().default(0)
});

// Domain registration schema
export const domainSchema = Joi.object({
  domainName: Joi.string().hostname().required(),
  years: Joi.number().integer().min(1).max(10).default(1),
  nameservers: Joi.array().items(Joi.string().hostname()).default([]),
  autoRenew: Joi.boolean().default(true)
});

// Validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return res.status(400).json({ errors });
    }

    req.body = value;
    next();
  };
};
