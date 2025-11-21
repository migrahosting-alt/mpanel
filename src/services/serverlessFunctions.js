/**
 * Serverless Functions Platform Service
 * FaaS platform within mPanel - deploy and execute functions
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import Docker from 'dockerode';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const docker = new Docker();

class ServerlessFunctionsService {
  constructor() {
    this.runtimeImages = {
      'nodejs18': 'node:18-alpine',
      'nodejs20': 'node:20-alpine',
      'python39': 'python:3.9-alpine',
      'python311': 'python:3.11-alpine',
      'go121': 'golang:1.21-alpine'
    };
    
    this.functionsDir = process.env.FUNCTIONS_DIR || '/var/mpanel/functions';
  }

  /**
   * Create a new serverless function
   */
  async createFunction(userId, tenantId, data) {
    const { name, runtime, code, handler, environment = {}, memory = 256, timeout = 30 } = data;

    try {
      // Validate runtime
      if (!this.runtimeImages[runtime]) {
        throw new Error(`Unsupported runtime: ${runtime}`);
      }

      // Create function record
      const result = await pool.query(
        `INSERT INTO serverless_functions 
         (user_id, tenant_id, name, runtime, handler, code, environment, memory_mb, timeout_seconds, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
         RETURNING *`,
        [userId, tenantId, name, runtime, handler, code, JSON.stringify(environment), memory, timeout]
      );

      const func = result.rows[0];

      // Create function directory
      const functionDir = path.join(this.functionsDir, func.id);
      await fs.mkdir(functionDir, { recursive: true });

      // Write function code to file
      const codeFile = this.getCodeFileName(runtime);
      await fs.writeFile(path.join(functionDir, codeFile), code);

      // Create package.json for Node.js functions
      if (runtime.startsWith('nodejs')) {
        const packageJson = {
          name: `function-${func.id}`,
          version: '1.0.0',
          main: handler || 'index.js',
          dependencies: {}
        };
        await fs.writeFile(
          path.join(functionDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );
      }

      logger.info('Serverless function created', { functionId: func.id, name, runtime });

      return func;
    } catch (error) {
      logger.error('Failed to create serverless function', { error: error.message, name });
      throw error;
    }
  }

  /**
   * Update function code or configuration
   */
  async updateFunction(functionId, userId, updates) {
    try {
      const { code, environment, memory, timeout, status } = updates;

      let updateFields = [];
      let params = [];
      let paramIndex = 1;

      if (code !== undefined) {
        updateFields.push(`code = $${paramIndex++}`);
        params.push(code);
      }

      if (environment !== undefined) {
        updateFields.push(`environment = $${paramIndex++}`);
        params.push(JSON.stringify(environment));
      }

      if (memory !== undefined) {
        updateFields.push(`memory_mb = $${paramIndex++}`);
        params.push(memory);
      }

      if (timeout !== undefined) {
        updateFields.push(`timeout_seconds = $${paramIndex++}`);
        params.push(timeout);
      }

      if (status !== undefined) {
        updateFields.push(`status = $${paramIndex++}`);
        params.push(status);
      }

      updateFields.push(`updated_at = NOW()`);

      params.push(functionId, userId);

      const result = await pool.query(
        `UPDATE serverless_functions 
         SET ${updateFields.join(', ')}
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING *`,
        params
      );

      const func = result.rows[0];

      if (!func) {
        throw new Error('Function not found or unauthorized');
      }

      // Update code file if code was changed
      if (code !== undefined) {
        const functionDir = path.join(this.functionsDir, func.id);
        const codeFile = this.getCodeFileName(func.runtime);
        await fs.writeFile(path.join(functionDir, codeFile), code);
      }

      logger.info('Function updated', { functionId, updates: Object.keys(updates) });

      return func;
    } catch (error) {
      logger.error('Failed to update function', { error: error.message, functionId });
      throw error;
    }
  }

  /**
   * Invoke a serverless function
   */
  async invokeFunction(functionId, payload = {}, userId = null) {
    const startTime = Date.now();

    try {
      // Get function details
      const funcResult = await pool.query(
        'SELECT * FROM serverless_functions WHERE id = $1',
        [functionId]
      );

      const func = funcResult.rows[0];

      if (!func) {
        throw new Error('Function not found');
      }

      if (func.status !== 'active') {
        throw new Error(`Function is ${func.status}`);
      }

      // Generate invocation ID
      const invocationId = crypto.randomUUID();

      // Create invocation record
      await pool.query(
        `INSERT INTO function_invocations 
         (id, function_id, user_id, status, payload)
         VALUES ($1, $2, $3, 'running', $4)`,
        [invocationId, functionId, userId, JSON.stringify(payload)]
      );

      // Execute function in isolated container
      const result = await this.executeInContainer(func, payload, invocationId);

      const duration = Date.now() - startTime;

      // Update invocation record with results
      await pool.query(
        `UPDATE function_invocations 
         SET status = $1, result = $2, duration_ms = $3, memory_used_mb = $4, 
             logs = $5, error = $6, completed_at = NOW()
         WHERE id = $7`,
        [
          result.error ? 'failed' : 'success',
          result.output ? JSON.stringify(result.output) : null,
          duration,
          result.memoryUsed || 0,
          result.logs || '',
          result.error || null,
          invocationId
        ]
      );

      // Update function metrics
      await pool.query(
        `UPDATE serverless_functions 
         SET invocations_count = invocations_count + 1,
             last_invocation_at = NOW(),
             total_duration_ms = total_duration_ms + $1
         WHERE id = $2`,
        [duration, functionId]
      );

      logger.info('Function invoked', { functionId, invocationId, duration, status: result.error ? 'failed' : 'success' });

      return {
        invocationId,
        status: result.error ? 'failed' : 'success',
        output: result.output,
        error: result.error,
        duration,
        logs: result.logs,
        memoryUsed: result.memoryUsed
      };

    } catch (error) {
      logger.error('Function invocation failed', { error: error.message, functionId });

      const duration = Date.now() - startTime;

      return {
        invocationId: null,
        status: 'failed',
        error: error.message,
        duration,
        output: null,
        logs: '',
        memoryUsed: 0
      };
    }
  }

  /**
   * Execute function in Docker container
   */
  async executeInContainer(func, payload, invocationId) {
    const containerName = `mpanel-function-${invocationId}`;
    const functionDir = path.join(this.functionsDir, func.id);

    try {
      const image = this.runtimeImages[func.runtime];

      // Prepare environment variables
      const env = Object.keys(func.environment || {}).map(key => `${key}=${func.environment[key]}`);
      env.push(`FUNCTION_PAYLOAD=${JSON.stringify(payload)}`);
      env.push(`FUNCTION_HANDLER=${func.handler}`);

      // Create container
      const container = await docker.createContainer({
        Image: image,
        name: containerName,
        Cmd: this.getContainerCmd(func.runtime, func.handler),
        Env: env,
        HostConfig: {
          Memory: func.memory_mb * 1024 * 1024,
          MemorySwap: func.memory_mb * 1024 * 1024,
          NetworkMode: 'none', // Isolated network
          AutoRemove: true,
          Binds: [`${functionDir}:/function:ro`]
        },
        WorkingDir: '/function',
        AttachStdout: true,
        AttachStderr: true
      });

      // Start container
      await container.start();

      // Collect logs
      let logs = '';
      const logStream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true
      });

      logStream.on('data', (chunk) => {
        logs += chunk.toString();
      });

      // Wait for container to finish (with timeout)
      const timeoutMs = func.timeout_seconds * 1000;
      const waitPromise = container.wait();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Function execution timeout')), timeoutMs)
      );

      await Promise.race([waitPromise, timeoutPromise]);

      // Get container stats for memory usage
      const stats = await container.stats({ stream: false });
      const memoryUsed = Math.round(stats.memory_stats.usage / 1024 / 1024);

      // Parse output from logs (last line should be JSON result)
      const logLines = logs.trim().split('\n');
      let output = null;
      let error = null;

      try {
        const lastLine = logLines[logLines.length - 1];
        output = JSON.parse(lastLine);
      } catch (e) {
        error = 'Failed to parse function output';
      }

      return {
        output,
        error,
        logs,
        memoryUsed
      };

    } catch (error) {
      return {
        output: null,
        error: error.message,
        logs: '',
        memoryUsed: 0
      };
    }
  }

  /**
   * Delete a serverless function
   */
  async deleteFunction(functionId, userId) {
    try {
      // Delete function record
      const result = await pool.query(
        'DELETE FROM serverless_functions WHERE id = $1 AND user_id = $2 RETURNING *',
        [functionId, userId]
      );

      const func = result.rows[0];

      if (!func) {
        throw new Error('Function not found or unauthorized');
      }

      // Delete function directory
      const functionDir = path.join(this.functionsDir, func.id);
      await fs.rm(functionDir, { recursive: true, force: true });

      logger.info('Function deleted', { functionId });

      return true;
    } catch (error) {
      logger.error('Failed to delete function', { error: error.message, functionId });
      throw error;
    }
  }

  /**
   * Get function metrics
   */
  async getFunctionMetrics(functionId) {
    try {
      const result = await pool.query(
        `SELECT 
           invocations_count,
           last_invocation_at,
           total_duration_ms,
           (SELECT COUNT(*) FROM function_invocations WHERE function_id = $1 AND status = 'failed') as error_count,
           (SELECT COUNT(*) FROM function_invocations WHERE function_id = $1 AND cold_start = true) as cold_start_count,
           (SELECT AVG(duration_ms) FROM function_invocations WHERE function_id = $1) as avg_duration
         FROM serverless_functions
         WHERE id = $1`,
        [functionId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get function metrics', { error: error.message, functionId });
      throw error;
    }
  }

  /**
   * List function invocations
   */
  async getInvocations(functionId, limit = 50) {
    try {
      const result = await pool.query(
        `SELECT * FROM function_invocations 
         WHERE function_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [functionId, limit]
      );

      return result.rows;
    } catch (error) {
      logger.error('Failed to get function invocations', { error: error.message, functionId });
      throw error;
    }
  }

  /**
   * Create scheduled function trigger (cron)
   */
  async createSchedule(functionId, userId, schedule, payload = {}) {
    try {
      const result = await pool.query(
        `INSERT INTO function_schedules (function_id, user_id, schedule, payload, enabled)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [functionId, userId, schedule, JSON.stringify(payload)]
      );

      logger.info('Function schedule created', { functionId, schedule });

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create function schedule', { error: error.message, functionId });
      throw error;
    }
  }

  // Helper methods

  getCodeFileName(runtime) {
    if (runtime.startsWith('nodejs')) return 'index.js';
    if (runtime.startsWith('python')) return 'main.py';
    if (runtime.startsWith('go')) return 'main.go';
    return 'index.js';
  }

  getContainerCmd(runtime, handler) {
    if (runtime.startsWith('nodejs')) {
      return ['node', '-e', `
        const fn = require('./${handler || 'index.js'}');
        const payload = JSON.parse(process.env.FUNCTION_PAYLOAD || '{}');
        Promise.resolve(fn.handler ? fn.handler(payload) : fn(payload))
          .then(result => console.log(JSON.stringify(result)))
          .catch(err => { console.error(err); process.exit(1); });
      `];
    }
    
    if (runtime.startsWith('python')) {
      return ['python', '-c', `
import json
import os
import importlib.util

spec = importlib.util.spec_from_file_location("handler", "${handler || 'main.py'}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

payload = json.loads(os.environ.get('FUNCTION_PAYLOAD', '{}'))
result = module.handler(payload)
print(json.dumps(result))
      `];
    }

    return ['sh', '-c', 'echo "Runtime not implemented"'];
  }
}

export default new ServerlessFunctionsService();
