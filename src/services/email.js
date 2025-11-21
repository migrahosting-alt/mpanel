// src/services/email.js
// Email Service
import emailService from './emailService-impl.js';

// Re-export as default and named exports
export default emailService;
export const sendEmail = async (...args) => emailService.send(...args);
