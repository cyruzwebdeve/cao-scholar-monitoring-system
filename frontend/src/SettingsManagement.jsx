import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CalendarRange,
  Check,
  Monitor,
  Power,
  Plus,
  RotateCcw,
  Save,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';

const emptyPeriodForm = { schoolYear: '', semester: '1st Semester', startDate: '', endDate: '' };
const emptyAvailability = { isEnabled: true, opensAt: '', closesAt: '', state: 'open', isOpen: true };

const toPhilippineDateTimeInput = (value) => {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};

const philippineDateTimeToIso = (value) => {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, Number(minute))).toISOString();
};

const formatApplicationDateTime = (value) => value
  ? new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
  : 'No schedule set';

const formatPeriodDate = (value) => {
  if (!value) return 'Date not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const getNextSchoolYear = (schoolYear) => {
  const match = /^(\d{4})-(\d{4})$/.exec(String(schoolYear || ''));
  return match ? `${Number(match[1]) + 1}-${Number(match[2]) + 1}` : '';
};

export default function SettingsManagement({ token, user }) {
  const [mode, setMode] = useState(() => localStorage.getItem('examDeliveryMode') || 'online');
  const [saved, setSaved] = useState(false);
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodError, setPeriodError] = useState('');
  const [periodNotice, setPeriodNotice] = useState('');
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState(emptyPeriodForm);
  const [savingPeriod, setSavingPeriod] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(null);
  const [activatingPeriod, setActivatingPeriod] = useState(false);
  const [availability, setAvailability] = useState(emptyAvailability);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const canManagePeriods = ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'].includes(user?.role);
  const canManageApplications = ['SuperAdmin', 'RegularAdmin'].includes(user?.role);
  const activePeriod = periods.find((period) => period.isActive) || null;

  const loadPeriods = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/academic-periods`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load academic periods.');
      setPeriods(body.periods || []);
      setPeriodError('');
    } catch (error) {
      setPeriodError(error.message || 'Unable to load academic periods.');
    } finally {
      setPeriodsLoading(false);
    }
  }, [token]);

  const loadAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    try {
      const response = await fetch(`${API_BASE}/application-settings`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load application availability.');
      setAvailability({
        ...body.availability,
        opensAt: toPhilippineDateTimeInput(body.availability?.opensAt),
        closesAt: toPhilippineDateTimeInput(body.availability?.closesAt),
      });
      setAvailabilityError('');
    } catch (error) {
      setAvailabilityError(error.message || 'Unable to load application availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadPeriods, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadPeriods]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadAvailability, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadAvailability]);

  useEffect(() => {
    if (!pendingActivation) return undefined;
    const closeDialog = (event) => {
      if (event.key === 'Escape' && !activatingPeriod) setPendingActivation(null);
    };
    window.addEventListener('keydown', closeDialog);
    return () => window.removeEventListener('keydown', closeDialog);
  }, [activatingPeriod, pendingActivation]);

  const saveExamMode = () => {
    localStorage.setItem('examDeliveryMode', mode);
    window.dispatchEvent(new Event('exam-mode-changed'));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const openPeriodForm = () => {
    setPeriodForm({ ...emptyPeriodForm, schoolYear: getNextSchoolYear(activePeriod?.schoolYear) });
    setPeriodError('');
    setPeriodNotice('');
    setPeriodFormOpen(true);
  };

  const createPeriod = async (event) => {
    event.preventDefault();
    if (savingPeriod) return;
    setSavingPeriod(true);
    setPeriodError('');
    setPeriodNotice('');
    try {
      const response = await fetch(`${API_BASE}/academic-periods`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(periodForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to create the academic period.');
      setPeriodFormOpen(false);
      setPeriodNotice(body.message || 'Academic period created.');
      await loadPeriods();
    } catch (error) {
      setPeriodError(error.message || 'Unable to create the academic period.');
    } finally {
      setSavingPeriod(false);
    }
  };

  const activatePeriod = async () => {
    if (!pendingActivation || activatingPeriod) return;
    setActivatingPeriod(true);
    setPeriodError('');
    setPeriodNotice('');
    try {
      const response = await fetch(`${API_BASE}/academic-periods/${pendingActivation.id}/activate`, {
        method: 'PUT',
        headers: authHeaders(token),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to activate the academic period.');
      setPendingActivation(null);
      setPeriodNotice(body.message);
      await loadPeriods();
      window.dispatchEvent(new CustomEvent('academic-period-changed', { detail: body.period }));
    } catch (error) {
      setPeriodError(error.message || 'Unable to activate the academic period.');
      setPendingActivation(null);
    } finally {
      setActivatingPeriod(false);
    }
  };

  const saveAvailability = async (event) => {
    event.preventDefault();
    if (!canManageApplications || availabilitySaving) return;
    if ((availability.opensAt && !availability.closesAt) || (!availability.opensAt && availability.closesAt)) {
      setAvailabilityError('Set both the opening and closing time, or clear both fields.');
      return;
    }

    setAvailabilitySaving(true);
    setAvailabilityError('');
    setAvailabilityNotice('');
    try {
      const response = await fetch(`${API_BASE}/application-settings`, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isEnabled: availability.isEnabled,
          opensAt: philippineDateTimeToIso(availability.opensAt),
          closesAt: philippineDateTimeToIso(availability.closesAt),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update application availability.');
      setAvailability({
        ...body.availability,
        opensAt: toPhilippineDateTimeInput(body.availability?.opensAt),
        closesAt: toPhilippineDateTimeInput(body.availability?.closesAt),
      });
      setAvailabilityNotice(body.message || 'Application availability updated.');
      window.dispatchEvent(new CustomEvent('application-availability-changed', { detail: body.availability }));
    } catch (error) {
      setAvailabilityError(error.message || 'Unable to update application availability.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const clearApplicationSchedule = () => {
    setAvailability((current) => ({ ...current, opensAt: '', closesAt: '' }));
    setAvailabilityError('');
    setAvailabilityNotice('');
  };

  return (
    <div className="settings-management">
      <div className="settings-heading">
        <div><span className="settings-page-eyebrow">SYSTEM CONFIGURATION</span><h2>Settings</h2><p>Configure academic periods, examinations, and scholarship portal preferences.</p></div>
        {saved && <span className="settings-saved"><Check size={14} /> Settings saved</span>}
      </div>

      <section className="settings-card settings-application-card">
        <div className="settings-card-heading">
          <div><span className="settings-eyebrow">APPLICATION AVAILABILITY</span><h3>Application form access</h3><p>Open or close new submissions immediately, or limit them to a scheduled window.</p></div>
          <Power size={24} />
        </div>

        {availabilityError && <div className="settings-period-message error" role="status"><TriangleAlert size={15} /><span>{availabilityError}</span><button type="button" onClick={loadAvailability}>Retry</button></div>}
        {availabilityNotice && <div className="settings-period-message success" role="status"><Check size={15} /><span>{availabilityNotice}</span></div>}

        <form className="settings-availability-form" onSubmit={saveAvailability}>
          <div className={`settings-availability-status ${availability.isOpen ? 'open' : availability.state || 'disabled'}`}>
            <span className="settings-availability-status-icon"><Power size={18} /></span>
            <div>
              <small>CURRENT APPLICATION STATUS</small>
              <strong>{availabilityLoading ? 'Checking status…' : availability.isOpen ? 'Applications are open' : availability.state === 'scheduled' ? 'Opening is scheduled' : availability.state === 'ended' ? 'Application period ended' : 'Applications are closed'}</strong>
              <span>{availabilityLoading ? 'Retrieving the live portal setting.' : availability.isOpen ? 'Applicants can complete and submit the form.' : 'New application submissions are blocked by the server.'}</span>
            </div>
            <label className="settings-availability-switch">
              <input type="checkbox" checked={availability.isEnabled} disabled={!canManageApplications || availabilityLoading || availabilitySaving} onChange={(event) => setAvailability((current) => ({ ...current, isEnabled: event.target.checked }))} />
              <span aria-hidden="true" />
              <b>{availability.isEnabled ? 'Enabled' : 'Disabled'}</b>
            </label>
          </div>

          <div className="settings-availability-window">
            <div className="settings-availability-window-heading"><span><CalendarClock size={17} /></span><div><strong>Active date and time range</strong><small>Optional · Philippine Standard Time (UTC+8)</small></div></div>
            <div className="settings-availability-fields">
              <label><span>Opens on</span><input type="datetime-local" value={availability.opensAt} disabled={!canManageApplications || availabilityLoading || availabilitySaving} onChange={(event) => setAvailability((current) => ({ ...current, opensAt: event.target.value }))} /></label>
              <label><span>Closes on</span><input type="datetime-local" value={availability.closesAt} min={availability.opensAt || undefined} disabled={!canManageApplications || availabilityLoading || availabilitySaving} onChange={(event) => setAvailability((current) => ({ ...current, closesAt: event.target.value }))} /></label>
            </div>
            {(availability.opensAt || availability.closesAt) && <p className="settings-availability-summary">Scheduled window: <strong>{availability.opensAt ? formatApplicationDateTime(philippineDateTimeToIso(availability.opensAt)) : 'Not set'}</strong> to <strong>{availability.closesAt ? formatApplicationDateTime(philippineDateTimeToIso(availability.closesAt)) : 'Not set'}</strong></p>}
          </div>

          {canManageApplications ? (
            <div className="settings-availability-actions">
              <button type="button" className="secondary" disabled={availabilitySaving || (!availability.opensAt && !availability.closesAt)} onClick={clearApplicationSchedule}><RotateCcw size={14} />Clear schedule</button>
              <button type="submit" disabled={availabilityLoading || availabilitySaving}><Save size={14} />{availabilitySaving ? 'Saving…' : 'Save application setting'}</button>
            </div>
          ) : <p className="settings-availability-readonly">Only Super Administrators and Administrators can change application availability.</p>}
        </form>
      </section>

      <section className="settings-card settings-period-card">
        <div className="settings-card-heading">
          <div><span className="settings-eyebrow">ACADEMIC PERIODS</span><h3>School year and semester</h3><p>Control the active cycle used by applications, billing, payroll, and reports.</p></div>
          <CalendarRange size={24} />
        </div>

        {periodError && <div className="settings-period-message error" role="status"><TriangleAlert size={15} /><span>{periodError}</span><button type="button" onClick={loadPeriods}>Retry</button></div>}
        {periodNotice && <div className="settings-period-message success" role="status"><Check size={15} /><span>{periodNotice}</span></div>}

        <div className="settings-active-period">
          <div className="settings-active-period-icon"><CalendarRange size={21} /></div>
          <div><span>ACTIVE ACADEMIC PERIOD</span><strong>{periodsLoading ? 'Loading…' : activePeriod ? `${activePeriod.schoolYear} · ${activePeriod.semester}` : 'No active period'}</strong><small>{activePeriod ? `${formatPeriodDate(activePeriod.startDate)} – ${formatPeriodDate(activePeriod.endDate)}` : 'Create and activate a period before processing new records.'}</small></div>
          {activePeriod && <em>Current</em>}
        </div>

        <div className="settings-period-toolbar">
          <div><strong>Period history</strong><span>Previous cycles remain available as archived billing and payroll data.</span></div>
          {canManagePeriods && <button type="button" onClick={openPeriodForm}><Plus size={14} />New period</button>}
        </div>

        {periodFormOpen && (
          <form className="settings-period-form" onSubmit={createPeriod}>
            <div className="settings-period-form-heading"><div><strong>Create academic period</strong><span>Add the period first, then activate it when the rollover is ready.</span></div><button type="button" onClick={() => setPeriodFormOpen(false)} aria-label="Close academic period form"><X size={16} /></button></div>
            <div className="settings-period-form-grid">
              <label><span>School year</span><input required value={periodForm.schoolYear} onChange={(event) => setPeriodForm((current) => ({ ...current, schoolYear: event.target.value }))} placeholder="2027-2028" pattern="\d{4}-\d{4}" /></label>
              <label><span>Semester</span><select value={periodForm.semester} onChange={(event) => setPeriodForm((current) => ({ ...current, semester: event.target.value }))}><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select></label>
              <label><span>Start date <small>(optional)</small></span><input type="date" value={periodForm.startDate} onChange={(event) => setPeriodForm((current) => ({ ...current, startDate: event.target.value }))} /></label>
              <label><span>End date <small>(optional)</small></span><input type="date" value={periodForm.endDate} onChange={(event) => setPeriodForm((current) => ({ ...current, endDate: event.target.value }))} /></label>
            </div>
            <div className="settings-period-form-actions"><button type="button" onClick={() => setPeriodFormOpen(false)}>Cancel</button><button type="submit" disabled={savingPeriod}><Save size={14} />{savingPeriod ? 'Creating…' : 'Create period'}</button></div>
          </form>
        )}

        <div className="settings-period-list">
          {periods.map((period) => (
            <article key={period.id} className={period.isActive ? 'active' : ''}>
              <div><strong>{period.schoolYear}</strong><span>{period.semester}</span></div>
              <div><span>{formatPeriodDate(period.startDate)} – {formatPeriodDate(period.endDate)}</span><small className={period.status}>{period.status}</small></div>
              {period.isActive
                ? <em><Check size={12} />Active</em>
                : canManagePeriods && <button type="button" onClick={() => setPendingActivation(period)}>Activate</button>}
            </article>
          ))}
          {!periodsLoading && !periods.length && <div className="settings-period-empty">No academic periods have been created.</div>}
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading"><div><span className="settings-eyebrow">EXAMINATION SETTINGS</span><h3>Exam delivery mode</h3><p>Choose how applicants will take the qualifying examination for the active academic period.</p></div><Monitor size={24} /></div>
        <div className="settings-mode-grid"><button className={mode === 'online' ? 'selected' : ''} onClick={() => setMode('online')}><Monitor size={25} /><span><b>Online Examination</b><small>Applicants answer remotely through the Applicant Dashboard.</small></span>{mode === 'online' && <Check className="settings-check" size={18} />}</button><button className={mode === 'face-to-face' ? 'selected' : ''} onClick={() => setMode('face-to-face')}><UsersRound size={25} /><span><b>Face-to-Face Examination</b><small>Applicants attend the assigned examination venue.</small></span>{mode === 'face-to-face' && <Check className="settings-check" size={18} />}</button></div>
        <button className="settings-save" onClick={saveExamMode}><Save size={15} /> Save examination setting</button>
      </section>

      {pendingActivation && (
        <div className="admin-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !activatingPeriod) setPendingActivation(null); }}>
          <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="activate-period-title" aria-describedby="activate-period-description">
            <div className="admin-confirm-icon warning"><TriangleAlert size={24} /></div>
            <div className="admin-confirm-copy"><span>ACADEMIC PERIOD ROLLOVER</span><h3 id="activate-period-title">Activate {pendingActivation.schoolYear} · {pendingActivation.semester}?</h3><p id="activate-period-description">The current period will be archived. Active scholars will start this period as not billed and not paid, while all previous billing and payroll records remain available as history.</p></div>
            <div className="admin-confirm-actions"><button type="button" className="cancel" disabled={activatingPeriod} onClick={() => setPendingActivation(null)}>Keep current period</button><button type="button" className="danger settings-activate-confirm" disabled={activatingPeriod} onClick={activatePeriod}><CalendarRange size={15} />{activatingPeriod ? 'Activating…' : 'Activate period'}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
