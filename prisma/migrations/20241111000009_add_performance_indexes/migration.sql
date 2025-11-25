-- Phase 7 Day 2: Database Performance Optimization
-- Add indexes for frequently queried columns and composite indexes for common query patterns

-- =====================================================
-- USERS TABLE INDEXES
-- =====================================================

-- Email lookup (authentication, user search)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Role-based queries (admin panels, user filtering)
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Tenant-based queries (multi-tenancy support)
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id) WHERE tenant_id IS NOT NULL;

-- Status filtering (active users, suspended accounts)
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Composite index for tenant + role queries
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role) WHERE tenant_id IS NOT NULL;

-- Created date for sorting/pagination
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- =====================================================
-- PRODUCTS TABLE INDEXES
-- =====================================================

-- Product lookup by SKU
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Active products filter
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active) WHERE active = true;

-- Category filtering
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Product type queries
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);

-- Composite for active products by category
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(active, category) WHERE active = true;

-- =====================================================
-- ORDERS TABLE INDEXES
-- =====================================================

-- User orders lookup
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

-- Order status filtering
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Date range queries (reports, analytics)
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Composite for user orders by status
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- Composite for user orders with date
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);

-- Stripe payment intent lookup
CREATE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent ON orders(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- =====================================================
-- ORDER ITEMS TABLE INDEXES
-- =====================================================

-- Order items by order_id (order details page)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- Product sales analytics
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Composite for order items with product
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);

-- =====================================================
-- INVOICES TABLE INDEXES
-- =====================================================

-- User invoices
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);

-- Invoice status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Due date queries (overdue invoices, payment reminders)
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date) WHERE status != 'paid';

-- Invoice number lookup
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- Composite for user invoices by status
CREATE INDEX IF NOT EXISTS idx_invoices_user_status ON invoices(user_id, status);

-- Created date for sorting
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- =====================================================
-- SUBSCRIPTIONS TABLE INDEXES
-- =====================================================

-- User subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Renewal date queries (upcoming renewals, expiring soon)
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_billing ON subscriptions(next_billing_date) WHERE status = 'active';

-- Stripe subscription lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Product subscription analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_product_id ON subscriptions(product_id);

-- Composite for active user subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);

-- =====================================================
-- DOMAINS TABLE INDEXES
-- =====================================================

-- User domains
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id);

-- Domain name lookup (DNS, SSL, management)
CREATE INDEX IF NOT EXISTS idx_domains_name ON domains(domain_name);

-- Domain status filtering
CREATE INDEX IF NOT EXISTS idx_domains_status ON domains(status);

-- Expiry date queries (renewal notifications)
CREATE INDEX IF NOT EXISTS idx_domains_expires_at ON domains(expires_at) WHERE status = 'active';

-- Composite for user active domains
CREATE INDEX IF NOT EXISTS idx_domains_user_status ON domains(user_id, status);

-- =====================================================
-- WEBSITES TABLE INDEXES
-- =====================================================

-- User websites
CREATE INDEX IF NOT EXISTS idx_websites_user_id ON websites(user_id);

-- Domain websites (one domain can have multiple websites)
CREATE INDEX IF NOT EXISTS idx_websites_domain_id ON websites(domain_id) WHERE domain_id IS NOT NULL;

-- Website status
CREATE INDEX IF NOT EXISTS idx_websites_status ON websites(status);

-- Website type filtering
CREATE INDEX IF NOT EXISTS idx_websites_type ON websites(website_type);

-- =====================================================
-- DATABASES TABLE INDEXES
-- =====================================================

-- User databases
CREATE INDEX IF NOT EXISTS idx_databases_user_id ON databases(user_id);

-- Database name lookup
CREATE INDEX IF NOT EXISTS idx_databases_name ON databases(database_name);

-- Database status
CREATE INDEX IF NOT EXISTS idx_databases_status ON databases(status);

-- =====================================================
-- EMAIL ACCOUNTS TABLE INDEXES
-- =====================================================

-- User email accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_id ON email_accounts(user_id);

-- Email address lookup
CREATE INDEX IF NOT EXISTS idx_email_accounts_email ON email_accounts(email_address);

-- Domain email accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_domain_id ON email_accounts(domain_id) WHERE domain_id IS NOT NULL;

-- =====================================================
-- SSL CERTIFICATES TABLE INDEXES
-- =====================================================

-- User certificates
CREATE INDEX IF NOT EXISTS idx_ssl_certs_user_id ON ssl_certificates(user_id);

-- Domain certificates
CREATE INDEX IF NOT EXISTS idx_ssl_certs_domain ON ssl_certificates(domain);

-- Expiry date (renewal monitoring)
CREATE INDEX IF NOT EXISTS idx_ssl_certs_expires_at ON ssl_certificates(expires_at) WHERE status = 'active';

-- Auto-renew certificates
CREATE INDEX IF NOT EXISTS idx_ssl_certs_auto_renew ON ssl_certificates(auto_renew) WHERE auto_renew = true AND status = 'active';

-- =====================================================
-- DNS ZONES TABLE INDEXES
-- =====================================================

-- User DNS zones
CREATE INDEX IF NOT EXISTS idx_dns_zones_user_id ON dns_zones(user_id);

-- Zone name lookup
CREATE INDEX IF NOT EXISTS idx_dns_zones_zone_name ON dns_zones(zone_name);

-- =====================================================
-- DNS RECORDS TABLE INDEXES
-- =====================================================

-- Zone records
CREATE INDEX IF NOT EXISTS idx_dns_records_zone_id ON dns_records(zone_id);

-- Record type filtering
CREATE INDEX IF NOT EXISTS idx_dns_records_type ON dns_records(record_type);

-- Composite for zone records by type
CREATE INDEX IF NOT EXISTS idx_dns_records_zone_type ON dns_records(zone_id, record_type);

-- =====================================================
-- BACKUPS TABLE INDEXES
-- =====================================================

-- User backups
CREATE INDEX IF NOT EXISTS idx_backups_user_id ON backups(user_id);

-- Backup type
CREATE INDEX IF NOT EXISTS idx_backups_type ON backups(backup_type);

-- Created date for listing
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON backups(created_at DESC);

-- Resource backups (website, database, etc.)
CREATE INDEX IF NOT EXISTS idx_backups_resource ON backups(resource_type, resource_id);

-- =====================================================
-- MONITORING ALERTS TABLE INDEXES
-- =====================================================

-- User alerts
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON monitoring_alerts(user_id);

-- Alert status
CREATE INDEX IF NOT EXISTS idx_alerts_status ON monitoring_alerts(status);

-- Unacknowledged alerts
CREATE INDEX IF NOT EXISTS idx_alerts_unack ON monitoring_alerts(status) WHERE status = 'active';

-- Created date
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON monitoring_alerts(created_at DESC);

-- =====================================================
-- API KEYS TABLE INDEXES
-- =====================================================

-- User API keys
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);

-- Key hash lookup (authentication)
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);

-- Active keys only
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

-- =====================================================
-- WEBHOOKS TABLE INDEXES
-- =====================================================

-- User webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING gin(events);

-- Active webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;

-- =====================================================
-- WEBHOOK DELIVERIES TABLE INDEXES
-- =====================================================

-- Webhook deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);

-- Delivery status
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);

-- Created date
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Failed deliveries (retry queue)
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_failed ON webhook_deliveries(status, created_at) WHERE status = 'failed';

-- =====================================================
-- PERFORMANCE ANALYSIS
-- =====================================================

-- Analyze tables to update statistics for query planner
ANALYZE users;
ANALYZE products;
ANALYZE orders;
ANALYZE order_items;
ANALYZE invoices;
ANALYZE subscriptions;
ANALYZE domains;
ANALYZE websites;
ANALYZE databases;
ANALYZE email_accounts;
ANALYZE ssl_certificates;
ANALYZE dns_zones;
ANALYZE dns_records;
ANALYZE backups;
ANALYZE monitoring_alerts;
ANALYZE api_keys;
ANALYZE webhooks;
ANALYZE webhook_deliveries;
