const { Readable } = require('node:stream');
const prisma = require('../config/prisma');
const { parseDataUrl } = require('../services/blobStorage');
const {
  REQUIREMENT_DEFINITIONS,
  applyReviewDecision,
  buildReviewRecords,
  getRequirementDocument,
} = require('../services/documentReview');

const parseApplicationId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getLatestScholarApplications = async () => {
  const scholars = await prisma.scholar_accounts.findMany({ where: { is_active: true }, select: { applicant_id: true } });
  const scholarIds = [...new Set(scholars.map(({ applicant_id }) => applicant_id))];
  if (!scholarIds.length) return [];
  const applications = await prisma.application_submissions.findMany({
    where: { applicant_id: { in: scholarIds } },
    orderBy: { submitted_at: 'desc' },
  });
  const latestByApplicant = new Map();
  applications.forEach((application) => {
    if (!latestByApplicant.has(application.applicant_id)) latestByApplicant.set(application.applicant_id, application);
  });
  return [...latestByApplicant.values()];
};

const getDocumentReviews = async (req, res) => {
  try {
    const applications = await getLatestScholarApplications();
    const applicantIds = applications.map(({ applicant_id }) => applicant_id);
    const reviewerIds = [...new Set(applications.flatMap((application) => Object.values(application.initial_docs?.requirements || {}))
      .map((file) => Number(file?.reviewedBy))
      .filter(Number.isInteger))];
    const activePeriod = await prisma.academic_periods.findFirst({ where: { is_active: true }, orderBy: { updated_at: 'desc' } });
    const [applicants, accounts, reviewers, physicalRequirements] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: applicantIds } } }),
      prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } } }),
      reviewerIds.length ? prisma.admins.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, full_name: true } }) : [],
      activePeriod ? prisma.scholar_requirements.findMany({
        where: { applicant_id: { in: applicantIds }, billing_period_id: activePeriod.id },
        select: { applicant_id: true, folder_physical_submitted: true, folder_physical_submitted_at: true },
      }) : [],
    ]);
    const records = buildReviewRecords({
      applications,
      applicantsById: new Map(applicants.map((applicant) => [applicant.id, applicant])),
      accountsByApplicant: new Map(accounts.map((account) => [account.applicant_id, account])),
      reviewersById: new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.full_name])),
    });
    return res.json({
      stats: {
        total: records.length,
        pending: records.filter(({ status }) => status === 'pending').length,
        approved: records.filter(({ status }) => status === 'approved').length,
        rejected: records.filter(({ status }) => status === 'rejected').length,
      },
      reviews: records,
      physicalFolders: applicants.map((applicant) => {
        const requirement = physicalRequirements.find((item) => item.applicant_id === applicant.id);
        const account = accounts.find((item) => item.applicant_id === applicant.id);
        return {
          applicantId: applicant.id,
          scholarName: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' '),
          controlNumber: account?.control_number || null,
          received: Boolean(requirement?.folder_physical_submitted),
          receivedAt: requirement?.folder_physical_submitted_at || null,
        };
      }),
    });
  } catch (error) {
    console.error('Error loading document reviews:', error);
    return res.status(500).json({ message: 'Server error loading document reviews.' });
  }
};

const updatePhysicalFolder = async (req, res) => {
  try {
    const applicantId = parseApplicationId(req.params.applicantId);
    if (!applicantId || typeof req.body.received !== 'boolean') {
      return res.status(400).json({ message: 'A valid scholar and received status are required.' });
    }
    const [activePeriod, scholar] = await Promise.all([
      prisma.academic_periods.findFirst({ where: { is_active: true }, orderBy: { updated_at: 'desc' } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
    ]);
    if (!activePeriod) return res.status(409).json({ message: 'No active academic period is configured.' });
    if (!scholar) return res.status(404).json({ message: 'Active scholar record not found.' });
    const timestamp = new Date();
    const requirement = await prisma.scholar_requirements.upsert({
      where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: activePeriod.id } },
      create: {
        applicant_id: applicantId,
        billing_period_id: activePeriod.id,
        folder_physical_submitted: req.body.received,
        folder_physical_submitted_at: req.body.received ? timestamp : null,
        updated_by: req.user.id,
      },
      update: {
        folder_physical_submitted: req.body.received,
        folder_physical_submitted_at: req.body.received ? timestamp : null,
        updated_by: req.user.id,
      },
    });
    res.locals.auditTargetId = applicantId;
    return res.json({
      message: req.body.received ? 'Physical folder marked as received.' : 'Physical folder receipt was removed.',
      physicalFolder: { applicantId, received: requirement.folder_physical_submitted, receivedAt: requirement.folder_physical_submitted_at },
    });
  } catch (error) {
    console.error('Error updating physical folder:', error);
    return res.status(500).json({ message: 'Server error updating the physical folder.' });
  }
};

const reviewDocument = async (req, res) => {
  try {
    const applicationId = parseApplicationId(req.params.applicationId);
    const { requirementKey } = req.params;
    const { decision, notes = '' } = req.body;
    if (!applicationId || !REQUIREMENT_DEFINITIONS[requirementKey]) {
      return res.status(400).json({ message: 'A valid application and requirement are required.' });
    }

    const application = await prisma.application_submissions.findUnique({ where: { id: applicationId } });
    if (!application) return res.status(404).json({ message: 'Scholar application not found.' });
    const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: application.applicant_id, is_active: true } });
    if (!scholar) return res.status(403).json({ message: 'Only accepted scholar documents can be reviewed.' });

    const updatedDocuments = applyReviewDecision({
      initialDocs: application.initial_docs || {},
      requirementKey,
      decision,
      reviewerId: req.user.id,
      notes,
    });
    if (!updatedDocuments) return res.status(404).json({ message: 'The uploaded requirement could not be found.' });

    const activePeriod = await prisma.academic_periods.findFirst({ where: { is_active: true }, orderBy: { updated_at: 'desc' } });
    const statusField = REQUIREMENT_DEFINITIONS[requirementKey].statusField;
    const operations = [prisma.application_submissions.update({
      where: { id: applicationId },
      data: { initial_docs: updatedDocuments },
    })];
    if (activePeriod) {
      operations.push(prisma.scholar_requirements.updateMany({
        where: { applicant_id: application.applicant_id, billing_period_id: activePeriod.id },
        data: { [statusField]: decision, updated_by: req.user.id },
      }));
    }
    await prisma.$transaction(operations);
    res.locals.auditTargetId = applicationId;
    return res.json({
      message: decision === 'approved' ? 'Document approved successfully.' : 'Document rejected and returned for correction.',
      review: {
        applicationId,
        requirementKey,
        status: decision,
        reviewNotes: String(notes || '').trim(),
        reviewedAt: updatedDocuments.requirements[requirementKey].reviewedAt,
      },
    });
  } catch (error) {
    console.error('Error reviewing scholar document:', error);
    return res.status(500).json({ message: 'Server error saving the document review.' });
  }
};

const streamDocument = async (req, res) => {
  try {
    const applicationId = parseApplicationId(req.params.applicationId);
    const { requirementKey } = req.params;
    if (!applicationId || !REQUIREMENT_DEFINITIONS[requirementKey]) return res.status(400).json({ message: 'Invalid document request.' });
    const application = await prisma.application_submissions.findUnique({ where: { id: applicationId } });
    const document = getRequirementDocument(application, requirementKey);
    if (!document?.fileName) return res.status(404).json({ message: 'Document not found.' });
    const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: application.applicant_id, is_active: true } });
    if (!scholar) return res.status(403).json({ message: 'Only accepted scholar documents can be opened.' });

    const setDocumentHeaders = () => {
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${String(document.fileName).replace(/["\r\n]/g, '')}"`);
      res.setHeader('Cache-Control', 'private, no-store');
    };

    if (document.fileData) {
      const parsed = parseDataUrl(document.fileData);
      setDocumentHeaders();
      return res.send(parsed.buffer);
    }
    if (!document.fileUrl) return res.status(404).json({ message: 'Document content is unavailable.' });
    const token = process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
    if (!token) return res.status(503).json({ message: 'Document storage is not configured.' });
    const { get } = await import('@vercel/blob');
    const blobResult = await get(document.fileUrl, { access: 'private', token });
    if (!blobResult?.stream) return res.status(404).json({ message: 'Document file was not found in storage.' });
    setDocumentHeaders();
    return Readable.fromWeb(blobResult.stream).pipe(res);
  } catch (error) {
    console.error('Error streaming scholar document:', error);
    if (!res.headersSent) return res.status(500).json({ message: 'Server error opening the document.' });
    return res.end();
  }
};

module.exports = { getDocumentReviews, reviewDocument, streamDocument, updatePhysicalFolder };
