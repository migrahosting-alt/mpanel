/**
 * Configuration Manager
 * Loads and manages agent configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class Config {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, '..', 'config.json');
    this.config = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.log('[Config] No config file found, using defaults');
        return this.getDefaults();
      }

      const configData = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(configData);
      
      // Merge with defaults
      return { ...this.getDefaults(), ...config };
    } catch (error) {
      console.error('[Config] Error loading config:', error.message);
      return this.getDefaults();
    }
  }

  getDefaults() {
    return {
      controlPanel: {
        url: process.env.MPANEL_URL || 'http://localhost:3000',
        apiKey: process.env.MPANEL_API_KEY || '',
      },
      agent: {
        reportInterval: parseInt(process.env.REPORT_INTERVAL) || 60, // seconds
        hostname: null, // auto-detect
        agentId: null, // set after registration
        enabledCollectors: [
          'cpu',
          'memory',
          'disk',
          'network',
        ],
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        file: null, // console only by default
      },
    };
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.config);
  }

  set(key, value) {
    const keys = key.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, k) => {
      if (!obj[k]) obj[k] = {};
      return obj[k];
    }, this.config);
    target[lastKey] = value;
  }

  save() {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      console.log('[Config] Configuration saved');
    } catch (error) {
      console.error('[Config] Error saving config:', error.message);
    }
  }
}
