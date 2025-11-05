import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting database migration...');
    
    // Run base billing schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await client.query(schema);
    logger.info('Base schema migrated');
    
    // Run hosting/control panel schema
    const hostingSchemaPath = path.join(__dirname, 'schema-hosting.sql');
    const hostingSchema = fs.readFileSync(hostingSchemaPath, 'utf8');
    await client.query(hostingSchema);
    logger.info('Hosting schema migrated');
    
    logger.info('Database migration completed successfully');
    
    // Insert default tenant for development
    if (process.env.NODE_ENV === 'development') {
      await client.query(`
        INSERT INTO tenants (name, domain, status)
        VALUES ('Default Tenant', 'localhost', 'active')
        ON CONFLICT DO NOTHING
      `);
      logger.info('Default tenant created');
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
