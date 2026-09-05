import './Sidebar.css';
import caologo from '../assets/caologo-96.webp';
import {
  Boxes,
  ChartColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings2,
  UsersRound,
  X,
} from 'lucide-react';

const navItemsByRole = {
  SuperAdmin: [
    { label: 'Dashboard', icon: LayoutDashboard, section: 'dashboard' },
    { label: 'Applicants', icon: UsersRound, section: 'applicants' },
    { label: 'Staff', icon: UsersRound },
    { label: 'Examination Management', icon: ClipboardList, section: 'examination' },
    { label: 'Scholars', icon: GraduationCap, section: 'scholars' },
    { label: 'Billing', icon: FileText, section: 'billing' },
    { label: 'Payroll', icon: Boxes, section: 'payroll' },
    { label: 'Announcements', icon: Megaphone, section: 'announcements' },
    { label: 'School Catalog', icon: FileText },
    { label: 'Activity Logs', icon: ClipboardList },
    { label: 'Reports', icon: ChartColumn, section: 'reports' },
    { label: 'Settings', icon: Settings2, section: 'settings' },
  ],
  BillingPayrollAdmin: [
    { label: 'Dashboard', icon: LayoutDashboard, section: 'dashboard' },
    { label: 'Applicants', icon: UsersRound, section: 'applicants' },
    { label: 'Examination Management', icon: ClipboardList, section: 'examination' },
    { label: 'Scholars', icon: GraduationCap, section: 'scholars' },
    { label: 'Billing', icon: FileText, section: 'billing' },
    { label: 'Payroll', icon: Boxes, section: 'payroll' },
    { label: 'Announcements', icon: Megaphone, section: 'announcements' },
    { label: 'Reports', icon: ChartColumn, section: 'reports' },
    { label: 'Settings', icon: Settings2, section: 'settings' },
  ],
  Moderator: [
    { label: 'Document Reviews', icon: ClipboardList, section: 'documentReviews' },
    { label: 'Announcements', icon: Megaphone, section: 'announcements' },
    { label: 'Settings', icon: Settings2, section: 'settings' },
  ],
};

navItemsByRole.RegularAdmin = navItemsByRole.SuperAdmin.filter(({ label }) => [
  'Dashboard', 'Applicants', 'Examination Management',
  'Scholars', 'Billing', 'Payroll', 'Announcements', 'Reports', 'Settings',
].includes(label));

function Sidebar({ onLogout, activeSection, onSectionChange, role, sectionAccess, isOpen = false, onClose }) {
  const roleItems = navItemsByRole[role] || navItemsByRole.Moderator;
  const navItems = role === 'SuperAdmin' || !Array.isArray(sectionAccess)
    ? roleItems
    : roleItems.filter((item) => !item.section || sectionAccess.includes(item.section));

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`} aria-label="Dashboard navigation">
      <button className="sidebar-mobile-close" type="button" onClick={onClose} aria-label="Close dashboard navigation">
        <X size={20} />
      </button>
      <div className="sidebar-brand">
        <div className="brand-avatar">
          <img
            src={caologo}
            width="96"
            height="96"
            alt="Admin avatar"
            className="brand-avatar-image"
          />
        </div>
        <div>
          <p className="brand-title">Admin Panel</p>
          <p className="brand-subtitle">
            {role === 'SuperAdmin'
              ? 'Super Admin Workspace'
              : role === 'BillingPayrollAdmin'
                ? 'Billing Admin Workspace'
                : role === 'Moderator'
                  ? 'Content Moderator Workspace'
                  : 'Administrator Workspace'}
          </p>
        </div>
      </div>

      <div className="sidebar-divider" />

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className={`sidebar-nav-item ${activeSection === item.label ? 'sidebar-nav-item-active' : ''}`}
              type="button"
              onClick={() => onSectionChange(item.label)}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                <Icon size={16} strokeWidth={2.2} />
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
