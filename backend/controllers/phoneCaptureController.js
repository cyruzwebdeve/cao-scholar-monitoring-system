const { canRecordInitial } = require('../services/passerIntake');
const { randomUUID } = require('node:crypto');
const prisma = require('../config/prisma');
const { parseDataUrl } = require('../services/blobStorage');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const { INITIAL_KEYS } = require('../services/requirementWaves');
const failure = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const validId = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const purgeExpired = (client = prisma) => client.phone_capture_sessions.deleteMany({ where: { expires_at: { lte: new Date() } } });
const loadSession = async (req, client = prisma) => {
  if (!validId(req.params.id)) throw failure('Capture session not found.', 404);
  const session = await client.phone_capture_sessions.findUnique({ where: { id: req.params.id } });
  if (!session || session.owner_admin_id !== req.user.id) throw failure('Capture session not found. Sign in with the Admin account used on the laptop.', 404);
  if (new Date(session.expires_at) <= new Date()) { await client.phone_capture_sessions.deleteMany({ where: { id: session.id, expires_at: { lte: new Date() } } }); throw failure('Capture session expired. Create a new connection on the laptop.', 410); }
  const [period, scholar] = await Promise.all([
    client.academic_periods.findFirst({ where: { id: session.academic_period_id, is_active: true } }),
    client.scholar_accounts.findFirst({ where: { applicant_id: session.applicant_id, is_active: true } }),
  ]);
  const application = !scholar ? await client.application_submissions.findFirst({ where: { applicant_id: session.applicant_id }, orderBy: { submitted_at: 'desc' } }) : null;
  if (!period || (!scholar && !await canRecordInitial(client, session.applicant_id, period.id, application))) throw failure('This passer, scholar or academic period is no longer available for intake.', 409);
  return session;
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
  const [scholar, applicant, period, application, requirement] = await Promise.all([
    prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
    prisma.applicants.findUnique({ where: { id: applicantId } }),
    prisma.academic_periods.findFirst({ where: { id: periodId, is_active: true } }),
    prisma.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
    prisma.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } } }),
  ]);
  if (!applicant || !period || !application || (!scholar && !await canRecordInitial(prisma, applicantId, periodId, application))) throw failure('An active scholar, application and period are required.', 400);
  const school = await loadResolvedScholarSchool(prisma, { applicantId, applicant, application, requirement });
  const type = schoolClassification(school?.school_type);
  if (!['Public', 'Private'].includes(type)) throw failure('Correct the school classification first.', 409);
  await prisma.phone_capture_sessions.deleteMany({ where: { owner_admin_id: req.user.id, applicant_id: applicantId, academic_period_id: periodId } });
  if (await prisma.phone_capture_sessions.count({ where: { owner_admin_id: req.user.id } }) >= 3) throw failure('Close another phone capture session before opening one.', 409);
  const context = { scholarName: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' '), periodLabel: `${period.school_year} · ${period.semester}`, requirementKeys: INITIAL_KEYS.filter((key) => type === 'Private' || key !== 'tuition_receipt') };
  const session = await prisma.phone_capture_sessions.create({ data: { id: randomUUID(), owner_admin_id: req.user.id, applicant_id: applicantId, academic_period_id: periodId, context, expires_at: new Date(Date.now() + 20 * 60 * 1000) } });
  res.locals.auditTargetId = applicantId;
  return res.status(201).json({ session: { id: session.id, expiresAt: session.expires_at, remainingMs: Math.max(0, new Date(session.expires_at).getTime() - Date.now()), ...context } });
});
const get = safe(async (req, res) => {
  const session = await loadSession(req);
  return res.json({ session: { id: session.id, expiresAt: session.expires_at, remainingMs: Math.max(0, new Date(session.expires_at).getTime() - Date.now()), ...session.context }, pages: req.query.receive === '1' ? session.pages : session.pages.map(({ id, requirementKey }) => ({ id, requirementKey })) });
});
const mutate = async (req, change) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const session = await loadSession(req);
    const pages = change(session);
    const updated = await prisma.phone_capture_sessions.updateMany({ where: { id: session.id, owner_admin_id: req.user.id, revision: session.revision, expires_at: { gt: new Date() } }, data: { pages, revision: { increment: 1 } } });
    if (updated.count === 1) return;
  }
  throw failure('Capture queue changed. Try again.', 409);
};
const send = safe(async (req, res) => {
  const { pageId, requirementKey, imageData } = req.body || {};
  if (!validId(pageId) || !INITIAL_KEYS.includes(requirementKey) || typeof imageData !== 'string' || imageData.length > 6 * 1024 * 1024) throw failure('Select a requirement and a valid photo.', 400);
  let file; try { file = parseDataUrl(imageData); } catch { throw failure('Use a valid JPEG capture.', 400); }
  if (file.contentType !== 'image/jpeg' || file.buffer.length > 4 * 1024 * 1024 || file.buffer[0] !== 0xff || file.buffer[1] !== 0xd8) throw failure('Use a JPEG photo below 4 MB.', 400);
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
    const session = await loadSession(req);
    const updated = await prisma.phone_capture_sessions.updateMany({ where: { id: session.id, owner_admin_id: req.user.id, revision: session.revision, expires_at: { gt: new Date() } }, data: { context: { ...session.context, accepting: false }, revision: { increment: 1 } } });
    if (updated.count === 1) return res.json({ pages: session.pages, message: 'New transfers stopped. Receive all pending pages before closing.' });
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
  const session = await loadSession(req);
  const discard = req.query.discard === '1';
  if (!discard && session.context.accepting !== false) throw failure('Stop new transfers and receive pending pages before closing, or explicitly cancel intake.', 409);
  const removed = await prisma.phone_capture_sessions.deleteMany({ where: { id: session.id, owner_admin_id: req.user.id, ...(discard ? {} : { revision: session.revision }) } });
  if (removed.count !== 1) throw failure('Capture queue changed. Retry ending the connection.', 409);
  res.locals.auditTargetId = session.applicant_id;
  return res.json({ message: discard ? 'Capture cancelled; queued temporary photos discarded.' : 'Phone connection closed.' });
});
module.exports = { create, get, send, freeze, acknowledge, close, purgeExpired };
