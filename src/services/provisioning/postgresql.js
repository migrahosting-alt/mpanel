/**
 * PostgreSQL Provisioning Service
 * Handles real database and user provisioning for customer accounts
 */

import pg from 'pg';
const { Client } = pg;

const POSTGRES_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT) || 5433,
  user: process.env.POSTGRES_ADMIN_USER || 'postgres',
  password: process.env.POSTGRES_ADMIN_PASSWORD || 'postgres',
  database: 'postgres', // Connect to default database for admin operations
};

/**
 * Create a new PostgreSQL database
 * @param {string} databaseName - Name of the database to create
 * @param {string} owner - Database owner (optional)
 * @returns {Promise<Object>} - Result with success status
 */
export async function createDatabase(databaseName, owner = null) {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    console.log(`[PostgreSQL] Creating database: ${databaseName}`);
    
    // Sanitize database name (only alphanumeric and underscore)
    const safeName = databaseName.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeName !== databaseName) {
      throw new Error(`Invalid database name: ${databaseName}. Only alphanumeric and underscore allowed.`);
    }
    
    // Check if database already exists
    const checkQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    const checkResult = await client.query(checkQuery, [safeName]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`Database ${safeName} already exists`);
    }
    
    // Create database (cannot use parameterized query for CREATE DATABASE)
    const createQuery = owner
      ? `CREATE DATABASE "${safeName}" OWNER "${owner}"`
      : `CREATE DATABASE "${safeName}"`;
    
    await client.query(createQuery);
    
    console.log(`[PostgreSQL] ✓ Database created: ${safeName}`);
    
    return {
      success: true,
      database: safeName,
      message: `Database ${safeName} created successfully`,
    };
  } catch (error) {
    console.error(`[PostgreSQL] Error creating database ${databaseName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Create a new PostgreSQL user with password
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {Object} options - Additional options (superuser, createdb, etc.)
 * @returns {Promise<Object>} - Result with success status
 */
export async function createUser(username, password, options = {}) {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    console.log(`[PostgreSQL] Creating user: ${username}`);
    
    // Sanitize username
    const safeName = username.replace(/[^a-zA-Z0-9_]/g, '');
    if (safeName !== username) {
      throw new Error(`Invalid username: ${username}. Only alphanumeric and underscore allowed.`);
    }
    
    // Check if user already exists
    const checkQuery = `
      SELECT 1 FROM pg_roles WHERE rolname = $1
    `;
    const checkResult = await client.query(checkQuery, [safeName]);
    
    if (checkResult.rows.length > 0) {
      throw new Error(`User ${safeName} already exists`);
    }
    
    // Build CREATE USER query
    const createQuery = `
      CREATE USER "${safeName}" WITH PASSWORD $1
      ${options.superuser ? 'SUPERUSER' : ''}
      ${options.createdb ? 'CREATEDB' : ''}
      ${options.createrole ? 'CREATEROLE' : ''}
    `;
    
    await client.query(createQuery, [password]);
    
    console.log(`[PostgreSQL] ✓ User created: ${safeName}`);
    
    return {
      success: true,
      username: safeName,
      message: `User ${safeName} created successfully`,
    };
  } catch (error) {
    console.error(`[PostgreSQL] Error creating user ${username}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Grant privileges to a user on a database
 * @param {string} database - Database name
 * @param {string} username - Username
 * @param {string} privilege - Privilege level ('ALL', 'SELECT', 'INSERT', etc.)
 * @returns {Promise<Object>} - Result with success status
 */
export async function grantPrivileges(database, username, privilege = 'ALL') {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    console.log(`[PostgreSQL] Granting ${privilege} on ${database} to ${username}`);
    
    const grantQuery = `GRANT ${privilege} ON DATABASE "${database}" TO "${username}"`;
    await client.query(grantQuery);
    
    console.log(`[PostgreSQL] ✓ Privileges granted`);
    
    return {
      success: true,
      message: `Granted ${privilege} on ${database} to ${username}`,
    };
  } catch (error) {
    console.error(`[PostgreSQL] Error granting privileges:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Delete a PostgreSQL database
 * @param {string} databaseName - Name of the database to delete
 * @returns {Promise<Object>} - Result with success status
 */
export async function deleteDatabase(databaseName) {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    console.log(`[PostgreSQL] Deleting database: ${databaseName}`);
    
    // Terminate all connections to the database
    const terminateQuery = `
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = $1
        AND pid <> pg_backend_pid()
    `;
    await client.query(terminateQuery, [databaseName]);
    
    // Drop database
    const dropQuery = `DROP DATABASE IF EXISTS "${databaseName}"`;
    await client.query(dropQuery);
    
    console.log(`[PostgreSQL] ✓ Database deleted: ${databaseName}`);
    
    return {
      success: true,
      message: `Database ${databaseName} deleted successfully`,
    };
  } catch (error) {
    console.error(`[PostgreSQL] Error deleting database ${databaseName}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Delete a PostgreSQL user
 * @param {string} username - Username to delete
 * @returns {Promise<Object>} - Result with success status
 */
export async function deleteUser(username) {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    console.log(`[PostgreSQL] Deleting user: ${username}`);
    
    // Revoke all privileges first
    const revokeQuery = `
      REVOKE ALL PRIVILEGES ON ALL DATABASES FROM "${username}"
    `;
    try {
      await client.query(revokeQuery);
    } catch (err) {
      // Ignore errors if no privileges to revoke
    }
    
    // Drop user
    const dropQuery = `DROP USER IF EXISTS "${username}"`;
    await client.query(dropQuery);
    
    console.log(`[PostgreSQL] ✓ User deleted: ${username}`);
    
    return {
      success: true,
      message: `User ${username} deleted successfully`,
    };
  } catch (error) {
    console.error(`[PostgreSQL] Error deleting user ${username}:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Provision a complete database setup (database + user + privileges)
 * @param {Object} config - Provisioning configuration
 * @param {string} config.databaseName - Database name
 * @param {string} config.username - Username
 * @param {string} config.password - Password
 * @returns {Promise<Object>} - Result with connection details
 */
export async function provisionDatabase(config) {
  const { databaseName, username, password } = config;
  
  try {
    console.log(`[PostgreSQL] Starting provisioning: ${databaseName} for ${username}`);
    
    // Step 1: Create user
    await createUser(username, password);
    
    // Step 2: Create database with user as owner
    await createDatabase(databaseName, username);
    
    // Step 3: Grant all privileges
    await grantPrivileges(databaseName, username, 'ALL');
    
    console.log(`[PostgreSQL] ✓ Provisioning complete: ${databaseName}`);
    
    return {
      success: true,
      database: databaseName,
      username: username,
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT) || 5433,
      connectionString: `postgresql://${username}:${password}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5433}/${databaseName}`,
      message: 'Database provisioned successfully',
    };
  } catch (error) {
    console.error(`[PostgreSQL] Provisioning failed:`, error);
    
    // Rollback: Try to clean up any created resources
    try {
      await deleteDatabase(databaseName);
      await deleteUser(username);
      console.log(`[PostgreSQL] ✓ Rollback complete`);
    } catch (rollbackError) {
      console.error(`[PostgreSQL] Rollback failed:`, rollbackError);
    }
    
    throw error;
  }
}

/**
 * List all databases (excluding system databases)
 * @returns {Promise<Array>} - List of databases
 */
export async function listDatabases() {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    await client.connect();
    
    const query = `
      SELECT 
        datname as name,
        pg_database_size(datname) as size,
        pg_catalog.pg_get_userbyid(datdba) as owner
      FROM pg_database
      WHERE datistemplate = false
        AND datname NOT IN ('postgres', 'mpanel', 'mpanel_test')
      ORDER BY datname
    `;
    
    const result = await client.query(query);
    
    return result.rows.map(row => ({
      name: row.name,
      size: parseInt(row.size),
      owner: row.owner,
    }));
  } catch (error) {
    console.error(`[PostgreSQL] Error listing databases:`, error);
    throw error;
  } finally {
    await client.end();
  }
}

export default {
  createDatabase,
  createUser,
  grantPrivileges,
  deleteDatabase,
  deleteUser,
  provisionDatabase,
  listDatabases,
};
