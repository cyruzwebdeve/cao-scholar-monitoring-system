import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CircleOff, GraduationCap, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ApplicationForm from './components/ApplicationForm';
import { API_BASE } from './services/api';
import './styles/application.css';
import './styles/application-responsive.css';

function ApplicationPage({ token, user }) {
  const [step, setStep] = useState(0);
  const [activePeriod, setActivePeriod] = useState({ schoolYear: '2026-2027', semester: '1st Semester' });
  const [availability, setAvailability] = useState(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const navigate = useNavigate();

  const loadAvailability = useCallback(async () => {
    setAvailabilityLoading(true);
    try {
      const response = await fetch(`${API_BASE}/application-settings`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to check application availability.');
      setAvailability(body.availability);
      setAvailabilityError('');
    } catch (error) {
      setAvailabilityError(error.message || 'Unable to check application availability.');
    } finally {
      setAvailabilityLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/academic-periods/active`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active && body?.period) setActivePeriod(body.period); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadAvailability, 0);
    const interval = window.setInterval(loadAvailability, 30000);
    const refreshFromSettings = () => loadAvailability();
    window.addEventListener('application-availability-changed', refreshFromSettings);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener('application-availability-changed', refreshFromSettings);
    };
  }, [loadAvailability]);

  const handleCreated = (createdScholar) => {
    if (createdScholar) setStep(0);
  };

  const formatSchedule = (value) => value
    ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
    : '';

  const renderApplicationContent = () => {
    if (availabilityLoading && !availability) {
      return (
        <section className="application-availability-panel loading" aria-live="polite">
          <RefreshCw className="application-availability-spinner" />
          <h2>Checking application availability</h2>
          <p>Please wait while we confirm whether submissions are open.</p>
        </section>
      );
    }

    if (availabilityError && !availability) {
      return (
        <section className="application-availability-panel error" role="alert">
          <CircleOff />
          <h2>Application status unavailable</h2>
          <p>{availabilityError} Please retry before completing the form.</p>
          <button type="button" onClick={loadAvailability}><RefreshCw size={16} />Try again</button>
        </section>
      );
    }

    if (availability && !availability.isOpen) {
      const title = availability.state === 'scheduled'
        ? 'Applications open soon'
        : availability.state === 'ended'
          ? 'Application period has ended'
          : 'Applications are currently closed';
      return (
        <section className={`application-availability-panel ${availability.state}`} aria-live="polite">
          <span className="application-availability-icon"><CircleOff /></span>
          <p className="application-availability-eyebrow">PGCEAP APPLICATION NOTICE</p>
          <h2>{title}</h2>
          <p>{availability.message}</p>
          {(availability.opensAt || availability.closesAt) && (
            <div className="application-availability-schedule">
              <CalendarClock size={20} />
              <div>
                {availability.opensAt && <span><small>OPENS</small><strong>{formatSchedule(availability.opensAt)}</strong></span>}
                {availability.closesAt && <span><small>CLOSES</small><strong>{formatSchedule(availability.closesAt)}</strong></span>}
              </div>
            </div>
          )}
          <small className="application-availability-timezone">All schedule times use Philippine Standard Time (UTC+8).</small>
          <button type="button" onClick={() => navigate('/login')}>Go to applicant portal</button>
        </section>
      );
    }

    return (
      <ApplicationForm
        token={token}
        user={user}
        onCreated={handleCreated}
        onGoToLogin={() => navigate('/login')}
        step={step}
        setStep={setStep}
      />
    );
  };

  return (
    <div className="application-page-shell">
      <header className="application-page-header">
        <div className="application-page-header-inner">
          <div className="application-brand">
            <div className="application-brand-mark" aria-hidden="true"><GraduationCap /></div>
            <div className="application-brand-copy">
              <p className="application-brand-kicker">LOCAL GOVERNMENT UNIT</p>
              <h1>Scholarship Monitoring System</h1>
            </div>
          </div>

          <div className="application-page-pill">
            <span className={`application-page-pill-dot${availability && !availability.isOpen ? ' closed' : ''}`} aria-hidden="true" />
            <span>{availability && !availability.isOpen ? 'Applications Closed' : 'Application Form'} · {activePeriod.schoolYear} · {activePeriod.semester}</span>
          </div>
        </div>
      </header>

      <main className="application-stage">{renderApplicationContent()}</main>

      <footer className="application-page-footer">
        Scholarship Monitoring System · All information is kept strictly confidential · A.Y. {activePeriod.schoolYear}
      </footer>
    </div>
  );
}

export default ApplicationPage;
