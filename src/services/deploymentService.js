import pool from '../db/index.js';
import logger from '../config/logger.js';
import crypto from 'crypto';

/**
 * Deployment Service - One-Click Deployments
 * Handles database, user, table, API, website, and form deployments
 */

class DeploymentService {
  /**
   * Create a new database deployment
   */
  async deployDatabase(userId, tenantId, config) {
    const { name, server_id, type, charset, collation } = config;

    try {
      // Create deployment record
      const deployment = await this.createDeployment(userId, tenantId, 'database', name, server_id, config);

      // Get server details
      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [server_id]);
      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }
      const server = serverResult.rows[0];

      // Generate random database username and password
      const dbUsername = `db_${crypto.randomBytes(4).toString('hex')}`;
      const dbPassword = crypto.randomBytes(16).toString('hex');
      const dbName = `${name}_${crypto.randomBytes(4).toString('hex')}`;

      // TODO: Replace with actual cPanel/Plesk API call
      const result = await this.createDatabaseOnServer(server, {
        dbName,
        dbUsername,
        dbPassword,
        type: type || 'mysql',
        charset: charset || 'utf8mb4',
        collation: collation || 'utf8mb4_unicode_ci'
      });

      // Update deployment with result
      await this.completeDeployment(deployment.id, {
        database_name: dbName,
        username: dbUsername,
        password: dbPassword,
        host: server.ip_address,
        port: type === 'postgresql' ? 5432 : 3306,
        connection_string: `${type}://${dbUsername}:${dbPassword}@${server.ip_address}:${type === 'postgresql' ? 5432 : 3306}/${dbName}`
      });

      return deployment;
    } catch (error) {
      logger.error('Database deployment error:', error);
      throw error;
    }
  }

  /**
   * Deploy a database user
   */
  async deployUser(userId, tenantId, config) {
    const { name, server_id, database_id, privileges } = config;

    try {
      const deployment = await this.createDeployment(userId, tenantId, 'user', name, server_id, config);

      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [server_id]);
      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }
      const server = serverResult.rows[0];

      const username = `usr_${crypto.randomBytes(4).toString('hex')}`;
      const password = crypto.randomBytes(16).toString('hex');

      // TODO: Replace with actual cPanel/Plesk API call
      const result = await this.createUserOnServer(server, {
        username,
        password,
        database_id,
        privileges: privileges || ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
      });

      await this.completeDeployment(deployment.id, {
        username,
        password,
        host: server.ip_address,
        privileges: privileges || ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
      });

      return deployment;
    } catch (error) {
      logger.error('User deployment error:', error);
      throw error;
    }
  }

  /**
   * Deploy a database table
   */
  async deployTable(userId, tenantId, config) {
    const { name, server_id, database_id, schema } = config;

    try {
      const deployment = await this.createDeployment(userId, tenantId, 'table', name, server_id, config);

      // TODO: Execute CREATE TABLE SQL on target database
      const result = await this.createTableInDatabase(database_id, name, schema);

      await this.completeDeployment(deployment.id, {
        table_name: name,
        database_id,
        columns: schema.columns || [],
        created: true
      });

      return deployment;
    } catch (error) {
      logger.error('Table deployment error:', error);
      throw error;
    }
  }

  /**
   * Deploy an API endpoint
   */
  async deployAPI(userId, tenantId, config) {
    const { name, server_id, method, path, handler_type, database_id } = config;

    try {
      const deployment = await this.createDeployment(userId, tenantId, 'api', name, server_id, config);

      // Generate API endpoint code based on handler type
      let code = '';
      let endpoint = `/api/${path}`;

      if (handler_type === 'crud') {
        code = this.generateCRUDAPI(database_id, name);
      } else if (handler_type === 'custom') {
        code = config.custom_code || '';
      }

      // TODO: Deploy to server (create route file, restart service)
      const result = await this.deployAPIToServer(server_id, {
        method: method || 'GET',
        path: endpoint,
        code
      });

      await this.completeDeployment(deployment.id, {
        endpoint,
        method: method || 'GET',
        url: `https://${config.domain || 'api.example.com'}${endpoint}`,
        deployed: true
      });

      return deployment;
    } catch (error) {
      logger.error('API deployment error:', error);
      throw error;
    }
  }

  /**
   * Deploy a website
   */
  async deployWebsite(userId, tenantId, config) {
    const { name, server_id, domain, template, framework } = config;

    try {
      const deployment = await this.createDeployment(userId, tenantId, 'website', name, server_id, config);

      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [server_id]);
      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }
      const server = serverResult.rows[0];

      const username = `web_${crypto.randomBytes(4).toString('hex')}`;
      const password = crypto.randomBytes(16).toString('hex');

      // TODO: Replace with actual provisioning service call
      const result = await this.createWebsiteOnServer(server, {
        domain,
        username,
        password,
        template,
        framework: framework || 'static'
      });

      await this.completeDeployment(deployment.id, {
        domain,
        username,
        password,
        control_panel_url: `${server.control_panel_url}`,
        ftp_host: server.ip_address,
        ftp_username: `${username}@${domain}`,
        document_root: `/home/${username}/public_html`
      });

      return deployment;
    } catch (error) {
      logger.error('Website deployment error:', error);
      throw error;
    }
  }

  /**
   * Deploy a form
   */
  async deployForm(userId, tenantId, config) {
    const { name, server_id, fields, action_type, database_id } = config;

    try {
      const deployment = await this.createDeployment(userId, tenantId, 'form', name, server_id, config);

      // Generate form HTML and backend handler
      const formHTML = this.generateFormHTML(name, fields);
      const formHandler = this.generateFormHandler(action_type, database_id, fields);

      // TODO: Deploy form files to server
      const result = await this.deployFormToServer(server_id, {
        name,
        html: formHTML,
        handler: formHandler
      });

      await this.completeDeployment(deployment.id, {
        form_url: `https://${config.domain || 'forms.example.com'}/${name}`,
        fields,
        action_type,
        deployed: true
      });

      return deployment;
    } catch (error) {
      logger.error('Form deployment error:', error);
      throw error;
    }
  }

  /**
   * Get all deployments
   */
  async getAllDeployments(filters = {}) {
    const { user_id, tenant_id, type, status, limit = 50, offset = 0 } = filters;

    let query = 'SELECT d.*, u.email as user_email FROM deployments d LEFT JOIN users u ON d.user_id = u.id WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (user_id) {
      query += ` AND d.user_id = $${paramCount}`;
      params.push(user_id);
      paramCount++;
    }

    if (tenant_id) {
      query += ` AND d.tenant_id = $${paramCount}`;
      params.push(tenant_id);
      paramCount++;
    }

    if (type) {
      query += ` AND d.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    if (status) {
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY d.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    try {
      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error getting deployments:', error);
      throw error;
    }
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(deploymentId) {
    try {
      const result = await pool.query(
        'SELECT d.*, u.email as user_email FROM deployments d LEFT JOIN users u ON d.user_id = u.id WHERE d.id = $1',
        [deploymentId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting deployment:', error);
      throw error;
    }
  }

  /**
   * Delete deployment
   */
  async deleteDeployment(deploymentId) {
    try {
      const deployment = await this.getDeploymentById(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // TODO: Clean up resources on server based on deployment type
      await this.cleanupDeployment(deployment);

      await pool.query('DELETE FROM deployments WHERE id = $1', [deploymentId]);
      logger.info(`Deployment deleted: ${deploymentId}`);
      return true;
    } catch (error) {
      logger.error('Error deleting deployment:', error);
      throw error;
    }
  }

  // ====== Helper Methods ======

  async createDeployment(userId, tenantId, type, name, serverId, config) {
    const result = await pool.query(
      `INSERT INTO deployments (user_id, tenant_id, type, name, server_id, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, tenantId, type, name, serverId, JSON.stringify(config), 'pending']
    );

    logger.info(`Deployment created: ${type} - ${name}`);
    return result.rows[0];
  }

  async completeDeployment(deploymentId, result) {
    await pool.query(
      `UPDATE deployments 
       SET status = $2, result = $3, completed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [deploymentId, 'completed', JSON.stringify(result)]
    );

    logger.info(`Deployment completed: ${deploymentId}`);
  }

  async failDeployment(deploymentId, error) {
    await pool.query(
      `UPDATE deployments 
       SET status = $2, error = $3, completed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [deploymentId, 'failed', error.message]
    );

    logger.error(`Deployment failed: ${deploymentId}`, error);
  }

  // Stub methods - Replace with actual API calls

  async createDatabaseOnServer(server, config) {
    logger.info(`[STUB] Creating database on ${server.hostname}:`, config);
    // TODO: Implement cPanel/Plesk API call
    return { success: true };
  }

  async createUserOnServer(server, config) {
    logger.info(`[STUB] Creating user on ${server.hostname}:`, config);
    // TODO: Implement cPanel/Plesk API call
    return { success: true };
  }

  async createTableInDatabase(databaseId, schema) {
    try {
      // Get database details
      const dbResult = await pool.query('SELECT * FROM databases WHERE id = $1', [databaseId]);
      const database = dbResult.rows[0];
      
      if (!database) {
        throw new Error(`Database ${databaseId} not found`);
      }

      // Get server for this database
      const serverResult = await pool.query('SELECT * FROM servers WHERE tenant_id = $1 LIMIT 1', [database.tenant_id]);
      const server = serverResult.rows[0];
      
      if (!server) {
        throw new Error('No server found for database');
      }

      // Generate CREATE TABLE SQL from schema
      const createTableSQL = this.generateCreateTableSQL(schema);
      
      // Execute on server via agent
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      await axios.post(`https://${server.hostname}:3100/api/databases/${database.name}/query`, {
        sql: createTableSQL
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Table ${schema.name} created in database ${database.name}`);
      return { success: true, tableName: schema.name };
    } catch (error) {
      logger.error('Failed to create table in database:', error.message);
      throw error;
    }
  }

  async deployAPIToServer(serverId, config) {
    try {
      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
      const server = serverResult.rows[0];
      
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }

      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      await axios.post(`https://${server.hostname}:3100/api/routes`, {
        method: config.method,
        path: config.path,
        code: config.code
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`API endpoint ${config.method} ${config.path} deployed to server ${server.hostname}`);
      return { success: true, url: `https://${server.hostname}${config.path}` };
    } catch (error) {
      logger.error('Failed to deploy API to server:', error.message);
      throw error;
    }
  }

  async createWebsiteOnServer(server, config) {
    try {
      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      await axios.post(`https://${server.hostname}:3100/api/websites`, {
        domain: config.domain,
        document_root: config.document_root || '/var/www/html',
        php_version: config.php_version || '8.2',
        ssl_enabled: config.ssl_enabled || true
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Website ${config.domain} created on ${server.hostname}`);
      return { success: true, domain: config.domain };
    } catch (error) {
      logger.error('Failed to create website on server:', error.message);
      throw error;
    }
  }

  async deployFormToServer(serverId, config) {
    try {
      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [serverId]);
      const server = serverResult.rows[0];
      
      if (!server) {
        throw new Error(`Server ${serverId} not found`);
      }

      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      await axios.post(`https://${server.hostname}:3100/api/forms`, {
        name: config.name,
        html: config.html,
        handler: config.handler
      }, {
        headers: {
          'Authorization': `Bearer ${server.api_key}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      });
      
      logger.info(`Form ${config.name} deployed to server ${server.hostname}`);
      return { success: true, formName: config.name };
    } catch (error) {
      logger.error('Failed to deploy form to server:', error.message);
      throw error;
    }
  }

  async cleanupDeployment(deployment) {
    try {
      const serverResult = await pool.query('SELECT * FROM servers WHERE id = $1', [deployment.server_id]);
      const server = serverResult.rows[0];
      
      if (!server) {
        logger.warn(`Server ${deployment.server_id} not found for cleanup`);
        return { success: true };
      }

      const axios = (await import('axios')).default;
      const https = (await import('https')).default;
      
      // Delete resource based on deployment type
      let endpoint = '';
      if (deployment.type === 'api') {
        endpoint = `/api/routes/${deployment.id}`;
      } else if (deployment.type === 'website') {
        endpoint = `/api/websites/${deployment.id}`;
      } else if (deployment.type === 'form') {
        endpoint = `/api/forms/${deployment.id}`;
      }
      
      if (endpoint) {
        await axios.delete(`https://${server.hostname}:3100${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${server.api_key}`
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: 30000
        });
      }
      
      logger.info(`Deployment ${deployment.id} cleaned up on server ${server.hostname}`);
      return { success: true };
    } catch (error) {
      logger.error('Failed to cleanup deployment:', error.message);
      // Don't throw - cleanup failures shouldn't block deletion
      return { success: false, error: error.message };
    }
  }

  generateCreateTableSQL(schema) {
    const { name, columns } = schema;
    
    const columnDefs = columns.map(col => {
      let def = `${col.name} ${col.type.toUpperCase()}`;
      if (col.primary_key) def += ' PRIMARY KEY';
      if (col.not_null) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    }).join(',\n  ');
    
    return `CREATE TABLE IF NOT EXISTS ${name} (\n  ${columnDefs}\n);`;
  }

  generateCRUDAPI(databaseId, tableName) {
    return `
// Auto-generated CRUD API for ${tableName}
import pool from '../db/index.js';

export default {
  async getAll(req, res) {
    const result = await pool.query('SELECT * FROM ${tableName}');
    res.json(result.rows);
  },
  
  async getById(req, res) {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM ${tableName} WHERE id = $1', [id]);
    res.json(result.rows[0]);
  },
  
  async create(req, res) {
    const data = req.body;
    // TODO: Dynamic insert
    res.json({ success: true });
  },
  
  async update(req, res) {
    const { id } = req.params;
    const data = req.body;
    // TODO: Dynamic update
    res.json({ success: true });
  },
  
  async delete(req, res) {
    const { id } = req.params;
    await pool.query('DELETE FROM ${tableName} WHERE id = $1', [id]);
    res.json({ success: true });
  }
};
    `;
  }

  generateFormHTML(name, fields) {
    let html = `<form id="${name}" method="POST" action="/api/forms/${name}">\n`;
    
    for (const field of fields) {
      html += `  <div class="form-group">\n`;
      html += `    <label for="${field.name}">${field.label}</label>\n`;
      html += `    <input type="${field.type}" name="${field.name}" id="${field.name}" ${field.required ? 'required' : ''}>\n`;
      html += `  </div>\n`;
    }
    
    html += `  <button type="submit">Submit</button>\n`;
    html += `</form>`;
    
    return html;
  }

  generateFormHandler(actionType, databaseId, _fields) {
    if (actionType === 'save_to_db') {
      return `
// Auto-generated form handler
import pool from '../db/index.js';

export async function handleSubmit(req, res) {
  try {
    const data = req.body;
    
    // Get database details
    const dbResult = await pool.query('SELECT * FROM databases WHERE id = $1', [${databaseId}]);
    const database = dbResult.rows[0];
    
    if (!database) {
      return res.status(404).json({ success: false, error: 'Database not found' });
    }
    
    // Prepare columns and values for INSERT
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map((_, i) => '$' + (i + 1)).join(', ');
    const values = Object.values(data);
    
    // Insert form submission into database table
    const query = 'INSERT INTO form_submissions (' + columns + ') VALUES (' + placeholders + ') RETURNING *';
    const result = await pool.query(query, values);
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
      `;
    } else if (actionType === 'send_email') {
      return `
// Auto-generated email form handler
import nodemailer from 'nodemailer';

export async function handleSubmit(req, res) {
  try {
    const data = req.body;
    
    // Configure SMTP transporter
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || process.env.SENDGRID_API_KEY
      }
    });
    
    // Format form data as HTML table
    const dataRows = Object.entries(data)
      .map(([key, value]) => '<tr><td><strong>' + key + '</strong></td><td>' + value + '</td></tr>')
      .join('\\n');
    
    // Send email with form data
    await transporter.sendMail({
      from: process.env.FORM_EMAIL_FROM || 'forms@migrahosting.com',
      to: process.env.FORM_EMAIL_TO || 'admin@migrahosting.com',
      subject: 'New Form Submission',
      html: '<h2>Form Submission</h2><table border="1">' + dataRows + '</table>'
    });
    
    res.json({ success: true, message: 'Form submitted and email sent' });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
      `;
    }
    
    return '';
  }
}

export default new DeploymentService();
