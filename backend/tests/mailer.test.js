const assert = require('node:assert/strict');
const test = require('node:test');

const { createMailer } = require('../services/mailer');

const configuredEnv = {
  GMAIL_USER: 'cao@example.com',
  GMAIL_APP_PASSWORD: 'abcdefghijklmnop',
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
