import { Columns3, Download, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './CsvExportModal.css';

export default function CsvExportModal({ title, description, columns, rowCount, getRowCount, onClose, onExport }) {
  const [selectedKeys, setSelectedKeys] = useState(() => columns.filter(({ defaultSelected = true }) => defaultSelected).map(({ key }) => key));
  const groups = useMemo(() => {
    const grouped = new Map();
    columns.forEach((column) => {
      const group = column.group || 'Available columns';
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group).push(column);
    });
    return [...grouped.entries()];
  }, [columns]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const selectedColumns = columns.filter(({ key }) => selectedKeys.includes(key));
  const effectiveRowCount = getRowCount ? getRowCount(selectedColumns) : rowCount;
  const toggleColumn = (key) => setSelectedKeys((current) => current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key]);
  const handleExport = () => {
    if (!selectedColumns.length) return;
    onExport(selectedColumns);
    onClose();
  };

  return (
    <div className="csv-export-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="csv-export-modal" role="dialog" aria-modal="true" aria-labelledby="csv-export-title">
        <header>
          <i><Columns3 size={21} /></i>
          <div><span>CSV EXPORT</span><h2 id="csv-export-title">{title}</h2><p>{description}</p></div>
          <button type="button" onClick={onClose} aria-label="Close export options"><X size={18} /></button>
        </header>

        <div className="csv-export-selection-bar">
          <span><strong>{selectedColumns.length}</strong> of <strong>{columns.length}</strong> columns selected</span>
          <div><button type="button" onClick={() => setSelectedKeys(columns.map(({ key }) => key))} disabled={selectedColumns.length === columns.length}>Select all</button><button type="button" onClick={() => setSelectedKeys([])} disabled={!selectedColumns.length}>Clear</button></div>
        </div>

        <div className="csv-export-groups">
          {groups.map(([group, groupColumns]) => (
            <fieldset key={group}>
              <legend>{group}</legend>
              <div className="csv-export-options">
                {groupColumns.map((column) => {
                  const selected = selectedKeys.includes(column.key);
                  return <label className={selected ? 'selected' : ''} key={column.key}><input type="checkbox" checked={selected} onChange={() => toggleColumn(column.key)} /><span><strong>{column.label}</strong>{column.description && <small>{column.description}</small>}</span></label>;
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <footer>
          <span>{selectedColumns.length ? `${effectiveRowCount} ${effectiveRowCount === 1 ? 'record' : 'records'} will be exported.` : 'Select at least one column to continue.'}</span>
          <div><button type="button" className="csv-export-cancel" onClick={onClose}>Cancel</button><button type="button" className="csv-export-confirm" onClick={handleExport} disabled={!selectedColumns.length}><Download size={15} />Export CSV</button></div>
        </footer>
      </section>
    </div>
  );
}
