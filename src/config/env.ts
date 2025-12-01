import { config } from 'dotenv';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../../.env') });

// Environment schema validation
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('2271'),
  HOST: z.string().default('0.0.0.0'),
  
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.string().transform(Number).default('2'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('10'),
  
  // Redis
  REDIS_URL: z.string().default('redis://127.0.0.1:6379/0'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  
  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Email
  EMAIL_FROM: z.string().email().default('no-reply@migrahosting.com'),
  SMTP_HOST: z.string().default('mail.migrahosting.com'),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // External Services
  POWERDNS_API_URL: z.string().url().default('http://10.1.10.102:8081/api/v1'),
  POWERDNS_API_KEY: z.string().optional(),
  POWERDNS_SERVER_ID: z.string().default('localhost'),
  
  MAILCORE_API_URL: z.string().url().default('http://10.1.10.101:8080/api'),
  MAILCORE_API_KEY: z.string().optional(),
  
  // Infrastructure IPs (from .env, defaults to LAN)
  SRV1_WEB_IP: z.string().default('10.1.10.10'),
  PROXMOX_HOST: z.string().default('10.1.10.70'),
  PROXMOX_SSH_USER: z.string().default('mpanel-automation'),
  PROXMOX_SSH_KEY_PATH: z.string().optional(),
  
  // Webhooks & Security
  MARKETING_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Application
  APP_URL: z.string().url().default('https://mpanel.migrahosting.com'),
  API_VERSION: z.string().default('v1'),
  
  // CORS
  CORS_ORIGIN: z.string().optional(),
});

// Validate and parse environment
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;

// Type-safe environment access
export type Env = z.infer<typeof envSchema>;

// Helper to check if we're in production
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export default env;
