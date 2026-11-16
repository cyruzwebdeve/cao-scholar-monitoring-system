import '../styles/reports-tabs.css';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'Intake & processing' },
  { id: 'coverage', label: 'Priority locations' },
  { id: 'fourth-year', label: 'Fourth-year records' },
  { id: 'scholars', label: 'Scholar records' },
];

export default function ReportsTabs({ activeTab, onChange }) {
  const navigate = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex(({ id }) => id === activeTab);
    const next = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };

  return (
    <nav className="examination-workspace-tabs reports-workspace-tabs" role="tablist" aria-label="Report sections" onKeyDown={navigate}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`reports-tab-${id}`}
          aria-controls={`reports-panel-${id}`}
          aria-selected={activeTab === id}
          tabIndex={activeTab === id ? 0 : -1}
          className={activeTab === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
