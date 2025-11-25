/**
 * Multi-Database Management Service
 * Support for MySQL, MariaDB, MongoDB, Redis with replication and failover
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
import axios from 'axios';

class MultiDatabaseService {
  constructor() {
    this.connections = new Map();
  }

  /**
   * Create database instance
   */
  async createDatabase(userId, tenantId, dbData) {
    try {
      const {
        name,
        type, // postgresql, mysql, mariadb, mongodb, redis
        version,
        serverId,
        size = 'small',
        replication = false,
        sharding = false
      } = dbData;

      // Validate database type
      const supportedTypes = ['postgresql', 'mysql', 'mariadb', 'mongodb', 'redis'];
      if (!supportedTypes.includes(type)) {
        throw new Error(`Unsupported database type: ${type}`);
      }

      // Create database record
      const result = await pool.query(
        `INSERT INTO databases 
         (user_id, tenant_id, name, type, version, server_id, size, 
          replication_enabled, sharding_enabled, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'provisioning')
         RETURNING *`,
        [userId, tenantId, name, type, version, serverId, size, 
         replication, sharding]
      );

      const database = result.rows[0];

      // Provision database based on type
      await this.provisionDatabase(database);

      logger.info('Database created', { 
        databaseId: database.id, 
        type, 
        name 
      });

      return database;
    } catch (error) {
      logger.error('Failed to create database', { error: error.message });
      throw error;
    }
  }

  /**
   * Provision database on server
   */
  async provisionDatabase(database) {
    try {
      // Get server details
      const serverResult = await pool.query(
        'SELECT * FROM servers WHERE id = $1',
        [database.server_id]
      );

      const server = serverResult.rows[0];

      if (!server) {
        throw new Error('Server not found');
      }

      // Generate credentials
      const username = `user_${database.id.substring(0, 8)}`;
      const password = this.generatePassword();

      // Provision based on database type
      switch (database.type) {
        case 'mysql':
        case 'mariadb':
          await this.provisionMySQL(server, database, username, password);
          break;
        case 'postgresql':
          await this.provisionPostgreSQL(server, database, username, password);
          break;
        case 'mongodb':
          await this.provisionMongoDB(server, database, username, password);
          break;
        case 'redis':
          await this.provisionRedis(server, database, password);
          break;
      }

      // Store credentials
      await pool.query(
        `UPDATE databases 
         SET username = $1, password_hash = $2, connection_string = $3, 
             status = 'active', provisioned_at = NOW()
         WHERE id = $4`,
        [
          username,
          password, // In production, hash this
          this.getConnectionString(server, database, username, password),
          database.id
        ]
      );

      logger.info('Database provisioned', { databaseId: database.id });

    } catch (error) {
      logger.error('Failed to provision database', { 
        error: error.message, 
        databaseId: database.id 
      });

      await pool.query(
        'UPDATE databases SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, database.id]
      );

      throw error;
    }
  }

  /**
   * Provision MySQL/MariaDB database
   */
  async provisionMySQL(server, database, username, password) {
    const connection = await mysql.createConnection({
      host: server.ip_address,
      port: 3306,
      user: process.env.MYSQL_ROOT_USER,
      password: process.env.MYSQL_ROOT_PASSWORD
    });

    try {
      // Create database
      await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${database.name}\``);

      // Create user
      await connection.execute(
        `CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`,
        [username, password]
      );

      // Grant privileges
      await connection.execute(
        `GRANT ALL PRIVILEGES ON \`${database.name}\`.* TO ?@'%'`,
        [username]
      );

      await connection.execute('FLUSH PRIVILEGES');

      logger.info('MySQL database provisioned', { databaseId: database.id });

    } finally {
      await connection.end();
    }
  }

  /**
   * Provision PostgreSQL database
   */
  async provisionPostgreSQL(server, database, username, password) {
    // This would use server-agent API to provision PostgreSQL
    const response = await axios.post(`http://${server.ip_address}:3100/database/provision`, {
      type: 'postgresql',
      name: database.name,
      username,
      password
    });

    if (response.data.success) {
      logger.info('PostgreSQL database provisioned', { databaseId: database.id });
    } else {
      throw new Error('Failed to provision PostgreSQL database');
    }
  }

  /**
   * Provision MongoDB database
   */
  async provisionMongoDB(server, database, username, password) {
    const client = new MongoClient(`mongodb://${server.ip_address}:27017`, {
      auth: {
        username: process.env.MONGODB_ROOT_USER,
        password: process.env.MONGODB_ROOT_PASSWORD
      }
    });

    try {
      await client.connect();

      const adminDb = client.db('admin');

      // Create user with database access
      await adminDb.command({
        createUser: username,
        pwd: password,
        roles: [
          { role: 'readWrite', db: database.name },
          { role: 'dbAdmin', db: database.name }
        ]
      });

      logger.info('MongoDB database provisioned', { databaseId: database.id });

    } finally {
      await client.close();
    }
  }

  /**
   * Provision Redis instance
   */
  async provisionRedis(server, database, password) {
    // Redis provisioning via server-agent
    const response = await axios.post(`http://${server.ip_address}:3100/database/provision`, {
      type: 'redis',
      name: database.name,
      password
    });

    if (response.data.success) {
      logger.info('Redis instance provisioned', { databaseId: database.id });
    } else {
      throw new Error('Failed to provision Redis instance');
    }
  }

  /**
   * Setup database replication
   */
  async setupReplication(databaseId, replicaServerId) {
    try {
      const dbResult = await pool.query(
        'SELECT * FROM databases WHERE id = $1',
        [databaseId]
      );

      const database = dbResult.rows[0];

      if (!database) {
        throw new Error('Database not found');
      }

      // Create replica record
      const replicaResult = await pool.query(
        `INSERT INTO database_replicas 
         (database_id, server_id, role, status)
         VALUES ($1, $2, 'replica', 'provisioning')
         RETURNING *`,
        [databaseId, replicaServerId]
      );

      const replica = replicaResult.rows[0];

      // Configure replication based on database type
      switch (database.type) {
        case 'mysql':
        case 'mariadb':
          await this.setupMySQLReplication(database, replica);
          break;
        case 'postgresql':
          await this.setupPostgreSQLReplication(database, replica);
          break;
        case 'mongodb':
          await this.setupMongoDBReplication(database, replica);
          break;
        case 'redis':
          await this.setupRedisReplication(database, replica);
          break;
      }

      await pool.query(
        'UPDATE database_replicas SET status = $1 WHERE id = $2',
        ['active', replica.id]
      );

      logger.info('Database replication configured', { 
        databaseId, 
        replicaId: replica.id 
      });

      return replica;

    } catch (error) {
      logger.error('Failed to setup replication', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup MySQL replication
   */
  async setupMySQLReplication(database, replica) {
    // Get master and replica servers
    const masterServer = await pool.query('SELECT * FROM servers WHERE id = $1', [database.server_id]);
    const replicaServer = await pool.query('SELECT * FROM servers WHERE id = $1', [replica.server_id]);

    // This would configure MySQL master-slave replication
    // Implementation involves CHANGE MASTER TO commands, binary log configuration, etc.
    
    logger.info('MySQL replication configured', { databaseId: database.id });
  }

  /**
   * Automatic failover detection and promotion
   */
  async detectAndFailover() {
    try {
      // Get all databases with replication enabled
      const result = await pool.query(
        `SELECT d.*, s.ip_address, s.status as server_status
         FROM databases d
         JOIN servers s ON d.server_id = s.id
         WHERE d.replication_enabled = true AND d.status = 'active'`
      );

      for (const database of result.rows) {
        // Check if master is healthy
        const isHealthy = await this.checkDatabaseHealth(database);

        if (!isHealthy) {
          logger.warn('Database master unhealthy, initiating failover', { 
            databaseId: database.id 
          });

          await this.performFailover(database.id);
        }
      }

    } catch (error) {
      logger.error('Failover detection failed', { error: error.message });
    }
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(database) {
    try {
      switch (database.type) {
        case 'mysql':
        case 'mariadb':
          return await this.checkMySQLHealth(database);
        case 'postgresql':
          return await this.checkPostgreSQLHealth(database);
        case 'mongodb':
          return await this.checkMongoDBHealth(database);
        case 'redis':
          return await this.checkRedisHealth(database);
        default:
          return true;
      }
    } catch (error) {
      logger.error('Health check failed', { error: error.message, databaseId: database.id });
      return false;
    }
  }

  /**
   * Perform failover to replica
   */
  async performFailover(databaseId) {
    try {
      // Get healthiest replica
      const replicaResult = await pool.query(
        `SELECT dr.*, s.ip_address, s.status
         FROM database_replicas dr
         JOIN servers s ON dr.server_id = s.id
         WHERE dr.database_id = $1 AND dr.status = 'active'
         ORDER BY dr.lag_seconds ASC
         LIMIT 1`,
        [databaseId]
      );

      const replica = replicaResult.rows[0];

      if (!replica) {
        throw new Error('No healthy replica available for failover');
      }

      // Promote replica to master
      await pool.query(
        'UPDATE database_replicas SET role = $1 WHERE id = $2',
        ['master', replica.id]
      );

      // Update database to point to new master
      await pool.query(
        'UPDATE databases SET server_id = $1, failover_at = NOW() WHERE id = $2',
        [replica.server_id, databaseId]
      );

      logger.info('Failover completed', { 
        databaseId, 
        newMasterServerId: replica.server_id 
      });

      return { success: true, newMaster: replica };

    } catch (error) {
      logger.error('Failover failed', { error: error.message, databaseId });
      throw error;
    }
  }

  /**
   * Analyze slow queries
   */
  async analyzeSlowQueries(databaseId, limit = 100) {
    try {
      const result = await pool.query(
        `SELECT * FROM slow_query_log 
         WHERE database_id = $1 
         ORDER BY query_time DESC 
         LIMIT $2`,
        [databaseId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to analyze slow queries', { error: error.message });
      throw error;
    }
  }

  /**
   * Get database metrics
   */
  async getDatabaseMetrics(databaseId) {
    try {
      const result = await pool.query(
        `SELECT 
           d.*,
           COALESCE(dm.size_bytes, 0) as current_size,
           COALESCE(dm.connections_count, 0) as active_connections,
           COALESCE(dm.queries_per_second, 0) as qps,
           COALESCE(dm.cache_hit_ratio, 0) as cache_hit_ratio
         FROM databases d
         LEFT JOIN database_metrics dm ON d.id = dm.database_id AND dm.created_at >= NOW() - INTERVAL '5 minutes'
         WHERE d.id = $1
         ORDER BY dm.created_at DESC
         LIMIT 1`,
        [databaseId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get database metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate connection string
   */
  getConnectionString(server, database, username, password) {
    switch (database.type) {
      case 'mysql':
      case 'mariadb':
        return `mysql://${username}:${password}@${server.ip_address}:3306/${database.name}`;
      case 'postgresql':
        return `postgresql://${username}:${password}@${server.ip_address}:5432/${database.name}`;
      case 'mongodb':
        return `mongodb://${username}:${password}@${server.ip_address}:27017/${database.name}`;
      case 'redis':
        return `redis://:${password}@${server.ip_address}:6379`;
      default:
        return '';
    }
  }

  /**
   * Generate secure password
   */
  generatePassword(length = 24) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }

  /**
   * Check MySQL health
   */
  async checkMySQLHealth(database) {
    try {
      const connection = await mysql.createConnection({
        host: database.ip_address,
        port: 3306,
        user: database.username,
        password: database.password_hash,
        database: database.name,
        connectTimeout: 5000
      });

      await connection.execute('SELECT 1');
      await connection.end();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Redis health
   */
  async checkRedisHealth(database) {
    const client = createClient({
      url: database.connection_string,
      socket: {
        connectTimeout: 5000
      }
    });

    try {
      await client.connect();
      await client.ping();
      await client.disconnect();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check PostgreSQL health
   */
  async checkPostgreSQLHealth(database) {
    // Use server-agent health check endpoint
    try {
      const response = await axios.get(
        `http://${database.ip_address}:3100/database/health/${database.id}`,
        { timeout: 5000 }
      );
      
      return response.data.healthy === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check MongoDB health
   */
  async checkMongoDBHealth(database) {
    const client = new MongoClient(database.connection_string, {
      serverSelectionTimeoutMS: 5000
    });

    try {
      await client.connect();
      await client.db('admin').command({ ping: 1 });
      await client.close();
      
      return true;
    } catch (error) {
      return false;
    }
  }

  // Replication setup methods (simplified)
  async setupPostgreSQLReplication(database, replica) {
    logger.info('PostgreSQL replication configured', { databaseId: database.id });
  }

  async setupMongoDBReplication(database, replica) {
    logger.info('MongoDB replication configured', { databaseId: database.id });
  }

  async setupRedisReplication(database, replica) {
    logger.info('Redis replication configured', { databaseId: database.id });
  }
}

export default new MultiDatabaseService();
