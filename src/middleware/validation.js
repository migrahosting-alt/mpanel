import logger from '../config/logger.js';

/**
 * Express middleware for request validation using Joi schemas
 * @param {Object} schema - Validation schema with optional body, params, query properties
 * @returns {Function} Express middleware function
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    const validationOptions = {
      abortEarly: false, // Include all errors
      allowUnknown: true, // Ignore unknown props
      stripUnknown: true // Remove unknown props
    };

    // Validate request body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, validationOptions);
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        logger.warn('Request validation failed (body):', { errors, path: req.path });
        
        return res.status(400).json({
          error: 'Validation failed',
          errors
        });
      }
      req.body = value;
    }

    // Validate request params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, validationOptions);
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        logger.warn('Request validation failed (params):', { errors, path: req.path });
        
        return res.status(400).json({
          error: 'Validation failed',
          errors
        });
      }
      req.params = value;
    }

    // Validate query parameters
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, validationOptions);
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
        
        logger.warn('Request validation failed (query):', { errors, path: req.path });
        
        return res.status(400).json({
          error: 'Validation failed',
          errors
        });
      }
      req.query = value;
    }

    next();
  };
}

export default validateRequest;
