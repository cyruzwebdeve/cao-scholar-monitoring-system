import '../styles/settings-tabs.css';

export default function SettingsTabs({ activeTab, onChange, showAdminTabs = false }) {
  const tabs = [
    ['applications', 'Applications'],
    ['academic-year', 'Academic Year'],
    ['requirements', 'Requirements'],
    ['examination', 'Examination'],
    ...(showAdminTabs ? [['schools', 'School Catalog'], ['system', 'System Health']] : []),
  ];
  const selectedTab = tabs.some(([id]) => id === activeTab) ? activeTab : 'applications';
  const navigate = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(([id]) => id === selectedTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next][0]);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <nav className="examination-workspace-tabs settings-tabs" role="tablist" aria-label="Settings sections" onKeyDown={navigate}>
    {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-controls={`settings-panel-${id}`} aria-selected={selectedTab === id} tabIndex={selectedTab === id ? 0 : -1} className={selectedTab === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>)}
  </nav>;
}
