const tabs = [{ id: 'initial', title: 'Initial documents', subtitle: 'Managed by CAO' }, { id: 'continuing', title: 'Continuing requirements', subtitle: 'Your uploads' }];
export default function ScholarRequirementsTabs({ activeTab, onChange }) {
  const onKeyDown = event => {
    const index = tabs.findIndex(tab => tab.id === activeTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' ? (index + 1) % 2 : event.key === 'ArrowLeft' ? (index + 1) % 2 : null;
    if (next === null) return;
    event.preventDefault(); onChange(tabs[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  return <div className="scholar-requirements-tabs" role="tablist" aria-label="Document submission stages" onKeyDown={onKeyDown}>{tabs.map(tab => <button key={tab.id} id={`scholar-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`scholar-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => onChange(tab.id)}><strong>{tab.title}</strong><small>{tab.subtitle}</small></button>)}</div>;
}
