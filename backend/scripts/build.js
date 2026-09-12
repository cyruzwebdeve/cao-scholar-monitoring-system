require('dotenv').config();

const path = require('path');
const { spawnSync } = require('child_process');
const prismaCli = require('./prisma-cli');

const backendRoot = path.resolve(__dirname, '..');

const run = (command, arguments_) => {
  const result = spawnSync(command, arguments_, {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
};

run(process.execPath, [prismaCli, 'generate', '--schema', 'prisma/schema.application.prisma']);

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_TARGET === 'cloud') {
  console.log('Production target detected; applying committed database migrations before startup.');
  run(process.execPath, [path.join(__dirname, 'deploy-migrations.js')]);
} else {
  console.log('Local target detected; production migration deployment skipped.');
}
