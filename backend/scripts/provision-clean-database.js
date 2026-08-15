const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const CLEAN_SUFFIX = '_clean';

const getDatabaseUrls = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  const sourceUrl = new URL(process.env.DATABASE_URL);
  const sourceName = sourceUrl.pathname.replace(/^\//, '');
  const targetName = `${sourceName}${CLEAN_SUFFIX}`;
  if (!/^[a-zA-Z0-9_]+$/.test(targetName)) throw new Error('The generated clean database name is invalid.');
  const targetUrl = new URL(sourceUrl.toString());
  targetUrl.pathname = `/${targetName}`;
  return { sourceUrl: sourceUrl.toString(), targetUrl: targetUrl.toString(), sourceName, targetName };
};

const run = (command, args, environment) => {
  const result = spawnSync(command, args, {
    cwd: require('path').resolve(__dirname, '..'),
    env: environment,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}.`);
};

const main = async () => {
  const { sourceUrl, targetUrl, sourceName, targetName } = getDatabaseUrls();
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  try {
    const existing = await source.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${targetName}`;
    if (!existing.length) {
      await source.$executeRawUnsafe(`CREATE DATABASE "${targetName}"`);
      console.log(`Created clean database: ${targetName}`);
    } else {
      console.log(`Clean database already exists: ${targetName}`);
    }
  } finally {
    await source.$disconnect();
  }

  const environment = { ...process.env, DATABASE_URL: targetUrl };
  const prismaCli = require.resolve('prisma');
  run(process.execPath, [prismaCli, 'db', 'push', '--schema', 'prisma/schema.cleaned.prisma'], environment);
  run(process.execPath, [prismaCli, 'generate', '--schema', 'prisma/schema.cleaned.prisma'], environment);
  console.log(`Clean schema provisioned from ${sourceName} into ${targetName}.`);
};

main().catch((error) => {
  console.error('Unable to provision the clean database:', error.message);
  process.exitCode = 1;
});
