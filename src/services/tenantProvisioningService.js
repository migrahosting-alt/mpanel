// src/services/tenantProvisioningService.js
import db from '../db/index.js';
import logger from '../utils/logger.js';

/**
 * Stubbed tenant provisioning workflow.
 * Replaces legacy WHMCS bridge while new provisioning service comes online.
 */
export async function provisionTenantForSubscription(subscriptionId) {
  logger.info('tenantProvisioning.start', { subscriptionId });

  const { rows } = await db.query(
    `
    SELECT s.*, c.email AS customer_email
    FROM subscriptions s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.id = $1
    LIMIT 1;
  `,
    [subscriptionId]
  );

  if (!rows.length) {
    logger.warn('tenantProvisioning.subscriptionMissing', { subscriptionId });
    return;
  }

  const subscription = rows[0];

  // Ensure tenant row exists so downstream services have a stable foreign key
  let tenantId = subscription.tenant_id;
  if (!tenantId) {
    const name =
      (subscription.metadata && subscription.metadata.tenantName) ||
      subscription.customer_email ||
      'Migra Tenant';
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = `${slugBase}-${String(Date.now()).slice(-5)}`;

    const insertTenant = `
      INSERT INTO tenants (name, slug, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id;
    `;
    const tenantResult = await db.query(insertTenant, [name, slug]);
    tenantId = tenantResult.rows[0].id;

    await db.query(
      `UPDATE subscriptions SET tenant_id = $1, updated_at = NOW() WHERE id = $2`,
      [tenantId, subscriptionId]
    );
  }

  const productTypes = subscription.metadata?.productTypes || [];

  if (productTypes.includes('hosting') || productTypes.includes('wordpress')) {
    await provisionHosting({ tenantId, subscription });
  }
  if (productTypes.includes('email')) {
    await provisionEmail({ tenantId, subscription });
  }
  if (productTypes.includes('storage')) {
    await provisionStorage({ tenantId, subscription });
  }

  await db.query(
    `UPDATE subscriptions SET status = 'active', updated_at = NOW() WHERE id = $1`,
    [subscriptionId]
  );

  logger.info('tenantProvisioning.complete', {
    subscriptionId,
    tenantId,
    productTypes,
  });
}

async function provisionHosting({ tenantId, subscription }) {
  logger.info('tenantProvisioning.hosting', {
    tenantId,
    subscriptionId: subscription.id,
  });
  // TODO: integrate with provisioning service or queue
}

async function provisionEmail({ tenantId, subscription }) {
  logger.info('tenantProvisioning.email', {
    tenantId,
    subscriptionId: subscription.id,
  });
}

async function provisionStorage({ tenantId, subscription }) {
  logger.info('tenantProvisioning.storage', {
    tenantId,
    subscriptionId: subscription.id,
  });
}
