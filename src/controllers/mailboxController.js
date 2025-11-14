import Mailbox from '../models/Mailbox.js';
import logger from '../config/logger.js';
import crypto from 'crypto';
import {
  createEmailAccount,
  changeEmailPassword,
  updateEmailQuota,
  deleteEmailAccount,
} from '../services/provisioning/email.js';

export const createMailbox = async (req, res) => {
  try {
    const { email, password, quotaMb = 1000 } = req.body;
    const tenantId = req.user.tenantId;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Generate password if not provided
    const mailboxPassword = password || crypto.randomBytes(12).toString('base64');

    logger.info(`Provisioning email account: ${email}`, { userId: req.user.id });

    // Provision the actual email account
    const provisionResult = await createEmailAccount({
      email,
      password: mailboxPassword,
      quota: quotaMb,
      tenantId,
    });

    if (!provisionResult.success) {
      throw new Error('Email account provisioning failed');
    }

    // Save mailbox metadata to our database
    const mailboxData = {
      tenantId,
      email,
      password: mailboxPassword,
      quotaMb,
      status: 'active',
      ...req.body,
    };

    const mailbox = await Mailbox.create(mailboxData);
    
    logger.info(`Email account created successfully: ${mailbox.email}`, { 
      userId: req.user.id,
    });
    
    res.status(201).json({
      ...mailbox,
      generatedPassword: mailboxPassword,
    });
  } catch (error) {
    logger.error('Error creating mailbox:', error);
    res.status(500).json({ 
      error: 'Failed to create mailbox',
      message: error.message,
    });
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

    const mailbox = await Mailbox.findById(req.params.id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    // Update password in actual email system
    await changeEmailPassword(mailbox.email, newPassword, req.user.tenantId);

    // Update password in our database
    const updatedMailbox = await Mailbox.updatePassword(req.params.id, newPassword);
    
    logger.info(`Mailbox password updated: ${mailbox.email}`, { userId: req.user.id });
    res.json({ message: 'Password updated successfully', mailbox: updatedMailbox });
  } catch (error) {
    logger.error('Error updating password:', error);
    res.status(500).json({ 
      error: 'Failed to update password',
      message: error.message,
    });
  }
};

export const updateQuota = async (req, res) => {
  try {
    const { quotaMb, usedMb } = req.body;
    
    const mailbox = await Mailbox.findById(req.params.id);
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    // Update quota in actual email system
    if (quotaMb) {
      await updateEmailQuota(mailbox.email, quotaMb, req.user.tenantId);
    }

    // Update quota in our database
    const updatedMailbox = await Mailbox.updateQuota(req.params.id, quotaMb, usedMb);
    
    logger.info(`Mailbox quota updated: ${mailbox.email}`, { userId: req.user.id });
    res.json(updatedMailbox);
  } catch (error) {
    logger.error('Error updating quota:', error);
    res.status(500).json({ 
      error: 'Failed to update quota',
      message: error.message,
    });
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

export const deleteMailbox = async (req, res) => {
  try {
    const mailbox = await Mailbox.findById(req.params.id);
    
    if (!mailbox) {
      return res.status(404).json({ error: 'Mailbox not found' });
    }

    if (mailbox.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    logger.info(`Deleting mailbox: ${mailbox.email}`, { userId: req.user.id });

    // Delete the actual email account
    try {
      await deleteEmailAccount(mailbox.email, req.user.tenantId);
      logger.info(`Deleted email account: ${mailbox.email}`);
    } catch (provisionError) {
      logger.error('Error deleting email account:', provisionError);
      // Continue with metadata deletion even if provisioning cleanup fails
    }

    // Delete mailbox metadata from our database
    await Mailbox.delete(req.params.id);
    
    logger.info(`Mailbox deleted successfully: ${mailbox.email}`, { userId: req.user.id });
    
    res.json({ 
      success: true,
      message: `Mailbox ${mailbox.email} deleted successfully`,
    });
  } catch (error) {
    logger.error('Error deleting mailbox:', error);
    res.status(500).json({ 
      error: 'Failed to delete mailbox',
      message: error.message,
    });
  }
};
