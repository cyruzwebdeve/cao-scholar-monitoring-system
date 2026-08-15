import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ApplicationForm from './components/ApplicationForm';
import { API_BASE } from './services/api';

function ApplicationPage({ token, user }) {
  const [step, setStep] = useState(0);
  const [activePeriod, setActivePeriod] = useState({ schoolYear: '2026-2027', semester: '1st Semester' });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/academic-periods/active`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => { if (active && body?.period) setActivePeriod(body.period); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const handleCreated = (createdScholar) => {
    if (createdScholar) {
      setStep(0);
    }
  };

  return (
    <div className="application-page-shell">
      <header className="application-page-header">
        <div className="application-page-header-inner">
          <div className="application-brand">
            <div className="application-brand-mark" aria-hidden="true">
              <GraduationCap />
            </div>
            <div className="application-brand-copy">
              <p className="application-brand-kicker">LOCAL GOVERNMENT UNIT</p>
              <h1>Scholarship Monitoring System</h1>
            </div>
          </div>

          <div className="application-page-pill">
            <span className="application-page-pill-dot" aria-hidden="true" />
            <span>Application Form · {activePeriod.schoolYear} · {activePeriod.semester}</span>
          </div>
        </div>
      </header>

      <main className="application-stage">
        <ApplicationForm
          token={token}
          user={user}
          onCreated={handleCreated}
          onGoToLogin={() => navigate('/login')}
          step={step}
          setStep={setStep}
        />
      </main>

      <footer className="application-page-footer">
            Scholarship Monitoring System · All information is kept strictly confidential · A.Y. {activePeriod.schoolYear}
      </footer>
    </div>
  );
}

export default ApplicationPage;
