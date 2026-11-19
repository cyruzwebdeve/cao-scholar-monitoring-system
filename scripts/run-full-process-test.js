/**
 * PGCEAP Scholarship Management System
 * End-to-End Full Process Lifecycle Test Runner
 *
 * Demonstrates and verifies the complete lifecycle for 2 applications:
 *  - 1 Public School Applicant (University of Camarines Norte)
 *  - 1 Private School Applicant (Mabini Colleges, Inc.)
 */

const { spawnSync } = require('node:child_process');
const path = require('node:path');

console.log('='.repeat(80));
console.log('   PGCEAP SCHOLARSHIP MANAGEMENT SYSTEM — COMPLETE PROCESS VERIFICATION');
console.log('   Testing 2 Applications: 1 Public School & 1 Private School');
console.log('='.repeat(80));
console.log();

const testFile = path.resolve(__dirname, '..', 'backend', 'tests', 'fullProcessLifecycle.test.js');

const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', testFile], {
  cwd: path.resolve(__dirname, '..', 'backend'),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' },
});

console.log();
if (result.status === 0) {
  console.log('='.repeat(80));
  console.log('   >>> ALL PHASES OF THE SYSTEM LIFECYCLE PASSED SUCCESSFULLY! <<<');
  console.log('   1. Application Intake (Public & Private)  : VERIFIED');
  console.log('   2. Qualifying Examination & Passer List   : VERIFIED');
  console.log('   3. Initial Document Capture & Review     : VERIFIED (Public 4 vs Private 5)');
  console.log('   4. Official Scholar Acceptance           : VERIFIED (Scholar IDs Issued)');
  console.log('   5. School Routing & Grant Preparation    : VERIFIED (Tuition Breakdown)');
  console.log('   6. Official Batch Generation             : VERIFIED (PAY & BILL Lists)');
  console.log('   7. Payout Schedule & Attendance          : VERIFIED (Staff: Present)');
  console.log('   8. Scholar Receipt Attestation           : VERIFIED (Scholar-owned report)');
  console.log('   9. Strict Scope Boundary Compliance      : VERIFIED (Non-disbursement)');
  console.log('='.repeat(80));
  process.exit(0);
} else {
  console.error('Lifecycle test execution failed with exit code:', result.status);
  process.exit(result.status || 1);
}
