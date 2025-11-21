/**
 * Domain Pricing Cron Job
 * Automatically updates domain pricing from NameSilo every 24 hours
 */

import cron from 'node-cron';
import domainPricingService from '../services/domainPricingService.js';
import logger from '../config/logger.js';

/**
 * Schedule: Run pricing update daily at 3 AM
 * Cron pattern: '0 3 * * *' = At 03:00 every day
 */
export function scheduleDomainPricingUpdates() {
  // Run every day at 3 AM
  const job = cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Starting scheduled domain pricing update...');
      
      const result = await domainPricingService.updateAllPricing(false);
      
      if (result.skipped) {
        logger.info('Domain pricing update skipped - not needed yet');
      } else {
        logger.info('Domain pricing update completed successfully', {
          updatedCount: result.updatedCount,
          insertedCount: result.insertedCount,
          totalTlds: result.totalTlds,
        });
      }
    } catch (error) {
      logger.error('Scheduled domain pricing update failed:', error);
      
      // You might want to send an alert here (email, Slack, etc.)
      // await sendAdminAlert('Domain pricing update failed', error.message);
    }
  });

  logger.info('Domain pricing cron job scheduled: Daily at 3 AM');
  
  return job;
}

/**
 * Run pricing update immediately on server start (optional)
 * Useful to ensure prices are fresh when server restarts
 */
export async function runInitialPricingUpdate() {
  try {
    logger.info('Running initial domain pricing update on server start...');
    
    const result = await domainPricingService.updateAllPricing(false);
    
    if (result.skipped) {
      logger.info('Initial pricing update skipped - prices are up to date');
    } else {
      logger.info('Initial pricing update completed', {
        updatedCount: result.updatedCount,
        insertedCount: result.insertedCount,
      });
    }
  } catch (error) {
    logger.warn('Initial pricing update failed (non-critical):', error.message);
    // Don't throw - server should still start even if pricing update fails
  }
}

export default {
  scheduleDomainPricingUpdates,
  runInitialPricingUpdate,
};
