const assert = require('node:assert/strict');
const test = require('node:test');

const { createMailer } = require('../services/mailer');

const configuredEnv = {
  GMAIL_USER: 'cao@example.com',
  GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
  MAIL_FROM_NAME: 'PGCEAP CAO',
  APP_BASE_URL: 'https://example.vercel.app/',
};

const gmailApiEnv = {
  GMAIL_USER: 'cao@example.com',
  GMAIL_CLIENT_ID: 'oauth-client-id',
  GMAIL_CLIENT_SECRET: 'oauth-client-secret',
  GMAIL_REFRESH_TOKEN: 'oauth-refresh-token',
  MAIL_FROM_NAME: 'PGCEAP CAO',
  APP_BASE_URL: 'https://example.vercel.app/',
};

test('skips delivery when Gmail credentials are not configured', async () => {
  const mailer = createMailer({ env: {}, transportFactory: () => { throw new Error('must not initialize'); } });
  const result = await mailer.sendExamSubmittedEmail({ to: 'applicant@example.com' });
  assert.deepEqual(result, { sent: false, skipped: true, reason: 'mailer_not_configured' });
});

test('sends an applicant account email with the portal URL and credentials', async () => {
  let transportOptions;
  let message;
  const mailer = createMailer({
    env: configuredEnv,
    transportFactory: (options) => {
      transportOptions = options;
      return {
        sendMail: async (payload) => {
          message = payload;
          return { messageId: 'gmail-message-id' };
        },
      };
    },
  });

  const result = await mailer.sendApplicantAccountEmail({
    to: 'applicant@example.com',
    firstName: '<Andrea>',
    controlNumber: 'PGCEAP-001',
    temporaryPassword: 'Temporary123!',
  });

  assert.equal(result.sent, true);
  assert.equal(transportOptions.service, 'gmail');
  assert.equal(transportOptions.auth.user, configuredEnv.GMAIL_USER);
  assert.match(message.subject, /account is ready/i);
  assert.match(message.text, /PGCEAP-001/);
  assert.match(message.text, /Temporary123!/);
  assert.match(message.html, /https:\/\/example\.vercel\.app\/login/);
  assert.doesNotMatch(message.html, /<Andrea>/);
  assert.match(message.html, /&lt;Andrea&gt;/);
});

test('prefers the Gmail HTTPS API and sends a MIME message with a refreshed token', async () => {
  const calls = [];
  const mailer = createMailer({
    env: gmailApiEnv,
    transportFactory: () => { throw new Error('SMTP must not initialize'); },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('oauth2.googleapis.com')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'short-lived-access-token', expires_in: 3600 }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'gmail-api-message-id' }),
      };
    },
  });

  const result = await mailer.sendScholarApprovedEmail({
    to: 'applicant@example.com',
    firstName: 'Andrea',
    scholarId: 'PGCEAP-2026-00001',
    schoolYear: '2026-2027',
  });

  assert.equal(mailer.provider, 'gmail_api');
  assert.equal(result.sent, true);
  assert.equal(result.messageId, 'gmail-api-message-id');
  assert.equal(calls.length, 2);
  assert.match(String(calls[0].options.body), /grant_type=refresh_token/);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer short-lived-access-token');
  const raw = JSON.parse(calls[1].options.body).raw;
  const decodedMessage = Buffer.from(raw, 'base64url').toString('utf8');
  assert.match(decodedMessage, /To: applicant@example\.com/);
  assert.match(decodedMessage, /Content-Type: multipart\/alternative/);
});

test('exam receipt does not expose the examination score', async () => {
  let message;
  const mailer = createMailer({
    env: configuredEnv,
    transportFactory: () => ({
      sendMail: async (payload) => {
        message = payload;
        return { messageId: 'exam-message-id' };
      },
    }),
  });

  await mailer.sendExamSubmittedEmail({
    to: 'applicant@example.com',
    firstName: 'Andrea',
    controlNumber: 'PGCEAP-001',
    examTitle: 'PGCEAP Qualifying Examination',
    submittedAt: new Date('2026-08-20T08:00:00Z'),
    score: 20,
  });

  assert.match(message.text, /awaiting review/i);
  assert.doesNotMatch(message.text, /score/i);
  assert.doesNotMatch(message.html, />20</);
});

test('sends a single-use password reset link without exposing the token outside the link', async () => {
  let message;
  const mailer = createMailer({
    env: configuredEnv,
    transportFactory: () => ({
      sendMail: async (payload) => {
        message = payload;
        return { messageId: 'password-reset-message-id' };
      },
    }),
  });

  const result = await mailer.sendPasswordResetEmail({
    to: 'applicant@example.com',
    firstName: 'Andrea',
    resetToken: 'secure_reset_token',
    expiresInMinutes: 30,
  });

  assert.equal(result.sent, true);
  assert.match(message.subject, /reset your pgceap portal password/i);
  assert.match(message.text, /reset-password\?token=secure_reset_token/);
  assert.match(message.html, /single use only/i);
  assert.match(message.html, /30 minutes/i);
});

test('converts transport failures into a safe delivery result', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const mailer = createMailer({
      env: configuredEnv,
      transportFactory: () => ({
        sendMail: async () => {
          const error = new Error('authentication failed');
          error.code = 'EAUTH';
          throw error;
        },
      }),
    });
    const result = await mailer.sendScholarApprovedEmail({
      to: 'applicant@example.com',
      firstName: 'Andrea',
      scholarId: 'PGCEAP-2026-00001',
      schoolYear: '2026-2027',
    });
    assert.deepEqual(result, { sent: false, skipped: false, reason: 'delivery_failed' });
  } finally {
    console.error = originalError;
  }
});
