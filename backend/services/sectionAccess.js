const SECTION_KEYS = Object.freeze([
  'dashboard',
  'applicants',
  'examination',
  'scholars',
  'billing',
  'payroll',
  'announcements',
  'reports',
  'settings',
  'documentReviews',
]);

const ROLE_SECTION_DEFAULTS = Object.freeze({
  SuperAdmin: SECTION_KEYS,
  RegularAdmin: Object.freeze(['dashboard', 'applicants', 'examination', 'scholars', 'billing', 'payroll', 'announcements', 'reports', 'settings']),
  BillingPayrollAdmin: Object.freeze(['dashboard', 'applicants', 'examination', 'scholars', 'billing', 'payroll', 'announcements', 'reports', 'settings']),
  Moderator: Object.freeze(['documentReviews', 'announcements', 'settings']),
});

const getAllowedSectionsForRole = (role) => [...(ROLE_SECTION_DEFAULTS[role] || [])];

const normalizeSectionAccess = (value, role) => {
  const allowed = new Set(getAllowedSectionsForRole(role));
  if (role === 'SuperAdmin') return [...allowed];
  if (!Array.isArray(value)) return [...allowed];
  return [...new Set(value.filter((section) => allowed.has(section)))];
};

const hasSectionAccess = (user, section) => user?.role === 'SuperAdmin'
  || normalizeSectionAccess(user?.sectionAccess, user?.role).includes(section);

module.exports = {
  ROLE_SECTION_DEFAULTS,
  SECTION_KEYS,
  getAllowedSectionsForRole,
  hasSectionAccess,
  normalizeSectionAccess,
};
