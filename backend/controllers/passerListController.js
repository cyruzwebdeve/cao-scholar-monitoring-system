const prisma = require('../config/prisma');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { isExaminationApplicationEligible } = require('../services/examinationEligibility');
const { getPostedPasser, initialChecklist, initialApproved } = require('../services/passerIntake');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
const safe = (handler) => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try { return await handler(req, res); }
  catch (error) {
    if (['P2002', 'P2034'].includes(error.code)) return res.status(409).json({ message: 'The list or result changed. Refresh before retrying; an existing request may already be saved.' });
    if (!error.statusCode) console.error('Passer list operation failed:', error.code || error.name);
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to process the passer list.' });
  }
};
const validateMember = async (tx, member, period) => {
  const [result, applicant, application, exam, slot] = await Promise.all([
    tx.results.findFirst({ where: { id: member.result_id, applicant_id: member.applicant_id, exam_id: member.exam_id } }),
    tx.applicants.findUnique({ where: { id: member.applicant_id } }),
    tx.application_submissions.findFirst({ where: { applicant_id: member.applicant_id }, orderBy: { submitted_at: 'desc' } }),
    tx.exams.findUnique({ where: { id: member.exam_id } }),
    tx.exam_slots.findUnique({ where: { applicant_id_exam_id: { applicant_id: member.applicant_id, exam_id: member.exam_id } } }),
  ]);
  const currentExam = applicant ? await tx.exams.findFirst({ where: { academic_year: period.school_year, municipality: { equals: String(applicant.municipality || '').trim(), mode: 'insensitive' } }, orderBy: { updated_at: 'desc' } }) : null;
  if (!result?.passed || result.score == null || !applicant || applicant.deleted_at || !isExaminationApplicationEligible(application) || application.id !== member.application_id || !exam || exam.academic_year !== period.school_year || currentExam?.id !== exam.id || !slot || slot.id !== result.exam_slot_id || +new Date(result.updated_at) !== +new Date(member.snapshot.resultUpdatedAt)) throw fail('A selected passer, assignment, application or score changed. Refresh Results and create a new draft.');
  return { result, applicant };
};
const snapshotOf = (result, applicant) => ({ name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' '), score: Number(result.score), passingScore: Number(result.passing_score ?? 14), resultUpdatedAt: new Date(result.updated_at).toISOString(), publishedAt: result.published_at ? new Date(result.published_at).toISOString() : null });
const postDraft = async (tx, list, actorId) => {
  if (list.status === 'posted') return list;
  const period = await findPrimaryActivePeriod(tx);
  if (!period || period.id !== list.academic_period_id) throw fail('The primary period changed. Create a list in the current period.');
  if (list.supersedes_id) {
    const previous = await tx.passer_lists.findUnique({ where: { id: list.supersedes_id }, include: { revisions: true } });
    if (!previous || previous.status !== 'posted' || previous.academic_period_id !== period.id || previous.revisions.some((revision) => revision.status === 'posted')) throw fail('The previous list has already been revised or is unavailable.');
  }
  const now = new Date();
  for (const member of list.members) {
    const { result, applicant } = await validateMember(tx, member, period);
    const scholar = await tx.scholar_accounts.findFirst({ where: { applicant_id: member.applicant_id, is_active: true } });
    if (scholar) throw fail('Already accepted Scholars cannot be newly posted as passers. Their historical records remain retained.');
    let published = result;
    if (!result.published_at) {
      const stamp = new Date(Math.max(Date.now(), +new Date(result.updated_at) + 1));
      const changed = await tx.results.updateMany({ where: { id: result.id, updated_at: result.updated_at }, data: { published_at: stamp, published_by: actorId, updated_at: stamp, review_history: [...(result.review_history || []), { operation: 'publish', actorId, at: stamp.toISOString(), reason: 'Posted in locked passer list', score: Number(result.score) }] } });
      if (changed.count !== 1) throw fail('A selected score changed during posting. Refresh and retry.');
      published = { ...result, published_at: stamp, updated_at: stamp };
    }
    await tx.passer_list_members.update({ where: { id: member.id }, data: { snapshot: snapshotOf(published, applicant) } });
  }
  return tx.passer_lists.update({ where: { id: list.id }, data: { status: 'posted', posted_at: now, posted_by: actorId }, include: { members: true } });
};
const index = safe(async (req, res) => {
  const period = await findPrimaryActivePeriod(prisma);
  return res.json({ lists: period ? await prisma.passer_lists.findMany({ where: { academic_period_id: period.id }, include: { members: true }, orderBy: { id: 'desc' }, take: 100 }) : [] });
});
const create = safe(async (req, res) => {
  const body = req.body || {};
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestKey || '') || !['draft', 'posted'].includes(body.status) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 160 || !Array.isArray(body.members) || !body.members.length || body.members.length > 500 || new Set(body.members.map((member) => member.applicantId)).size !== body.members.length) throw fail('Enter a title and select 1–500 distinct passers.', 400);
  if (body.supersedesId && (!Number.isSafeInteger(body.supersedesId) || body.supersedesId <= 0 || typeof body.revisionReason !== 'string' || !body.revisionReason.trim() || body.revisionReason.length > 2000)) throw fail('A revision needs the previous list and a reason of up to 2,000 characters.', 400);
  for (const member of body.members) if (!['applicantId','resultId','examId','applicationId'].every((key) => Number.isSafeInteger(member[key]) && member[key] > 0) || !Number.isFinite(+new Date(member.updatedAt))) throw fail('Reload the selected results before saving.', 400);
  const list = await prisma.$transaction(async (tx) => {
    const existing = await tx.passer_lists.findUnique({ where: { request_key: body.requestKey }, include: { members: true } });
    if (existing) {
      if (existing.created_by !== req.user.id) throw fail('Request key already used.', 409);
      return existing;
    }
    const period = await findPrimaryActivePeriod(tx);
    if (!period) throw fail('Configure a primary academic period.');
    const members = body.members.map((member) => ({ academic_period_id: period.id, applicant_id: member.applicantId, application_id: member.applicationId, exam_id: member.examId, result_id: member.resultId, snapshot: { resultUpdatedAt: member.updatedAt } }));
    for (const member of members) {
      const { result, applicant } = await validateMember(tx, member, period);
      member.snapshot = snapshotOf(result, applicant);
    }
    const draft = await tx.passer_lists.create({ data: { request_key: body.requestKey, academic_period_id: period.id, title: body.title.trim(), created_by: req.user.id, supersedes_id: body.supersedesId || null, revision_reason: body.supersedesId ? body.revisionReason.trim() : null, members: { create: members } }, include: { members: true } });
    return body.status === 'posted' ? postDraft(tx, draft, req.user.id) : draft;
  }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 300000 });
  res.locals.auditTargetId = list.id;
  return res.status(201).json({ list, message: list.status === 'posted' ? 'Passer list posted and locked. Applicants can see their published outcome and initial checklist.' : 'Passer list draft saved. Applicants are not notified until posting.' });
});
const post = safe(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw fail('Select a saved draft.', 400);
  const list = await prisma.$transaction(async (tx) => {
    const draft = await tx.passer_lists.findUnique({ where: { id }, include: { members: true } });
    if (!draft) throw fail('Passer list not found.', 404);
    return postDraft(tx, draft, req.user.id);
  }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 300000 });
  res.locals.auditTargetId = list.id;
  return res.json({ list, message: 'Passer list posted and locked.' });
});
const intake = safe(async (req, res) => {
  const applicantId = Number(req.params.applicantId);
  if (!Number.isSafeInteger(applicantId) || applicantId <= 0) throw fail('Select a passer.', 400);
  const period = await findPrimaryActivePeriod(prisma);
  if (!period) throw fail('No primary period.');
  const application = await prisma.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } });
  const member = await getPostedPasser(prisma, applicantId, period.id, null, application?.id);
  const result = member ? await prisma.results.findFirst({ where: { id: member.result_id, applicant_id: applicantId } }) : null;
  if (!application || !isExaminationApplicationEligible(application) || !result || !await getPostedPasser(prisma, applicantId, period.id, result, application.id)) throw fail('Post the current reviewed passing result in a locked Passer List before initial intake.');
  const applicant = await prisma.applicants.findUnique({ where: { id: applicantId } });
  if (!applicant || applicant.deleted_at) throw fail('Applicant record unavailable.', 404);
  const school = await loadResolvedScholarSchool(prisma, { applicantId, applicant, application });
  const type = schoolClassification(school?.school_type);
  return res.json({ intake: { applicantId, applicationId: application.id, name: member.snapshot.name, academicPeriodId: period.id, schoolYear: period.school_year, semester: period.semester, schoolType: type, entryYearLevel: application.school_plan?.incomingYearLevel || null, initialDocuments: initialChecklist(application.initial_docs, period.id, type, period.id, application.id, application.school_plan?.incomingYearLevel), initialVerified: initialApproved(application.initial_docs, period.id, type, period.id, application.school_plan?.incomingYearLevel), passerListId: member.list_id } });
});
module.exports = { index, create, post, intake, postDraft, validateMember };
