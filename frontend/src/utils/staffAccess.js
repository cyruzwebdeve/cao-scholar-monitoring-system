const operationalRoles = ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'];

export const canManageStaffSection = (user, section) => operationalRoles.includes(user?.role)
  && (user.role === 'SuperAdmin' || !Array.isArray(user.sectionAccess) || user.sectionAccess.includes(section));

const billingWorkspaces = {
  Dashboard: ['dashboard'], Applicants: ['applicants', 'examination'],
  'Examination Management': ['examination'], 'Results Management': ['examination'],
  Scholars: ['scholars'], 'Document Reviews': ['documentReviews'], Billing: ['billing'],
  Payroll: ['payroll'], Announcements: ['announcements'], Reports: ['reports'], Settings: ['settings'],
};

// A Billing role is never promoted to SuperAdmin. Hidden and unassigned
// workspaces stay unavailable even if a stale/direct selection reaches Dashboard.
export const canAccessBillingWorkspace = (user, workspace) => user?.role === 'BillingPayrollAdmin'
  && Boolean(billingWorkspaces[workspace]?.some((section) => canManageStaffSection(user, section)));
