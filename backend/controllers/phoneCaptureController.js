const { isFirstYearEntry } = require('../services/initialAcademicEvidence');
const { canRecordInitial } = require('../services/passerIntake');
const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const { validateDocumentUpload } = require('../services/documentFilePolicy');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const { INITIAL_KEYS } = require('../services/requirementWaves');
const { findIntakePeriod, lockIntakePeriod, readIntakeSettings } = require('../services/intakePeriod');
const { isCurrentExaminationApplicant } = require('../services/examinationEligibility');
const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const validId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const purgeExpired = (client = prisma) => client.phone_capture_sessions.deleteMany({ where: { expires_at: { lte: new Date() } } });
const loadSession = async (req, client = prisma) => {
  if (!validId(req.params.id)) throw failure('Capture session not found.', 404);
  const session = await client.phone_capture_sessions.findUnique({ where: { id: req.params.id } });
  if (!session || session.owner_admin_id !== req.user.id) throw failure('Capture session not found. Sign in with the Admin account used on the laptop.', 404);
  if (new Date(session.expires_at) <= new Date()) { await client.phone_capture_sessions.deleteMany({ where: { id: session.id, expires_at: { lte: new Date() } } }); throw failure('Capture session expired. Create a new connection on the laptop.', 410); }
  const scholar = await client.scholar_accounts.findFirst({ where: { applicant_id: session.applicant_id, is_active: true } });
  const intakeCapture = session.context?.intakeCapture === true || session.context?.intakeCapture === undefined && !scholar;
  if (!intakeCapture && !scholar) throw failure('This Scholar account is no longer available for capture.', 409);
  const period = intakeCapture ? await findIntakePeriod(client)
    : await client.academic_periods.findFirst({ where: { id: session.academic_period_id, is_active: true } });
  const application = intakeCapture ? await client.application_submissions.findFirst({ where: { applicant_id: session.applicant_id }, orderBy: { submitted_at: 'desc' } }) : null;
  if (!period || period.id !== session.academic_period_id || intakeCapture && !await canRecordInitial(client, session.applicant_id, period.id, application)) throw failure('This passer, scholar or academic period is no longer available for intake.', 409);
  return { ...session, intakeCapture, intakeYear: period.school_year };
};
const withWritableSession = async (req, operation) => {
  const session = await loadSession(req);
  if (!session.intakeCapture) return operation(prisma, session);
  return prisma.$transaction(async (client) => {
    await lockIntakePeriod(client, session.academic_period_id, session.intakeYear);
    return operation(client, await loadSession(req, client));
  }, { isolationLevel: 'Serializable' });
};
const safe = (handler) => async (req, res) => {
  res.set('Cache-Control', 'no-store, private');
  try { return await handler(req, res); }
  catch (error) { if (!error.statusCode) console.error('Phone capture failed:', error.code || error.name); return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to complete phone capture. Try again.' }); }
};
const create = safe(async (req, res) => {
  const applicantId = Number(req.body.applicantId), periodId = Number(req.body.academicPeriodId);
  if (![applicantId, periodId].every((id) => Number.isInteger(id) && id > 0)) throw failure('Select a scholar and active academic period.', 400);
  await purgeExpired();
  const [scholar, applicant, application, requirement] = await Promise.all([
    prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
    prisma.applicants.findUnique({ where: { id: applicantId } }),
    prisma.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
    prisma.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } } }),
  ]);
  const period = scholar ? await prisma.academic_periods.findFirst({ where: { id: periodId, is_active: true } }) : await findIntakePeriod(prisma);
  if (!applicant || !period || period.id !== periodId || !application || (!scholar && (!isCurrentExaminationApplicant(applicant, period.school_year) || !await canRecordInitial(prisma, applicantId, periodId, application)))) throw failure('Select an active Scholar processing period or the current posted-passer intake.', 400);
  const school = await loadResolvedScholarSchool(prisma, { applicantId, applicant, application, requirement });
  const type = schoolClassification(school?.school_type);
  if (!['Public', 'Private'].includes(type)) throw failure('Correct the school classification first.', 409);
  const context = { intakeCapture: !scholar, scholarName: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' '), periodLabel: `${period.school_year} · ${period.semester}`, requirementKeys: INITIAL_KEYS.filter((key) => (type === 'Private' || key !== 'tuition_receipt') && (key !== 'report_card' || isFirstYearEntry(application.school_plan?.incomingYearLevel))) };
  const persist = async (client) => {
    if (!scholar) {
      await lockIntakePeriod(client, periodId, period.school_year);
      const currentApplication = await client.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } });
      if (!await canRecordInitial(client, applicantId, periodId, currentApplication)) throw failure('The posted-passer intake changed. Reload before pairing.', 409);
    }
    await client.phone_capture_sessions.deleteMany({ where: { owner_admin_id: req.user.id, applicant_id: applicantId, academic_period_id: periodId } });
    if (await client.phone_capture_sessions.count({ where: { owner_admin_id: req.user.id } }) >= 3) throw failure('Close another phone capture session before opening one.', 409);
    return client.phone_capture_sessions.create({ data: { id: randomUUID(), owner_admin_id: req.user.id, applicant_id: applicantId, academic_period_id: periodId, context, expires_at: new Date(Date.now() + 20 * 60 * 1000) } });
  };
  const session = scholar ? await persist(prisma) : await prisma.$transaction(persist, { isolationLevel: 'Serializable' });
  res.locals.auditTargetId = applicantId;
  return res.status(201).json({ session: { id: session.id, revision: session.revision, expiresAt: session.expires_at, remainingMs: Math.max(0, new Date(session.expires_at).getTime() - Date.now()), ...context } });
});
const get = safe(async (req, res) => {
  const requestedRevision = req.query.revision;
  if (typeof requestedRevision === 'string' && /^\d+$/.test(requestedRevision)) {
    if (!validId(req.params.id)) throw failure('Capture session not found.', 404);
    const summary = await prisma.phone_capture_sessions.findUnique({ where: { id: req.params.id }, select: { id: true, owner_admin_id: true, expires_at: true, revision: true, context: true, academic_period_id: true } });
    if (!summary || summary.owner_admin_id !== req.user.id) throw failure('Capture session not found. Sign in with the Admin account used on the laptop.', 404);
    if (new Date(summary.expires_at) <= new Date()) {
      await prisma.phone_capture_sessions.deleteMany({ where: { id: summary.id, expires_at: { lte: new Date() } } });
      throw failure('Capture session expired. Create a new connection on the laptop.', 410);
    }
    if (summary.context?.intakeCapture && (await readIntakeSettings(prisma))?.academic_period_id !== summary.academic_period_id) throw failure('The application intake changed. Reopen the current intake before capturing.', 409);
    if (summary.context?.intakeCapture === undefined) await loadSession(req);
    if (summary.revision === Number(requestedRevision)) return res.json({ unchanged: true, revision: summary.revision });
  }
  const session = await loadSession(req);
  return res.json({ session: { id: session.id, revision: session.revision, expiresAt: session.expires_at, remainingMs: Math.max(0, new Date(session.expires_at).getTime() - Date.now()), ...session.context }, pages: req.query.receive === '1' ? session.pages : session.pages.map(({ id, requirementKey }) => ({ id, requirementKey })) });
});
const mutate = async (req, change) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const changed = await withWritableSession(req, async (client, session) => {
      const pages = change(session);
      const updated = await client.phone_capture_sessions.updateMany({ where: { id: session.id, owner_admin_id: req.user.id, revision: session.revision, expires_at: { gt: new Date() } }, data: { pages, revision: { increment: 1 } } });
      return updated.count === 1;
    });
    if (changed) return;
  }
  throw failure('Capture queue changed. Try again.', 409);
};
const send = safe(async (req, res) => {
  const { pageId, requirementKey, imageData } = req.body || {};
  if (!validId(pageId) || !INITIAL_KEYS.includes(requirementKey) || typeof imageData !== 'string' || imageData.length > 6 * 1024 * 1024) throw failure('Select a requirement and a valid photo.', 400);
  await validateDocumentUpload('capture.jpg', imageData, { maxBytes: 4 * 1024 * 1024 });
  await mutate(req, (session) => {
    if (session.context.accepting === false) throw failure('The laptop has ended capture. Review the received pages there.', 409);
    if (!session.context.requirementKeys.includes(requirementKey)) throw failure('This requirement does not apply to this scholar.', 400);
    if (session.pages.some((page) => page.id === pageId)) return session.pages; // Safe retry after a lost response.
    if (session.pages.filter((page) => page.requirementKey === requirementKey).length >= 10 || session.pages.reduce((bytes, page) => bytes + page.imageData.length, 0) + imageData.length > 32 * 1024 * 1024) throw failure('Capture queue is full. Receive pages on the laptop before sending more.', 409);
    return [...session.pages, { id: pageId, requirementKey, imageData }];
  });
  return res.json({ message: 'Photo sent to the laptop for review. No requirement was approved.' });
});
const freeze = safe(async (req, res) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const pages = await withWritableSession(req, async (client, session) => {
      const updated = await client.phone_capture_sessions.updateMany({ where: { id: session.id, owner_admin_id: req.user.id, revision: session.revision, expires_at: { gt: new Date() } }, data: { context: { ...session.context, accepting: false }, revision: { increment: 1 } } });
      return updated.count === 1 ? session.pages : null;
    });
    if (pages) return res.json({ pages, message: 'New transfers stopped. Receive all pending pages before closing.' });
  }
  throw failure('Capture queue changed. Try ending the connection again.', 409);
});
const acknowledge = safe(async (req, res) => {
  const ids = req.body.pageIds;
  if (!Array.isArray(ids) || ids.length > 60 || ids.some((id) => !validId(id))) throw failure('Select valid received pages.', 400);
  await mutate(req, (session) => session.pages.filter((page) => !ids.includes(page.id)));
  return res.json({ message: 'Received temporary pages removed.' });
});
const close = safe(async (req, res) => {
  const discard = req.query.discard === '1';
  const session = await withWritableSession(req, async (client, session) => {
    if (!discard && session.context.accepting !== false) throw failure('Stop new transfers and receive pending pages before closing, or explicitly cancel intake.', 409);
    const removed = await client.phone_capture_sessions.deleteMany({ where: { id: session.id, owner_admin_id: req.user.id, ...(discard ? {} : { revision: session.revision }) } });
    if (removed.count !== 1) throw failure('Capture queue changed. Retry ending the connection.', 409);
    return session;
  });
  res.locals.auditTargetId = session.applicant_id;
  return res.json({ message: discard ? 'Capture cancelled; queued temporary photos discarded.' : 'Phone connection closed.' });
});
module.exports = { create, get, send, freeze, acknowledge, close, purgeExpired };
