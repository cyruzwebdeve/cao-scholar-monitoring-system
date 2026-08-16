const databaseTarget = process.env.DATABASE_TARGET;
const useApplicationDatabase = databaseTarget !== 'legacy';
const useLocalSuffixedDatabase = useApplicationDatabase
  && (databaseTarget === 'local-v2' || (!databaseTarget && process.env.NODE_ENV !== 'production'));
const { PrismaClient } = useApplicationDatabase
  ? require('../generated/application-client')
  : require('@prisma/client');

const databaseUrl = new URL(process.env.DATABASE_URL);
if (useLocalSuffixedDatabase && !databaseUrl.pathname.endsWith('_v2')) {
  databaseUrl.pathname = `${databaseUrl.pathname}_v2`;
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });

module.exports = prisma;
