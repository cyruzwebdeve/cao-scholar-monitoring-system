require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');

if (process.env.DATABASE_TARGET !== 'cloud' && process.env.NODE_ENV !== 'production') {
  throw new Error('Production migrations are disabled locally. Set DATABASE_TARGET=cloud only when targeting the managed database.');
}

const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('DIRECT_URL or DATABASE_URL is required to deploy database migrations.');

const result = spawnSync(
  process.execPath,
  [require.resolve('prisma'), 'migrate', 'deploy', '--schema', 'prisma/schema.application.prisma'],
  {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: migrationUrl, DATABASE_TARGET: 'cloud' },
    stdio: 'inherit',
  },
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
