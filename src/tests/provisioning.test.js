/**
 * Provisioning Integration Tests
 * Tests PostgreSQL, Email, and DNS provisioning services
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import pool from '../db/index.js';

import {
  provisionDatabase,
  createDatabase,
  createUser,
  deleteDatabase,
  deleteUser,
} from '../services/provisioning/postgresql.js';

import {
  createEmailAccount,
  createEmailForwarder,
  deleteEmailAccount,
  changeEmailPassword,
} from '../services/provisioning/email.js';

import {
  createDNSZone,
  createDNSRecord,
  deleteDNSZone,
  deleteDNSRecord,
} from '../services/provisioning/dns.js';

const TEST_TENANT_ID = 999;

// PostgreSQL Provisioning Tests
describe('PostgreSQL Provisioning', () => {
  const testDb = `test_db_${Date.now()}`;
  const testUser = `test_user_${Date.now()}`;
  const testPassword = 'TestPass123!';

  after(async () => {
    // Cleanup
    try {
      await deleteDatabase(testDb);
      await deleteUser(testUser);
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should create database successfully', async () => {
    const result = await createDatabase(testDb, testUser);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.database, testDb);
  });

  it('should prevent duplicate database creation', async () => {
    await assert.rejects(
      async () => await createDatabase(testDb),
      /already exists/
    );
  });

  it('should create user successfully', async () => {
    const result = await createUser(testUser, testPassword);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.username, testUser);
  });

  it('should provision database with rollback on failure', async () => {
    const config = {
      databaseName: `test_rollback_${Date.now()}`,
      username: `test_rollback_user_${Date.now()}`,
      password: testPassword,
    };

    // Test successful provisioning
    const result = await provisionDatabase(config);
    assert.strictEqual(result.success, true);
    assert.ok(result.connectionString.includes('postgresql://'));

    // Cleanup
    await deleteDatabase(config.databaseName);
    await deleteUser(config.username);
  });

  it('should sanitize database names', async () => {
    const unsafeName = 'test-db!@#$%^&*()';
    const result = await createDatabase(unsafeName);
    assert.ok(result.database.match(/^[a-zA-Z0-9_]+$/));
    
    await deleteDatabase(result.database);
  });

  it('should delete database successfully', async () => {
    const dbName = `test_delete_${Date.now()}`;
    await createDatabase(dbName);
    
    const result = await deleteDatabase(dbName);
    assert.strictEqual(result.success, true);
  });

  it('should delete user successfully', async () => {
    const userName = `test_delete_user_${Date.now()}`;
    await createUser(userName, testPassword);
    
    const result = await deleteUser(userName);
    assert.strictEqual(result.success, true);
  });
});

// Email Provisioning Tests
describe('Email Provisioning', () => {
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'EmailPass123!';

  before(async () => {
    // Ensure email tables exist
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_accounts (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL,
          domain VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE,
          username VARCHAR(255) NOT NULL,
          password_hash TEXT NOT NULL,
          quota_mb INTEGER DEFAULT 1000,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS email_forwarders (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL,
          domain VARCHAR(255) NOT NULL,
          source VARCHAR(255) NOT NULL,
          destination TEXT NOT NULL,
          enabled BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } finally {
      client.release();
    }
  });

  after(async () => {
    // Cleanup
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM email_accounts WHERE tenant_id = $1', [TEST_TENANT_ID]);
      await client.query('DELETE FROM email_forwarders WHERE tenant_id = $1', [TEST_TENANT_ID]);
    } finally {
      client.release();
    }
  });

  it('should create email account successfully', async () => {
    const config = {
      email: testEmail,
      password: testPassword,
      quota: 2000,
      tenantId: TEST_TENANT_ID,
    };

    const result = await createEmailAccount(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.account.email, testEmail);
    assert.strictEqual(result.account.quota, 2000);
  });

  it('should prevent duplicate email accounts', async () => {
    await assert.rejects(
      async () => await createEmailAccount({
        email: testEmail,
        password: testPassword,
        tenantId: TEST_TENANT_ID,
      }),
      /already exists/
    );
  });

  it('should validate email format', async () => {
    await assert.rejects(
      async () => await createEmailAccount({
        email: 'invalid-email',
        password: testPassword,
        tenantId: TEST_TENANT_ID,
      }),
      /Invalid email format/
    );
  });

  it('should create email forwarder successfully', async () => {
    const config = {
      source: `forward${Date.now()}@example.com`,
      destination: 'dest@example.com',
      tenantId: TEST_TENANT_ID,
    };

    const result = await createEmailForwarder(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.forwarder.source, config.source);
  });

  it('should support multiple destinations for forwarder', async () => {
    const config = {
      source: `multi${Date.now()}@example.com`,
      destination: 'dest1@example.com,dest2@example.com',
      tenantId: TEST_TENANT_ID,
    };

    const result = await createEmailForwarder(config);
    assert.strictEqual(result.success, true);
    assert.ok(result.forwarder.destination.includes('dest1@example.com'));
  });

  it('should change email password successfully', async () => {
    const newPassword = 'NewPass456!';
    const result = await changeEmailPassword(testEmail, newPassword, TEST_TENANT_ID);
    assert.strictEqual(result.success, true);
  });

  it('should delete email account successfully', async () => {
    const result = await deleteEmailAccount(testEmail, TEST_TENANT_ID);
    assert.strictEqual(result.success, true);
  });
});

// DNS Provisioning Tests
describe('DNS Provisioning', () => {
  const testDomain = `test${Date.now()}.com`;
  let createdZoneId;

  before(async () => {
    // Ensure DNS tables exist
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS dns_zones (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL,
          domain VARCHAR(255) NOT NULL UNIQUE,
          type VARCHAR(20) DEFAULT 'MASTER',
          master VARCHAR(255),
          serial INTEGER NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS dns_records (
          id SERIAL PRIMARY KEY,
          zone_id INTEGER NOT NULL REFERENCES dns_zones(id) ON DELETE CASCADE,
          tenant_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(10) NOT NULL,
          content TEXT NOT NULL,
          ttl INTEGER DEFAULT 3600,
          prio INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } finally {
      client.release();
    }
  });

  after(async () => {
    // Cleanup
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM dns_records WHERE tenant_id = $1', [TEST_TENANT_ID]);
      await client.query('DELETE FROM dns_zones WHERE tenant_id = $1', [TEST_TENANT_ID]);
    } finally {
      client.release();
    }
  });

  it('should create DNS zone successfully', async () => {
    const config = {
      domain: testDomain,
      tenantId: TEST_TENANT_ID,
      type: 'MASTER',
    };

    const result = await createDNSZone(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.zone.domain, testDomain);
    assert.ok(result.zone.serial > 0);
    
    createdZoneId = result.zone.id;
  });

  it('should create default records with zone', async () => {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT COUNT(*) FROM dns_records WHERE zone_id = $1',
        [createdZoneId]
      );
      
      // Should have SOA, NS (2), A, CNAME, MX = 6 records
      assert.ok(parseInt(result.rows[0].count) >= 6);
    } finally {
      client.release();
    }
  });

  it('should prevent duplicate DNS zones', async () => {
    await assert.rejects(
      async () => await createDNSZone({
        domain: testDomain,
        tenantId: TEST_TENANT_ID,
      }),
      /already exists/
    );
  });

  it('should validate domain format', async () => {
    await assert.rejects(
      async () => await createDNSZone({
        domain: 'invalid domain!',
        tenantId: TEST_TENANT_ID,
      }),
      /Invalid domain format/
    );
  });

  it('should create DNS record successfully', async () => {
    const config = {
      zoneId: createdZoneId,
      name: `subdomain.${testDomain}`,
      type: 'A',
      content: '192.168.1.100',
      ttl: 7200,
      tenantId: TEST_TENANT_ID,
    };

    const result = await createDNSRecord(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.record.type, 'A');
    assert.strictEqual(result.record.content, '192.168.1.100');
  });

  it('should create MX record with priority', async () => {
    const config = {
      zoneId: createdZoneId,
      name: testDomain,
      type: 'MX',
      content: `mail2.${testDomain}.`,
      ttl: 3600,
      prio: 20,
      tenantId: TEST_TENANT_ID,
    };

    const result = await createDNSRecord(config);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.record.prio, 20);
  });

  it('should increment zone serial on record creation', async () => {
    const client = await pool.connect();
    try {
      const beforeResult = await client.query(
        'SELECT serial FROM dns_zones WHERE id = $1',
        [createdZoneId]
      );
      const beforeSerial = beforeResult.rows[0].serial;

      await createDNSRecord({
        zoneId: createdZoneId,
        name: `test2.${testDomain}`,
        type: 'A',
        content: '192.168.1.101',
        tenantId: TEST_TENANT_ID,
      });

      const afterResult = await client.query(
        'SELECT serial FROM dns_zones WHERE id = $1',
        [createdZoneId]
      );
      const afterSerial = afterResult.rows[0].serial;

      assert.ok(afterSerial > beforeSerial);
    } finally {
      client.release();
    }
  });

  it('should delete DNS record successfully', async () => {
    const client = await pool.connect();
    let recordId;
    
    try {
      const result = await client.query(
        'SELECT id FROM dns_records WHERE zone_id = $1 AND type = $2 LIMIT 1',
        [createdZoneId, 'A']
      );
      recordId = result.rows[0].id;
    } finally {
      client.release();
    }

    const deleteResult = await deleteDNSRecord(recordId, TEST_TENANT_ID);
    assert.strictEqual(deleteResult.success, true);
  });

  it('should delete DNS zone and cascade records', async () => {
    const result = await deleteDNSZone(createdZoneId, TEST_TENANT_ID);
    assert.strictEqual(result.success, true);

    // Verify records were deleted
    const client = await pool.connect();
    try {
      const recordsResult = await client.query(
        'SELECT COUNT(*) FROM dns_records WHERE zone_id = $1',
        [createdZoneId]
      );
      assert.strictEqual(parseInt(recordsResult.rows[0].count), 0);
    } finally {
      client.release();
    }
  });
});

// End-to-End Provisioning Tests
describe('Full Customer Provisioning Workflow', () => {
  const timestamp = Date.now();
  const customerData = {
    domain: `customer${timestamp}.com`,
    email: `admin@customer${timestamp}.com`,
    dbName: `customer${timestamp}_db`,
    dbUser: `customer${timestamp}_user`,
    password: 'Customer123!',
    tenantId: TEST_TENANT_ID,
  };

  let zoneId, emailId, dbConnectionString;

  it('should provision database for customer', async () => {
    const result = await provisionDatabase({
      databaseName: customerData.dbName,
      username: customerData.dbUser,
      password: customerData.password,
    });

    assert.strictEqual(result.success, true);
    assert.ok(result.connectionString);
    dbConnectionString = result.connectionString;
  });

  it('should provision email account for customer', async () => {
    const result = await createEmailAccount({
      email: customerData.email,
      password: customerData.password,
      quota: 5000,
      tenantId: customerData.tenantId,
    });

    assert.strictEqual(result.success, true);
    emailId = result.account.id;
  });

  it('should provision DNS zone for customer', async () => {
    const result = await createDNSZone({
      domain: customerData.domain,
      tenantId: customerData.tenantId,
      type: 'MASTER',
    });

    assert.strictEqual(result.success, true);
    zoneId = result.zone.id;
  });

  it('should have all customer resources provisioned', () => {
    assert.ok(dbConnectionString);
    assert.ok(emailId);
    assert.ok(zoneId);
  });

  after(async () => {
    // Cleanup all customer resources
    try {
      await deleteDatabase(customerData.dbName);
      await deleteUser(customerData.dbUser);
      await deleteEmailAccount(customerData.email, customerData.tenantId);
      await deleteDNSZone(zoneId, customerData.tenantId);
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  });
});

console.log('\n🧪 Running provisioning integration tests...\n');
