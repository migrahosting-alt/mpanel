import Invoice from '../models/Invoice.js';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import TaxService from './TaxService.js';
import logger from '../config/logger.js';

class BillingService {
  /**
   * Generate invoice for a subscription
   */
  static async generateInvoiceForSubscription(subscription, customer) {
    try {
      const tenantId = subscription.tenant_id;
      const invoiceNumber = await Invoice.generateInvoiceNumber(tenantId);

      // Calculate tax
      const taxRate = await TaxService.calculateTaxRate(customer);

      // Calculate due date (14 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      const items = [
        {
          subscriptionId: subscription.id,
          productId: subscription.product_id,
          description: `${subscription.product_name} - ${subscription.billing_cycle}`,
          quantity: 1,
          unitPrice: subscription.price,
          amount: subscription.price,
          taxable: true
        }
      ];

      const invoice = await Invoice.create({
        tenantId,
        customerId: customer.id,
        invoiceNumber,
        items,
        taxRate,
        currency: customer.currency || 'USD',
        dueDate,
        notes: `Subscription renewal for ${subscription.product_name}`
      });

      logger.info(`Invoice ${invoice.invoice_number} generated for subscription ${subscription.id}`);
      return invoice;

    } catch (error) {
      logger.error('Error generating invoice:', error);
      throw error;
    }
  }

  /**
   * Process recurring billing for all due subscriptions
   */
  static async processRecurringBilling(tenantId) {
    try {
      const dueSubscriptions = await Subscription.getDueForBilling(tenantId);
      logger.info(`Processing ${dueSubscriptions.length} due subscriptions`);

      const results = {
        processed: 0,
        failed: 0,
        invoices: []
      };

      for (const subscription of dueSubscriptions) {
        try {
          const customer = { id: subscription.customer_id, currency: subscription.currency };
          const invoice = await this.generateInvoiceForSubscription(subscription, customer);
          
          // Update next billing date
          const nextBillingDate = this.calculateNextBillingDate(
            subscription.next_billing_date,
            subscription.billing_cycle
          );
          await Subscription.updateNextBillingDate(subscription.id, nextBillingDate);

          results.processed++;
          results.invoices.push(invoice);

        } catch (error) {
          logger.error(`Failed to process subscription ${subscription.id}:`, error);
          results.failed++;
        }
      }

      logger.info(`Recurring billing complete: ${results.processed} processed, ${results.failed} failed`);
      return results;

    } catch (error) {
      logger.error('Error in recurring billing:', error);
      throw error;
    }
  }

  /**
   * Calculate next billing date based on billing cycle
   */
  static calculateNextBillingDate(currentDate, billingCycle) {
    const date = new Date(currentDate);
    
    switch (billingCycle) {
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'semi-annually':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'annually':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'biennially':
        date.setFullYear(date.getFullYear() + 2);
        break;
      case 'triennially':
        date.setFullYear(date.getFullYear() + 3);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    
    return date.toISOString().split('T')[0];
  }

  /**
   * Process payment for invoice
   */
  static async processPayment(invoice, paymentData) {
    try {
      const payment = await Payment.create({
        tenantId: invoice.tenant_id,
        customerId: invoice.customer_id,
        invoiceId: invoice.id,
        amount: invoice.total,
        currency: invoice.currency,
        paymentMethod: paymentData.method,
        transactionId: paymentData.transactionId,
        metadata: paymentData.metadata || {}
      });

      // Update payment status
      await Payment.markCompleted(payment.id);

      // Update invoice status
      await Invoice.updateStatus(invoice.id, 'paid', new Date());

      logger.info(`Payment processed for invoice ${invoice.invoice_number}`);
      return payment;

    } catch (error) {
      logger.error('Error processing payment:', error);
      throw error;
    }
  }
}

export default BillingService;
