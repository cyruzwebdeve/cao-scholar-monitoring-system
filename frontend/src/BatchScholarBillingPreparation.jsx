import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, RefreshCw, Save, Search } from 'lucide-react';
import Notification from './components/Notification';
import DocumentViewButton from './components/DocumentViewButton';
import { API_BASE, authHeaders } from './services/api';
import {
  MAX_BATCH_GRANT_ROWS, batchBillingAmount, batchBillingBlocker, batchBillingDraft,
  buildBatchBillingEntries, mergeBatchBillingDrafts, readBatchBillingResults,
} from './utils/batchScholarBilling';
import './styles/batch-scholar-billing.css';

const emptyData = { periodId: '', token: null, records: [], periods: [], loading: true, error: '' };
const emptyRows = { periodId: '', token: null, rows: {} };
const emptyIds = { periodId: '', token: null, ids: [] };
const money = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Unavailable';

export default function BatchScholarBillingPreparation({ token, onAddedToBilling }) {
  const [periodId, setPeriodId] = useState('');
  const [data, setData] = useState(emptyData);
  const [draftState, setDraftState] = useState(emptyRows);
  const [selection, setSelection] = useState(emptyIds);
  const [saved, setSaved] = useState(emptyIds);
  const [query, setQuery] = useState('');
  const [school, setSchool] = useState('All schools');
  const [saving, setSaving] = useState(false);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [notice, setNotice] = useState(null);
  const scopeRef = useRef(null);
  const actionRef = useRef(null);
  const requestRef = useRef(0);

  useLayoutEffect(() => {
    scopeRef.current = { periodId, token };
    return () => { scopeRef.current = null; };
  }, [periodId, token]);

  const loadRecords = useCallback(async ({ signal } = {}) => {
    const scope = scopeRef.current;
    if (!scope) return;
    const requestId = ++requestRef.current;
    setData((current) => ({ ...current, loading: true, error: '' }));
    try {
      const response = await fetch(`${API_BASE}/scholars/management${periodId ? `?academicPeriodId=${encodeURIComponent(periodId)}` : ''}`, { headers: authHeaders(token), cache: 'no-store', signal });
      const body = await response.json();
      if (scopeRef.current !== scope || requestRef.current !== requestId || signal?.aborted) return;
      if (!response.ok) throw new Error(body.message || 'Unable to load Scholar grant records.');
      const loadedId = String(body.activePeriod?.id || '');
      if (!loadedId || body.activePeriod?.isActive !== true || (periodId && loadedId !== periodId)) throw new Error('Select an active academic year and semester.');
      const records = (body.scholars || []).filter((record) => String(record.schoolType || '').toLowerCase() === 'private' && record.processRoute === 'billing');
      const periods = (body.activePeriods || []).filter((period) => period.isActive);
      setData({ periodId: loadedId, token, records, periods, loading: false, error: '' });
      setDraftState((current) => ({ periodId: loadedId, token, rows: mergeBatchBillingDrafts(records, current.periodId === loadedId && current.token === token ? current.rows : {}) }));
      setSelection((current) => ({ periodId: loadedId, token, ids: current.periodId === loadedId && current.token === token
        ? current.ids.filter((id) => records.some((record) => record.applicantId === id && !batchBillingBlocker(record, loadedId))) : [] }));
      if (!periodId) setPeriodId(loadedId);
    } catch (failure) {
      if (scopeRef.current === scope && requestRef.current === requestId && !signal?.aborted) setData((current) => ({ ...current, periodId, token, records: current.periodId === periodId && current.token === token ? current.records : [], loading: false, error: failure.message || 'Unable to load Scholar grant records.' }));
    }
  }, [periodId, token]);

  useEffect(() => {
    const controller = new AbortController();
    loadRecords({ signal: controller.signal });
    return () => { controller.abort(); requestRef.current += 1; };
  }, [loadRecords]);

  const currentData = data.periodId === periodId && data.token === token;
  const records = currentData ? data.records : [];
  const drafts = draftState.periodId === periodId && draftState.token === token ? draftState.rows : {};
  const selectedIds = selection.periodId === periodId && selection.token === token ? selection.ids : [];
  const savedIds = saved.periodId === periodId && saved.token === token ? saved.ids : [];
  const currentNotice = notice?.periodId === periodId && notice?.token === token ? notice : null;
  const loadError = currentData ? data.error : '';
  const currentPeriod = data.periods.find((period) => String(period.id) === periodId);
  const schoolYears = [...new Set(data.periods.map((period) => period.schoolYear))];
  const schools = [...new Set(records.map((record) => record.school).filter(Boolean))].sort();
  const filtered = useMemo(() => records.filter((record) => `${record.name} ${record.controlNumber || ''} ${record.school}`.toLowerCase().includes(query.trim().toLowerCase()) && (school === 'All schools' || record.school === school)), [records, query, school]);
  const busy = saving || openingBilling;
  const controlsDisabled = busy || data.loading || !currentData || Boolean(data.error);
  const visibleSelectable = filtered.filter((record) => !batchBillingBlocker(record, periodId) && !savedIds.includes(record.applicantId));
  const selectedRecords = records.filter((record) => selectedIds.includes(record.applicantId));
  const showNotice = (value) => setNotice(value ? { ...value, periodId, token } : null);

  const changePeriod = (nextId) => {
    if (actionRef.current || nextId === periodId) return;
    requestRef.current += 1;
    setPeriodId(nextId); setQuery(''); setSchool('All schools'); showNotice(null);
  };
  const selectRows = (ids) => {
    if (controlsDisabled || actionRef.current) return;
    const next = [...new Set(ids)];
    if (next.length > MAX_BATCH_GRANT_ROWS) { showNotice({ tone: 'warning', text: `Select up to ${MAX_BATCH_GRANT_ROWS} Scholars per save.` }); return; }
    setSelection({ periodId, token, ids: next });
  };
  const editTuition = (record, tuition) => {
    if (controlsDisabled || actionRef.current || savedIds.includes(record.applicantId) || batchBillingBlocker(record, periodId)) return;
    setDraftState((current) => ({ periodId, token, rows: { ...(current.periodId === periodId && current.token === token ? current.rows : {}), [record.applicantId]: { ...(drafts[record.applicantId] || batchBillingDraft(record)), tuition, dirty: true, error: '' } } }));
  };
  const resetDraft = (record) => {
    if (controlsDisabled || actionRef.current || savedIds.includes(record.applicantId)) return;
    setDraftState((current) => ({ ...current, rows: { ...current.rows, [record.applicantId]: batchBillingDraft(record) } }));
  };
  const handoffSavedRows = async (ids, scope) => {
    if (!ids.length || scopeRef.current !== scope) return;
    try {
      const opened = await onAddedToBilling?.({ periodId: Number(scope.periodId), applicantIds: ids });
      if (scopeRef.current === scope && (!onAddedToBilling || opened === false)) showNotice({ tone: 'warning', text: `${ids.length} prepared record(s) remain saved. Open Billing from the sidebar or retry Open Billing to queue them.` });
    } catch (failure) {
      if (scopeRef.current === scope) showNotice({ tone: 'warning', text: `${ids.length} prepared record(s) remain saved. Unable to open Billing: ${failure.message || 'Please retry.'}` });
    }
  };
  const openBilling = async () => {
    if (actionRef.current || controlsDisabled || !savedIds.length) return;
    const scope = scopeRef.current, action = {};
    actionRef.current = action; setOpeningBilling(true);
    try { await handoffSavedRows(savedIds, scope); }
    finally { if (actionRef.current === action) { actionRef.current = null; if (scopeRef.current) setOpeningBilling(false); } }
  };
  const saveBatch = async (event) => {
    event?.preventDefault();
    if (actionRef.current || controlsDisabled || !selectedIds.length) return;
    const prepared = buildBatchBillingEntries(records, drafts, selectedIds, periodId);
    if (prepared.message) {
      setDraftState((current) => ({ ...current, rows: Object.fromEntries(Object.entries(current.rows).map(([id, draft]) => [id, { ...draft, error: prepared.errors[id] || draft.error }])) }));
      showNotice({ tone: 'error', text: prepared.message }); return;
    }
    const scope = scopeRef.current, action = {};
    actionRef.current = action; setSaving(true); showNotice(null);
    try {
      const response = await fetch(`${API_BASE}/scholars/grant-preparation/batch`, {
        method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicPeriodId: Number(periodId), entries: prepared.entries }),
      });
      const body = await response.json();
      if (scopeRef.current !== scope) return;
      if (!response.ok) throw new Error(body.message || 'Unable to save the selected grant records.');
      const results = readBatchBillingResults(body, prepared.entries.map((entry) => entry.applicantId));
      const successful = results.filter((result) => result.success), failed = results.filter((result) => !result.success);
      const successes = new Map(successful.map((result) => [result.applicantId, result.grant]));
      const nextSavedIds = [...new Set([...savedIds, ...successes.keys()])];
      // Reads started before saving cannot replace the new preparation snapshots.
      requestRef.current += 1;
      setData((current) => ({ ...current, loading: false, records: current.records.map((record) => successes.has(record.applicantId) ? { ...record, ...successes.get(record.applicantId), preparationStatus: 'Prepared', processEligible: true, billingEligibilityReasons: [] } : record) }));
      setDraftState((current) => ({ ...current, rows: { ...current.rows, ...Object.fromEntries(results.map((result) => [result.applicantId,
        result.success ? batchBillingDraft(result.grant) : { ...current.rows[result.applicantId], dirty: true, error: result.message },
      ])) } }));
      setSelection({ periodId, token, ids: selectedIds.filter((id) => !successes.has(id)) });
      setSaved({ periodId, token, ids: nextSavedIds });
      showNotice({ tone: successful.length ? failed.length ? 'warning' : 'success' : 'error', text: `${successful.length} record(s) saved for Billing.${failed.length ? ` ${failed.length} need attention. Correct the failed rows and retry; saved rows will not be sent again.` : ' The official certification list is generated in Billing.'}` });
      if (!failed.length && successful.length) await handoffSavedRows(nextSavedIds, scope);
    } catch (failure) {
      if (scopeRef.current === scope) showNotice({ tone: 'error', text: failure.message || 'Unable to confirm the save. Refresh the records before retrying.' });
    } finally {
      if (actionRef.current === action) { actionRef.current = null; if (scopeRef.current) setSaving(false); }
    }
  };

  return <section className="batch-scholar-billing" aria-label="Batch Scholar Billing preparation" aria-busy={data.loading || busy}>
    <header className="batch-billing-heading"><div><span className="batch-billing-eyebrow">PRIVATE GRANT PREPARATION</span><h3>Prepare multiple Scholars for Billing</h3><p>Select Scholars and enter each tuition assistance amount. Allowance is computed separately for every Scholar.</p></div><button type="button" onClick={() => loadRecords()} disabled={busy || data.loading}><RefreshCw size={15} />Refresh records</button></header>
    <div className="batch-billing-controls">
      <label><span>Academic Year</span><select value={currentPeriod?.schoolYear || ''} disabled={busy || data.loading || !data.periods.length} onChange={(event) => { const choices = data.periods.filter((period) => period.schoolYear === event.target.value); changePeriod(String((choices.find((period) => period.semester === currentPeriod?.semester) || choices[0])?.id || '')); }}><option value="" disabled>Select academic year</option>{schoolYears.map((year) => <option key={year}>{year}</option>)}</select></label>
      <label><span>Semester</span><select value={periodId} disabled={busy || data.loading || !currentPeriod} onChange={(event) => changePeriod(event.target.value)}><option value="" disabled>Select semester</option>{data.periods.filter((period) => period.schoolYear === currentPeriod?.schoolYear).map((period) => <option key={period.id} value={period.id}>{period.semester}{period.isPrimary ? ' (Primary)' : ''}</option>)}</select></label>
      <label className="batch-billing-search"><span>Search Scholars</span><div><Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, control number or school" disabled={busy} /></div></label>
      <label><span>School</span><select value={school} onChange={(event) => setSchool(event.target.value)} disabled={busy}><option>All schools</option>{schools.map((name) => <option key={name}>{name}</option>)}</select></label>
    </div>
    <p className="batch-billing-guidance">This view includes Private Scholars assigned to Billing. Initial or redirected Private Scholars are prepared in Payroll. Listed records are locked. Enter 0 explicitly when no tuition assistance applies.</p>
    {loadError && <Notification tone="error" title="Unable to load grant records">{loadError}</Notification>}
    {currentNotice && <Notification tone={currentNotice.tone} title={currentNotice.tone === 'error' ? 'Grant preparation needs attention' : 'Batch preparation update'}>{currentNotice.text}</Notification>}
    <form onSubmit={saveBatch} noValidate>
      <div className="batch-billing-selection"><span><strong>{selectedIds.length}</strong> selected · {filtered.length} shown · up to {MAX_BATCH_GRANT_ROWS} per save</span><div><button type="button" onClick={() => selectRows([...selectedIds, ...visibleSelectable.map((record) => record.applicantId)].slice(0, MAX_BATCH_GRANT_ROWS))} disabled={controlsDisabled || !visibleSelectable.length}>Select visible</button><button type="button" onClick={() => selectRows([])} disabled={controlsDisabled || !selectedIds.length}>Clear selection</button></div></div>
      <div className="batch-billing-table-wrap"><table className="batch-billing-table"><caption className="batch-billing-sr-only">Private Scholar grant amounts for the selected academic year and semester</caption><thead><tr><th scope="col">Select</th><th scope="col">Scholar</th><th scope="col">Total Grant (PHP)</th><th scope="col">Tuition Assistance (PHP)</th><th scope="col">Allowance (PHP)</th><th scope="col">Receipt / status</th></tr></thead><tbody>
        {(!currentData || data.loading) && !records.length ? <tr><td colSpan={6} className="batch-billing-empty">Loading Scholar records…</td></tr> : !filtered.length && <tr><td colSpan={6} className="batch-billing-empty">{loadError ? 'Records are unavailable. Refresh to retry.' : 'No Private Scholars assigned to Billing match this selection.'}</td></tr>}
        {filtered.map((record) => {
          const blocker = batchBillingBlocker(record, periodId), draft = drafts[record.applicantId] || batchBillingDraft(record), amount = batchBillingAmount(record, draft.tuition), rowSaved = savedIds.includes(record.applicantId);
          const disabled = controlsDisabled || Boolean(blocker) || rowSaved;
          const inputId = `batch-billing-tuition-${record.applicantId}`, helpId = `${inputId}-help`;
          return <tr key={`${periodId}:${record.applicantId}`} className={rowSaved ? 'is-saved' : blocker ? 'is-locked' : ''}>
            <td data-label="Select"><input type="checkbox" aria-label={`Select ${record.name} for Billing preparation`} checked={selectedIds.includes(record.applicantId)} disabled={disabled} onChange={() => selectRows(selectedIds.includes(record.applicantId) ? selectedIds.filter((id) => id !== record.applicantId) : [...selectedIds, record.applicantId])} /></td>
            <td data-label="Scholar"><strong className="batch-billing-name">{record.name}</strong><span className="batch-billing-secondary">{record.controlNumber || record.scholarId}</span><span className="batch-billing-secondary">{record.school}</span></td>
            <td data-label="Total Grant"><output aria-label={`Total grant for ${record.name}`}>{money(amount.total)}</output></td>
            <td data-label="Tuition Assistance"><label className="batch-billing-sr-only" htmlFor={inputId}>Tuition assistance for {record.name}</label><input id={inputId} type="number" min="0" max={amount.total} step="0.01" value={draft.tuition} disabled={disabled} onChange={(event) => editTuition(record, event.target.value)} aria-describedby={helpId} aria-invalid={Boolean(draft.error || draft.dirty && !amount.valid)} /><small id={helpId} className={draft.error ? 'batch-billing-row-error' : 'batch-billing-secondary'}>{draft.error || `PHP 0–${money(amount.total)}`}</small>{(draft.dirty || draft.error) && !rowSaved && !blocker && <button className="batch-billing-reset" type="button" disabled={controlsDisabled} onClick={() => resetDraft(record)}>Use saved values</button>}</td>
            <td data-label="Allowance"><output aria-label={`Computed allowance for ${record.name}`}>{amount.allowance == null ? '—' : money(amount.allowance)}</output></td>
            <td data-label="Receipt / status"><DocumentViewButton key={`${periodId}:${record.applicantId}`} token={token} endpoint={`/scholars/${record.applicantId}/tuition-receipt?academicPeriodId=${periodId}`} label={`Tuition receipt · ${record.name} · ${currentPeriod?.schoolYear || ''} · ${currentPeriod?.semester || ''}`} buttonLabel="View receipt" disabled={controlsDisabled} /><span className={`batch-billing-status${rowSaved ? ' saved' : blocker ? ' locked' : ''}`}>{rowSaved ? 'Saved for Billing' : blocker || (record.grantPrepared ? 'Prepared · editable' : 'Not prepared')}</span>{record.processingWarnings?.length > 0 && <span className="batch-billing-secondary">Requirements incomplete; preparation remains available.</span>}</td>
          </tr>;
        })}
      </tbody></table></div>
      <footer className="batch-billing-footer"><div><strong>{selectedIds.length} selected Scholar{selectedIds.length === 1 ? '' : 's'}</strong><span>Total selected grants: PHP {money(selectedRecords.reduce((sum, record) => sum + Math.round(Number(record.totalGrant ?? record.claimAmount ?? 5000) * 100), 0) / 100)}</span><small>Saving prepares each grant. Generate the official certification list in Billing.</small></div><div className="batch-billing-footer-actions">{savedIds.length > 0 && <button type="button" onClick={openBilling} disabled={controlsDisabled}><ArrowRight size={15} />{openingBilling ? 'Opening Billing…' : `Open Billing (${savedIds.length} saved)`}</button>}<button type="submit" className="batch-billing-primary" disabled={controlsDisabled || !selectedIds.length}><Save size={15} />{saving ? 'Saving selected records…' : 'Save & Add to Billing'}</button></div></footer>
    </form>
  </section>;
}
