# Test Email Service
# Run this script to test email service configuration
# Usage: node test-email-service.js

const emailService = require('./src/services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  try {
    // Initialize email service
    console.log('Initializing email service...');
    await emailService.initialize();
    console.log('✅ Email service initialized\n');

    // Test user
    const testUser = {
      id: 1,
      email: process.env.TEST_EMAIL || 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
    };

    // Test welcome email
    console.log('📧 Sending welcome email...');
    await emailService.sendWelcomeEmail(testUser);
    console.log('✅ Welcome email sent\n');

    // Test password reset email
    console.log('🔐 Sending password reset email...');
    await emailService.sendPasswordResetEmail(testUser, 'test-token-123');
    console.log('✅ Password reset email sent\n');

    // Test invoice email
    console.log('📄 Sending invoice email...');
    const testInvoice = {
      id: 1,
      invoice_number: 'INV-001',
      total: 99.99,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'pending',
    };
    await emailService.sendInvoiceEmail(testUser, testInvoice, null);
    console.log('✅ Invoice email sent\n');

    // Test payment receipt email
    console.log('✅ Sending payment receipt email...');
    const testPayment = {
      amount: 99.99,
      payment_method: 'card',
      created_at: new Date(),
    };
    await emailService.sendPaymentReceiptEmail(testUser, testPayment, testInvoice);
    console.log('✅ Payment receipt email sent\n');

    // Test order confirmation email
    console.log('🛒 Sending order confirmation email...');
    const testOrder = {
      id: 1,
      total_amount: 149.99,
      payment_method: 'stripe',
    };
    const testServices = [
      { name: 'example.com', type: 'domain' },
      { name: 'Shared Hosting Pro', type: 'hosting' },
    ];
    await emailService.sendOrderConfirmationEmail(testUser, testOrder, testServices);
    console.log('✅ Order confirmation email sent\n');

    // Test service provisioned email
    console.log('🚀 Sending service provisioned email...');
    const testService = {
      id: 1,
      name: 'example.com',
      type: 'domain',
      status: 'active',
    };
    await emailService.sendServiceProvisionedEmail(testUser, testService);
    console.log('✅ Service provisioned email sent\n');

    console.log('🎉 All email tests passed!\n');
    console.log('Check your inbox at:', testUser.email);
  } catch (error) {
    console.error('❌ Email test failed:', error);
    process.exit(1);
  }
}

testEmailService();
