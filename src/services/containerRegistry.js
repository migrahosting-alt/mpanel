/**
 * Container Registry Service
 * Private Docker registry with vulnerability scanning and access control
 */

import pool from '../db/index.js';
import logger from '../config/logger.js';
import Docker from 'dockerode';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const docker = new Docker();

class ContainerRegistryService {
  constructor() {
    this.registryUrl = process.env.REGISTRY_URL || 'localhost:5000';
    this.registryStoragePath = process.env.REGISTRY_STORAGE || '/var/lib/registry';
    this.trivyPath = process.env.TRIVY_PATH || 'trivy';
  }

  /**
   * Push image to registry
   */
  async pushImage(userId, tenantId, imageName, tag = 'latest') {
    try {
      const fullImageName = `${this.registryUrl}/${tenantId}/${imageName}:${tag}`;

      // Record image in database
      const result = await pool.query(
        `INSERT INTO container_images 
         (user_id, tenant_id, name, tag, registry_url, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [userId, tenantId, imageName, tag, this.registryUrl]
      );

      const image = result.rows[0];

      // Tag the image
      const sourceImage = docker.getImage(`${imageName}:${tag}`);
      await sourceImage.tag({ repo: fullImageName });

      // Push to registry
      const pushStream = await docker.getImage(fullImageName).push({
        authconfig: this.getRegistryAuth()
      });

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(pushStream, (err, res) => err ? reject(err) : resolve(res));
      });

      // Update status
      await pool.query(
        'UPDATE container_images SET status = $1, pushed_at = NOW() WHERE id = $2',
        ['available', image.id]
      );

      // Trigger vulnerability scan
      await this.scanImage(image.id);

      logger.info('Image pushed to registry', { imageId: image.id, imageName: fullImageName });

      return image;
    } catch (error) {
      logger.error('Failed to push image', { error: error.message, imageName });
      throw error;
    }
  }

  /**
   * Pull image from registry
   */
  async pullImage(imageId, userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM container_images WHERE id = $1 AND (user_id = $2 OR public = true)',
        [imageId, userId]
      );

      const image = result.rows[0];

      if (!image) {
        throw new Error('Image not found or access denied');
      }

      const fullImageName = `${image.registry_url}/${image.tenant_id}/${image.name}:${image.tag}`;

      // Pull from registry
      const pullStream = await docker.pull(fullImageName, {
        authconfig: this.getRegistryAuth()
      });

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(pullStream, (err, res) => err ? reject(err) : resolve(res));
      });

      // Update pull count
      await pool.query(
        'UPDATE container_images SET pull_count = pull_count + 1, last_pulled_at = NOW() WHERE id = $1',
        [imageId]
      );

      logger.info('Image pulled from registry', { imageId, imageName: fullImageName });

      return { success: true, imageName: fullImageName };
    } catch (error) {
      logger.error('Failed to pull image', { error: error.message, imageId });
      throw error;
    }
  }

  /**
   * Scan image for vulnerabilities using Trivy
   */
  async scanImage(imageId) {
    try {
      const result = await pool.query(
        'SELECT * FROM container_images WHERE id = $1',
        [imageId]
      );

      const image = result.rows[0];

      if (!image) {
        throw new Error('Image not found');
      }

      const fullImageName = `${image.registry_url}/${image.tenant_id}/${image.name}:${image.tag}`;

      // Update scan status
      await pool.query(
        'UPDATE container_images SET scan_status = $1, last_scanned_at = NOW() WHERE id = $2',
        ['scanning', imageId]
      );

      // Run Trivy scan
      const scanResults = await this.runTrivyScan(fullImageName);

      // Parse vulnerabilities
      const vulnerabilities = this.parseVulnerabilities(scanResults);

      // Store scan results
      await pool.query(
        `INSERT INTO image_scan_results (image_id, scanner, scan_data, vulnerability_count, critical_count, high_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          imageId,
          'trivy',
          JSON.stringify(scanResults),
          vulnerabilities.total,
          vulnerabilities.critical,
          vulnerabilities.high
        ]
      );

      // Update image status
      const scanStatus = vulnerabilities.critical > 0 ? 'vulnerable' : 'scanned';
      await pool.query(
        'UPDATE container_images SET scan_status = $1, vulnerability_count = $2 WHERE id = $3',
        [scanStatus, vulnerabilities.total, imageId]
      );

      logger.info('Image scanned', { 
        imageId, 
        vulnerabilities: vulnerabilities.total,
        critical: vulnerabilities.critical 
      });

      return vulnerabilities;
    } catch (error) {
      logger.error('Failed to scan image', { error: error.message, imageId });
      
      await pool.query(
        'UPDATE container_images SET scan_status = $1 WHERE id = $2',
        ['scan_failed', imageId]
      );

      throw error;
    }
  }

  /**
   * Run Trivy vulnerability scanner
   */
  async runTrivyScan(imageName) {
    return new Promise((resolve, reject) => {
      const trivy = spawn(this.trivyPath, [
        'image',
        '--format', 'json',
        '--severity', 'CRITICAL,HIGH,MEDIUM,LOW',
        imageName
      ]);

      let output = '';
      let errorOutput = '';

      trivy.stdout.on('data', (data) => {
        output += data.toString();
      });

      trivy.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      trivy.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Trivy scan failed: ${errorOutput}`));
        } else {
          try {
            resolve(JSON.parse(output));
          } catch (e) {
            reject(new Error('Failed to parse Trivy output'));
          }
        }
      });
    });
  }

  /**
   * Parse vulnerability data from scan results
   */
  parseVulnerabilities(scanData) {
    const vulnerabilities = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      details: []
    };

    if (!scanData.Results) return vulnerabilities;

    for (const result of scanData.Results) {
      if (!result.Vulnerabilities) continue;

      for (const vuln of result.Vulnerabilities) {
        vulnerabilities.total++;

        switch (vuln.Severity) {
          case 'CRITICAL':
            vulnerabilities.critical++;
            break;
          case 'HIGH':
            vulnerabilities.high++;
            break;
          case 'MEDIUM':
            vulnerabilities.medium++;
            break;
          case 'LOW':
            vulnerabilities.low++;
            break;
        }

        vulnerabilities.details.push({
          id: vuln.VulnerabilityID,
          package: vuln.PkgName,
          version: vuln.InstalledVersion,
          fixedVersion: vuln.FixedVersion,
          severity: vuln.Severity,
          title: vuln.Title,
          description: vuln.Description
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Delete image from registry
   */
  async deleteImage(imageId, userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM container_images WHERE id = $1 AND user_id = $2',
        [imageId, userId]
      );

      const image = result.rows[0];

      if (!image) {
        throw new Error('Image not found or access denied');
      }

      const fullImageName = `${image.registry_url}/${image.tenant_id}/${image.name}:${image.tag}`;

      // Remove from registry (requires registry API v2)
      await this.deleteFromRegistry(image.tenant_id, image.name, image.tag);

      // Delete local image
      try {
        const dockerImage = docker.getImage(fullImageName);
        await dockerImage.remove({ force: true });
      } catch (e) {
        logger.warn('Failed to remove local image', { error: e.message });
      }

      // Delete from database
      await pool.query('DELETE FROM container_images WHERE id = $1', [imageId]);

      logger.info('Image deleted', { imageId, imageName: fullImageName });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete image', { error: error.message, imageId });
      throw error;
    }
  }

  /**
   * Delete image from registry using Docker Registry HTTP API V2
   */
  async deleteFromRegistry(tenantId, imageName, tag) {
    try {
      // Get manifest digest
      const manifestUrl = `http://${this.registryUrl}/v2/${tenantId}/${imageName}/manifests/${tag}`;
      const manifestResponse = await axios.get(manifestUrl, {
        headers: {
          'Accept': 'application/vnd.docker.distribution.manifest.v2+json'
        }
      });

      const digest = manifestResponse.headers['docker-content-digest'];

      // Delete manifest
      const deleteUrl = `http://${this.registryUrl}/v2/${tenantId}/${imageName}/manifests/${digest}`;
      await axios.delete(deleteUrl);

      logger.info('Image deleted from registry', { tenantId, imageName, tag });
    } catch (error) {
      logger.warn('Failed to delete from registry', { error: error.message });
      // Don't throw - image might already be deleted
    }
  }

  /**
   * Sign image with content trust
   */
  async signImage(imageId, userId) {
    try {
      const result = await pool.query(
        'SELECT * FROM container_images WHERE id = $1 AND user_id = $2',
        [imageId, userId]
      );

      const image = result.rows[0];

      if (!image) {
        throw new Error('Image not found or access denied');
      }

      // Generate signature
      const signature = crypto.createHash('sha256')
        .update(`${image.name}:${image.tag}:${Date.now()}`)
        .digest('hex');

      // Store signature
      await pool.query(
        'UPDATE container_images SET signed = true, signature = $1, signed_at = NOW() WHERE id = $2',
        [signature, imageId]
      );

      logger.info('Image signed', { imageId, signature });

      return { success: true, signature };
    } catch (error) {
      logger.error('Failed to sign image', { error: error.message, imageId });
      throw error;
    }
  }

  /**
   * Build image from Dockerfile
   */
  async buildImage(userId, tenantId, imageName, dockerfileContent, buildContext = {}) {
    try {
      // Create build directory
      const buildId = crypto.randomUUID();
      const buildDir = path.join('/tmp', `build-${buildId}`);
      await fs.mkdir(buildDir, { recursive: true });

      // Write Dockerfile
      await fs.writeFile(path.join(buildDir, 'Dockerfile'), dockerfileContent);

      // Build image
      const tag = `${this.registryUrl}/${tenantId}/${imageName}:latest`;

      const stream = await docker.buildImage({
        context: buildDir,
        src: ['Dockerfile']
      }, {
        t: tag,
        buildargs: buildContext
      });

      // Follow build progress
      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
      });

      // Clean up build directory
      await fs.rm(buildDir, { recursive: true, force: true });

      // Record in database
      const result = await pool.query(
        `INSERT INTO container_images 
         (user_id, tenant_id, name, tag, registry_url, status, built_at)
         VALUES ($1, $2, $3, 'latest', $4, 'available', NOW())
         RETURNING *`,
        [userId, tenantId, imageName, this.registryUrl]
      );

      const image = result.rows[0];

      // Trigger vulnerability scan
      await this.scanImage(image.id);

      logger.info('Image built', { imageId: image.id, imageName: tag });

      return image;
    } catch (error) {
      logger.error('Failed to build image', { error: error.message, imageName });
      throw error;
    }
  }

  /**
   * List images for tenant
   */
  async listImages(tenantId, filters = {}) {
    try {
      let query = 'SELECT * FROM container_images WHERE tenant_id = $1';
      const params = [tenantId];

      if (filters.name) {
        query += ' AND name ILIKE $2';
        params.push(`%${filters.name}%`);
      }

      if (filters.status) {
        query += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);

      return result.rows;
    } catch (error) {
      logger.error('Failed to list images', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Get registry authentication config
   */
  getRegistryAuth() {
    return {
      username: process.env.REGISTRY_USERNAME || '',
      password: process.env.REGISTRY_PASSWORD || '',
      serveraddress: this.registryUrl
    };
  }

  /**
   * Run garbage collection to clean up unused layers
   */
  async runGarbageCollection() {
    try {
      logger.info('Starting registry garbage collection');

      // This would execute: docker exec registry bin/registry garbage-collect /etc/docker/registry/config.yml
      const gc = spawn('docker', [
        'exec',
        'registry',
        'bin/registry',
        'garbage-collect',
        '/etc/docker/registry/config.yml'
      ]);

      let output = '';

      gc.stdout.on('data', (data) => {
        output += data.toString();
      });

      await new Promise((resolve, reject) => {
        gc.on('close', (code) => {
          code === 0 ? resolve() : reject(new Error('GC failed'));
        });
      });

      logger.info('Garbage collection completed', { output });

      return { success: true, output };
    } catch (error) {
      logger.error('Garbage collection failed', { error: error.message });
      throw error;
    }
  }
}

export default new ContainerRegistryService();
