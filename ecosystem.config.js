/**
 * PM2 Ecosystem Configuration
 * 
 * Production process manager configuration for mPanel API server
 * 
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js
 *   pm2 reload ecosystem.config.js  (zero-downtime reload)
 *   pm2 stop ecosystem.config.js
 *   pm2 logs mpanel-api
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      // Application configuration
      name: 'mpanel-api',
      script: './src/server.js',
      
      // Execution mode
      instances: process.env.PM2_INSTANCES || 'max', // Use all CPU cores or set specific number
      exec_mode: 'cluster', // Cluster mode for load balancing
      
      // Node.js configuration
      node_args: '--max-old-space-size=2048', // 2GB max memory per instance
      interpreter: 'node',
      interpreter_args: '--no-warnings',
      
      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 2271,
        API_VERSION: 'v1'
      },
      
      env_production: {
        NODE_ENV: 'production',
        PORT: 2271,
        API_VERSION: 'v1'
      },
      
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 2271,
        API_VERSION: 'v1'
      },
      
      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10, // Max restarts within restart_delay window
      min_uptime: '10s', // Min uptime before considering app stable
      max_memory_restart: '1G', // Restart if memory exceeds 1GB
      
      // Restart delay with exponential backoff
      restart_delay: 4000, // 4 seconds between restarts
      exp_backoff_restart_delay: 100, // Exponential backoff starting at 100ms
      
      // Graceful shutdown
      kill_timeout: 30000, // 30s timeout for graceful shutdown (matches our gracefulShutdown.js)
      wait_ready: true, // Wait for app to send 'ready' signal
      listen_timeout: 10000, // Wait 10s for app to start listening
      
      // Watch & reload (development only)
      watch: false, // Set to true for development, false for production
      ignore_watch: [
        'node_modules',
        'logs',
        'prisma/migrations',
        '.git',
        '*.log',
        'frontend'
      ],
      
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true, // Prefix logs with timestamp
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true, // Merge logs from all instances
      
      // Log rotation (prevent log files from growing indefinitely)
      log_type: 'json', // JSON formatted logs for easier parsing
      
      // Process management
      pid_file: './pids/mpanel-api.pid',
      cron_restart: '0 3 * * *', // Restart daily at 3 AM (optional, only if needed)
      
      // Health monitoring
      vizion: true, // Enable versioning metadata
      automation: false, // Disable keymetrics automation
      
      // Startup hooks
      post_update: ['npm install'], // Run after pulling new code
      
      // Advanced options
      source_map_support: true, // Enable source map support for debugging
      instance_var: 'INSTANCE_ID', // Environment variable with instance ID
      
      // Windows-specific (if deploying on Windows)
      windowsHide: true,
      
      // Shutdown hooks (execute before shutdown)
      shutdown_with_message: true
    },
    
    // Optional: SSL Certificate Renewal Worker
    {
      name: 'mpanel-ssl-worker',
      script: './src/services/sslWorker.js',
      instances: 1, // Only one instance needed
      exec_mode: 'fork', // Fork mode (not cluster)
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 10000,
      error_file: './logs/ssl-worker-error.log',
      out_file: './logs/ssl-worker-out.log',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: ['server1.example.com', 'server2.example.com'],
      ref: 'origin/main',
      repo: 'git@github.com:migrahosting-alt/mpanel.git',
      path: '/var/www/mpanel',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': "echo 'Deploying to production...'",
      ssh_options: 'StrictHostKeyChecking=no'
    },
    
    staging: {
      user: 'deploy',
      host: 'staging.example.com',
      ref: 'origin/develop',
      repo: 'git@github.com:migrahosting-alt/mpanel.git',
      path: '/var/www/mpanel-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      ssh_options: 'StrictHostKeyChecking=no'
    }
  }
};
