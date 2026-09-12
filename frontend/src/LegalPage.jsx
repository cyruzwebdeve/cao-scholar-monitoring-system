import { ArrowLeft, ExternalLink, Mail, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import caologo from './assets/caologo-96.webp';
import './styles/legal.css';

const CONTACT_EMAIL = 'caopgceap@gmail.com';
const EFFECTIVE_DATE = 'September 12, 2026';

function LegalPageLayout({ eyebrow, title, summary, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" to="/" aria-label="PGCEAP home">
          <img src={caologo} width="52" height="52" alt="Community Affairs Office seal" />
          <span><strong>PGCEAP</strong><small>Scholarship Management System</small></span>
        </Link>
        <Link className="legal-back" to="/"><ArrowLeft size={17} />Back to home</Link>
      </header>
      <main className="legal-main">
        <article className="legal-document">
          <div className="legal-title-block">
            <span className="legal-eyebrow"><ShieldCheck size={16} />{eyebrow}</span>
            <h1>{title}</h1>
            <p>{summary}</p>
            <small>Effective date: {EFFECTIVE_DATE}</small>
          </div>
          <div className="legal-content">{children}</div>
        </article>
      </main>
      <footer className="legal-footer">
        <span>Community Affairs Office · Province of Camarines Norte</span>
        <nav aria-label="Legal links">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-of-service">Terms of Service</Link>
        </nav>
      </footer>
    </div>
  );
}

function ContactSection() {
  return (
    <section>
      <h2>Contact us</h2>
      <p>Questions, correction requests, and privacy concerns may be directed to the Community Affairs Office:</p>
      <a className="legal-contact" href={`mailto:${CONTACT_EMAIL}`}><Mail size={17} />{CONTACT_EMAIL}<ExternalLink size={14} /></a>
    </section>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout eyebrow="Privacy and data protection" title="Privacy Policy" summary="This policy explains what information the PGCEAP Scholarship Management System handles and how it is used to administer the scholarship program.">
      <section>
        <h2>Who operates this system</h2>
        <p>The PGCEAP Scholarship Management System is operated for the Community Affairs Office of the Province of Camarines Norte. It supports scholarship applications, examinations, decisions, scholar requirements, private-school certification lists, and public-scholar payroll-list preparation.</p>
      </section>
      <section>
        <h2>Information we collect</h2>
        <p>Depending on your role and stage in the program, the system may collect and maintain:</p>
        <ul>
          <li><strong>Identity and contact details:</strong> name, email address, control number, telephone number, sex or gender, date and place of birth, civil status, and account identifiers.</li>
          <li><strong>Address information:</strong> house number, street or purok, barangay, and municipality.</li>
          <li><strong>Education information:</strong> school, school type, course or program, year level, school year, semester, grades, and general weighted average.</li>
          <li><strong>Family and eligibility information:</strong> parent or guardian details, occupations, sibling counts, household or family income, and answers used to evaluate program eligibility.</li>
          <li><strong>Application and scholar documents:</strong> proofs of residency or indigency, identification, registration records, grade reports, tax-related certifications, and other required supporting files.</li>
          <li><strong>Examination and program records:</strong> assigned schedule and venue, attendance status, examination score and result, application decisions, requirement reviews, certification-list information, and payroll-list information. Individual question answers are evaluated in the browser and are not sent to the server.</li>
          <li><strong>Security and operational information:</strong> password hashes, password-reset records, login timestamps, IP addresses, and logs of authorized system actions. Passwords are not stored as readable text.</li>
        </ul>
      </section>
      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Receive, validate, and review scholarship applications and supporting documents.</li>
          <li>Create and secure applicant, scholar, staff, and administrator accounts.</li>
          <li>Schedule examinations, confirm attendance, record results, and support authorized scholarship decisions.</li>
          <li>Review scholar requirements and prepare private-school certification lists or public-scholar payroll lists.</li>
          <li>Send essential account, password-recovery, application, examination, and program notifications.</li>
          <li>Protect the system, investigate errors or misuse, and maintain operational accountability.</li>
          <li>Produce authorized administrative reports about the scholarship program.</li>
        </ul>
        <p>The system ends its financial workflow at official payroll-list generation. It does not track fund release, payment claiming, disbursement confirmation, reconciliation, or monetary auditing.</p>
      </section>
      <section>
        <h2>Gmail and Google user data</h2>
        <p>The system authorizes one official CAO Gmail account with the <code>gmail.send</code> permission solely to send transactional PGCEAP email. It does not request permission to read, list, modify, or delete messages, and it does not access a recipient's Gmail account. OAuth credentials are kept in protected server configuration and are not exposed to applicants or scholars.</p>
        <p>Information received from Google APIs is used only to provide this email-delivery function, consistent with the Google API Services User Data Policy, including its Limited Use requirements.</p>
      </section>
      <section>
        <h2>Storage, access, and disclosure</h2>
        <p>Information is stored using the system's authorized hosting, database, and document-storage providers. Access is restricted according to assigned roles. Records may be disclosed to authorized Community Affairs Office personnel, relevant Provincial Government offices, schools involved in scholarship administration, contracted technology providers acting on authorized instructions, or public authorities when required by law.</p>
        <p>We do not sell applicant or scholar personal information or use it for commercial advertising.</p>
      </section>
      <section>
        <h2>Retention and security</h2>
        <p>Records are retained only for as long as reasonably necessary for scholarship administration, legal obligations, official records-management requirements, dispute handling, and system security. Actual retention periods may vary by record category.</p>
        <p>Reasonable administrative and technical safeguards are used, including role-based access, password hashing, access controls, validation, rate limiting, and operational logging. No internet service can guarantee absolute security, so suspected account compromise should be reported promptly.</p>
      </section>
      <section>
        <h2>Your choices and rights</h2>
        <p>Subject to applicable Philippine law and program recordkeeping requirements, you may ask to access or correct your information, raise an objection or privacy concern, or request information about how a record is handled. Some records cannot be deleted immediately when they must be preserved for legal or official program purposes.</p>
        <p>Application drafts may be stored in your browser until submitted or cleared. You may clear those drafts and saved sign-in state by using the application's controls or clearing this site's browser storage.</p>
      </section>
      <section>
        <h2>Policy updates</h2>
        <p>This policy may be updated when system functions, legal requirements, or data practices change. The effective date above will be revised when material changes are published.</p>
      </section>
      <ContactSection />
    </LegalPageLayout>
  );
}

export function TermsOfServicePage() {
  return (
    <LegalPageLayout eyebrow="Responsible system use" title="Terms of Service" summary="These terms govern access to and use of the PGCEAP Scholarship Management System.">
      <section>
        <h2>Acceptance and purpose</h2>
        <p>By using this system, you agree to these terms and the Privacy Policy. The portal is provided to support official PGCEAP application and scholarship-administration activities. If you do not agree, do not submit information through the portal and contact the Community Affairs Office for assistance.</p>
      </section>
      <section>
        <h2>Eligibility and accurate information</h2>
        <p>You must provide complete, current, and truthful information and submit only authentic documents that you are authorized to provide. Submission does not guarantee examination admission, scholarship approval, continuation, certification, inclusion in a payroll list, or any financial benefit. Authorized officials retain responsibility for program decisions under applicable rules.</p>
      </section>
      <section>
        <h2>Accounts and security</h2>
        <ul>
          <li>Keep your control number, username, password, and recovery access confidential.</li>
          <li>Use only your own account unless officially authorized to administer the system.</li>
          <li>Notify the Community Affairs Office promptly if you suspect unauthorized access.</li>
          <li>You are responsible for information and actions submitted through your account to the extent permitted by law.</li>
        </ul>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>You must not attempt to bypass access controls, access examinations before authorization, impersonate another person, submit malicious or unlawful material, interfere with system availability, scrape protected records, reverse engineer security measures, or use the portal for purposes unrelated to PGCEAP.</p>
      </section>
      <section>
        <h2>Examinations and records</h2>
        <p>Examination access depends on the configured delivery mode, active schedule, assigned municipality, and attendance confirmation. Users must follow examination instructions and integrity rules. The Community Affairs Office may investigate irregular activity and correct administrative or technical errors in accordance with program procedures.</p>
      </section>
      <section>
        <h2>Documents and communications</h2>
        <p>By uploading a document, you confirm that it is relevant, accurate, lawful, and available for authorized PGCEAP review. Uploaded files may be approved, rejected, or returned for correction. You agree to receive essential service communications through the portal or the contact information you provide.</p>
      </section>
      <section>
        <h2>System scope</h2>
        <p>The system supports private-school certification-list preparation and public-scholar payroll-list generation. Payroll-list generation is an administrative endpoint and must not be interpreted as confirmation that funds were released, claimed, disbursed, reconciled, or audited.</p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>The system may occasionally be unavailable because of maintenance, security measures, connectivity, or third-party services. Reasonable efforts are made to preserve availability and accuracy, but uninterrupted or error-free operation cannot be guaranteed. Features and these terms may be updated to reflect program, legal, security, or operational requirements.</p>
      </section>
      <section>
        <h2>Suspension and enforcement</h2>
        <p>Access may be restricted or suspended when reasonably necessary to protect users, preserve examination integrity, investigate misuse, comply with law, or enforce program rules. Deliberate misuse may be referred to the appropriate authorities.</p>
      </section>
      <section>
        <h2>Applicable rules</h2>
        <p>Use of the system is subject to applicable laws of the Philippines, including data-protection requirements, and to official PGCEAP and Provincial Government policies. If these terms conflict with a controlling law or formally issued program rule, that controlling requirement prevails.</p>
      </section>
      <ContactSection />
    </LegalPageLayout>
  );
}

export default function LegalPage({ document }) {
  return document === 'terms' ? <TermsOfServicePage /> : <PrivacyPolicyPage />;
}
