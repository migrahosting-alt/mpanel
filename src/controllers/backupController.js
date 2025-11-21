// src/controllers/backupController.js
/**
 * Backup & Restore System Controller
 * Handles automated backups, manual backups, and restore operations
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import extract from 'extract-zip';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const execAsync = promisify(exec);

// Initialize S3/MinIO client
const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
  },
  forcePathStyle: true, // Required for MinIO
});

const BACKUP_BUCKET = process.env.BACKUP_BUCKET || 'mpanel-backups';
const BACKUP_DIR = process.env.BACKUP_DIR || '/var/mpanel/backups';

/**
 * Get all backups for user
 */
export const getBackups = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `
      SELECT 
        b.*,
        u.email as owner_email
      FROM backups b
      LEFT JOIN users u ON b.user_id = u.id
    `;

    const params = [];
    if (!isAdmin) {
      query += ` WHERE b.user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY b.created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ backups: result.rows });
  } catch (error) {
    logger.error('Error fetching backups:', error);
    res.status(500).json({ error: 'Failed to fetch backups' });
  }
};

/**
 * Get single backup details
 */
/**
 * Get single backup
 */
export const getBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT * FROM backups WHERE id = $1`
      : `SELECT * FROM backups WHERE id = $1 AND user_id = $2`;
    
    const params = isAdmin ? [id] : [id, userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching backup:', error);
    res.status(500).json({ error: 'Failed to fetch backup' });
  }
};

/**
 * Create manual backup
 */
export const createBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, resource_type, resource_id, description } = req.body;

    if (!type || !resource_type || !resource_id) {
      return res.status(400).json({ error: 'Type, resource_type, and resource_id are required' });
    }

    // Validate resource ownership
    const ownershipCheck = await verifyResourceOwnership(userId, resource_type, resource_id);
    if (!ownershipCheck) {
      return res.status(403).json({ error: 'You do not have access to this resource' });
    }

    // Create backup record
    const backupName = `${resource_type}_${resource_id}_${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO backups (user_id, name, type, resource_type, resource_id, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, backupName, type, resource_type, resource_id, description, 'pending']
    );

    const backup = result.rows[0];

    // Start backup process asynchronously
    performBackup(backup.id, userId, resource_type, resource_id)
      .catch(error => logger.error(`Backup ${backup.id} failed:`, error));

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'backup_created', `Created backup for ${resource_type} #${resource_id}`]
    );

    logger.info(`Backup initiated: ${backupName}`);
    res.status(201).json(backup);
  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
};

/**
 * Perform actual backup process
 */
async function performBackup(backupId, userId, resourceType, resourceId) {
  try {
    // Update status to in_progress
    await pool.query(
      `UPDATE backups SET status = $1, started_at = NOW() WHERE id = $2`,
      ['in_progress', backupId]
    );

    let backupPath;
    let size = 0;

    // Perform backup based on resource type
    switch (resourceType) {
      case 'website':
        backupPath = await backupWebsite(resourceId);
        break;
      case 'database':
        backupPath = await backupDatabase(resourceId);
        break;
      case 'email':
        backupPath = await backupEmail(resourceId);
        break;
      case 'full':
        backupPath = await backupFull(userId);
        break;
      default:
        throw new Error(`Unknown resource type: ${resourceType}`);
    }

    // Get file size
    const stats = await fs.stat(backupPath);
    size = stats.size;

    // Upload to S3/MinIO
    const s3Key = `backups/${userId}/${path.basename(backupPath)}`;
    await uploadToS3(backupPath, s3Key);

    // Update backup record
    await pool.query(
      `UPDATE backups 
       SET status = $1, path = $2, size = $3, completed_at = NOW()
       WHERE id = $4`,
      ['completed', s3Key, size, backupId]
    );

    // Clean up local file
    await fs.unlink(backupPath);

    logger.info(`Backup ${backupId} completed successfully`);
  } catch (error) {
    logger.error(`Backup ${backupId} failed:`, error);
    await pool.query(
      `UPDATE backups SET status = $1, error = $2 WHERE id = $3`,
      ['failed', error.message, backupId]
    );
  }
}

/**
 * Backup website files
 */
async function backupWebsite(websiteId) {
  const website = await pool.query(`SELECT * FROM websites WHERE id = $1`, [websiteId]);
  if (website.rows.length === 0) throw new Error('Website not found');

  const sitePath = website.rows[0].path || `/var/www/${website.rows[0].domain}`;
  const backupPath = path.join(BACKUP_DIR, `website_${websiteId}_${Date.now()}.zip`);

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(backupPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(sitePath, false);
    archive.finalize();
  });
}

/**
 * Backup database
 */
async function backupDatabase(databaseId) {
  const db = await pool.query(`SELECT * FROM databases WHERE id = $1`, [databaseId]);
  if (db.rows.length === 0) throw new Error('Database not found');

  const dbName = db.rows[0].name;
  const backupPath = path.join(BACKUP_DIR, `database_${databaseId}_${Date.now()}.sql`);

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  // Use pg_dump for PostgreSQL
  const { stdout } = await execAsync(
    `pg_dump -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} ${dbName}`
  );

  await fs.writeFile(backupPath, stdout);
  return backupPath;
}

/**
 * Backup email account
 */
async function backupEmail(emailId) {
  const email = await pool.query(`SELECT * FROM email_accounts WHERE id = $1`, [emailId]);
  if (email.rows.length === 0) throw new Error('Email account not found');

  const mailPath = `/var/mail/${email.rows[0].email}`;
  const backupPath = path.join(BACKUP_DIR, `email_${emailId}_${Date.now()}.zip`);

  await fs.mkdir(BACKUP_DIR, { recursive: true });

  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(backupPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(mailPath, false);
    archive.finalize();
  });
}

/**
 * Full account backup
 */
async function backupFull(userId) {
  const backupPath = path.join(BACKUP_DIR, `full_${userId}_${Date.now()}.zip`);
  await fs.mkdir(BACKUP_DIR, { recursive: true });

  return new Promise(async (resolve, reject) => {
    const output = require('fs').createWriteStream(backupPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(backupPath));
    archive.on('error', reject);

    archive.pipe(output);

    // Add all user websites
    const websites = await pool.query(`SELECT * FROM websites WHERE user_id = $1`, [userId]);
    for (const site of websites.rows) {
      const sitePath = site.path || `/var/www/${site.domain}`;
      archive.directory(sitePath, `websites/${site.domain}`);
    }

    // Add all user databases
    const databases = await pool.query(`SELECT * FROM databases WHERE user_id = $1`, [userId]);
    for (const db of databases.rows) {
      const { stdout } = await execAsync(
        `pg_dump -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} ${db.name}`
      );
      archive.append(stdout, { name: `databases/${db.name}.sql` });
    }

    archive.finalize();
  });
}

/**
 * Upload file to S3/MinIO
 */
async function uploadToS3(filePath, key) {
  const fileContent = await fs.readFile(filePath);
  
  const command = new PutObjectCommand({
    Bucket: BACKUP_BUCKET,
    Key: key,
    Body: fileContent,
  });

  await s3Client.send(command);
}

/**
 * Restore backup
 */
/**
 * Restore from backup
 */
export const restoreBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const backup = await pool.query(
      `SELECT * FROM backups WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (backup.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backupData = backup.rows[0];

    if (backupData.status !== 'completed') {
      return res.status(400).json({ error: 'Backup is not in a restorable state' });
    }

    // Start restore process asynchronously
    performRestore(backupData)
      .catch(error => logger.error(`Restore ${id} failed:`, error));

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'backup_restored', `Initiated restore from backup #${id}`]
    );

    res.json({ message: 'Restore initiated', backup: backupData });
  } catch (error) {
    logger.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
};

/**
 * Perform actual restore process
 */
async function performRestore(backup) {
  try {
    // Download from S3
    const localPath = path.join(BACKUP_DIR, path.basename(backup.path));
    await downloadFromS3(backup.path, localPath);

    // Restore based on resource type
    switch (backup.resource_type) {
      case 'website':
        await restoreWebsite(backup.resource_id, localPath);
        break;
      case 'database':
        await restoreDatabase(backup.resource_id, localPath);
        break;
      case 'email':
        await restoreEmail(backup.resource_id, localPath);
        break;
      case 'full':
        await restoreFull(backup.user_id, localPath);
        break;
    }

    // Clean up local file
    await fs.unlink(localPath);

    logger.info(`Restore completed for backup ${backup.id}`);
  } catch (error) {
    logger.error(`Restore failed for backup ${backup.id}:`, error);
    throw error;
  }
}

/**
 * Download file from S3/MinIO
 */
async function downloadFromS3(key, localPath) {
  const command = new GetObjectCommand({
    Bucket: BACKUP_BUCKET,
    Key: key,
  });

  const response = await s3Client.send(command);
  const chunks = [];
  
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  
  await fs.writeFile(localPath, Buffer.concat(chunks));
}

/**
 * Restore website from backup
 */
async function restoreWebsite(websiteId, backupPath) {
  const website = await pool.query(`SELECT * FROM websites WHERE id = $1`, [websiteId]);
  if (website.rows.length === 0) throw new Error('Website not found');

  const sitePath = website.rows[0].path || `/var/www/${website.rows[0].domain}`;
  
  // Backup current state before restore
  const backupCurrent = `${sitePath}_backup_${Date.now()}`;
  await execAsync(`mv ${sitePath} ${backupCurrent}`);

  try {
    await extract(backupPath, { dir: sitePath });
  } catch (error) {
    // Restore original on failure
    await execAsync(`mv ${backupCurrent} ${sitePath}`);
    throw error;
  }

  // Clean up backup of current state
  await execAsync(`rm -rf ${backupCurrent}`);
}

/**
 * Restore database from backup
 */
async function restoreDatabase(databaseId, backupPath) {
  const db = await pool.query(`SELECT * FROM databases WHERE id = $1`, [databaseId]);
  if (db.rows.length === 0) throw new Error('Database not found');

  const dbName = db.rows[0].name;
  
  // Read SQL file and execute
  const sqlContent = await fs.readFile(backupPath, 'utf-8');
  
  // Drop and recreate database
  await pool.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await pool.query(`CREATE DATABASE ${dbName}`);
  
  // Import data
  await execAsync(
    `psql -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} ${dbName} < ${backupPath}`
  );
}

/**
 * Restore email account from backup
 */
async function restoreEmail(emailId, backupPath) {
  const email = await pool.query(`SELECT * FROM email_accounts WHERE id = $1`, [emailId]);
  if (email.rows.length === 0) throw new Error('Email account not found');

  const mailPath = `/var/mail/${email.rows[0].email}`;
  
  // Backup current emails
  const backupCurrent = `${mailPath}_backup_${Date.now()}`;
  await execAsync(`mv ${mailPath} ${backupCurrent}`);

  try {
    await extract(backupPath, { dir: mailPath });
  } catch (error) {
    await execAsync(`mv ${backupCurrent} ${mailPath}`);
    throw error;
  }

  await execAsync(`rm -rf ${backupCurrent}`);
}

/**
 * Restore full account from backup
 */
async function restoreFull(userId, backupPath) {
  const extractPath = path.join(BACKUP_DIR, `restore_${userId}_${Date.now()}`);
  await extract(backupPath, { dir: extractPath });

  // Restore websites
  const websitesPath = path.join(extractPath, 'websites');
  const websites = await fs.readdir(websitesPath);
  for (const domain of websites) {
    const sitePath = `/var/www/${domain}`;
    await execAsync(`cp -r ${path.join(websitesPath, domain)} ${sitePath}`);
  }

  // Restore databases
  const databasesPath = path.join(extractPath, 'databases');
  const databases = await fs.readdir(databasesPath);
  for (const dbFile of databases) {
    const dbName = path.basename(dbFile, '.sql');
    await execAsync(
      `psql -h ${process.env.DB_HOST || 'localhost'} -U ${process.env.DB_USER || 'postgres'} ${dbName} < ${path.join(databasesPath, dbFile)}`
    );
  }

  // Clean up extract directory
  await execAsync(`rm -rf ${extractPath}`);
}

/**
 * Delete backup
 */
export const deleteBackup = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const backup = await pool.query(
      `SELECT * FROM backups WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (backup.rows.length === 0) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backupData = backup.rows[0];

    // Delete from S3
    if (backupData.path) {
      const command = new DeleteObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: backupData.path,
      });
      await s3Client.send(command);
    }

    // Delete from database
    await pool.query(`DELETE FROM backups WHERE id = $1`, [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'backup_deleted', `Deleted backup #${id}`]
    );

    logger.info(`Backup ${id} deleted`);
    res.json({ message: 'Backup deleted successfully' });
  } catch (error) {
    logger.error('Error deleting backup:', error);
    res.status(500).json({ error: 'Failed to delete backup' });
  }
};

/**
 * Get backup schedules
 */
export const getSchedules = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM backup_schedules WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ schedules: result.rows });
  } catch (error) {
    logger.error('Error fetching backup schedules:', error);
    res.status(500).json({ error: 'Failed to fetch backup schedules' });
  }
};

/**
 * Create backup schedule
 */
export const createSchedule = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resource_type, resource_id, frequency, retention_days } = req.body;

    if (!resource_type || !resource_id || !frequency) {
      return res.status(400).json({ error: 'Resource type, resource ID, and frequency are required' });
    }

    const result = await pool.query(
      `INSERT INTO backup_schedules (user_id, resource_type, resource_id, frequency, retention_days)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, resource_type, resource_id, frequency, retention_days || 30]
    );

    logger.info(`Backup schedule created for ${resource_type} #${resource_id}`);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    logger.error('Error creating backup schedule:', error);
    res.status(500).json({ error: 'Failed to create backup schedule' });
  }
};

/**
 * Update backup schedule
 */
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { frequency, retention_days, enabled } = req.body;

    const result = await pool.query(
      `UPDATE backup_schedules 
       SET frequency = COALESCE($1, frequency),
           retention_days = COALESCE($2, retention_days),
           enabled = COALESCE($3, enabled),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [frequency, retention_days, enabled, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backup schedule not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error updating backup schedule:', error);
    res.status(500).json({ error: 'Failed to update backup schedule' });
  }
};

/**
 * Delete backup schedule
 */
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `DELETE FROM backup_schedules WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Backup schedule not found' });
    }

    res.json({ message: 'Backup schedule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting backup schedule:', error);
    res.status(500).json({ error: 'Failed to delete backup schedule' });
  }
};

/**
 * Verify resource ownership
 */
async function verifyResourceOwnership(userId, resourceType, resourceId) {
  let table;
  switch (resourceType) {
    case 'website':
      table = 'websites';
      break;
    case 'database':
      table = 'databases';
      break;
    case 'email':
      table = 'email_accounts';
      break;
    case 'full':
      return true; // Full backup is always owned by user
    default:
      return false;
  }

  const result = await pool.query(
    `SELECT id FROM ${table} WHERE id = $1 AND user_id = $2`,
    [resourceId, userId]
  );

  return result.rows.length > 0;
}
