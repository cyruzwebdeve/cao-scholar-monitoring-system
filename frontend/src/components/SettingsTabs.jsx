export default function SettingsTabs({ activeTab, onChange, canManageQuestions }) {
  const tabs = [['general', 'General & Face-to-face'], ['online', 'Online Examination'], ...(canManageQuestions ? [['questions', 'Online Questions']] : [])];
  const navigate = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(([id]) => id === activeTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next][0]);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <nav className="examination-workspace-tabs" role="tablist" aria-label="Settings sections" onKeyDown={navigate}>
    {tabs.map(([id, label]) => <button key={id} type="button" role="tab" id={`settings-tab-${id}`} aria-controls={`settings-panel-${id}`} aria-selected={activeTab === id} tabIndex={activeTab === id ? 0 : -1} className={activeTab === id ? 'active' : ''} onClick={() => onChange(id)}>{label}</button>)}
  </nav>;
}
