require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
const { PrismaClient } = require('../generated/application-client');

const recoverableFixtureMigration = '20260909000000_seed_billing_payroll_demo';

if (process.env.DATABASE_TARGET !== 'cloud' && process.env.NODE_ENV !== 'production') {
  throw new Error('Production migrations are disabled locally. Set DATABASE_TARGET=cloud only when targeting the managed database.');
}

const migrationUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!migrationUrl) throw new Error('DIRECT_URL or DATABASE_URL is required to deploy database migrations.');

const runPrisma = (arguments_) => spawnSync(
  process.execPath,
  [require.resolve('prisma'), ...arguments_, '--schema', 'prisma/schema.application.prisma'],
  {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: migrationUrl, DATABASE_TARGET: 'cloud' },
    stdio: 'inherit',
  },
);

const main = async () => {
  const client = new PrismaClient({ datasources: { db: { url: migrationUrl } } });
  try {
    const failedFixture = await client.$queryRawUnsafe(
      `SELECT migration_name FROM "_prisma_migrations"
       WHERE migration_name = $1 AND finished_at IS NULL AND rolled_back_at IS NULL`,
      recoverableFixtureMigration,
    ).catch((error) => {
      if (error?.code === 'P2010' && error?.meta?.code === '42P01') return [];
      throw error;
    });

    if (failedFixture.length) {
      console.log(`Recovering rolled-back fixture migration: ${recoverableFixtureMigration}`);
      const recovery = runPrisma(['migrate', 'resolve', '--rolled-back', recoverableFixtureMigration]);
      if (recovery.error) throw recovery.error;
      if (recovery.status !== 0) process.exit(recovery.status || 1);
    }
  } finally {
    await client.$disconnect();
  }

  const result = runPrisma(['migrate', 'deploy']);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

main().catch((error) => {
  console.error(`Migration deployment failed: ${error.message}`);
  process.exitCode = 1;
});
