import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageStaffSection, canAccessBillingWorkspace } from '../src/utils/staffAccess.js';

test('Billing operational actions honor each saved section assignment without changing roles', () => {
  const user = { role: 'BillingPayrollAdmin', sectionAccess: ['scholars', 'settings'] };
  assert.equal(canManageStaffSection(user, 'scholars'), true);
  assert.equal(canManageStaffSection(user, 'settings'), true);
  assert.equal(canManageStaffSection(user, 'examination'), false);
  assert.equal(user.role, 'BillingPayrollAdmin');
  assert.equal(canManageStaffSection({ role: 'Applicant', sectionAccess: ['settings'] }, 'settings'), false);
  assert.equal(canManageStaffSection({ role: 'Scholar' }, 'scholars'), false);
});

test('Billing never gains hidden workspaces, including direct or stale navigation selections', () => {
  for (const sectionAccess of [undefined, [], ['settings', 'scholars', 'examination', 'Staff', 'Activity Logs']]) {
    for (const workspace of ['Staff', 'Activity Logs', 'School Catalog', 'System Health', 'Online Questions', 'Unknown']) {
      assert.equal(canAccessBillingWorkspace({ role: 'BillingPayrollAdmin', sectionAccess }, workspace), false);
    }
  }
});

test('Billing visible workspaces stay narrowed by saved section access', () => {
  const user = { role: 'BillingPayrollAdmin', sectionAccess: ['examination'] };
  assert.equal(canAccessBillingWorkspace(user, 'Applicants'), true);
  assert.equal(canAccessBillingWorkspace(user, 'Results Management'), true);
  assert.equal(canAccessBillingWorkspace(user, 'Settings'), false);
  assert.equal(canAccessBillingWorkspace(user, 'Scholars'), false);
  assert.equal(canAccessBillingWorkspace({ role: 'BillingPayrollAdmin' }, 'Settings'), true);
});
