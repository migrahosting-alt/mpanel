/**
 * Domain Registration Routes
 * Handles domain registration, renewal, and management via NameSilo
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requirePermission } from '../middleware/authorization.js';
import {
  checkDomainAvailability,
  checkDomainAvailabilityPublic,
  registerDomain,
  renewDomain,
  transferDomain,
  updateNameServers,
  getDomainInfo,
  toggleDomainLock,
  getAuthCode,
  toggleAutoRenewal,
  togglePrivacy,
  getPricing,
} from '../controllers/domainRegistrationController.js';

const router = express.Router();

/**
 * @route   POST /api/domain-registration/check-availability-public
 * @desc    Check if domain(s) are available for registration (public endpoint for marketing site)
 * @access  Public - no authentication required
 */
router.post('/check-availability-public', checkDomainAvailabilityPublic);

// All other routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/domain-registration/check-availability
 * @desc    Check if domain(s) are available for registration
 * @access  Private - requires 'domains.read' permission
 */
router.post(
  '/check-availability',
  requirePermission('domains.read'),
  checkDomainAvailability
);

/**
 * @route   POST /api/domain-registration/register
 * @desc    Register a new domain
 * @access  Private - requires 'domains.create' permission
 */
router.post('/register', requirePermission('domains.create'), registerDomain);

/**
 * @route   POST /api/domain-registration/:id/renew
 * @desc    Renew a domain
 * @access  Private - requires 'domains.edit' permission
 */
router.post('/:id/renew', requirePermission('domains.edit'), renewDomain);

/**
 * @route   POST /api/domain-registration/transfer
 * @desc    Transfer a domain to NameSilo
 * @access  Private - requires 'domains.create' permission
 */
router.post('/transfer', requirePermission('domains.create'), transferDomain);

/**
 * @route   PUT /api/domain-registration/:id/nameservers
 * @desc    Update domain nameservers
 * @access  Private - requires 'dns.edit' permission
 */
router.put('/:id/nameservers', requirePermission('dns.edit'), updateNameServers);

/**
 * @route   GET /api/domain-registration/:id/info
 * @desc    Get domain information from registrar
 * @access  Private - requires 'domains.read' permission
 */
router.get('/:id/info', requirePermission('domains.read'), getDomainInfo);

/**
 * @route   PUT /api/domain-registration/:id/lock
 * @desc    Lock or unlock domain
 * @access  Private - requires 'domains.edit' permission
 */
router.put('/:id/lock', requirePermission('domains.edit'), toggleDomainLock);

/**
 * @route   GET /api/domain-registration/:id/auth-code
 * @desc    Get EPP/Auth code for domain transfer
 * @access  Private - requires 'domains.read' permission
 */
router.get('/:id/auth-code', requirePermission('domains.read'), getAuthCode);

/**
 * @route   PUT /api/domain-registration/:id/auto-renewal
 * @desc    Enable or disable auto-renewal
 * @access  Private - requires 'domains.edit' permission
 */
router.put('/:id/auto-renewal', requirePermission('domains.edit'), toggleAutoRenewal);

/**
 * @route   PUT /api/domain-registration/:id/privacy
 * @desc    Enable or disable WHOIS privacy
 * @access  Private - requires 'domains.edit' permission
 */
router.put('/:id/privacy', requirePermission('domains.edit'), togglePrivacy);

/**
 * @route   GET /api/domain-registration/pricing
 * @desc    Get TLD pricing from NameSilo
 * @access  Private - requires 'domains.read' permission
 */
router.get('/pricing', requirePermission('domains.read'), getPricing);

export default router;

