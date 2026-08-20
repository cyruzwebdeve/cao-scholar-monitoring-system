import caologo from '../assets/caologo-96.webp';
import caologoLarge from '../assets/caologo-512.webp';
import caologoLarge2x from '../assets/caologo-1024.webp';
import '../styles/login.css';

function AuthPageShell({ children }) {
  return (
    <div className="login-page">
      <div className="login-backdrop-seal" aria-hidden="true" />
      <img
        src={caologoLarge}
        srcSet={`${caologo} 96w, ${caologoLarge} 512w, ${caologoLarge2x} 1024w`}
        sizes="(max-width: 500px) 1px, (max-width: 900px) 92vw, 1200px"
        width="1024"
        height="1024"
        fetchPriority="high"
        alt=""
        className="login-large-logo"
        aria-hidden="true"
      />
      <section className="login-intro">
        <div className="login-intro-topline">
          <img src={caologo} width="96" height="96" alt="" className="login-logo" />
          <div>
            <span className="login-kicker">Province of Camarines Norte</span>
            <strong>Community Affairs Office</strong>
          </div>
        </div>
        <div className="login-intro-copy">
          <p className="login-eyebrow">PGCEAP • Scholarship Management System</p>
          <h1>Opening doors to brighter futures.</h1>
          <p>Track your scholarship journey from one secure portal built for applicants and scholars.</p>
        </div>
        <div className="login-intro-footer"><span className="login-footer-dot" /> Secure access for the PGCEAP community</div>
      </section>

      <section className="login-card">
        <div className="login-card-brand">
          <img src={caologo} width="96" height="96" alt="Community Affairs Office seal" />
          <span>PGCEAP PORTAL</span>
        </div>
        {children}
      </section>
    </div>
  );
}

export default AuthPageShell;
