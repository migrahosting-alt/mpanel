import pool from '../../db/index.js';
import logger from '../../utils/logger.js';

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

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const subscriptionResult = await client.query(
      `SELECT s.*, c.id as customer_id, d.id as domain_id, d.domain_name,
              p.name as product_name, p.metadata as product_metadata
       FROM subscriptions s
       INNER JOIN customers c ON s.customer_id = c.id
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

    const serverCandidate = await client.query(
      `SELECT id, name, ip_address
       FROM servers
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY created_at ASC
       LIMIT 1`,
      [tenantId]
    );

    const fallbackServerId = options.serverId || process.env.DEFAULT_WEB_SERVER_ID || null;
    const server = serverCandidate.rows[0] || (fallbackServerId ? { id: fallbackServerId } : null);

    if (!server?.id) {
      throw new Error('No eligible web server found for provisioning');
    }

    const subscriptionMetadata = normalizeJson(subscription.metadata);

    const websiteResult = await client.query(
      `INSERT INTO websites (
         tenant_id, customer_id, server_id, subscription_id,
         name, primary_domain, document_root, status, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'provisioning', $8::jsonb)
       RETURNING id`,
      [
        tenantId,
        subscription.customer_id,
        server.id,
        subscriptionId,
        subscription.product_name || subscription.domain_name || 'Hosting Plan',
        subscription.domain_name || subscriptionMetadata.domain || `site-${subscriptionId}`,
        resolveDocumentRoot(subscription.domain_name, subscriptionId),
        buildWebsiteMetadata(server, options),
      ]
    );

    const websiteId = websiteResult.rows[0].id;

    await client.query(
      `UPDATE domains
       SET status = 'active', updated_at = NOW()
       WHERE subscription_id = $1`,
      [subscriptionId]
    );

    await client.query(
      `UPDATE subscriptions
       SET status = 'active', updated_at = NOW()
       WHERE id = $1`,
      [subscriptionId]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    logger.info('Provisioned hosting subscription', {
      subscriptionId,
      websiteId,
      serverId: server.id,
    });

    return {
      success: true,
      websiteId,
      serverId: server.id,
    };
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    logger.error('Provisioning failed', {
      subscriptionId,
      error: error.message,
    });

    throw error;
  } finally {
    client.release();
  }
}

export default {
  provisionHostingForSubscription,
};
