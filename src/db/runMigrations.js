import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../../prisma/migrations');

/**
 * Run all database migrations in order
 */
async function runAllMigrations() {
  try {
    logger.info('=== Starting Database Migrations ===');

    // Create migrations tracking table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration directories
    const migrationDirs = await fs.readdir(MIGRATIONS_DIR);
    const sortedMigrations = migrationDirs
      .filter(dir => !dir.startsWith('.'))
      .sort();

    logger.info(`Found ${sortedMigrations.length} migration(s)`);

    // Check which migrations have already been executed
    const executedResult = await db.query('SELECT name FROM _migrations');
    const executed = new Set(executedResult.rows.map(r => r.name));

    let executedCount = 0;
    let skippedCount = 0;

    for (const migrationName of sortedMigrations) {
      if (executed.has(migrationName)) {
        logger.info(`⏭️  Skipping ${migrationName} (already executed)`);
        skippedCount++;
        continue;
      }

      const migrationPath = path.join(MIGRATIONS_DIR, migrationName, 'migration.sql');
      
      try {
        // Check if migration.sql exists
        await fs.access(migrationPath);
        
        logger.info(`▶️  Running ${migrationName}...`);
        
        // Read and execute migration
        const sql = await fs.readFile(migrationPath, 'utf-8');
        
        // Execute in a transaction
        await db.query('BEGIN');
        try {
          await db.query(sql);
          await db.query(
            'INSERT INTO _migrations (name) VALUES ($1)',
            [migrationName]
          );
          await db.query('COMMIT');
          logger.info(`✅ Completed ${migrationName}`);
          executedCount++;
        } catch (err) {
          await db.query('ROLLBACK');
          throw err;
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          logger.warn(`⚠️  Migration file not found: ${migrationPath}`);
        } else {
          logger.error(`❌ Failed to execute ${migrationName}:`, err.message);
          throw err;
        }
      }
    }

    logger.info('\n=== Migration Summary ===');
    logger.info(`✅ Executed: ${executedCount}`);
    logger.info(`⏭️  Skipped: ${skippedCount}`);
    logger.info(`📊 Total: ${sortedMigrations.length}`);
    logger.info('=========================\n');

    return { executed: executedCount, skipped: skippedCount, total: sortedMigrations.length };
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllMigrations()
    .then(() => {
      logger.info('All migrations completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Fatal migration error:', err);
      process.exit(1);
    });
}

export default runAllMigrations;
