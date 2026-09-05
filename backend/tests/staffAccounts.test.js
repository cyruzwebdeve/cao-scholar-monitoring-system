const assert = require('node:assert/strict');
const test = require('node:test');

const {
  assertAccessChangeAllowed,
  getRoleConfig,
  resolvePortalRole,
  serializeStaff,
} = require('../services/staffAccounts');
const { hasSectionAccess, normalizeSectionAccess } = require('../services/sectionAccess');

test('maps every supported staff role to its database representation', () => {
  assert.deepEqual(getRoleConfig('SuperAdmin'), {
    databaseRole: 'superadmin',
    isSuperAdmin: true,
    label: 'Super Administrator',
  });
  assert.equal(getRoleConfig('RegularAdmin').databaseRole, 'admin');
  assert.equal(getRoleConfig('BillingPayrollAdmin').databaseRole, 'billing');
  assert.equal(getRoleConfig('Moderator').databaseRole, 'moderator');
  assert.equal(getRoleConfig('Applicant'), null);
});

test('resolves legacy administrator records to portal roles', () => {
  assert.equal(resolvePortalRole({ is_super_admin: true, role: 'superadmin' }), 'SuperAdmin');
  assert.equal(resolvePortalRole({ is_super_admin: false, role: 'admin' }), 'RegularAdmin');
  assert.equal(resolvePortalRole({ is_super_admin: false, role: 'moderator' }), 'Moderator');
  assert.equal(resolvePortalRole({ is_super_admin: false, role: 'billing' }), 'BillingPayrollAdmin');
});

test('serializes staff without exposing password hashes or authentication versions', () => {
  const staff = serializeStaff({
    id: 3,
    full_name: 'Billing Admin',
    email: 'billing@example.com',
    role: 'billing',
    is_super_admin: false,
    is_active: true,
    last_login_at: null,
    created_at: new Date('2026-08-20T00:00:00Z'),
    updated_at: new Date('2026-08-20T01:00:00Z'),
    password_hash: 'must-not-leak',
    auth_version: 8,
    section_access: ['dashboard', 'applicants'],
  }, 3);

  assert.equal(staff.role, 'BillingPayrollAdmin');
  assert.equal(staff.isCurrentUser, true);
  assert.deepEqual(staff.sectionAccess, ['dashboard', 'applicants']);
  assert.equal(Object.hasOwn(staff, 'password_hash'), false);
  assert.equal(Object.hasOwn(staff, 'auth_version'), false);
});

test('prevents a Super Administrator from removing their own access', () => {
  assert.throws(() => assertAccessChangeAllowed({
    actorId: 1,
    target: { id: 1, is_super_admin: true },
    nextRole: 'RegularAdmin',
    nextIsActive: true,
    otherActiveSuperAdmins: 2,
  }), /cannot remove your own/i);
});

test('protects the final active Super Administrator while allowing safe access changes', () => {
  assert.throws(() => assertAccessChangeAllowed({
    actorId: 9,
    target: { id: 1, is_super_admin: true },
    nextRole: 'SuperAdmin',
    nextIsActive: false,
    otherActiveSuperAdmins: 0,
  }), /at least one active/i);

  assert.doesNotThrow(() => assertAccessChangeAllowed({
    actorId: 9,
    target: { id: 1, is_super_admin: true },
    nextRole: 'Moderator',
    nextIsActive: true,
    otherActiveSuperAdmins: 1,
  }));
});

test('section permissions narrow role access while preserving legacy role defaults', () => {
  assert.deepEqual(normalizeSectionAccess(['dashboard', 'billing', 'staff'], 'RegularAdmin'), ['dashboard', 'billing']);
  assert.equal(hasSectionAccess({ role: 'RegularAdmin', sectionAccess: ['billing'] }, 'billing'), true);
  assert.equal(hasSectionAccess({ role: 'RegularAdmin', sectionAccess: ['billing'] }, 'applicants'), false);
  assert.equal(hasSectionAccess({ role: 'SuperAdmin', sectionAccess: [] }, 'settings'), true);
  assert.ok(normalizeSectionAccess(null, 'Moderator').includes('documentReviews'));
});
