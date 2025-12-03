import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',

  // Optional but nice to be explicit
  migrations: {
    path: 'prisma/migrations',
  },

  // 👇 THIS is what Prisma 7 expects: a *single* `datasource` block
  datasource: {
    url: process.env.DATABASE_URL!,

    // Shadow DB for migrate dev
    shadowDatabaseUrl:
      process.env.PRISMA_MIGRATE_SHADOW_DATABASE_URL ??
      process.env.SHADOW_DATABASE_URL ??
      process.env.DATABASE_URL!,
  },
});
