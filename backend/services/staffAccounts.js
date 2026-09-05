const { getAllowedSectionsForRole, normalizeSectionAccess } = require('./sectionAccess');

const STAFF_ROLE_CONFIG = Object.freeze({
  SuperAdmin: Object.freeze({ databaseRole: 'superadmin', isSuperAdmin: true, label: 'Super Administrator' }),
  RegularAdmin: Object.freeze({ databaseRole: 'admin', isSuperAdmin: false, label: 'Administrator' }),
  BillingPayrollAdmin: Object.freeze({ databaseRole: 'billing', isSuperAdmin: false, label: 'Billing / Payroll Admin' }),
  Moderator: Object.freeze({ databaseRole: 'moderator', isSuperAdmin: false, label: 'Content Moderator' }),
});

const STAFF_ROLES = Object.freeze(Object.keys(STAFF_ROLE_CONFIG));

const resolvePortalRole = (admin) => {
  if (admin.is_super_admin) return 'SuperAdmin';
  if (admin.role === 'moderator') return 'Moderator';
  if (admin.role === 'admin') return 'RegularAdmin';
  return 'BillingPayrollAdmin';
};

const getRoleConfig = (role) => STAFF_ROLE_CONFIG[role] || null;

const serializeStaff = (admin, currentUserId = null) => {
  const role = resolvePortalRole(admin);
  return {
    id: admin.id,
    fullName: admin.full_name,
    email: admin.email,
    role,
    roleLabel: STAFF_ROLE_CONFIG[role].label,
    isActive: admin.is_active,
    sectionAccess: normalizeSectionAccess(admin.section_access, role),
    availableSections: getAllowedSectionsForRole(role),
    lastLoginAt: admin.last_login_at,
    createdAt: admin.created_at,
    updatedAt: admin.updated_at,
    isCurrentUser: admin.id === currentUserId,
  };
};

const assertAccessChangeAllowed = ({ actorId, target, nextRole, nextIsActive, otherActiveSuperAdmins }) => {
  if (target.id === actorId && (nextRole !== 'SuperAdmin' || !nextIsActive)) {
    const error = new Error('You cannot remove your own Super Administrator access or deactivate your own account.');
    error.statusCode = 400;
    throw error;
  }

  const removesSuperAdminAccess = target.is_super_admin && (nextRole !== 'SuperAdmin' || !nextIsActive);
  if (removesSuperAdminAccess && otherActiveSuperAdmins < 1) {
    const error = new Error('At least one active Super Administrator account must remain.');
    error.statusCode = 400;
    throw error;
  }
};

module.exports = {
  STAFF_ROLE_CONFIG,
  STAFF_ROLES,
  assertAccessChangeAllowed,
  getRoleConfig,
  resolvePortalRole,
  serializeStaff,
};
