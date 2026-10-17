const { canRecordInitial } = require('../services/passerIntake');
const { Readable } = require('node:stream');
const prisma = require('../config/prisma');
const { parseDataUrl } = require('../services/blobStorage');
const { PRIORITY_PROOFS, isDeclaredPriorityProof } = require('../services/priorityEligibility');
const {
  REQUIREMENT_DEFINITIONS,
  normalizeReviewStatus,
  applyReviewDecision,
  buildReviewRecords,
  getRequirementDocument,
} = require('../services/documentReview');

const { INITIAL_KEYS, CONTINUING_KEYS, getInitialRequirements, WAVES, getWaveSet, getScopedDocument, mutateRequirementWaves, conflict } = require('../services/requirementWaves');

const parseApplicationId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getLatestScholarApplications = async () => {
  const scholars = await prisma.scholar_accounts.findMany({ where: { is_active: true }, select: { applicant_id: true } });
  const scholarIds = new Set(scholars.map(({ applicant_id }) => applicant_id));
  const applications = await prisma.application_submissions.findMany({
    where: { status: { not: 'Withdrawn' } },
    orderBy: { submitted_at: 'desc' },
  });
  const latestByApplicant = new Map();
  applications.forEach((application) => {
    if (!latestByApplicant.has(application.applicant_id)) latestByApplicant.set(application.applicant_id, application);
  });
  return [...latestByApplicant.values()].filter((application) => scholarIds.has(application.applicant_id)
    || Object.keys(application.initial_docs?.requirements || {}).some((key) => PRIORITY_PROOFS[key]));
};

const getPrimaryAcademicPeriod = async () => prisma.academic_periods.findFirst({
  where: { is_active: true, is_primary: true },
  orderBy: { updated_at: 'desc' },
}) || prisma.academic_periods.findFirst({
  where: { is_active: true },
  orderBy: [{ updated_at: 'desc' }, { id: 'desc' }],
});

const getDocumentReviews = async (req, res) => {
  try {
    const applications = await getLatestScholarApplications();
    const primaryPeriod = await getPrimaryAcademicPeriod();
    const periods = await prisma.academic_periods.findMany({ select: { id: true, school_year: true, semester: true } });
    const applicantIds = applications.map(({ applicant_id }) => applicant_id);
    const reviewerIds = [...new Set(applications.flatMap((application) => [...Object.values(application.initial_docs?.requirements || {}), ...Object.values(application.initial_docs?.requirementSets || {}).flatMap((set) => Object.values(set.requirements || {}))])
      .map((file) => Number(file?.reviewedBy))
      .filter(Number.isInteger))];
    const [applicants, accounts, reviewers] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: applicantIds } } }),
      prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } } }),
      reviewerIds.length ? prisma.admins.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, full_name: true } }) : [],
    ]);
    const records = buildReviewRecords({
      applications,
      applicantsById: new Map(applicants.map((applicant) => [applicant.id, applicant])),
      accountsByApplicant: new Map(accounts.map((account) => [account.applicant_id, account])),
      reviewersById: new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.full_name])),
      legacyPeriodId: primaryPeriod?.id,
    });
    const periodById = new Map(periods.map((period) => [period.id, period]));
    records.forEach((record) => { const period = periodById.get(record.academicPeriodId); record.periodLabel = period ? `${period.school_year} · ${period.semester}` : ''; });
    return res.json({
      stats: {
        total: records.length,
        pending: records.filter(({ status }) => status === 'pending').length,
        approved: records.filter(({ status }) => status === 'approved').length,
        rejected: records.filter(({ status }) => status === 'rejected').length,
      },
      reviews: records,
    });
  } catch (error) {
    console.error('Error loading document reviews:', error);
    return res.status(500).json({ message: 'Server error loading document reviews.' });
  }
};

const reviewWave = async (req, res, application, primaryPeriod, bulk = false) => {
  const periodId = Number(req.body.academicPeriodId);
  const wave = req.body.submissionWave;
  if (!Number.isInteger(periodId) || periodId <= 0 || !WAVES.has(wave)) return res.status(400).json({ message: 'Refresh and select the document period and submission wave.' });
  if (!primaryPeriod) return res.status(409).json({ message: 'An active academic period is required.' });
  const saved = await mutateRequirementWaves(prisma, application.id, primaryPeriod.id, (docs) => {
    const set = getWaveSet(docs, periodId, wave, primaryPeriod.id);
    const keys = bulk ? Object.keys(set.requirements).filter((key) => normalizeReviewStatus(set.requirements[key].status) === 'pending') : [req.params.requirementKey];
    if (!keys.length) throw Object.assign(new Error('This document set has no pending files.'), { statusCode: 409, exactFileConflict: true });
    if (bulk) {
      const expected = req.body.documents;
      if (!Array.isArray(expected) || expected.length > 6 || expected.some((item) => !item || typeof item.requirementKey !== 'string' || !Number.isInteger(item.revision) || item.revision < 0)) throw Object.assign(new Error('Reload the review queue before approving this submission.'), { statusCode: 400 });
      if (expected.length !== keys.length || new Set(expected.map((item) => item.requirementKey)).size !== expected.length
        || keys.some((key) => { const file = set.requirements[key]; const item = expected.find((entry) => entry.requirementKey === key); return !item || (item.versionId || undefined) !== file.versionId || item.revision !== (file.revision || 0); })) {
        throw Object.assign(conflict('A pending file changed. Reload and review the current files before approving them.'), { exactFileConflict: true });
      }
    }
    const reviewedAt = new Date().toISOString();
    keys.forEach((key) => {
      const file = set.requirements[key];
      if (!file?.fileName) throw Object.assign(new Error('Document not found in this submission.'), { statusCode: 404 });
      if (!bulk && (file.versionId !== (req.body.versionId || undefined) || (file.revision || 0) !== req.body.revision)) {
        throw Object.assign(conflict('This file or review changed. Reload the document before reviewing it.'), { exactFileConflict: true });
      }
      if (file.reviewedAt) (file.reviewHistory ||= []).push({ status: file.status, reviewedAt: file.reviewedAt, reviewedBy: file.reviewedBy, reviewNotes: file.reviewNotes || '' });
      Object.assign(file, { status: bulk || req.body.decision === 'approved' ? 'Approved' : 'Rejected', reviewedAt, reviewedBy: req.user.id,
        reviewNotes: bulk ? 'Approved together within this period and submission wave.' : String(req.body.notes || '').trim(), revision: (file.revision || 0) + 1 });
    });
    docs.requirementSets[`${periodId}:${wave}`] = set;
    return { keys, reviewedAt };
  });
  res.locals.auditTargetId = application.id;
  res.locals.auditDescription = `Reviewed ${saved.keys.length} ${wave} documents for academic period ${periodId}.`;
  return res.json({ message: bulk ? `${saved.keys.length} pending documents approved in this submission.` : 'Document review saved for the selected period and wave.', approvedCount: bulk ? saved.keys.length : undefined });
};

const reviewDocument = async (req, res) => {
  try {
    const applicationId = parseApplicationId(req.params.applicationId);
    const { requirementKey } = req.params;
    const { decision, notes = '' } = req.body;
    if (!['approved', 'rejected'].includes(decision) || typeof notes !== 'string' || notes.length > 500) return res.status(400).json({ message: 'A valid decision and notes up to 500 characters are required.' });
    if (!applicationId || !REQUIREMENT_DEFINITIONS[requirementKey]) {
      return res.status(400).json({ message: 'A valid application and requirement are required.' });
    }

    const application = await prisma.application_submissions.findUnique({ where: { id: applicationId } });
    if (!application) return res.status(404).json({ message: 'Scholar application not found.' });
    const definition = REQUIREMENT_DEFINITIONS[requirementKey];
    const priorityProof = definition.category === 'priority';
    const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: application.applicant_id } });
    if (!scholar?.is_active && !priorityProof) return res.status(403).json({ message: 'Only accepted scholar documents can be reviewed.' });
    if (priorityProof && !isDeclaredPriorityProof({ eligibility: application.eligibility, proofKey: requirementKey })) {
      return res.status(409).json({ message: 'This proof does not match a declared eligibility criterion.' });
    }

    const scopedPeriod = await getPrimaryAcademicPeriod();
    if (!scopedPeriod) return res.status(409).json({ message: 'An active academic period is required for document review.' });
    if (!priorityProof) return await reviewWave(req, res, application, scopedPeriod);

    const updatedDocuments = applyReviewDecision({
      initialDocs: application.initial_docs || {},
      requirementKey,
      decision,
      reviewerId: req.user.id,
      notes,
    });
    if (!updatedDocuments) return res.status(404).json({ message: 'The uploaded requirement could not be found.' });

    const activePeriod = await getPrimaryAcademicPeriod();
    const statusField = definition.statusField;
    const operations = [];
    if (activePeriod && statusField) {
      operations.push((tx) => tx.scholar_requirements.updateMany({
        where: { applicant_id: application.applicant_id, billing_period_id: activePeriod.id },
        data: { [statusField]: decision, updated_by: req.user.id },
      }));
    }
    await mutateRequirementWaves(prisma, applicationId, activePeriod?.id, async (docs, tx) => {
      if (JSON.stringify(docs.requirements?.[requirementKey]) !== JSON.stringify(application.initial_docs?.requirements?.[requirementKey])) throw Object.assign(conflict(), { exactFileConflict: true });
      docs.requirements[requirementKey] = updatedDocuments.requirements[requirementKey];
      for (const operation of operations) await operation(tx);
      return {};
    });
    res.locals.auditTargetId = applicationId;
    return res.json({
      message: decision === 'approved' ? 'Document approved. Scholar registration follows posted results and initial-document verification.' : 'Document rejected and returned for correction.',
      review: {
        applicationId,
        requirementKey,
        status: decision,
        reviewNotes: String(notes || '').trim(),
        reviewedAt: updatedDocuments.requirements[requirementKey].reviewedAt,
      },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error reviewing scholar document:', error);
    return res.status(500).json({ message: 'Server error saving the document review.' });
  }
};

const approvePendingDocuments = async (req, res) => {
  try {
    const applicationId = parseApplicationId(req.params.applicationId);
    if (!applicationId) return res.status(400).json({ message: 'A valid scholar application is required.' });

    const application = await prisma.application_submissions.findUnique({ where: { id: applicationId } });
    if (!application) return res.status(404).json({ message: 'Scholar application not found.' });
    const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: application.applicant_id, is_active: true } });
    if (!scholar) return res.status(403).json({ message: 'Only accepted scholar documents can be reviewed.' });

    return await reviewWave(req, res, application, await getPrimaryAcademicPeriod(), true);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error('Error bulk approving scholar documents:', error);
    return res.status(500).json({ message: 'Server error approving the pending documents.' });
  }
};

// File contents are served only after the caller has resolved its authorized document.
const sendStoredDocument = async (document, res) => {
    const setDocumentHeaders = (contentType) => {
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${String(document.fileName).replace(/[^\x20-\x7e]|["]/g, '_')}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    };

    if (document.fileData) {
      const parsed = parseDataUrl(document.fileData);
      setDocumentHeaders(parsed.contentType);
      return res.send(parsed.buffer);
    }
    if (!document.fileUrl) return res.status(404).json({ message: 'Document content is unavailable.' });
    const token = process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(503).json({ message: 'Document storage is not configured.' });
    const { get } = await import('@vercel/blob');
    const blobResult = await get(document.fileUrl, { access: 'private', token });
    if (!blobResult?.stream) return res.status(404).json({ message: 'Document file was not found in storage.' });
    setDocumentHeaders(document.fileType || blobResult.blob?.contentType);
    return Readable.fromWeb(blobResult.stream).pipe(res);
};

// Ownership is derived exclusively from the authenticated control account, never a URL applicant ID.
const streamMyDocument = async (req, res) => {
  try {
    if (!['Applicant', 'Scholar'].includes(req.user?.role)) return res.status(403).json({ message: 'Only your own applicant documents can be opened here.' });
    const { requirementKey } = req.params;
    const wave = req.query?.submissionWave;
    const periodId = Number(req.query?.academicPeriodId);
    const keys = wave === 'initial' ? INITIAL_KEYS : wave === 'continuing' ? CONTINUING_KEYS : [];
    if (!keys.includes(requirementKey) || !Number.isSafeInteger(periodId) || periodId <= 0 || req.query?.versionId) return res.status(400).json({ message: 'Invalid document scope.' });
    const application = await prisma.application_submissions.findFirst({ where: { applicant_id: req.user.id }, orderBy: { submitted_at: 'desc' } });
    if (!application || application.applicant_id !== req.user.id) return res.status(404).json({ message: 'Document not found.' });
    const primary = await getPrimaryAcademicPeriod();
    if (!primary) return res.status(409).json({ message: 'An active academic period is required.' });
    const document = wave === 'initial'
      ? getInitialRequirements(application.initial_docs, periodId, primary.id).requirements[requirementKey]
      : getScopedDocument(application.initial_docs, periodId, wave, requirementKey, null, primary.id);
    if (!document?.fileName) return res.status(404).json({ message: 'Document not found.' });
    return await sendStoredDocument(document, res);
  } catch (error) {
    console.error('Error opening own requirement document:', error.name);
    if (!res.headersSent) return res.status(500).json({ message: 'Unable to open the document.' });
    return res.end();
  }
};

const streamDocument = async (req, res) => {
  try {
    const applicationId = parseApplicationId(req.params.applicationId);
    const { requirementKey } = req.params;
    if (!applicationId || !REQUIREMENT_DEFINITIONS[requirementKey]) return res.status(400).json({ message: 'Invalid document request.' });
    const application = await prisma.application_submissions.findUnique({ where: { id: applicationId } });
    const wave = req.query?.submissionWave;
    const periodId = Number(req.query?.academicPeriodId);
    if (wave && (!WAVES.has(wave) || !Number.isInteger(periodId) || periodId <= 0)) return res.status(400).json({ message: 'Invalid document scope.' });
    const primaryPeriod = wave ? await getPrimaryAcademicPeriod() : null;
    const document = wave ? getScopedDocument(application?.initial_docs, periodId, wave, requirementKey, req.query.versionId, primaryPeriod?.id) : getRequirementDocument(application, requirementKey);
    if (!document?.fileName) return res.status(404).json({ message: 'Document not found.' });
    const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: application.applicant_id, is_active: true } });
    if (!scholar && REQUIREMENT_DEFINITIONS[requirementKey].category !== 'priority' && !(wave === 'initial' && await canRecordInitial(prisma, application.applicant_id, periodId, application))) return res.status(403).json({ message: 'Only current posted passer or Scholar documents can be opened.' });

    return await sendStoredDocument(document, res);
  } catch (error) {
    console.error('Error streaming scholar document:', error);
    if (!res.headersSent) return res.status(500).json({ message: 'Server error opening the document.' });
    return res.end();
  }
};

module.exports = { approvePendingDocuments, getDocumentReviews, reviewDocument, streamDocument, streamMyDocument };
