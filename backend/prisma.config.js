/**
 * Prisma 7 configuration: connection URL for the CLI (migrate, db pull, studio).
 * The runtime client connects through a driver adapter (see src/shared/config/database.js).
 */
require('dotenv').config({ quiet: true });
const { defineConfig } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
