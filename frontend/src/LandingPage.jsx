import {
  ArrowRight,
  BellRing,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  GraduationCap,
  LockKeyhole,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import caologo from './assets/caologo-96.webp';
import caologoLarge from './assets/caologo-400.webp';
import communityPhoto from './assets/landing-community-720.webp';
import communityPhotoLarge from './assets/landing-community-1200.webp';
import './styles/landing.css';

const benefits = [
  {
    icon: ClipboardCheck,
    title: 'Apply with confidence',
    description: 'Complete one guided application and keep your personal, family, and education information organized.',
  },
  {
    icon: BellRing,
    title: 'Stay informed',
    description: 'See examination notices, application updates, results, and official announcements in your portal.',
  },
  {
    icon: GraduationCap,
    title: 'Continue as a scholar',
    description: 'After acceptance, manage scholar requirements and follow your progress toward allowance processing.',
  },
];

const journey = [
  {
    number: '01',
    title: 'Submit your application',
    description: 'Provide complete and accurate personal, family, and school information.',
  },
  {
    number: '02',
    title: 'Take the qualifying exam',
    description: 'Your examination schedule appears after it has been finalized and activated by CAO.',
  },
  {
    number: '03',
    title: 'Receive your result',
    description: 'Track the result in your account while the scholarship decision is being processed.',
  },
  {
    number: '04',
    title: 'Complete scholar requirements',
    description: 'Accepted scholars can submit the current requirements needed for continued support.',
  },
];

const guidance = [
  'Prepare accurate contact and education information before starting.',
  'Only one sibling from the same family may receive the scholarship.',
  'Scholar requirements are requested only after an applicant is accepted.',
];

function LandingPage({ portalPath = '/login', isAuthenticated = false }) {
  const portalLabel = isAuthenticated ? 'Open your portal' : 'Sign in';

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-container landing-nav">
          <Link className="landing-brand" to="/" aria-label="PGCEAP home">
            <img src={caologo} width="96" height="96" alt="Community Affairs Office seal" />
            <span>
              <strong>PGCEAP</strong>
              <small>Scholarship Management System</small>
            </span>
          </Link>

          <nav className="landing-nav-links" aria-label="Main navigation">
            <a href="#about">About</a>
            <a href="#journey">How it works</a>
            <a href="#guidance">Before you apply</a>
            <a href="#support">Support</a>
          </nav>

          <div className="landing-nav-actions">
            <Link className="landing-button landing-button-ghost" to={portalPath}>
              {portalLabel}
            </Link>
            <Link className="landing-button landing-button-primary landing-nav-apply" to="/application">
              Apply now <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero-glow" aria-hidden="true" />
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <div className="landing-eyebrow">
                <span className="landing-eyebrow-mark"><GraduationCap size={16} /></span>
                Province of Camarines Norte
              </div>
              <h1 id="landing-hero-title">Your scholarship journey, all in one place.</h1>
              <p className="landing-hero-lead">
                Apply for PGCEAP, receive important examination updates, and track your progress through one secure and accessible portal.
              </p>
              <div className="landing-hero-actions">
                <Link className="landing-button landing-button-primary landing-button-large" to="/application">
                  Start your application <ArrowRight size={18} />
                </Link>
                <Link className="landing-button landing-button-light landing-button-large" to={portalPath}>
                  <LockKeyhole size={17} /> {portalLabel}
                </Link>
              </div>
              <div className="landing-hero-note">
                <ShieldCheck size={18} />
                <span>Your application information is kept private and secure.</span>
              </div>
            </div>

            <div className="landing-hero-visual" aria-label="PGCEAP scholars and Community Affairs Office representatives">
              <div className="landing-photo-frame">
                <img
                  src={communityPhoto}
                  srcSet={`${communityPhoto} 720w, ${communityPhotoLarge} 1200w`}
                  sizes="(max-width: 700px) calc(100vw - 32px), (max-width: 1080px) 45vw, 540px"
                  width="1200"
                  height="720"
                  fetchPriority="high"
                  alt="PGCEAP community members and scholars"
                />
                <div className="landing-photo-shade" aria-hidden="true" />
                <div className="landing-photo-caption">
                  <span>PGCEAP scholar portal</span>
                  <strong>Opening doors to brighter futures.</strong>
                </div>
              </div>
              <div className="landing-floating-card landing-floating-year">
                <span>Current academic year</span>
                <strong>2026–2027</strong>
              </div>
              <div className="landing-floating-card landing-floating-flow">
                <span className="landing-floating-icon"><FileCheck2 size={19} /></span>
                <span><strong>One connected journey</strong><small>Application to scholarship</small></span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="Portal highlights">
          <div className="landing-container landing-trust-items">
            <span><Check size={16} /> Guided application</span>
            <span><Check size={16} /> Timely examination updates</span>
            <span><Check size={16} /> Clear progress tracking</span>
            <span><Check size={16} /> Secure scholar records</span>
          </div>
        </section>

        <section className="landing-section" id="about">
          <div className="landing-container">
            <div className="landing-section-heading landing-section-heading-centered">
              <span>Designed around your next step</span>
              <h2>A simpler way to move through the scholarship process.</h2>
              <p>Everything you need is organized by where you are in your PGCEAP journey.</p>
            </div>
            <div className="landing-benefit-grid">
              {benefits.map(({ icon: Icon, title, description }) => (
                <article className="landing-benefit-card" key={title}>
                  <span className="landing-card-icon"><Icon size={23} /></span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className="landing-card-line" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-journey-section" id="journey">
          <div className="landing-container landing-journey-layout">
            <div className="landing-section-heading landing-journey-intro">
              <span>Your PGCEAP journey</span>
              <h2>Know what happens next.</h2>
              <p>Follow a clear process from your first application through acceptance and scholar support.</p>
              <Link className="landing-text-link" to="/application">
                Begin your application <ArrowRight size={17} />
              </Link>
            </div>
            <div className="landing-journey-list">
              {journey.map((step, index) => (
                <article className="landing-journey-step" key={step.number}>
                  <div className="landing-step-marker">
                    <span>{step.number}</span>
                    {index < journey.length - 1 && <i aria-hidden="true" />}
                  </div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section" id="guidance">
          <div className="landing-container landing-guidance-grid">
            <div className="landing-guidance-card">
              <div className="landing-guidance-seal" aria-hidden="true">
                <img src={caologoLarge} width="400" height="400" loading="lazy" decoding="async" alt="" />
              </div>
              <div className="landing-section-heading">
                <span>Before you apply</span>
                <h2>Start prepared. Finish with confidence.</h2>
                <p>Review these reminders before opening the application form.</p>
              </div>
              <ul className="landing-guidance-list">
                {guidance.map((item) => (
                  <li key={item}><span><Check size={16} /></span>{item}</li>
                ))}
              </ul>
              <Link className="landing-button landing-button-primary landing-button-large" to="/application">
                Continue to application <ArrowRight size={18} />
              </Link>
            </div>

            <aside className="landing-help-card" id="support">
              <span className="landing-help-icon"><MapPin size={23} /></span>
              <p className="landing-help-kicker">Need assistance?</p>
              <h3>We’re here to help.</h3>
              <p>Contact the Community Affairs Office for questions about your application, examination, or scholar record.</p>
              <div className="landing-help-office">
                <img src={caologo} width="96" height="96" loading="lazy" decoding="async" alt="" />
                <span><strong>Community Affairs Office</strong><small>Province of Camarines Norte</small></span>
              </div>
              <Link className="landing-button landing-button-light landing-button-wide" to="/login">
                Access the portal <ChevronRight size={17} />
              </Link>
            </aside>
          </div>
        </section>

        <section className="landing-section landing-faq-section">
          <div className="landing-container landing-faq-layout">
            <div className="landing-section-heading">
              <span>Common questions</span>
              <h2>Helpful answers before you begin.</h2>
            </div>
            <div className="landing-faq-list">
              <details>
                <summary>Do I submit scholar requirements during application?<ChevronRight size={18} /></summary>
                <p>No. Scholar requirements become available only after your application has been accepted as a scholarship record.</p>
              </details>
              <details>
                <summary>When will my examination schedule appear?<ChevronRight size={18} /></summary>
                <p>Your portal displays the schedule after the Community Affairs Office has finalized and activated the examination for your municipality.</p>
              </details>
              <details>
                <summary>Can I track my application after submitting it?<ChevronRight size={18} /></summary>
                <p>Yes. Use your account to follow application, examination, result, and scholarship progress from the portal.</p>
              </details>
            </div>
          </div>
        </section>

        <section className="landing-cta-section">
          <div className="landing-container landing-cta-card">
            <div>
              <span>Take the first step</span>
              <h2>Your brighter future can start today.</h2>
              <p>Begin your PGCEAP application or return to your portal to continue your journey.</p>
            </div>
            <div className="landing-cta-actions">
              <Link className="landing-button landing-button-white landing-button-large" to="/application">
                Apply now <ArrowRight size={18} />
              </Link>
              <Link className="landing-button landing-button-outline-white landing-button-large" to={portalPath}>
                {portalLabel}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-grid">
          <div className="landing-footer-brand">
            <img src={caologo} width="96" height="96" loading="lazy" decoding="async" alt="Community Affairs Office seal" />
            <span><strong>PGCEAP</strong><small>Scholarship Management System</small></span>
          </div>
          <p>Community Affairs Office · Province of Camarines Norte</p>
          <div className="landing-footer-links">
            <a href="#about">About</a>
            <a href="#support">Support</a>
            <Link to="/login">Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
