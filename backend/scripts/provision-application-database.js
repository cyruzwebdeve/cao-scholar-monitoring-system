const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const TARGET_SUFFIX = '_v2';

const urls = () => {
  const source = new URL(process.env.DATABASE_URL);
  const sourceName = source.pathname.replace(/^\//, '');
  const targetName = `${sourceName}${TARGET_SUFFIX}`;
  const target = new URL(source.toString());
  target.pathname = `/${targetName}`;
  return { sourceUrl: source.toString(), targetUrl: target.toString(), targetName };
};

const runPrisma = (args, targetUrl) => {
  const result = spawnSync(process.execPath, [require.resolve('prisma'), ...args], {
    cwd: require('path').resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: targetUrl },
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Prisma exited with status ${result.status}.`);
};

const main = async () => {
  const { sourceUrl, targetUrl, targetName } = urls();
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  try {
    const existing = await source.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${targetName}`;
    if (!existing.length) {
      await source.$executeRawUnsafe(`CREATE DATABASE "${targetName}"`);
      console.log(`Created application database: ${targetName}`);
    }
  } finally {
    await source.$disconnect();
  }
  runPrisma(['db', 'push', '--schema', 'prisma/schema.application.prisma'], targetUrl);
  runPrisma(['generate', '--schema', 'prisma/schema.application.prisma'], targetUrl);
  console.log(`Application schema is ready in ${targetName}.`);
};

main().catch((error) => {
  console.error('Unable to provision the application database:', error.message);
  process.exitCode = 1;
});
