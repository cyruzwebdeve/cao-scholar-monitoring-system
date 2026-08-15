const { spawnSync } = require('child_process');
const path = require('path');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!databaseUrl.pathname.endsWith('_v2')) {
  databaseUrl.pathname = `${databaseUrl.pathname}_v2`;
}

const result = spawnSync(
  process.execPath,
  [
    require.resolve('prisma'),
    'studio',
    '--schema',
    'prisma/schema.application.prisma',
  ],
  {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
    stdio: 'inherit',
  },
);

if (result.error) {
  console.error('Unable to start Prisma Studio:', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
