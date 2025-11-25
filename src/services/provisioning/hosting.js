import pool from '../../db/index.js';
import logger from '../../utils/logger.js';
import domainRegistrationService from '../domainRegistrationService.js';
import dnsProvisioningService from '../dnsProvisioningService.js';
import cpanelProvisioningService from '../cpanelProvisioningService.js';
import sslProvisioningService from '../sslProvisioningService.js';
import crypto from 'crypto';

function resolveDocumentRoot(domainName, fallbackId) {
  if (domainName) {
    return `/srv/web/clients/${domainName}/public`;
  }
  return `/srv/web/subscriptions/${fallbackId}/public`;
}

function buildWebsiteMetadata(server, options = {}) {
  return JSON.stringify({
    serverName: server?.name || null,
    serverIp: server?.ip_address || null,
    autoProvisioned: true,
    requestedBy: options.requestedBy || 'marketing-checkout',
    scriptVersion: 'v1',
  });
}

function normalizeJson(value) {
  if (!value) {
    return {};
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.warn('Failed to parse JSON metadata during provisioning', { error: error.message });
    return {};
  }
}

export async function provisionHostingForSubscription(subscriptionId, options = {}) {
  const client = await pool.connect();
  let transactionStarted = false;

  const provisioningSteps = {
    subscription: false,
    domain: false,
    dns: false,
    cpanel: false,
    ssl: false,
    website: false
  };

  const provisioningResults = {};

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const subscriptionResult = await client.query(
      `SELECT s.*, c.id as customer_id, c.tenant_id, d.id as domain_id, d.domain_name, d.metadata as domain_metadata,
              p.name as product_name, p.metadata as product_metadata, u.email, u.first_name, u.last_name
       FROM subscriptions s
       INNER JOIN customers c ON s.customer_id = c.id
       INNER JOIN users u ON c.user_id = u.id
       LEFT JOIN domains d ON d.subscription_id = s.id
       LEFT JOIN products p ON p.id = s.product_id
       WHERE s.id = $1
       FOR UPDATE`,
      [subscriptionId]
    );

    if (subscriptionResult.rows.length === 0) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }

    const subscription = subscriptionResult.rows[0];
    const tenantId = subscription.tenant_id;
    const subscriptionMetadata = normalizeJson(subscription.metadata);
    const domainMetadata = normalizeJson(subscription.domain_metadata);
    const productMetadata = normalizeJson(subscription.product_metadata);
    
    // Extract domain info
    const domain = subscription.domain_name || subscriptionMetadata.domain || `site-${subscriptionId}.migrahosting.com`;
    const domainMode = subscriptionMetadata.domainMode || domainMetadata.mode || 'external';
    const email = options.email || subscription.email;

    logger.info(`🚀 Starting full provisioning for subscription ${subscriptionId}`, {
      domain,
      domainMode,
      customerId: subscription.customer_id,
      email
    });

    // STEP 1: Domain Registration (if new_registration mode)
    if (domainMode === 'new_registration') {
      logger.info(`📝 Step 1/6: Registering domain ${domain}`);
      
      const domainResult = await domainRegistrationService.registerDomain({
        domain,
        years: 1,
        customerId: subscription.customer_id,
        tenantId
      });

      provisioningResults.domain = domainResult;
      provisioningSteps.domain = domainResult.success || domainResult.skipped;

      if (domainResult.success) {
        // Update nameservers
        await domainRegistrationService.updateNameservers({
          domain,
          nameservers: [
            process.env.NS1 || 'ns1.migrahosting.com',
            process.env.NS2 || 'ns2.migrahosting.com'
          ]
        });
      }
    } else {
      logger.info(`📝 Step 1/6: External domain mode, skipping registration`);
      provisioningSteps.domain = true;
      provisioningResults.domain = { success: true, skipped: true, mode: domainMode };
    }

    // STEP 2: Get or create server
    const serverCandidate = await client.query(
      `SELECT id, name, ip_address
       FROM servers
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [tenantId]
    );

    const fallbackServerId = options.serverId || process.env.DEFAULT_WEB_SERVER_ID || null;
    const server = serverCandidate.rows[0] || (fallbackServerId ? { id: fallbackServerId, ip_address: '73.139.18.218' } : null);

    if (!server?.id) {
      throw new Error('No eligible web server found for provisioning');
    }

    const serverIp = server.ip_address || process.env.DEFAULT_SERVER_IP || '73.139.18.218';

    // STEP 3: DNS Zone Creation
    logger.info(`🌐 Step 2/6: Creating DNS zone for ${domain}`);
    
    const dnsResult = await dnsProvisioningService.createDNSZone({
      domain,
      serverIp,
      tenantId
    });

    provisioningResults.dns = dnsResult;
    provisioningSteps.dns = dnsResult.success;

    // STEP 4: cPanel Account Creation
    logger.info(`🖥️  Step 3/6: Creating cPanel account for ${domain}`);
    
    // Generate secure password for cPanel
    const cpanelPassword = crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    const cpanelUsername = domain.replace(/[^a-z0-9]/gi, '').substring(0, 8).toLowerCase();
    
    const cpanelResult = await cpanelProvisioningService.createAccount({
      domain,
      username: cpanelUsername,
      email,
      password: cpanelPassword,
      plan: productMetadata.cpanel_plan || 'default',
      diskQuota: productMetadata.disk_quota_mb || 5120,
      tenantId
    });

    provisioningResults.cpanel = cpanelResult;
    provisioningSteps.cpanel = cpanelResult.success || cpanelResult.skipped;

    // STEP 5: Create website record
    logger.info(`🌍 Step 4/6: Creating website record for ${domain}`);

    const websiteResult = await client.query(
      `INSERT INTO websites (
         tenant_id, customer_id, server_id, subscription_id,
         name, primary_domain, document_root, status, metadata,
         cpanel_username, cpanel_password
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8::jsonb, $9, $10)
       RETURNING id`,
      [
        tenantId,
        subscription.customer_id,
        server.id,
        subscriptionId,
        subscription.product_name || domain,
        domain,
        resolveDocumentRoot(domain, subscriptionId),
        JSON.stringify({
          serverName: server?.name || null,
          serverIp: serverIp,
          autoProvisioned: true,
          provisionedAt: new Date().toISOString(),
          requestedBy: options.requestedBy || 'auto-provisioning',
          cpanelUrl: cpanelResult.cpanelUrl,
          webmailUrl: cpanelResult.webmailUrl
        }),
        cpanelResult.success ? cpanelUsername : null,
        cpanelResult.success ? cpanelPassword : null
      ]
    );

    const websiteId = websiteResult.rows[0].id;
    provisioningSteps.website = true;
    provisioningResults.website = { success: true, websiteId };

    // STEP 6: SSL Certificate Issuance
    logger.info(`🔒 Step 5/6: Issuing SSL certificate for ${domain}`);
    
    const sslResult = await sslProvisioningService.issueSSL({
      domain,
      email,
      tenantId,
      websiteId
    });

    provisioningResults.ssl = sslResult;
    provisioningSteps.ssl = sslResult.success || sslResult.skipped;

    // STEP 7: Update domain and subscription status
    logger.info(`✅ Step 6/6: Finalizing provisioning for ${domain}`);

    await client.query(
      `UPDATE domains
       SET status = 'active', 
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb), 
             '{provisioned}', 
             'true'
           ),
           updated_at = NOW()
       WHERE subscription_id = $1`,
      [subscriptionId]
    );

    await client.query(
      `UPDATE subscriptions
       SET status = 'active',
           metadata = jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{provisioningCompleted}',
             to_jsonb(NOW())
           ),
           updated_at = NOW()
       WHERE id = $1`,
      [subscriptionId]
    );

    provisioningSteps.subscription = true;

    await client.query('COMMIT');
    transactionStarted = false;

    // Prepare temp password for customer
    const tempPassword = cpanelResult.success ? cpanelPassword : crypto.randomBytes(12).toString('base64').substring(0, 12);

    logger.info(`✨ Provisioning completed successfully for subscription ${subscriptionId}`, {
      domain,
      websiteId,
      serverId: server.id,
      steps: provisioningSteps
    });

    return {
      success: true,
      websiteId,
      serverId: server.id,
      domain,
      tempPassword,
      cpanelUrl: cpanelResult.cpanelUrl || `https://${domain}:2083`,
      cpanelUsername: cpanelResult.success ? cpanelUsername : null,
      webmailUrl: cpanelResult.webmailUrl || `https://${domain}:2096`,
      nameservers: dnsResult.nameservers || ['ns1.migrahosting.com', 'ns2.migrahosting.com'],
      steps: provisioningSteps,
      results: provisioningResults
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    logger.error(`❌ Provisioning failed for subscription ${subscriptionId}`, {
      error: error.message,
      steps: provisioningSteps,
      results: provisioningResults
    });

    return {
      success: false,
      error: error.message,
      steps: provisioningSteps,
      results: provisioningResults
    };
  } finally {
    client.release();
  }
}

export default {
  provisionHostingForSubscription,
};
