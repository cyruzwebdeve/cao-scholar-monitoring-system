const { readdirSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const selection = process.argv.slice(2);
if (selection.length > 1 || (selection.length === 1 && !['backend', 'frontend'].includes(selection[0]))) {
  console.error('Usage: npm test, npm run test:backend, or npm run test:frontend');
  process.exit(2);
}
const suites = selection.length ? selection : ['backend', 'frontend'];
const color = (text, code) => process.stdout.isTTY && !process.env.NO_COLOR ? `\u001b[${code}m${text}\u001b[0m` : text;
let failed = false;
for (const suite of suites) {
  const directory = path.join(root, suite);
  const files = readdirSync(path.join(directory, 'tests'))
    .filter((name) => name.endsWith('.test.js')).sort().map((name) => path.join('tests', name));
  if (!files.length) {
    console.error(`FAIL ${suite}: no test files found.`);
    failed = true;
    continue;
  }
  console.log(`\n${color(`RUN  ${suite === 'backend' ? 'Backend workflows and permissions' : 'Frontend behavior and recovery'}`, '1;36')}\n`);
  // Ordinary regressions use facades/fixtures. The database-backed migration test
  // remains explicitly skipped here rather than inheriting a production URL.
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], {
    cwd: directory,
    env: { ...process.env, DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/pgceap_test', PGCEAP_TEST_CATALOG_MIGRATION: '0' },
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) console.error(result.error.message);
  const passed = !result.error && result.status === 0;
  console.log(`\n${color(`${passed ? 'PASS' : 'FAIL'} ${suite} test suite`, passed ? '1;32' : '1;31')}`);
  if (!passed) failed = true;
  if (result.signal) { process.exitCode = 1; break; }
}
console.log(`\n${color(failed ? 'FAIL Some tests failed. Review the checks above.' : 'PASS All selected test suites passed.', failed ? '1;31' : '1;32')}\n`);
process.exitCode = failed || process.exitCode ? 1 : 0;
