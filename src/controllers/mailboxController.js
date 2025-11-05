import Mailbox from '../models/Mailbox.js';
import logger from '../config/logger.js';

export const createMailbox = async (req, res) => {
  try {
    const mailboxData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const mailbox = await Mailbox.create(mailboxData);
    logger.info(`Mailbox created: ${mailbox.email}`, { userId: req.user.id });
    res.status(201).json(mailbox);
  } catch (error) {
    logger.error('Error creating mailbox:', error);
    res.status(500).json({ error: 'Failed to create mailbox' });
  }
};

export const getMailboxes = async (req, res) => {
  try {
    const { domainId } = req.query;
    let mailboxes;
    
    if (domainId) {
      mailboxes = await Mailbox.findByDomain(domainId);
    } else {
      mailboxes = await Mailbox.findByTenant(req.user.tenantId);
    }
    
    res.json(mailboxes);
  } catch (error) {
    logger.error('Error fetching mailboxes:', error);
    res.status(500).json({ error: 'Failed to fetch mailboxes' });
  }
};

export const getMailbox = async (req, res) => {
  try {
    const mailbox = await Mailbox.findById(req.params.id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }
    res.json(mailbox);
  } catch (error) {
    logger.error('Error fetching mailbox:', error);
    res.status(500).json({ error: 'Failed to fetch mailbox' });
  }
};

export const updatePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const mailbox = await Mailbox.updatePassword(req.params.id, newPassword);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }
    
    logger.info(`Mailbox password updated: ${mailbox.email}`, { userId: req.user.id });
    res.json({ message: 'Password updated successfully', mailbox });
  } catch (error) {
    logger.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
};

export const updateQuota = async (req, res) => {
  try {
    const { quotaMb, usedMb } = req.body;
    const mailbox = await Mailbox.updateQuota(req.params.id, quotaMb, usedMb);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }
    
    logger.info(`Mailbox quota updated: ${mailbox.email}`, { userId: req.user.id });
    res.json(mailbox);
  } catch (error) {
    logger.error('Error updating quota:', error);
    res.status(500).json({ error: 'Failed to update quota' });
  }
};

export const suspendMailbox = async (req, res) => {
  try {
    const mailbox = await Mailbox.suspend(req.params.id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }
    
    logger.info(`Mailbox suspended: ${mailbox.email}`, { userId: req.user.id });
    res.json(mailbox);
  } catch (error) {
    logger.error('Error suspending mailbox:', error);
    res.status(500).json({ error: 'Failed to suspend mailbox' });
  }
};

export const activateMailbox = async (req, res) => {
  try {
    const mailbox = await Mailbox.activate(req.params.id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }
    
    logger.info(`Mailbox activated: ${mailbox.email}`, { userId: req.user.id });
    res.json(mailbox);
  } catch (error) {
    logger.error('Error activating mailbox:', error);
    res.status(500).json({ error: 'Failed to activate mailbox' });
  }
};
