import './Sidebar.css';
import caologo from '../assets/caologo-96.webp';
import {
  BadgeCheck,
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
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Applicants', icon: UsersRound },
    { label: 'Staff', icon: UsersRound },
    { label: 'Examination Management', icon: ClipboardList },
    { label: 'Results Management', icon: BadgeCheck },
    { label: 'Scholars', icon: GraduationCap },
    { label: 'Billing', icon: FileText },
    { label: 'Payroll', icon: Boxes },
    { label: 'Announcements', icon: Megaphone },
    { label: 'School Catalog', icon: FileText },
    { label: 'Activity Logs', icon: ClipboardList },
    { label: 'Reports', icon: ChartColumn },
    { label: 'Settings', icon: Settings2 },
  ],
  BillingPayrollAdmin: [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Applicants', icon: UsersRound },
    { label: 'Examination Management', icon: ClipboardList },
    { label: 'Results Management', icon: BadgeCheck },
    { label: 'Scholars', icon: GraduationCap },
    { label: 'Billing', icon: FileText },
    { label: 'Payroll', icon: Boxes },
    { label: 'Announcements', icon: Megaphone },
    { label: 'Reports', icon: ChartColumn },
    { label: 'Settings', icon: Settings2 },
  ],
  Moderator: [
    { label: 'Content Management', icon: Megaphone },
    { label: 'Announcements', icon: Megaphone },
    { label: 'Settings', icon: Settings2 },
  ],
};

navItemsByRole.RegularAdmin = navItemsByRole.SuperAdmin.filter(({ label }) => [
  'Dashboard', 'Applicants', 'Examination Management', 'Results Management',
  'Scholars', 'Billing', 'Payroll', 'Announcements', 'Reports', 'Settings',
].includes(label));

function Sidebar({ onLogout, activeSection, onSectionChange, role, isOpen = false, onClose }) {
  const navItems = navItemsByRole[role] || navItemsByRole.Moderator;

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
