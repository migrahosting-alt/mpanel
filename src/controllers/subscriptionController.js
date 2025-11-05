import Subscription from '../models/Subscription.js';
import logger from '../config/logger.js';

export const createSubscription = async (req, res) => {
  try {
    const subscriptionData = {
      tenantId: req.user.tenantId,
      ...req.body
    };

    const subscription = await Subscription.create(subscriptionData);
    logger.info(`Subscription created: ${subscription.id}`, { userId: req.user.id });
    res.status(201).json(subscription);
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
};

export const getSubscriptions = async (req, res) => {
  try {
    const { customerId, status } = req.query;
    const subscriptions = await Subscription.findByCustomer(customerId, status);
    res.json(subscriptions);
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

export const getSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.findById(req.params.id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json(subscription);
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.cancel(req.params.id);
    logger.info(`Subscription cancelled: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
};

export const suspendSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.suspend(req.params.id);
    logger.info(`Subscription suspended: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error suspending subscription:', error);
    res.status(500).json({ error: 'Failed to suspend subscription' });
  }
};

export const reactivateSubscription = async (req, res) => {
  try {
    const subscription = await Subscription.reactivate(req.params.id);
    logger.info(`Subscription reactivated: ${subscription.id}`, { userId: req.user.id });
    res.json(subscription);
  } catch (error) {
    logger.error('Error reactivating subscription:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
};
