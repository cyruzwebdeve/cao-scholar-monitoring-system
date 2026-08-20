const nodemailer = require('nodemailer');

const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_FROM_NAME = 'PGCEAP Community Affairs Office';

const clean = (value) => String(value || '').trim();
const escapeHtml = (value) => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const normalizeAppUrl = (value) => (clean(value) || DEFAULT_APP_URL).replace(/\/+$/, '');

const maskEmail = (email) => {
  const [name, domain] = clean(email).split('@');
  if (!domain) return 'invalid-recipient';
  return `${name.slice(0, 2)}***@${domain}`;
};

const formatDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
};

const detailRow = (label, value) => `
  <tr>
    <td style="padding:10px 12px;color:#68776d;font-size:13px;border-bottom:1px solid #e4ece7;">${escapeHtml(label)}</td>
    <td style="padding:10px 12px;color:#173f2b;font-size:13px;font-weight:700;text-align:right;border-bottom:1px solid #e4ece7;">${escapeHtml(value)}</td>
  </tr>`;

const renderEmail = ({ eyebrow, title, greeting, body, details = [], actionLabel, actionUrl, notice }) => `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f1f6f2;font-family:Arial,Helvetica,sans-serif;color:#183e2b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f6f2;padding:28px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce8df;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#16833b;padding:24px 28px;color:#ffffff;">
            <div style="font-size:12px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;opacity:.86;">PGCEAP Scholarship Management System</div>
            <div style="font-size:20px;font-weight:700;margin-top:6px;">Community Affairs Office</div>
          </td></tr>
          <tr><td style="padding:30px 28px 18px;">
            <div style="font-size:11px;letter-spacing:1.4px;font-weight:700;text-transform:uppercase;color:#16833b;">${escapeHtml(eyebrow)}</div>
            <h1 style="font-size:25px;line-height:1.25;margin:10px 0 18px;color:#102f20;">${escapeHtml(title)}</h1>
            <p style="font-size:15px;line-height:1.65;margin:0 0 12px;">${escapeHtml(greeting)}</p>
            <p style="font-size:15px;line-height:1.65;margin:0 0 22px;color:#425d4d;">${escapeHtml(body)}</p>
            ${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dce8df;border-radius:10px;overflow:hidden;margin-bottom:22px;">${details.map(({ label, value }) => detailRow(label, value)).join('')}</table>` : ''}
            ${notice ? `<div style="padding:13px 15px;background:#fff8e7;border:1px solid #f0d99b;border-radius:9px;color:#6a5318;font-size:13px;line-height:1.5;margin-bottom:22px;">${escapeHtml(notice)}</div>` : ''}
            ${actionUrl && actionLabel ? `<a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#16833b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 20px;border-radius:9px;">${escapeHtml(actionLabel)}</a>` : ''}
          </td></tr>
          <tr><td style="padding:18px 28px 26px;color:#789084;font-size:12px;line-height:1.55;border-top:1px solid #edf2ee;">
            This is an automated PGCEAP account notification. If you did not expect this message, contact the Community Affairs Office.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const createMailer = ({ env = process.env, transportFactory = nodemailer.createTransport } = {}) => {
  const gmailUser = clean(env.GMAIL_USER).toLowerCase();
  const gmailAppPassword = clean(env.GMAIL_APP_PASSWORD).replace(/\s/g, '');
  const fromName = clean(env.MAIL_FROM_NAME) || DEFAULT_FROM_NAME;
  const appUrl = normalizeAppUrl(env.APP_BASE_URL);
  const configured = Boolean(gmailUser && gmailAppPassword);
  let transporter = null;
  let warnedAboutConfiguration = false;

  const getTransporter = () => {
    if (!transporter) {
      transporter = transportFactory({
        service: 'gmail',
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
        auth: { user: gmailUser, pass: gmailAppPassword },
      });
    }
    return transporter;
  };

  const send = async ({ to, subject, text, html, template }) => {
    if (!configured) {
      if (!warnedAboutConfiguration) {
        console.warn('Email delivery is disabled because GMAIL_USER or GMAIL_APP_PASSWORD is not configured.');
        warnedAboutConfiguration = true;
      }
      return { sent: false, skipped: true, reason: 'mailer_not_configured' };
    }

    if (!clean(to)) return { sent: false, skipped: true, reason: 'recipient_missing' };

    try {
      const info = await getTransporter().sendMail({
        from: `"${fromName.replace(/["<>]/g, '')}" <${gmailUser}>`,
        to,
        subject,
        text,
        html,
      });
      return { sent: true, skipped: false, messageId: info.messageId };
    } catch (error) {
      console.error('Email delivery failed.', {
        template,
        recipient: maskEmail(to),
        code: error.code || 'MAIL_DELIVERY_ERROR',
      });
      return { sent: false, skipped: false, reason: 'delivery_failed' };
    }
  };

  const sendApplicantAccountEmail = ({ to, firstName, controlNumber, temporaryPassword }) => {
    const loginUrl = `${appUrl}/login`;
    const details = [
      { label: 'Control number', value: controlNumber },
      { label: 'Email address', value: to },
    ];
    if (temporaryPassword) details.push({ label: 'Temporary password', value: temporaryPassword });

    return send({
      to,
      template: 'applicant_account_created',
      subject: 'Your PGCEAP applicant account is ready',
      text: [
        `Hello ${clean(firstName) || 'Applicant'},`,
        'Your scholarship application was submitted and your PGCEAP applicant account is ready.',
        `Control number: ${controlNumber}`,
        `Email address: ${to}`,
        temporaryPassword ? `Temporary password: ${temporaryPassword}` : '',
        `Sign in: ${loginUrl}`,
        'Keep these account details private.',
      ].filter(Boolean).join('\n\n'),
      html: renderEmail({
        eyebrow: 'Applicant account',
        title: 'Your application was received',
        greeting: `Hello ${clean(firstName) || 'Applicant'},`,
        body: 'Your scholarship application has been submitted successfully. Use the account details below to track your application and future updates.',
        details,
        notice: 'Keep these account details private. The Community Affairs Office will never ask you to send your password by email or chat.',
        actionLabel: 'Open applicant portal',
        actionUrl: loginUrl,
      }),
    });
  };

  const sendExamSubmittedEmail = ({ to, firstName, controlNumber, examTitle, submittedAt }) => {
    const portalUrl = `${appUrl}/dashboard`;
    return send({
      to,
      template: 'exam_submitted',
      subject: 'Your PGCEAP examination was received',
      text: [
        `Hello ${clean(firstName) || 'Applicant'},`,
        'Your qualifying examination was submitted successfully and is now awaiting review.',
        `Examination: ${examTitle || 'PGCEAP Qualifying Examination'}`,
        controlNumber ? `Control number: ${controlNumber}` : '',
        `Submitted: ${formatDate(submittedAt)}`,
        `Track your application: ${portalUrl}`,
      ].filter(Boolean).join('\n\n'),
      html: renderEmail({
        eyebrow: 'Examination update',
        title: 'Examination submission received',
        greeting: `Hello ${clean(firstName) || 'Applicant'},`,
        body: 'Your qualifying examination was submitted successfully. Please wait while the Community Affairs Office reviews and releases your result.',
        details: [
          { label: 'Examination', value: examTitle || 'PGCEAP Qualifying Examination' },
          ...(controlNumber ? [{ label: 'Control number', value: controlNumber }] : []),
          { label: 'Submitted', value: formatDate(submittedAt) },
          { label: 'Current status', value: 'Waiting for results' },
        ],
        actionLabel: 'Track application',
        actionUrl: portalUrl,
      }),
    });
  };

  const sendScholarApprovedEmail = ({ to, firstName, scholarId, schoolYear }) => {
    const portalUrl = `${appUrl}/dashboard`;
    return send({
      to,
      template: 'scholar_approved',
      subject: 'You have been approved as a PGCEAP scholar',
      text: [
        `Hello ${clean(firstName) || 'Scholar'},`,
        'Congratulations! You have been approved as a PGCEAP scholar.',
        `Scholar ID: ${scholarId}`,
        `School year: ${schoolYear}`,
        `Open your scholar dashboard: ${portalUrl}`,
        'Please sign in to review and complete your scholar requirements.',
      ].join('\n\n'),
      html: renderEmail({
        eyebrow: 'Scholarship decision',
        title: 'Welcome to the PGCEAP scholar community',
        greeting: `Congratulations, ${clean(firstName) || 'Scholar'}!`,
        body: 'Your application has been approved and your scholar record is now active. Sign in to review the requirements and next steps for allowance processing.',
        details: [
          { label: 'Scholar ID', value: scholarId },
          { label: 'School year', value: schoolYear },
          { label: 'Scholar status', value: 'Active' },
        ],
        actionLabel: 'Open scholar dashboard',
        actionUrl: portalUrl,
      }),
    });
  };

  const verifyConnection = async () => {
    if (!configured) return { verified: false, reason: 'mailer_not_configured' };
    try {
      await getTransporter().verify();
      return { verified: true };
    } catch (error) {
      return { verified: false, reason: error.code || 'verification_failed' };
    }
  };

  return {
    configured,
    sendApplicantAccountEmail,
    sendExamSubmittedEmail,
    sendScholarApprovedEmail,
    verifyConnection,
  };
};

const defaultMailer = createMailer();

module.exports = {
  ...defaultMailer,
  createMailer,
};
