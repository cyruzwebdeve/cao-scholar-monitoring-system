import MetricDetailsCard from './MetricDetailsCard';
import { payrollSummaryDetails } from '../utils/reportPayrollDetails';
import { ArrowLeftRight, ArrowUpRight, Banknote, ChevronDown, ChevronLeft, ChevronRight, Coins, Download, Info, Search, University, UsersRound, X } from 'lucide-react';
import { formatReportMoney, summarizePayrollReport } from '../utils/reportScholarSearch';
import '../styles/report-scholar-search.css';
export default function ReportScholarSearch({ rows, total, query, onQuery, page = 1, onPage, disabled = false, onExport, listType = 'all', onListType }) {
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const currentPage = Math.max(1, Math.min(page, pageCount));
  const visible = rows.slice((currentPage - 1) * 10, currentPage * 10);
  const summary = summarizePayrollReport(rows);
  const rowMoney = (row, value) => row.listStatus !== 'Payroll listed' ? <span className="report-money-missing">—</span> : value == null ? <span className="report-money-missing">Not recorded</span> : formatReportMoney(value);
  return <section className="reports-surface reports-scholar-search" aria-labelledby="report-scholars-title" aria-busy={disabled}>
    <header>
      <div className="report-directory-title"><span className="report-directory-icon" aria-hidden="true"><UsersRound size={23} /></span><div><h2 id="report-scholars-title">Scholar records</h2><p>Find scholars, review payroll list amounts, and export matching records.</p></div></div>
      <div className="report-scholar-actions"><span className="report-record-count" role="status">{rows.length} of {total} records</span>{onExport && <button type="button" onClick={onExport} disabled={disabled || !rows.length}><Download size={14} aria-hidden="true" />Export matches</button>}</div>
    </header>
    <div className="report-scholar-search-controls">
      <div className="report-record-toolbar">
        <div className="report-query-label"><label htmlFor="report-scholar-query">Search scholar records</label><div className="report-query-input"><Search size={16} aria-hidden="true" /><input id="report-scholar-query" type="search" maxLength={200} value={query} onChange={event => onQuery(event.target.value)} disabled={disabled} placeholder="Name, control number or list reference" aria-describedby="report-scholar-search-help" />{query && <button type="button" onClick={() => onQuery('')} disabled={disabled} aria-label="Clear scholar search"><X size={16} aria-hidden="true" /></button>}</div></div>
        <label className="report-list-type">List status<select aria-label="Report list status" value={listType} onChange={event => onListType?.(event.target.value)} disabled={disabled}><option value="all">All records</option><option value="payroll">Payroll listed</option><option value="certification">Certification listed</option><option value="unlisted">Not listed</option></select></label>
      </div>
      <div className="report-record-context"><details className="report-record-scope"><summary><Info size={14} aria-hidden="true" />About these records<ChevronDown size={14} aria-hidden="true" /></summary><p id="report-scholar-search-help">Search, school year and list status apply to the totals, records and export below. Names, school, course and account status are current; list references and amounts retain their recorded period.</p></details>{(query.trim() || listType !== 'all') && <button type="button" className="report-reset-filters" disabled={disabled} onClick={() => { onQuery(''); onListType?.('all'); }}>Reset filters</button>}</div>
    </div>
    <section className="report-payroll-summary" aria-label="Matching payroll summary" aria-busy={disabled}>
      <div className="report-payroll-summary-heading"><h3>Payroll list summary</h3><span>Amounts on saved payroll lists</span></div>
      <div className="report-payroll-cards">
        {[
          { kind: 'payroll', title: 'Payroll list amount', value: formatReportMoney(summary.payrollAmount), meta: `${summary.entries} payroll ${summary.entries === 1 ? 'entry' : 'entries'}`, Icon: Banknote },
          { kind: 'tuition', title: 'Recorded tuition assistance', value: formatReportMoney(summary.tuitionAmount), meta: 'From saved breakdowns', Icon: University },
          { kind: 'allowance', title: 'Recorded allowance', value: formatReportMoney(summary.allowanceAmount), meta: 'From saved breakdowns', Icon: Coins },
          { kind: 'scholars', title: 'Scholars on payroll', value: summary.scholars, meta: `${summary.lists} payroll ${summary.lists === 1 ? 'list' : 'lists'}`, Icon: UsersRound },
        ].map(({ kind, title, value, meta, Icon }) => <MetricDetailsCard key={kind} className={`report-payroll-card report-payroll-card-${kind}`} {...payrollSummaryDetails(rows, kind)} disabled={disabled}>
          <div className="report-stat-heading"><span className="report-stat-icon" aria-hidden="true"><Icon size={18} /></span><span>{title}</span><ArrowUpRight size={16} className="report-stat-arrow" aria-hidden="true" /></div>
          <strong className="report-stat-value">{disabled ? '—' : value}</strong><div className="report-stat-footer"><small>{meta}</small><span>View details</span></div>
        </MetricDetailsCard>)}
      </div>
      {(summary.missingAmounts > 0 || summary.overflow) && <p className="report-amount-warning" role="status">{summary.overflow ? 'The matching amount total exceeds the supported range. Narrow the search or school year.' : `${summary.missingAmounts} payroll entries have no valid recorded amount; the total includes recorded values only.`}</p>}
      {summary.missingBreakdowns > 0 && <p className="report-breakdown-note">Tuition and allowance totals cover {summary.recordedBreakdowns} of {summary.entries} payroll entries. Missing breakdowns are shown as Not recorded.</p>}
    </section>
    <div className="report-entries-heading"><h3>Scholar entries</h3><span className="report-scroll-hint"><ArrowLeftRight size={14} aria-hidden="true" />Scroll to see all amounts</span></div>
    <div className="report-scholar-table-wrap"><table><thead><tr><th scope="col">Control no.</th><th scope="col">Scholar / current school</th><th scope="col">School year / semester</th><th scope="col">List status / reference</th><th scope="col" className="report-money-cell">Payroll amount</th><th scope="col" className="report-money-cell">Tuition assistance</th><th scope="col" className="report-money-cell">Allowance</th></tr></thead><tbody>{visible.map(row => <tr key={row.id}>
      <td data-label="Control no."><code className="report-control-number">{row.controlNumber || '—'}</code></td>
      <td data-label="Scholar / current school"><div className="report-person"><span className="report-person-avatar" aria-hidden="true">{String(row.name || '').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{row.name}</strong><span className="report-person-school">{row.school}</span><small className="report-account-meta">{row.accountStatus}{row.historical && <span className="report-history-flag">Historical list record</span>}</small></div></div></td>
      <td data-label="School year / semester">{row.schoolYear}<span>{row.semester}</span></td>
      <td data-label="List status / reference"><span className={`report-list-badge ${row.listStatus === 'Payroll listed' ? 'payroll' : row.listStatus === 'Certification listed' ? 'certification' : 'unlisted'}`}>{row.listStatus}</span><code className="report-list-reference">{row.reference || '—'}</code></td>
      <td data-label="Payroll amount" className="report-money-cell report-payroll-value">{rowMoney(row, row.payrollAmount)}</td>
      <td data-label="Tuition assistance" className="report-money-cell">{rowMoney(row, row.tuitionAmount)}</td>
      <td data-label="Allowance" className="report-money-cell">{rowMoney(row, row.allowanceAmount)}</td>
    </tr>)}</tbody></table></div>
    {!rows.length && <div className="reports-empty compact"><Search size={22} aria-hidden="true" /><strong>{query.trim() ? 'No scholar records match your search' : 'No scholar records for these filters'}</strong><span>Try another name, reference, school year or list status.</span></div>}
    <footer><div className="report-pagination-summary"><strong>{rows.length ? `Showing ${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, rows.length)} of ${rows.length} records` : 'No matching records'}</strong><span>Page {currentPage} of {pageCount}</span></div><div className="report-pagination-actions"><button type="button" disabled={disabled || currentPage === 1} onClick={() => onPage(currentPage - 1)} aria-label="Previous scholar records page"><ChevronLeft size={16} aria-hidden="true" />Previous</button><button type="button" disabled={disabled || currentPage === pageCount} onClick={() => onPage(currentPage + 1)} aria-label="Next scholar records page">Next<ChevronRight size={16} aria-hidden="true" /></button></div></footer>
  </section>;
}
