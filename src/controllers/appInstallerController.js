// src/controllers/appInstallerController.js
/**
 * Application Installer Controller
 * Handles one-click application installations (WordPress, Laravel, Node.js, etc.)
 */

import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Application templates
const APP_TEMPLATES = {
  wordpress: {
    name: 'WordPress',
    description: 'Popular CMS for blogs and websites',
    version: '6.4',
    category: 'cms',
    requirements: { php: '7.4', mysql: '5.7' },
    icon: 'wordpress',
  },
  laravel: {
    name: 'Laravel',
    description: 'PHP framework for web applications',
    version: '10.x',
    category: 'framework',
    requirements: { php: '8.1', composer: true },
    icon: 'laravel',
  },
  nodejs: {
    name: 'Node.js App',
    description: 'Node.js application template',
    version: '18.x',
    category: 'framework',
    requirements: { node: '18.0', npm: true },
    icon: 'nodejs',
  },
  nextjs: {
    name: 'Next.js',
    description: 'React framework for production',
    version: '14.x',
    category: 'framework',
    requirements: { node: '18.0', npm: true },
    icon: 'nextjs',
  },
  django: {
    name: 'Django',
    description: 'Python web framework',
    version: '4.x',
    category: 'framework',
    requirements: { python: '3.9', pip: true },
    icon: 'django',
  },
  moodle: {
    name: 'Moodle',
    description: 'Learning management system',
    version: '4.1',
    category: 'lms',
    requirements: { php: '7.4', mysql: '5.7' },
    icon: 'moodle',
  },
  ghost: {
    name: 'Ghost',
    description: 'Professional publishing platform',
    version: '5.x',
    category: 'cms',
    requirements: { node: '18.0', npm: true },
    icon: 'ghost',
  },
  drupal: {
    name: 'Drupal',
    description: 'Enterprise CMS platform',
    version: '10.x',
    category: 'cms',
    requirements: { php: '8.1', mysql: '5.7' },
    icon: 'drupal',
  },
};

/**
 * Get available application templates
 */
export const getTemplates = async (req, res) => {
  try {
    const { category } = req.query;

    let templates = Object.entries(APP_TEMPLATES).map(([key, template]) => ({
      id: key,
      ...template,
    }));

    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    res.json({ templates });
  } catch (error) {
    logger.error('Error fetching app templates:', error);
    res.status(500).json({ error: 'Failed to fetch app templates' });
  }
};

/**
 * Get installed applications
 */
export const getInstalled = async (req, res) => {
  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let query = `SELECT * FROM installed_apps`;
    const params = [];

    if (!isAdmin) {
      query += ` WHERE user_id = $1`;
      params.push(userId);
    }

    query += ` ORDER BY created_at DESC`;

    const result = await pool.query(query, params);
    res.json({ apps: result.rows });
  } catch (error) {
    logger.error('Error fetching installed apps:', error);
    res.status(500).json({ error: 'Failed to fetch installed apps' });
  }
};

/**
 * Get single installation
 */
/**
 * Get single installation details
 */
export const getInstallation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const query = isAdmin
      ? `SELECT * FROM installed_apps WHERE id = $1`
      : `SELECT * FROM installed_apps WHERE id = $1 AND user_id = $2`;
    
    const params = isAdmin ? [id] : [id, userId];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Error fetching installation:', error);
    res.status(500).json({ error: 'Failed to fetch installation' });
  }
};

/**
 * Install application
 */
export const install = async (req, res) => {
  try {
    const userId = req.user.id;
    const { app_id, domain, config } = req.body;

    if (!app_id || !domain) {
      return res.status(400).json({ error: 'app_id and domain are required' });
    }

    const template = APP_TEMPLATES[app_id];
    if (!template) {
      return res.status(400).json({ error: 'Invalid application template' });
    }

    // Verify domain ownership
    const domainCheck = await pool.query(
      `SELECT * FROM websites WHERE domain = $1 AND user_id = $2`,
      [domain, userId]
    );

    if (domainCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Domain not found or access denied' });
    }

    const website = domainCheck.rows[0];

    // Create installation record
    const result = await pool.query(
      `INSERT INTO installed_apps 
       (user_id, website_id, app_type, app_name, version, domain, config, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        website.id,
        app_id,
        template.name,
        template.version,
        domain,
        JSON.stringify(config || {}),
        'installing',
      ]
    );

    const installation = result.rows[0];

    // Start installation process asynchronously
    performInstallation(installation.id, app_id, website, config)
      .catch(error => logger.error(`Installation ${installation.id} failed:`, error));

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'app_installed', `Installing ${template.name} on ${domain}`]
    );

    logger.info(`Application installation initiated: ${template.name} on ${domain}`);
    res.status(201).json(installation);
  } catch (error) {
    logger.error('Error starting installation:', error);
    res.status(500).json({ error: 'Failed to start installation' });
  }
};

/**
 * Perform actual installation
 */
async function performInstallation(installationId, appId, website, config) {
  try {
    await pool.query(
      `UPDATE installed_apps SET status = $1 WHERE id = $2`,
      ['installing', installationId]
    );

    const installPath = website.path || `/var/www/${website.domain}`;
    
    // Install based on app type
    switch (appId) {
      case 'wordpress':
        await installWordPress(installPath, config);
        break;
      case 'laravel':
        await installLaravel(installPath, config);
        break;
      case 'nodejs':
        await installNodeJS(installPath, config);
        break;
      case 'nextjs':
        await installNextJS(installPath, config);
        break;
      case 'django':
        await installDjango(installPath, config);
        break;
      case 'moodle':
        await installMoodle(installPath, config);
        break;
      case 'ghost':
        await installGhost(installPath, config);
        break;
      case 'drupal':
        await installDrupal(installPath, config);
        break;
      default:
        throw new Error(`Unknown app type: ${appId}`);
    }

    // Update status to installed
    await pool.query(
      `UPDATE installed_apps 
       SET status = $1, installed_at = NOW() 
       WHERE id = $2`,
      ['installed', installationId]
    );

    logger.info(`Installation ${installationId} completed successfully`);
  } catch (error) {
    logger.error(`Installation ${installationId} failed:`, error);
    await pool.query(
      `UPDATE installed_apps SET status = $1, error = $2 WHERE id = $3`,
      ['failed', error.message, installationId]
    );
  }
}

/**
 * Install WordPress
 */
async function installWordPress(installPath, config) {
  // Create directory
  await fs.mkdir(installPath, { recursive: true });

  // Download WordPress
  await execAsync(`wget https://wordpress.org/latest.tar.gz -O /tmp/wordpress.tar.gz`);
  await execAsync(`tar -xzf /tmp/wordpress.tar.gz -C ${installPath} --strip-components=1`);
  await execAsync(`rm /tmp/wordpress.tar.gz`);

  // Create wp-config.php
  const wpConfig = `<?php
define('DB_NAME', '${config.db_name || 'wordpress'}');
define('DB_USER', '${config.db_user || 'wordpress'}');
define('DB_PASSWORD', '${config.db_password || 'password'}');
define('DB_HOST', '${config.db_host || 'localhost'}');
define('DB_CHARSET', 'utf8mb4');
define('DB_COLLATE', '');

define('AUTH_KEY',         '${generateSalt()}');
define('SECURE_AUTH_KEY',  '${generateSalt()}');
define('LOGGED_IN_KEY',    '${generateSalt()}');
define('NONCE_KEY',        '${generateSalt()}');
define('AUTH_SALT',        '${generateSalt()}');
define('SECURE_AUTH_SALT', '${generateSalt()}');
define('LOGGED_IN_SALT',   '${generateSalt()}');
define('NONCE_SALT',       '${generateSalt()}');

$table_prefix = 'wp_';
define('WP_DEBUG', false);

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}

require_once ABSPATH . 'wp-settings.php';
?>`;

  await fs.writeFile(path.join(installPath, 'wp-config.php'), wpConfig);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
  await execAsync(`chmod -R 755 ${installPath}`);
}

/**
 * Install Laravel
 */
async function installLaravel(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });
  
  // Install via Composer
  await execAsync(`composer create-project laravel/laravel ${installPath}`);

  // Create .env file
  const envContent = `APP_NAME="${config.app_name || 'Laravel'}"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=${config.app_url || 'http://localhost'}

DB_CONNECTION=mysql
DB_HOST=${config.db_host || 'localhost'}
DB_PORT=3306
DB_DATABASE=${config.db_name || 'laravel'}
DB_USERNAME=${config.db_user || 'laravel'}
DB_PASSWORD=${config.db_password || 'password'}
`;

  await fs.writeFile(path.join(installPath, '.env'), envContent);

  // Generate app key
  await execAsync(`cd ${installPath} && php artisan key:generate`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
  await execAsync(`chmod -R 755 ${installPath}/storage ${installPath}/bootstrap/cache`);
}

/**
 * Install Node.js app
 */
async function installNodeJS(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });

  // Create package.json
  const packageJson = {
    name: config.app_name || 'nodejs-app',
    version: '1.0.0',
    description: 'Node.js application',
    main: 'index.js',
    scripts: {
      start: 'node index.js',
    },
    dependencies: {
      express: '^4.18.0',
    },
  };

  await fs.writeFile(
    path.join(installPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Create basic index.js
  const indexJs = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`);
});
`;

  await fs.writeFile(path.join(installPath, 'index.js'), indexJs);

  // Install dependencies
  await execAsync(`cd ${installPath} && npm install`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
}

/**
 * Install Next.js
 */
async function installNextJS(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });
  
  // Create Next.js app
  await execAsync(`npx create-next-app@latest ${installPath} --typescript --tailwind --app --no-git --use-npm`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
}

/**
 * Install Django
 */
async function installDjango(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });

  // Create virtual environment
  await execAsync(`python3 -m venv ${installPath}/venv`);

  // Install Django
  await execAsync(`${installPath}/venv/bin/pip install django`);

  // Create project
  const projectName = config.project_name || 'myproject';
  await execAsync(`${installPath}/venv/bin/django-admin startproject ${projectName} ${installPath}`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
}

/**
 * Install Moodle
 */
async function installMoodle(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });

  // Download Moodle
  await execAsync(`git clone -b MOODLE_41_STABLE git://git.moodle.org/moodle.git ${installPath}`);

  // Create data directory
  await fs.mkdir(`${installPath}data`, { recursive: true });

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
  await execAsync(`chmod -R 0755 ${installPath}`);
}

/**
 * Install Ghost
 */
async function installGhost(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });

  // Install Ghost CLI
  await execAsync(`npm install -g ghost-cli`);

  // Install Ghost
  await execAsync(`cd ${installPath} && ghost install local --no-setup`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
}

/**
 * Install Drupal
 */
async function installDrupal(installPath, config) {
  await fs.mkdir(installPath, { recursive: true });

  // Install via Composer
  await execAsync(`composer create-project drupal/recommended-project ${installPath}`);

  // Set permissions
  await execAsync(`chown -R www-data:www-data ${installPath}`);
  await execAsync(`chmod -R 755 ${installPath}/web/sites/default/files`);
}

/**
 * Uninstall application
 */
export const uninstall = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const installation = await pool.query(
      `SELECT * FROM installed_apps WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (installation.rows.length === 0) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    const app = installation.rows[0];

    // Get website info
    const website = await pool.query(
      `SELECT * FROM websites WHERE id = $1`,
      [app.website_id]
    );

    if (website.rows.length > 0) {
      const installPath = website.rows[0].path || `/var/www/${website.rows[0].domain}`;
      
      // Backup before removal
      const backupPath = `${installPath}_backup_${Date.now()}`;
      await execAsync(`mv ${installPath} ${backupPath}`);
    }

    // Delete installation record
    await pool.query(`DELETE FROM installed_apps WHERE id = $1`, [id]);

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'app_uninstalled', `Uninstalled ${app.app_name} from ${app.domain}`]
    );

    logger.info(`Application uninstalled: ${app.app_name}`);
    res.json({ message: 'Application uninstalled successfully' });
  } catch (error) {
    logger.error('Error uninstalling app:', error);
    res.status(500).json({ error: 'Failed to uninstall application' });
  }
};

/**
 * Update application
 */
export const update = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { version } = req.body;

    const installation = await pool.query(
      `SELECT * FROM installed_apps WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (installation.rows.length === 0) {
      return res.status(404).json({ error: 'Installation not found' });
    }

    // Update version
    await pool.query(
      `UPDATE installed_apps SET version = $1, updated_at = NOW() WHERE id = $2`,
      [version, id]
    );

    // Log activity
    await pool.query(
      `INSERT INTO activity_logs (user_id, type, description) VALUES ($1, $2, $3)`,
      [userId, 'app_updated', `Updated ${installation.rows[0].app_name} to version ${version}`]
    );

    res.json({ message: 'Application updated successfully' });
  } catch (error) {
    logger.error('Error updating app:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
};

/**
 * Generate random salt for WordPress
 */
function generateSalt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  let salt = '';
  for (let i = 0; i < 64; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}
