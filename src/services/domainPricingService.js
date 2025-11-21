/**
 * Domain Pricing Service with Automatic Margin Management
 * Fetches prices from NameSilo and applies competitive markups
 */

import namesiloService from './namesiloService.js';
import pool from '../db/index.js';
import logger from '../config/logger.js';
import { parseStringPromise } from 'xml2js';

// Pricing Strategy Configuration
const PRICING_CONFIG = {
  // Default markup percentage over NameSilo cost
  defaultMarkupPercent: 15, // 15% markup
  
  // Minimum profit margin in dollars
  minimumProfitPerDomain: 1.00,
  
  // Competitive pricing targets (check these competitors)
  competitors: {
    godaddy: 'https://www.godaddy.com', // For reference
    namecheap: 'https://www.namecheap.com', // For reference
  },
  
  // TLD-specific markup rules (override defaults)
  tldMarkupRules: {
    '.com': { markupPercent: 12, minProfit: 1.50 },
    '.net': { markupPercent: 12, minProfit: 1.50 },
    '.org': { markupPercent: 12, minProfit: 1.50 },
    '.io': { markupPercent: 10, minProfit: 3.00 },
    '.ai': { markupPercent: 10, minProfit: 5.00 },
    '.co': { markupPercent: 15, minProfit: 2.00 },
    '.xyz': { markupPercent: 20, minProfit: 0.50 },
    '.app': { markupPercent: 15, minProfit: 2.00 },
    '.dev': { markupPercent: 15, minProfit: 2.00 },
    // Add more TLD-specific rules as needed
  },
  
  // Auto-update schedule
  updateIntervalHours: 24, // Update prices every 24 hours
  
  // Price change threshold (only update if change > this %)
  updateThresholdPercent: 2,
};

class DomainPricingService {
  constructor() {
    this.lastUpdateTime = null;
    this.priceCache = new Map();
  }

  /**
   * Fetch current pricing from NameSilo
   */
  async fetchNameSiloPricing() {
    try {
      logger.info('Fetching pricing from NameSilo API...');
      
      const result = await namesiloService.makeRequest('getPrices');
      const xmlData = result.rawXml;
      
      // Parse XML response
      const parsed = await parseStringPromise(xmlData);
      const prices = {};
      
      // NameSilo XML structure: <namesilo><reply><com>9.99</com><net>11.99</net>...
      if (parsed.namesilo && parsed.namesilo.reply && parsed.namesilo.reply[0]) {
        const reply = parsed.namesilo.reply[0];
        
        // Extract all TLD prices
        for (const [tld, priceArray] of Object.entries(reply)) {
          if (tld !== 'code' && tld !== 'detail' && Array.isArray(priceArray)) {
            const tldName = tld.startsWith('.') ? tld : `.${tld}`;
            prices[tldName] = {
              registration: parseFloat(priceArray[0]) || 0,
              renewal: parseFloat(priceArray[0]) || 0, // NameSilo uses same price
              transfer: parseFloat(priceArray[0]) || 0,
              lastUpdated: new Date(),
            };
          }
        }
      }
      
      logger.info(`Fetched pricing for ${Object.keys(prices).length} TLDs from NameSilo`);
      return prices;
      
    } catch (error) {
      logger.error('Failed to fetch NameSilo pricing:', error);
      throw new Error('Unable to fetch domain pricing from registrar');
    }
  }

  /**
   * Calculate customer price with markup
   */
  calculateCustomerPrice(costPrice, tld) {
    const rules = PRICING_CONFIG.tldMarkupRules[tld] || {
      markupPercent: PRICING_CONFIG.defaultMarkupPercent,
      minProfit: PRICING_CONFIG.minimumProfitPerDomain,
    };
    
    // Calculate price with markup
    const markupPrice = costPrice * (1 + rules.markupPercent / 100);
    
    // Ensure minimum profit
    const priceWithMinProfit = costPrice + rules.minProfit;
    
    // Use whichever is higher
    const finalPrice = Math.max(markupPrice, priceWithMinProfit);
    
    // Round to 2 decimal places
    return Math.round(finalPrice * 100) / 100;
  }

  /**
   * Update database with new pricing
   */
  async updateDatabasePricing(nameSiloPrices) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      let updatedCount = 0;
      let insertedCount = 0;
      
      for (const [tld, prices] of Object.entries(nameSiloPrices)) {
        const costPrice = prices.registration;
        const customerPrice = this.calculateCustomerPrice(costPrice, tld);
        const profit = customerPrice - costPrice;
        const profitMargin = ((profit / costPrice) * 100).toFixed(2);
        
        // Check if TLD already exists
        const existingResult = await client.query(
          'SELECT * FROM domain_pricing WHERE tld = $1',
          [tld]
        );
        
        if (existingResult.rows.length > 0) {
          const existing = existingResult.rows[0];
          const oldPrice = parseFloat(existing.registration_price);
          const priceChange = Math.abs(((customerPrice - oldPrice) / oldPrice) * 100);
          
          // Only update if price change exceeds threshold
          if (priceChange >= PRICING_CONFIG.updateThresholdPercent) {
            await client.query(
              `UPDATE domain_pricing 
               SET cost_price = $1,
                   registration_price = $2,
                   renewal_price = $3,
                   transfer_price = $4,
                   profit_margin = $5,
                   last_updated = NOW(),
                   updated_at = NOW()
               WHERE tld = $6`,
              [
                costPrice,
                customerPrice,
                this.calculateCustomerPrice(prices.renewal, tld),
                this.calculateCustomerPrice(prices.transfer, tld),
                profitMargin,
                tld,
              ]
            );
            updatedCount++;
            
            logger.info(`Updated pricing for ${tld}: $${oldPrice} → $${customerPrice} (${priceChange.toFixed(2)}% change)`);
          }
        } else {
          // Insert new TLD
          await client.query(
            `INSERT INTO domain_pricing (
              tld, 
              cost_price, 
              registration_price, 
              renewal_price, 
              transfer_price, 
              profit_margin,
              is_active,
              last_updated,
              created_at,
              updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())`,
            [
              tld,
              costPrice,
              customerPrice,
              this.calculateCustomerPrice(prices.renewal, tld),
              this.calculateCustomerPrice(prices.transfer, tld),
              profitMargin,
              true,
            ]
          );
          insertedCount++;
          
          logger.info(`Added new TLD ${tld}: Cost $${costPrice} → Customer $${customerPrice} (${profitMargin}% margin)`);
        }
      }
      
      await client.query('COMMIT');
      
      logger.info(`Pricing update complete: ${updatedCount} updated, ${insertedCount} inserted`);
      
      return {
        success: true,
        updatedCount,
        insertedCount,
        totalTlds: Object.keys(nameSiloPrices).length,
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update database pricing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Main function: Update all domain pricing
   */
  async updateAllPricing(force = false) {
    try {
      // Check if update is needed
      if (!force && this.lastUpdateTime) {
        const hoursSinceUpdate = (Date.now() - this.lastUpdateTime) / (1000 * 60 * 60);
        if (hoursSinceUpdate < PRICING_CONFIG.updateIntervalHours) {
          logger.info(`Skipping pricing update. Last update was ${hoursSinceUpdate.toFixed(1)} hours ago`);
          return {
            success: true,
            skipped: true,
            message: 'Update not needed yet',
          };
        }
      }
      
      logger.info('Starting domain pricing update...');
      
      // Fetch latest prices from NameSilo
      const nameSiloPrices = await this.fetchNameSiloPricing();
      
      // Update database
      const result = await this.updateDatabasePricing(nameSiloPrices);
      
      // Update cache
      this.priceCache = new Map(Object.entries(nameSiloPrices));
      this.lastUpdateTime = Date.now();
      
      return result;
      
    } catch (error) {
      logger.error('Domain pricing update failed:', error);
      throw error;
    }
  }

  /**
   * Get pricing for a specific TLD
   */
  async getPricingForTld(tld) {
    if (!tld.startsWith('.')) {
      tld = `.${tld}`;
    }
    
    const result = await pool.query(
      'SELECT * FROM domain_pricing WHERE tld = $1 AND is_active = true',
      [tld]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }

  /**
   * Get all active domain pricing
   */
  async getAllPricing(includeInactive = false) {
    const query = includeInactive
      ? 'SELECT * FROM domain_pricing ORDER BY tld'
      : 'SELECT * FROM domain_pricing WHERE is_active = true ORDER BY tld';
    
    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Get popular TLD pricing
   */
  async getPopularTldPricing() {
    const popularTlds = ['.com', '.net', '.org', '.io', '.co', '.ai', '.app', '.dev'];
    
    const result = await pool.query(
      'SELECT * FROM domain_pricing WHERE tld = ANY($1) AND is_active = true ORDER BY tld',
      [popularTlds]
    );
    
    return result.rows;
  }

  /**
   * Manually adjust pricing for a TLD
   */
  async adjustTldPricing(tld, adjustments) {
    if (!tld.startsWith('.')) {
      tld = `.${tld}`;
    }
    
    const { registrationPrice, renewalPrice, transferPrice, isActive } = adjustments;
    
    // Get current pricing
    const current = await this.getPricingForTld(tld);
    if (!current) {
      throw new Error(`TLD ${tld} not found in pricing database`);
    }
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (registrationPrice !== undefined) {
      updates.push(`registration_price = $${paramIndex++}`);
      values.push(registrationPrice);
    }
    
    if (renewalPrice !== undefined) {
      updates.push(`renewal_price = $${paramIndex++}`);
      values.push(renewalPrice);
    }
    
    if (transferPrice !== undefined) {
      updates.push(`transfer_price = $${paramIndex++}`);
      values.push(transferPrice);
    }
    
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(tld);
    
    await pool.query(
      `UPDATE domain_pricing SET ${updates.join(', ')} WHERE tld = $${paramIndex}`,
      values
    );
    
    logger.info(`Manually adjusted pricing for ${tld}`, adjustments);
    
    return {
      success: true,
      tld,
      adjustments,
    };
  }

  /**
   * Get pricing statistics
   */
  async getPricingStats() {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_tlds,
        COUNT(*) FILTER (WHERE is_active = true) as active_tlds,
        AVG(profit_margin) as avg_profit_margin,
        MIN(registration_price) as min_price,
        MAX(registration_price) as max_price,
        MAX(last_updated) as last_update
      FROM domain_pricing
    `);
    
    return result.rows[0];
  }

  /**
   * Compare our pricing with NameSilo (audit)
   */
  async auditPricing() {
    const nameSiloPrices = await this.fetchNameSiloPricing();
    const ourPricing = await this.getAllPricing();
    
    const comparison = [];
    
    for (const ourPrice of ourPricing) {
      const nameSiloPrice = nameSiloPrices[ourPrice.tld];
      if (nameSiloPrice) {
        const costDiff = parseFloat(ourPrice.cost_price) - nameSiloPrice.registration;
        const isProfitable = parseFloat(ourPrice.registration_price) > nameSiloPrice.registration;
        
        comparison.push({
          tld: ourPrice.tld,
          ourCost: parseFloat(ourPrice.cost_price),
          nameSiloCost: nameSiloPrice.registration,
          costDifference: costDiff,
          ourCustomerPrice: parseFloat(ourPrice.registration_price),
          isProfitable,
          profitMargin: ourPrice.profit_margin,
          needsUpdate: Math.abs(costDiff) > 0.01,
        });
      }
    }
    
    return {
      totalCompared: comparison.length,
      needingUpdate: comparison.filter(c => c.needsUpdate).length,
      unprofitable: comparison.filter(c => !c.isProfitable).length,
      comparison,
    };
  }
}

export default new DomainPricingService();
