import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import LoginForm from './components/LoginForm';
import caologo from './assets/caologo.jpg';

function LoginPage({ token, user, onLogin }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) {
      navigate(user.role === 'Scholar' ? '/scholar-dashboard' : user.role === 'Applicant' ? '/applicant-dashboard' : '/dashboard', { replace: true });
    }
  }, [token, user, navigate]);

  return (
    <div className="login-page">
      <div className="login-backdrop-seal" aria-hidden="true" />
      <img src={caologo} alt="" className="login-large-logo" aria-hidden="true" />
      <section className="login-intro">
        <div className="login-intro-topline">
          <img src={caologo} alt="" className="login-logo" />
          <div>
            <span className="login-kicker">Province of Camarines Norte</span>
            <strong>Community Affairs Office</strong>
          </div>
        </div>
        <div className="login-intro-copy">
          <p className="login-eyebrow">PGCEAP • Scholarship Management System</p>
          <h1>Opening doors to brighter futures.</h1>
          <p>Track your scholarship journey from one secure portal built for applicants, scholars.</p>
        </div>
        <div className="login-intro-footer"><span className="login-footer-dot" /> Secure access for the PGCEAP community</div>
      </section>

      <section className="login-card">
        <div className="login-card-brand">
          <img src={caologo} alt="Community Affairs Office seal" />
          <span>PGCEAP PORTAL</span>
        </div>
        <div className="login-card-header">
          <h2>Welcome back</h2>
          <p>Track your scholarship application and progress.</p>
        </div>
        <LoginForm onLogin={onLogin} />
        <p className="login-security-note"><ShieldCheck size={15} /> Your information is protected and kept confidential.</p>
      </section>
    </div>
  );
}

export default LoginPage;