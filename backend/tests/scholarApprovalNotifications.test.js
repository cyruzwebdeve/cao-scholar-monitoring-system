const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = {};
const messages = [];
let deliveryResult = { sent: true };
for (const [path, exports] of [
  ['../config/prisma', prisma],
  ['../services/mailer', { sendScholarApprovedEmail: async (message) => { messages.push(message); return deliveryResult; } }],
]) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
const { acceptApplicantAsScholar, createAnnouncement, updateAnnouncement, getAnnouncementManagement } = require('../controllers/applicationController');

const response = () => ({ locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const setup = ({ passed = true, active = false } = {}) => {
  messages.length = 0;
  deliveryResult = { sent: true };
  const applicant = { id: 1, email: 'test@example.com', first_name: 'Test', school_year: '2026-2027' };
  const application = { id: 2, applicant_id: 1, family: { familyIncome: 'Below 50,000', gwa: '92' }, eligibility: { pwd: 'Yes' }, initial_docs: { requirements: { priority_pwd: { fileName: 'proof.pdf', status: 'Pending' } } } };
  const scholar = { id: 3, applicant_id: 1, scholar_id: 'PGCEAP-2026-00001', is_active: true };
  Object.assign(prisma, {
    $transaction: async () => {
      if (!passed) { const { AttemptError } = require('../services/onlineExamAttempt'); throw new AttemptError('Reviewed result cannot be accepted.', 400); }
      return active ? { alreadyAccepted: true, scholar } : { scholar, applicant, schoolYear: '2026-2027', assessment: { recommendation: 'MEETS_CONFIGURED_CRITERIA' } };
    },
  });
};
const decisionBody = () => ({ examId: 3, resultId: 5, applicationId: 2, academicPeriodId: 4, updatedAt: new Date().toISOString() });
test('official acceptance emails the successful applicant with scholar ID, after saving', async () => {
  setup(); const res = response();
  await acceptApplicantAsScholar({ params: { applicantId: '1' }, body: decisionBody(), user: { id: 99 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.notification.scholarApprovalEmailSent, true);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, 'test@example.com');
  assert.equal(messages[0].scholarId, 'PGCEAP-2026-00001');
});
test('failed examinations and repeated acceptance do not send approval emails', async () => {
  for (const config of [{ passed: false }, { active: true }]) {
    setup(config); const res = response();
    await acceptApplicantAsScholar({ params: { applicantId: '1' }, body: decisionBody(), user: { id: 99 } }, res);
    assert.equal(messages.length, 0);
  }
});
test('mail failure does not undo official scholarship acceptance', async () => {
  setup(); deliveryResult = { sent: false }; const res = response();
  await acceptApplicantAsScholar({ params: { applicantId: '1' }, body: decisionBody(), user: { id: 99 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.notification.scholarApprovalEmailSent, false);
});
test('new announcements default to email enabled; explicit opt-out is persisted', async () => {
  for (const opt of [undefined, false, true]) {
    let saved;
    prisma.announcements = { create: async ({ data }) => { saved = data; return { id: 1, ...data }; } };
    const res = response();
    await createAnnouncement({ body: { title: 'Notice', content: 'Details', status: 'published', ...(opt === undefined ? {} : { notifyEmail: opt }) }, user: { id: 99 } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(saved.notify_email, opt ?? true);
    assert.equal(res.body.announcement.notifyEmail, opt ?? true);
  }
});
test('announcement updates preserve email preference and queue marker; invalid preference is rejected', async () => {
  let saved;
  prisma.$transaction = async (fn) => fn(prisma);
  prisma.announcements = {
    findUnique: async () => ({ id: 1, notify_email: false, email_queued_at: new Date(), published_at: new Date(), updated_at: new Date('2026-10-18T00:00:00Z') }),
    updateMany: async ({ data }) => { saved = data; return { count: 1 }; },
  };
  const req = { params: { id: 1 }, body: { title: 'Edited', content: 'Details', status: 'published', updatedAt: '2026-10-18T00:00:00Z' }, user: { id: 99 } };
  const res = response(); await updateAnnouncement(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(saved.notify_email, false);
  assert.equal(Object.hasOwn(saved, 'email_queued_at'), false);
  const invalid = response(); await createAnnouncement({ ...req, body: { ...req.body, notifyEmail: 'false' } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('management exposes delivery counts without recipient addresses', async () => {
  prisma.announcements = { updateMany: async () => ({}), findMany: async () => [{ id: 1, title: 'Notice', notify_email: true }] };
  prisma.announcement_email_deliveries = { groupBy: async () => [
    { announcement_id: 1, status: 'sent', _count: { _all: 2 } },
    { announcement_id: 1, status: 'failed', _count: { _all: 1 } },
  ] };
  const res = response(); await getAnnouncementManagement({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.announcements[0].emailDeliveries, { sent: 2, failed: 1 });
  assert.doesNotMatch(JSON.stringify(res.body), /test@example.com/);
});
