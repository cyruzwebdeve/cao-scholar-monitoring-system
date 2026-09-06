import { useState } from 'react';
import './Sidebar.css';
import caologo from '../assets/caologo-96.webp';
import {
  Boxes,
  ChartColumn,
  ChevronDown,
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
    {
      label: 'Applicants',
      icon: UsersRound,
      children: [
        { label: 'Applicants', navLabel: 'Applicant Records', icon: UsersRound, section: 'applicants' },
        { label: 'Examination Management', icon: ClipboardList, section: 'examination' },
      ],
    },
    { label: 'Staff', icon: UsersRound },
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
    {
      label: 'Applicants',
      icon: UsersRound,
      children: [
        { label: 'Applicants', navLabel: 'Applicant Records', icon: UsersRound, section: 'applicants' },
        { label: 'Examination Management', icon: ClipboardList, section: 'examination' },
      ],
    },
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
  const navItems = (role === 'SuperAdmin' || !Array.isArray(sectionAccess)
    ? roleItems
    : roleItems.reduce((items, item) => {
      if (item.children) {
        const children = item.children.filter((child) => !child.section || sectionAccess.includes(child.section));
        if (children.length) items.push({ ...item, children });
      } else if (!item.section || sectionAccess.includes(item.section)) {
        items.push(item);
      }
      return items;
    }, []));
  const [groupExpandedOverrides, setGroupExpandedOverrides] = useState({});

  const toggleGroup = (label, isExpanded) => {
    setGroupExpandedOverrides((groups) => ({ ...groups, [label]: !isExpanded }));
  };

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

          if (item.children) {
            const isGroupActive = item.children.some((child) => child.label === activeSection);
            const isExpanded = groupExpandedOverrides[item.label] ?? isGroupActive;

            return (
              <div className="sidebar-nav-group" key={item.label}>
                <button
                  className={`sidebar-nav-item sidebar-nav-group-toggle ${isGroupActive ? 'sidebar-nav-group-active' : ''}`}
                  type="button"
                  onClick={() => toggleGroup(item.label, isExpanded)}
                  aria-expanded={isExpanded}
                  aria-controls={`sidebar-group-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span className="sidebar-nav-icon" aria-hidden="true">
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  <span>{item.label}</span>
                  <ChevronDown className="sidebar-nav-chevron" size={15} aria-hidden="true" />
                </button>
                {isExpanded && (
                  <div className="sidebar-nav-children" id={`sidebar-group-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.label}
                          className={`sidebar-nav-item sidebar-nav-child ${activeSection === child.label ? 'sidebar-nav-item-active' : ''}`}
                          type="button"
                          onClick={() => onSectionChange(child.label)}
                        >
                          <span className="sidebar-nav-icon" aria-hidden="true">
                            <ChildIcon size={15} strokeWidth={2.2} />
                          </span>
                          <span>{child.navLabel || child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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
