const useApplicationDatabase = process.env.DATABASE_TARGET !== 'legacy';
const { PrismaClient } = useApplicationDatabase
  ? require('../generated/application-client')
  : require('@prisma/client');

const databaseUrl = new URL(process.env.DATABASE_URL);
if (useApplicationDatabase && !databaseUrl.pathname.endsWith('_v2')) {
  databaseUrl.pathname = `${databaseUrl.pathname}_v2`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });

module.exports = prisma;
