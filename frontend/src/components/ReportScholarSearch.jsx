import { Download, Search, X } from 'lucide-react';
import { formatReportMoney, summarizePayrollReport } from '../utils/reportScholarSearch';
import '../styles/report-scholar-search.css';
export default function ReportScholarSearch({ rows, total, query, onQuery, page = 1, onPage, disabled = false, onExport, listType = 'all', onListType }) {
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const visible = rows.slice((currentPage - 1) * 10, currentPage * 10);
  const summary = summarizePayrollReport(rows);
  const rowMoney = (row, value) => row.listStatus === 'Payroll listed' ? formatReportMoney(value) : '—';
  return <section className="reports-surface reports-scholar-search" aria-labelledby="report-scholars-title">
    <header>
      <div><h2 id="report-scholars-title">Scholar records</h2><p>Search scholars and review recorded amounts from generated payroll lists.</p></div>
      <div className="report-scholar-actions"><span role="status">{rows.length} of {total} records</span>{onExport && <button type="button" onClick={onExport} disabled={disabled || !rows.length}><Download size={14} aria-hidden="true" />Export matches</button>}</div>
    </header>
    <div className="report-scholar-search-controls">
      <div className="report-record-toolbar">
        <div className="report-query-label"><label htmlFor="report-scholar-query">Search scholar records</label><div className="report-query-input"><Search size={16} aria-hidden="true" /><input id="report-scholar-query" type="search" maxLength={200} value={query} onChange={event => onQuery(event.target.value)} disabled={disabled} placeholder="Name, control number or list reference" aria-describedby="report-scholar-search-help" />{query && <button type="button" onClick={() => onQuery('')} disabled={disabled} aria-label="Clear scholar search"><X size={16} aria-hidden="true" /></button>}</div></div>
        <label className="report-list-type">List status<select aria-label="Report list status" value={listType} onChange={event => onListType?.(event.target.value)} disabled={disabled}><option value="all">All records</option><option value="payroll">Payroll listed</option><option value="certification">Certification listed</option><option value="unlisted">Not listed</option></select></label>
      </div>
      <small id="report-scholar-search-help">Search, school year and list status apply to the totals, records and export below. Names, school, course and account status are current; list references and amounts retain their recorded period.</small>
    </div>
    <section className="report-payroll-summary" aria-label="Matching payroll summary" aria-busy={disabled}>
      <div className="report-payroll-summary-heading"><h3>Payroll list summary</h3><span>Amounts on saved payroll lists</span></div>
      <div className="report-payroll-cards">
        <article><span>Payroll list amount</span><strong>{disabled ? '—' : formatReportMoney(summary.payrollAmount)}</strong><small>{summary.entries} payroll {summary.entries === 1 ? 'entry' : 'entries'}</small></article>
        <article><span>Recorded tuition assistance</span><strong>{disabled ? '—' : formatReportMoney(summary.tuitionAmount)}</strong><small>From saved breakdowns</small></article>
        <article><span>Recorded allowance</span><strong>{disabled ? '—' : formatReportMoney(summary.allowanceAmount)}</strong><small>From saved breakdowns</small></article>
        <article><span>Scholars on payroll</span><strong>{disabled ? '—' : summary.scholars}</strong><small>{summary.lists} payroll {summary.lists === 1 ? 'list' : 'lists'}</small></article>
      </div>
      {(summary.missingAmounts > 0 || summary.overflow) && <p className="report-amount-warning" role="status">{summary.overflow ? 'The matching amount total exceeds the supported range. Narrow the search or school year.' : `${summary.missingAmounts} payroll entries have no valid recorded amount; the total includes recorded values only.`}</p>}
      {summary.missingBreakdowns > 0 && <p className="report-breakdown-note">Tuition and allowance totals cover {summary.recordedBreakdowns} of {summary.entries} payroll entries. Missing breakdowns are shown as Not recorded.</p>}
    </section>
    <div className="report-scholar-table-wrap"><table><thead><tr><th scope="col">Control no.</th><th scope="col">Scholar / current school</th><th scope="col">School year / semester</th><th scope="col">List status / reference</th><th scope="col" className="report-money-cell">Payroll amount</th><th scope="col" className="report-money-cell">Tuition assistance</th><th scope="col" className="report-money-cell">Allowance</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}>
      <td data-label="Control no.">{row.controlNumber || '—'}</td>
      <td data-label="Scholar / current school"><strong>{row.name}</strong><span>{row.school}</span><small>{row.accountStatus}{row.historical ? ' · Historical list record' : ''}</small></td>
      <td data-label="School year / semester">{row.schoolYear}<span>{row.semester}</span></td>
      <td data-label="List status / reference">{row.listStatus}<span>{row.reference || '—'}</span></td>
      <td data-label="Payroll amount" className="report-money-cell">{rowMoney(row, row.payrollAmount)}</td>
      <td data-label="Tuition assistance" className="report-money-cell">{rowMoney(row, row.tuitionAmount)}</td>
      <td data-label="Allowance" className="report-money-cell">{rowMoney(row, row.allowanceAmount)}</td>
    </tr>)}</tbody></table></div>
    {!rows.length && <div className="reports-empty compact"><Search size={22} aria-hidden="true" /><strong>{query.trim() ? 'No scholar records match your search' : 'No scholar records for these filters'}</strong><span>Try another name, reference, school year or list status.</span></div>}
    <footer><span>Page {currentPage} of {pageCount}</span><div><button type="button" disabled={disabled || currentPage === 1} onClick={() => onPage(currentPage - 1)} aria-label="Previous scholar records page">Previous</button><button type="button" disabled={disabled || currentPage === pageCount} onClick={() => onPage(currentPage + 1)} aria-label="Next scholar records page">Next</button></div></footer>
  </section>;
}
