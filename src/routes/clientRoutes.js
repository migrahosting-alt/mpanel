const express = require('express');
const router = express.Router();
const { requireClient } = require('../middleware/authorization');
const logger = require('../config/logger');

// All client routes require client role
router.use(requireClient);

/**
 * GET /api/client/services
 * Get all services for the authenticated client
 */
router.get('/services', async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data - replace with actual database query
    const services = [
      {
        id: 1,
        userId,
        name: 'Shared Hosting - Business',
        type: 'Shared Hosting',
        status: 'active',
        price: 19.99,
        renewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        domain: 'example.com',
        diskUsage: 45,
        bandwidthUsage: 60,
      },
    ];

    res.json({ services });
  } catch (error) {
    logger.error('Error fetching client services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

/**
 * GET /api/client/domains
 * Get all domains for the authenticated client
 */
router.get('/domains', async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data - replace with actual database query
    const domains = [
      {
        id: 1,
        userId,
        name: 'example.com',
        registrar: 'MigraHosting',
        registrationDate: '2024-01-15',
        expiryDate: '2026-01-15',
        status: 'active',
        autoRenew: true,
      },
    ];

    res.json({ domains });
  } catch (error) {
    logger.error('Error fetching client domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

/**
 * GET /api/client/invoices
 * Get all invoices for the authenticated client
 */
router.get('/invoices', async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data - replace with actual database query
    const invoices = [
      {
        id: 'INV-2025-001',
        userId,
        date: '2025-11-01',
        dueDate: '2025-11-15',
        amount: 19.99,
        status: 'paid',
        description: 'Shared Hosting - Business',
      },
      {
        id: 'INV-2025-002',
        userId,
        date: '2025-11-12',
        dueDate: '2025-11-26',
        amount: 49.99,
        status: 'unpaid',
        description: 'VPS Server - Premium',
      },
    ];

    res.json({ invoices });
  } catch (error) {
    logger.error('Error fetching client invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * GET /api/client/billing
 * Get billing information for the authenticated client
 */
router.get('/billing', async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data - replace with actual database/Stripe query
    const billingData = {
      paymentMethods: [
        {
          id: 1,
          type: 'card',
          brand: 'Visa',
          last4: '4242',
          expiryMonth: 12,
          expiryYear: 2025,
          isDefault: true,
        },
      ],
      billingInfo: {
        name: 'John Doe',
        email: req.user.email,
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94102',
        country: 'United States',
      },
    };

    res.json(billingData);
  } catch (error) {
    logger.error('Error fetching billing data:', error);
    res.status(500).json({ error: 'Failed to fetch billing data' });
  }
});

/**
 * GET /api/client/tickets
 * Get all support tickets for the authenticated client
 */
router.get('/tickets', async (req, res) => {
  try {
    const userId = req.user.id;

    // Mock data - replace with actual database query
    const tickets = [
      {
        id: 'TKT-001',
        userId,
        subject: 'Website loading slowly',
        status: 'open',
        priority: 'high',
        created: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        replies: 3,
      },
    ];

    res.json({ tickets });
  } catch (error) {
    logger.error('Error fetching client tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

/**
 * POST /api/client/tickets
 * Create a new support ticket
 */
router.post('/tickets', async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, priority, description } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ error: 'Subject and description are required' });
    }

    // Mock response - replace with actual database insert
    const ticket = {
      id: `TKT-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
      userId,
      subject,
      priority: priority || 'medium',
      description,
      status: 'open',
      created: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      replies: 0,
    };

    logger.info(`Support ticket created: ${ticket.id} by user ${userId}`);

    res.status(201).json({ ticket });
  } catch (error) {
    logger.error('Error creating support ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

module.exports = router;
