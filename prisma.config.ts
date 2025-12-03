import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Ensure .env variables (DATABASE_URL, etc.) are loaded before Prisma inspects config
loadEnv();

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrate: {
    adapter: async () => {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      
      const connectionString = process.env.DATABASE_URL!;
      
      const pool = new Pool({ connectionString });
      return new PrismaPg(pool);
    },
  },
});
