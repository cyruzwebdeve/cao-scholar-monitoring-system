const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const {
  BlobStorageConfigurationError,
  deleteBlob,
  isBlobUrl,
  parseDataUrl,
  uploadDataUrl,
} = require('../services/blobStorage');
const {
  sendApplicantAccountEmail,
  sendExamSubmittedEmail,
  sendPayrollCompletedEmail,
  sendScholarApprovedEmail,
} = require('../services/mailer');
const {
  evaluateBillingEligibility,
  evaluateBillingOverride,
  isPayableClaim,
} = require('../services/lifecycleIntegrity');
const {
  assignApplicantToMunicipalityExam,
  assignApplicantsToMunicipalityExams,
  countScheduledApplicants,
  indexExamsByMunicipality,
  normalizeMunicipality,
} = require('../services/examAssignments');
const { recordActivitySafely } = require('../services/activityLog');
const { getApplicationAvailability } = require('../services/applicationAvailability');
const { buildApplicantGuidance } = require('../services/applicantGuidance');
const { evaluateEligibility, serializeAssessment } = require('../services/eligibilityRecommendation');
const { PRIORITY_PROOFS, selectedPriorityCriteria } = require('../services/priorityEligibility');

const APPLICATION_STATUSES = {
  APPLIED: 'Applied',
  EXAMINED: 'Examined',
  PASSED_EXAM: 'Passed_Exam',
  REQUIREMENTS_SUBMITTED: 'Requirements_Submitted',
  ACTIVE_SCHOLAR: 'Active_Scholar',
  PAYOUT_COMPLIANT: 'Payout_Compliant',
  IN_PAYROLL: 'In_Payroll',
  PAID: 'Paid',
};

const PASSING_SCORE = 75;
const CURRENT_SCHOOL_YEAR = '2026-2027';
const STALE_DEFAULT_SCHOOL_YEAR = '2025-2026';
const DEFAULT_SEMESTER = '1st Semester';
const PRIORITY_PROOF_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const storePriorityProof = async ({ applicantPath, eligibility, priorityProof }) => {
  const selected = selectedPriorityCriteria(eligibility);
  if (!selected.length) return { initialDocs: {}, uploadedUrl: null };
  const definition = PRIORITY_PROOFS[priorityProof?.proofKey];
  if (!definition || !selected.some(({ proofKey }) => proofKey === priorityProof.proofKey)) {
    throw Object.assign(new Error('Select a declared eligibility criterion for the supporting proof.'), { statusCode: 400 });
  }
  if (typeof priorityProof.fileName !== 'string' || typeof priorityProof.fileData !== 'string') {
    throw Object.assign(new Error('Upload a PDF, JPG, or PNG proof for one selected eligibility criterion.'), { statusCode: 400 });
  }
  let parsed;
  try { parsed = parseDataUrl(priorityProof.fileData); } catch (error) { throw Object.assign(error, { statusCode: 400 }); }
  if (!PRIORITY_PROOF_FILE_TYPES.has(parsed.contentType)) throw Object.assign(new Error('Eligibility proof must be a PDF, JPG, or PNG file.'), { statusCode: 400 });
  if (parsed.buffer.length > 6 * 1024 * 1024) throw Object.assign(new Error('Eligibility proof must be smaller than 6 MB.'), { statusCode: 413 });
  const token = process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
  let storedFile;
  if (token || process.env.NODE_ENV === 'production') {
    const blob = await uploadDataUrl({ dataUrl: priorityProof.fileData, fileName: priorityProof.fileName, contentType: parsed.contentType, pathSegments: ['eligibility-proofs', applicantPath, priorityProof.proofKey], token, access: 'private' });
    storedFile = { fileName: priorityProof.fileName, fileType: blob.contentType, fileUrl: blob.url, pathname: blob.pathname, storage: 'vercel-blob-private', status: 'Pending', uploadedAt: new Date().toISOString() };
  } else {
    storedFile = { fileName: priorityProof.fileName, fileType: parsed.contentType, fileData: priorityProof.fileData, storage: 'database', status: 'Pending', uploadedAt: new Date().toISOString() };
  }
  return { initialDocs: { requirements: { [priorityProof.proofKey]: storedFile } }, uploadedUrl: storedFile.fileUrl || null };
};

const serializeAcademicPeriod = (period) => ({
  id: period.id,
  schoolYear: period.school_year,
  semester: period.semester,
  startDate: period.start_date,
  endDate: period.end_date,
  status: period.status,
  isActive: period.is_active,
  createdAt: period.created_at,
  updatedAt: period.updated_at,
});

const getActiveAcademicPeriodRecord = async (client = prisma) => {
  const period = await client.academic_periods.findFirst({
    where: { is_active: true },
    orderBy: { updated_at: 'desc' },
  });
  return period || {
    id: Number(CURRENT_SCHOOL_YEAR.replace('-', '')),
    school_year: CURRENT_SCHOOL_YEAR,
    semester: DEFAULT_SEMESTER,
    start_date: null,
    end_date: null,
    status: 'active',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
};

const normalizeFamilyName = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]/gi, '')
  .toUpperCase();

const hasMatchingParents = (candidateFamily, existingFamily) => {
  if (!candidateFamily || !existingFamily || typeof existingFamily !== 'object') return false;
  const candidateFather = normalizeFamilyName(candidateFamily.fatherName);
  const candidateMother = normalizeFamilyName(candidateFamily.motherName);
  if (!candidateFather || !candidateMother) return false;
  return candidateFather === normalizeFamilyName(existingFamily.fatherName)
    && candidateMother === normalizeFamilyName(existingFamily.motherName);
};

const createApplication = async (req, res) => {
  let uploadedPriorityProofUrl = null;
  try {
    const availability = await getApplicationAvailability(prisma);
    if (!availability.isOpen) {
      return res.status(403).json({
        code: 'APPLICATIONS_CLOSED',
        message: availability.message,
        availability,
      });
    }

    const { email, password, personalInfo, initialDocs } = req.body;

    if (!personalInfo || typeof personalInfo !== 'object') {
      return res.status(400).json({ message: 'Missing required application fields.' });
    }

    const identity = personalInfo.identity || {};
    const address = personalInfo.address || {};
    const family = personalInfo.family || {};
    if (!normalizeFamilyName(family.fatherName) || !normalizeFamilyName(family.motherName)) {
      return res.status(400).json({ message: 'Both parents’ full names are required to verify the one-sibling scholarship rule.' });
    }
    if (personalInfo.eligibility?.siblingRuleAccepted !== true) {
      return res.status(400).json({ message: 'You must confirm that no sibling has an active PGCEAP application or scholarship.' });
    }

    const normalizedEmail = String(email || identity.email || '').toLowerCase().trim();
    const existingApplicant = await prisma.applicants.findFirst({ where: { email: normalizedEmail } });
    if (existingApplicant) return res.status(409).json({ message: 'An applicant account already exists for this email address.' });

    const existing = await prisma.application_submissions.findFirst({
      where: { email: normalizedEmail, status: { not: 'Withdrawn' } },
      orderBy: { submitted_at: 'desc' },
    });
    if (existing) return res.status(409).json({ message: 'An application already exists for this email address.' });

    const activeFamilyApplications = await prisma.application_submissions.findMany({
      where: { status: { not: 'Withdrawn' } },
      select: { family: true },
    });
    if (activeFamilyApplications.some((application) => hasMatchingParents(family, application.family))) {
      return res.status(409).json({
        code: 'SIBLING_ALREADY_APPLIED',
        message: 'Another sibling from this family already has an active PGCEAP application or scholarship. Only one sibling per family is allowed at a time.',
      });
    }

    const activePeriod = await getActiveAcademicPeriodRecord();

    const storedPriorityProof = await storePriorityProof({ applicantPath: normalizedEmail, eligibility: personalInfo.eligibility, priorityProof: initialDocs?.priorityProof });
    uploadedPriorityProofUrl = storedPriorityProof.uploadedUrl;
    const generatedPassword = password || `Scholar@${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await bcrypt.hash(generatedPassword, 12);

    const { application, account } = await prisma.$transaction(async (tx) => {
      const applicant = await tx.applicants.create({
        data: {
          first_name: identity.firstName,
          middle_name: identity.middleName || null,
          last_name: identity.familyName,
          name_ext: identity.nameExtension || null,
          email: normalizedEmail,
          phone: identity.mobile,
          street: address.houseNumber,
          barangay: address.barangay,
          municipality: address.municipality,
          gender: identity.sex,
          date_of_birth: new Date(identity.birthday),
          birthplace: identity.birthplace,
          civil_status: identity.civilStatus,
          family_income: family.familyIncome,
          guardians: JSON.stringify({
            fatherName: family.fatherName,
            fatherOccupation: family.fatherOccupation,
            motherName: family.motherName,
            motherOccupation: family.motherOccupation,
            guardianName: family.guardianName,
            guardianOccupation: family.guardianOccupation,
          }),
          siblings_boys: family.brothersCount === '5+' ? 5 : Number(family.brothersCount || 0),
          siblings_girls: family.sistersCount === '5+' ? 5 : Number(family.sistersCount || 0),
          school_year: activePeriod.school_year,
          status: 'pending',
        },
      });
      const account = await tx.control_accounts.create({
        data: {
          applicant_id: applicant.id,
          control_number: `PGCEAP-${String(applicant.id).padStart(3, '0')}`,
          username: normalizedEmail,
          password_hash: passwordHash,
        },
      });
      const application = await tx.application_submissions.create({
        data: {
          applicant_id: applicant.id,
          email: normalizedEmail,
          identity,
          address,
          school_plan: personalInfo.schoolPlan,
          family,
          eligibility: personalInfo.eligibility,
          initial_docs: storedPriorityProof.initialDocs,
          status: APPLICATION_STATUSES.APPLIED,
        },
      });
      await assignApplicantToMunicipalityExam(tx, {
        applicantId: applicant.id,
        municipality: applicant.municipality,
        academicYear: activePeriod.school_year,
      });
      return { application, account };
    });
    uploadedPriorityProofUrl = null;

    await recordActivitySafely(prisma, {
      user: { id: application.applicant_id, role: 'Applicant' },
      action: 'APPLICATION_SUBMITTED',
      description: 'Submitted a scholarship application.',
      targetTable: 'application_submissions',
      targetId: application.id,
      ipAddress: req.ip,
    });

    const emailDelivery = await sendApplicantAccountEmail({
      to: normalizedEmail,
      firstName: identity.firstName,
      controlNumber: account.control_number,
      temporaryPassword: generatedPassword,
    });

    const response = {
      message: 'Application submitted and applicant account created.',
      application,
      applicant: { id: application.applicant_id, email: normalizedEmail, controlNumber: account.control_number },
      notification: { accountEmailSent: emailDelivery.sent },
    };
    if (process.env.NODE_ENV !== 'production') response.applicant.temporaryPassword = generatedPassword;
    return res.status(201).json(response);
  } catch (error) {
    console.error(error);
    if (uploadedPriorityProofUrl) await deleteBlob(uploadedPriorityProofUrl, process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN);
    if (error instanceof BlobStorageConfigurationError || error.statusCode) return res.status(error.statusCode || 500).json({ message: error.message });
    return res.status(500).json({ message: 'Server error submitting application.' });
  }
};

const inputExamScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { examScore } = req.body;

    if (typeof examScore !== 'number') {
      return res.status(400).json({ message: 'Exam score must be a number.' });
    }

    const scholar = await prisma.scholar.findUnique({ where: { id: Number(id) } });
    if (!scholar) {
      return res.status(404).json({ message: 'Scholar application not found.' });
    }

    const updatedStatus = examScore >= PASSING_SCORE ? APPLICATION_STATUSES.PASSED_EXAM : APPLICATION_STATUSES.EXAMINED;

    const updatedScholar = await prisma.scholar.update({
      where: { id: Number(id) },
      data: {
        examScore,
        status: updatedStatus,
      },
    });

    return res.status(200).json({ message: 'Exam score updated.', scholar: updatedScholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating exam score.' });
  }
};

const submitRequirements = async (req, res) => {
  try {
    const { id } = req.params;
    const { payoutComplianceDocs } = req.body;

    const scholar = await prisma.scholar.findUnique({ where: { id: Number(id) } });
    if (!scholar) {
      return res.status(404).json({ message: 'Scholar record not found.' });
    }

    if (req.user.id !== scholar.userId && req.user.role !== 'SuperAdmin') {
      return res.status(403).json({ message: 'Access Denied. Cannot update this scholar.' });
    }

    const updatedScholar = await prisma.scholar.update({
      where: { id: Number(id) },
      data: {
        payoutComplianceDocs: payoutComplianceDocs || scholar.payoutComplianceDocs,
        status: APPLICATION_STATUSES.REQUIREMENTS_SUBMITTED,
      },
    });

    return res.status(200).json({ message: 'Requirements submitted.', scholar: updatedScholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error submitting requirements.' });
  }
};

const activateScholar = async (req, res) => {
  try {
    const { id } = req.params;
    const scholar = await prisma.scholar.findUnique({ where: { id: Number(id) } });
    if (!scholar) {
      return res.status(404).json({ message: 'Scholar record not found.' });
    }

    const updatedScholar = await prisma.scholar.update({
      where: { id: Number(id) },
      data: {
        status: APPLICATION_STATUSES.ACTIVE_SCHOLAR,
      },
    });

    return res.status(200).json({ message: 'Scholar activated.', scholar: updatedScholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error activating scholar.' });
  }
};

const markPayoutCompliant = async (req, res) => {
  try {
    const { id } = req.params;
    const scholar = await prisma.scholar.findUnique({ where: { id: Number(id) } });
    if (!scholar) {
      return res.status(404).json({ message: 'Scholar record not found.' });
    }

    const updatedScholar = await prisma.scholar.update({
      where: { id: Number(id) },
      data: {
        status: APPLICATION_STATUSES.PAYOUT_COMPLIANT,
      },
    });

    return res.status(200).json({ message: 'Scholar marked payout compliant.', scholar: updatedScholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating scholar payout status.' });
  }
};

const getEligibleScholars = async (req, res) => {
  try {
    const eligibleStatuses = [APPLICATION_STATUSES.ACTIVE_SCHOLAR, APPLICATION_STATUSES.PAYOUT_COMPLIANT];
    const scholars = await prisma.scholar.findMany({
      where: { status: { in: eligibleStatuses } },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    return res.status(200).json({ scholars });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching eligible scholars.' });
  }
};

const getScholarsByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    if (!status || !Object.values(APPLICATION_STATUSES).includes(status)) {
      return res.status(400).json({ message: 'A valid scholar status query is required.' });
    }

    const scholars = await prisma.scholar.findMany({
      where: { status },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    return res.status(200).json({ scholars });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching scholars by status.' });
  }
};

const createPayrollBatch = async (req, res) => {
  try {
    const { totalAmount } = req.body;
    if (typeof totalAmount !== 'number' || totalAmount < 0) {
      return res.status(400).json({ message: 'A valid total amount is required.' });
    }

    const eligibleScholars = await prisma.scholar.findMany({ where: { status: APPLICATION_STATUSES.PAYOUT_COMPLIANT } });
    if (!eligibleScholars.length) {
      return res.status(400).json({ message: 'No payout-compliant scholars available for batching.' });
    }

    const batch = await prisma.payrollBatch.create({
      data: {
        createdBy: { connect: { id: req.user.id } },
        totalAmount,
        status: 'pending',
        scholars: {
          connect: eligibleScholars.map((scholar) => ({ id: scholar.id })),
        },
      },
      include: { scholars: true },
    });

    await prisma.scholar.updateMany({
      where: { id: { in: eligibleScholars.map((scholar) => scholar.id) } },
      data: { status: APPLICATION_STATUSES.IN_PAYROLL, payrollBatchId: batch.id },
    });

    return res.status(201).json({ message: 'Payroll batch created.', batch });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error creating payroll batch.' });
  }
};

const releasePayrollBatch = async (req, res) => {
  try {
    const { id } = req.params;
    const batch = await prisma.payrollBatch.findUnique({
      where: { id: Number(id) },
      include: { scholars: true },
    });

    if (!batch) {
      return res.status(404).json({ message: 'Payroll batch not found.' });
    }

    const updatedBatch = await prisma.payrollBatch.update({
      where: { id: Number(id) },
      data: { status: 'released' },
    });

    await prisma.scholar.updateMany({
      where: { payrollBatchId: Number(id), status: APPLICATION_STATUSES.IN_PAYROLL },
      data: { status: APPLICATION_STATUSES.PAID },
    });

    return res.status(200).json({ message: 'Payroll batch released.', batch: updatedBatch });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error releasing payroll batch.' });
  }
};

const markPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const scholar = await prisma.scholar.findUnique({ where: { id: Number(id) } });
    if (!scholar) {
      return res.status(404).json({ message: 'Scholar record not found.' });
    }

    const updatedScholar = await prisma.scholar.update({
      where: { id: Number(id) },
      data: {
        status: APPLICATION_STATUSES.PAID,
      },
    });

    return res.status(200).json({ message: 'Scholar marked paid.', scholar: updatedScholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error marking scholar paid.' });
  }
};

const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const scholar = await prisma.scholar.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { id: true, email: true, role: true } } },
    });

    if (!scholar) {
      return res.status(404).json({ message: 'Scholar application not found.' });
    }

    const isOwner = req.user.id === scholar.userId;
    const allowedViewerRoles = ['SuperAdmin', 'BillingPayrollAdmin'];

    if (!isOwner && !allowedViewerRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access Denied. Cannot view this application.' });
    }

    return res.status(200).json({ scholar });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching application.' });
  }
};

const ACADEMIC_PERIOD_SEMESTERS = ['1st Semester', '2nd Semester', 'Summer'];

const getActiveAcademicPeriod = async (req, res) => {
  try {
    const period = await getActiveAcademicPeriodRecord();
    return res.json({ period: serializeAcademicPeriod(period) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching the active academic period.' });
  }
};

const getAcademicPeriods = async (req, res) => {
  try {
    const periods = await prisma.academic_periods.findMany({
      orderBy: [{ school_year: 'desc' }, { semester: 'asc' }],
    });
    return res.json({ periods: periods.map(serializeAcademicPeriod) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching academic periods.' });
  }
};

const createAcademicPeriod = async (req, res) => {
  try {
    const schoolYear = String(req.body.schoolYear || '').trim();
    const semester = String(req.body.semester || '').trim();
    const match = /^(\d{4})-(\d{4})$/.exec(schoolYear);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) {
      return res.status(400).json({ message: 'School year must use a consecutive YYYY-YYYY format.' });
    }
    if (!ACADEMIC_PERIOD_SEMESTERS.includes(semester)) {
      return res.status(400).json({ message: 'Select a valid semester.' });
    }
    const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    if (startDate && Number.isNaN(startDate.getTime())) return res.status(400).json({ message: 'Enter a valid start date.' });
    if (endDate && Number.isNaN(endDate.getTime())) return res.status(400).json({ message: 'Enter a valid end date.' });
    if (startDate && endDate && endDate < startDate) return res.status(400).json({ message: 'End date must be on or after the start date.' });

    const period = await prisma.academic_periods.create({
      data: {
        school_year: schoolYear,
        semester,
        start_date: startDate,
        end_date: endDate,
        status: 'upcoming',
        is_active: false,
        created_by: req.user.id,
      },
    });
    return res.status(201).json({ message: 'Academic period created.', period: serializeAcademicPeriod(period) });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'That school year and semester already exist.' });
    console.error(error);
    return res.status(500).json({ message: 'Server error creating the academic period.' });
  }
};

const activateAcademicPeriod = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Select a valid academic period.' });
    const existing = await prisma.academic_periods.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Academic period not found.' });
    if (existing.is_active) return res.json({ message: 'This academic period is already active.', period: serializeAcademicPeriod(existing) });

    const period = await prisma.$transaction(async (transaction) => {
      await transaction.academic_periods.updateMany({
        where: { is_active: true },
        data: { is_active: false, status: 'archived' },
      });
      return transaction.academic_periods.update({
        where: { id },
        data: { is_active: true, status: 'active' },
      });
    });
    return res.json({
      message: `${period.school_year} · ${period.semester} is now the active academic period.`,
      period: serializeAcademicPeriod(period),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error activating the academic period.' });
  }
};

const ANNOUNCEMENT_AUDIENCES = ['all', 'applicants', 'scholars', 'applicants_scholars', 'admins'];
const ANNOUNCEMENT_PRIORITIES = ['normal', 'high', 'urgent'];
const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'archived'];

const serializeAnnouncement = (announcement) => ({
  id: announcement.id,
  title: announcement.title,
  content: announcement.content,
  audience: announcement.audience,
  priority: announcement.priority,
  status: announcement.status,
  publishAt: announcement.publish_at,
  expiresAt: announcement.expires_at,
  publishedAt: announcement.published_at,
  imageName: announcement.image_name,
  imageType: announcement.image_type,
  imageData: announcement.image_data,
  createdBy: announcement.created_by,
  createdAt: announcement.created_at,
  updatedAt: announcement.updated_at,
});

const parseAnnouncementPayload = (body) => {
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const audience = String(body.audience || 'all').toLowerCase();
  const priority = String(body.priority || 'normal').toLowerCase();
  const status = String(body.status || 'draft').toLowerCase();
  const publishAt = body.publishAt ? new Date(body.publishAt) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const imageName = body.imageName ? String(body.imageName).trim().slice(0, 255) : null;
  const imageType = body.imageType ? String(body.imageType).trim().slice(0, 100) : null;
  const imageData = body.imageData ? String(body.imageData) : null;
  if (!title || title.length > 200) return { error: 'Announcement title is required and must not exceed 200 characters.' };
  if (!content || content.length > 5000) return { error: 'Announcement content is required and must not exceed 5,000 characters.' };
  if (!ANNOUNCEMENT_AUDIENCES.includes(audience)) return { error: 'Select a valid announcement audience.' };
  if (!ANNOUNCEMENT_PRIORITIES.includes(priority)) return { error: 'Select a valid announcement priority.' };
  if (!ANNOUNCEMENT_STATUSES.includes(status)) return { error: 'Select a valid publishing status.' };
  if (publishAt && Number.isNaN(publishAt.getTime())) return { error: 'Enter a valid publishing date.' };
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: 'Enter a valid expiration date.' };
  if (status === 'scheduled' && !publishAt) return { error: 'A publishing date is required for scheduled announcements.' };
  const isImageDataUrl = /^data:image\/(jpeg|png|webp|gif);base64,/i.test(imageData || '');
  if (imageData && !isImageDataUrl && !isBlobUrl(imageData)) return { error: 'Upload a valid JPG, PNG, WEBP, or GIF image.' };
  if (isImageDataUrl && imageData.length > 4.5 * 1024 * 1024) return { error: 'Announcement image must not exceed 3 MB.' };
  const effectivePublishDate = publishAt || new Date();
  if (expiresAt && expiresAt <= effectivePublishDate) return { error: 'Expiration must be later than the publishing date.' };
  return { title, content, audience, priority, status, publishAt, expiresAt, imageName, imageType, imageData };
};

const persistAnnouncementImage = async (payload) => {
  if (!payload.imageData || isBlobUrl(payload.imageData)) return payload.imageData;
  const token = process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN;
  if (!token && process.env.NODE_ENV !== 'production') return payload.imageData;
  const blob = await uploadDataUrl({
    dataUrl: payload.imageData,
    fileName: payload.imageName || 'announcement-image',
    contentType: payload.imageType,
    pathSegments: ['announcements', new Date().getUTCFullYear()],
    token,
    access: 'public',
  });
  return blob.url;
};

const publishDueAnnouncements = async () => {
  const now = new Date();
  await prisma.announcements.updateMany({
    where: { status: 'scheduled', publish_at: { lte: now } },
    data: { status: 'published', published_at: now },
  });
};

const getAnnouncementManagement = async (req, res) => {
  try {
    await publishDueAnnouncements();
    const announcements = await prisma.announcements.findMany({ orderBy: { updated_at: 'desc' } });
    return res.json({ announcements: announcements.map(serializeAnnouncement) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching announcements.' });
  }
};

const getLatestPublishedAnnouncement = async (req, res) => {
  try {
    await publishDueAnnouncements();
    const roleAudiences = req.user.role === 'Scholar'
      ? ['all', 'scholars', 'applicants_scholars']
      : req.user.role === 'Applicant'
        ? ['all', 'applicants', 'applicants_scholars']
        : ['all', 'admins'];
    const now = new Date();
    const availableAnnouncements = await prisma.announcements.findMany({
      where: {
        status: 'published',
        audience: { in: roleAudiences },
        OR: [{ publish_at: null }, { publish_at: { lte: now } }],
        AND: [{ OR: [{ expires_at: null }, { expires_at: { gt: now } }] }],
      },
      orderBy: [{ published_at: 'desc' }, { updated_at: 'desc' }],
      take: 50,
    });
    const priorityWeight = { urgent: 3, high: 2, normal: 1 };
    const announcement = availableAnnouncements.sort((left, right) => {
      const priorityDifference = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
      if (priorityDifference) return priorityDifference;
      return new Date(right.published_at || right.updated_at) - new Date(left.published_at || left.updated_at);
    })[0] || null;
    return res.json({ announcement: announcement ? serializeAnnouncement(announcement) : null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching the latest announcement.' });
  }
};

const createAnnouncement = async (req, res) => {
  try {
    const payload = parseAnnouncementPayload(req.body);
    if (payload.error) return res.status(400).json({ message: payload.error });
    const storedImage = await persistAnnouncementImage(payload);
    const announcement = await prisma.announcements.create({
      data: {
        title: payload.title,
        content: payload.content,
        audience: payload.audience,
        priority: payload.priority,
        status: payload.status,
        publish_at: payload.publishAt,
        expires_at: payload.expiresAt,
        published_at: payload.status === 'published' ? new Date() : null,
        image_name: payload.imageName,
        image_type: payload.imageType,
        image_data: storedImage,
        created_by: req.user.id,
      },
    });
    return res.status(201).json({ message: 'Announcement created successfully.', announcement: serializeAnnouncement(announcement) });
  } catch (error) {
    console.error(error);
    if (error instanceof BlobStorageConfigurationError) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: 'Server error creating announcement.' });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid announcement is required.' });
    const existing = await prisma.announcements.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Announcement not found.' });
    const payload = parseAnnouncementPayload(req.body);
    if (payload.error) return res.status(400).json({ message: payload.error });
    const storedImage = await persistAnnouncementImage(payload);
    const announcement = await prisma.announcements.update({
      where: { id },
      data: {
        title: payload.title,
        content: payload.content,
        audience: payload.audience,
        priority: payload.priority,
        status: payload.status,
        publish_at: payload.publishAt,
        expires_at: payload.expiresAt,
        published_at: payload.status === 'published' ? existing.published_at || new Date() : existing.published_at,
        image_name: payload.imageName,
        image_type: payload.imageType,
        image_data: storedImage,
      },
    });
    if (existing.image_data && existing.image_data !== storedImage) {
      await deleteBlob(existing.image_data, process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN);
    }
    return res.json({ message: 'Announcement updated successfully.', announcement: serializeAnnouncement(announcement) });
  } catch (error) {
    console.error(error);
    if (error instanceof BlobStorageConfigurationError) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: 'Server error updating the announcement.' });
  }
};

const getScholarManagement = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const scholarAccounts = await prisma.scholar_accounts.findMany({ orderBy: { issued_at: 'desc' } });
    const applicantIds = scholarAccounts.map(({ applicant_id }) => applicant_id);
    const [applicants, accounts, requirements, schools, applications, payrollClaims, academicPeriods] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: applicantIds }, deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true, email: true, municipality: true, barangay: true, school_id: true, school_year: true } }),
      prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, control_number: true } }),
      prisma.scholar_requirements.findMany({ where: { applicant_id: { in: applicantIds }, billing_period_id: activePeriod.id }, orderBy: { updated_at: 'desc' } }),
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true } }),
      prisma.application_submissions.findMany({
        where: { applicant_id: { in: applicantIds } },
        orderBy: { submitted_at: 'desc' },
        select: { applicant_id: true, school_plan: true, initial_docs: true },
      }),
      prisma.payroll_claims.findMany({ where: { applicant_id: { in: applicantIds } }, orderBy: { updated_at: 'desc' } }),
      prisma.academic_periods.findMany(),
    ]);
    const payrollBatchIds = [...new Set(payrollClaims.map((claim) => claim.payroll_batch_id).filter(Boolean))];
    const payrollBatches = payrollBatchIds.length
      ? await prisma.payroll_batches.findMany({ where: { id: { in: payrollBatchIds } } })
      : [];
    const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
    const accountByApplicant = new Map(accounts.map((account) => [account.applicant_id, account]));
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const schoolByName = new Map(schools.map((school) => [String(school.name).trim().toLowerCase(), school]));
    const requirementByApplicant = new Map();
    requirements.forEach((requirement) => {
      if (!requirementByApplicant.has(requirement.applicant_id)) requirementByApplicant.set(requirement.applicant_id, requirement);
    });
    const applicationByApplicant = new Map();
    applications.forEach((application) => {
      if (!applicationByApplicant.has(application.applicant_id)) {
        applicationByApplicant.set(application.applicant_id, application);
      }
    });
    const payrollBatchById = new Map(payrollBatches.map((batch) => [batch.id, batch]));
    const academicPeriodById = new Map(academicPeriods.map((period) => [period.id, period]));
    const payrollClaimsByApplicant = new Map();
    const payrollClaimByApplicant = new Map();
    payrollClaims.forEach((claim) => {
      const claims = payrollClaimsByApplicant.get(claim.applicant_id) || [];
      claims.push(claim);
      payrollClaimsByApplicant.set(claim.applicant_id, claims);
      const batch = payrollBatchById.get(claim.payroll_batch_id);
      if (batch?.billing_period_id === activePeriod.id && !payrollClaimByApplicant.has(claim.applicant_id)) {
        payrollClaimByApplicant.set(claim.applicant_id, claim);
      }
    });
    const requirementFields = [
      ['Certificate of Tax Exemption', 'cert_tax_exemption_file', 'cert_tax_exemption_review_status', 'tax_exemption'],
      ['Barangay Indigency', 'barangay_indigency_file', 'barangay_indigency_review_status', 'indigency'],
      ['Photocopy of ID (any valid ID)', 'valid_id_photocopy_file', 'valid_id_photocopy_review_status', 'valid_id'],
      ['Certificate of Grades (previous semester attended)', 'grade_report_file', 'grade_report_review_status', 'grades'],
      ['Registration Form (1st semester of current school year)', 'registration_form_file', 'registration_form_review_status', 'registration_form'],
      ['Official Receipt of Tuition Fee (private school scholars)', 'tuition_fee_receipt_file', 'tuition_fee_receipt_review_status', 'tuition_receipt'],
      ['White Long Folder with Fastener', 'folder_physical_submitted', null, null],
    ];
    const scholars = scholarAccounts.map((scholar) => {
      const applicant = applicantById.get(scholar.applicant_id);
      if (!applicant) return null;
      const requirement = requirementByApplicant.get(applicant.id);
      const application = applicationByApplicant.get(applicant.id);
      const applicationPlan = application?.school_plan || {};
      const applicationRequirements = application?.initial_docs?.requirements || {};
      const school = schoolById.get(requirement?.school_id || applicant.school_id)
        || schoolByName.get(String(applicationPlan.school || '').trim().toLowerCase());
      const schoolType = String(school?.school_type || 'public').toLowerCase() === 'private'
        ? 'Private'
        : 'Public';
      const payrollClaim = payrollClaimByApplicant.get(applicant.id);
      const payrollBatch = payrollClaim ? payrollBatchById.get(payrollClaim.payroll_batch_id) : null;
      const normalizedClaimStatus = String(payrollClaim?.claim_status || '').toLowerCase();
      const normalizedBatchStatus = String(payrollBatch?.status || '').toLowerCase();
      const paid = Boolean(payrollClaim?.claimed_date)
        || ['paid', 'claimed', 'released'].includes(normalizedClaimStatus)
        || normalizedBatchStatus === 'released';
      const schoolYear = activePeriod.school_year;
      const semester = activePeriod.semester;
      const financialHistory = (payrollClaimsByApplicant.get(applicant.id) || []).map((claim) => {
        const batch = payrollBatchById.get(claim.payroll_batch_id);
        const period = academicPeriodById.get(batch?.billing_period_id);
        const historyClaimStatus = String(claim.claim_status || '').toLowerCase();
        const historyBatchStatus = String(batch?.status || '').toLowerCase();
        const historyPaid = Boolean(claim.claimed_date)
          || ['paid', 'claimed', 'released'].includes(historyClaimStatus)
          || historyBatchStatus === 'released';
        return {
          academicPeriodId: batch?.billing_period_id || null,
          schoolYear: period?.school_year || (batch?.billing_period_id === activePeriod.id ? activePeriod.school_year : 'Legacy period'),
          semester: period?.semester || (batch?.billing_period_id === activePeriod.id ? activePeriod.semester : 'Not specified'),
          billingStatus: 'Billed',
          payrollStatus: historyPaid ? 'Paid' : 'Not paid yet',
          payReference: historyPaid ? claim.claimed_notes || batch?.batch_number || null : null,
          dateProcessed: claim.updated_at || null,
          claimAmount: Number(claim.claim_amount),
          claimStatus: claim.claim_status || null,
          batchStatus: batch?.status || null,
          isActivePeriod: batch?.billing_period_id === activePeriod.id,
        };
      });
      const documents = requirementFields.map(([label, fileField, statusField, uploadKey]) => {
        const uploadedDocument = uploadKey ? applicationRequirements[uploadKey] : null;
        const submitted = Boolean(requirement?.[fileField] || uploadedDocument?.fileName);
        return {
          label,
          submitted,
          status: statusField
            ? uploadedDocument?.status || requirement?.[statusField] || 'pending'
            : submitted ? 'approved' : 'pending',
        };
      });
      const submittedDocuments = documents.filter(({ submitted }) => submitted);
      const hasReviewItems = submittedDocuments.some(({ status }) => !['approved', 'complete', 'completed'].includes(String(status).toLowerCase()));
      const documentsComplete = submittedDocuments.length === documents.length && !hasReviewItems;
      const billingEligibility = evaluateBillingEligibility({
        isActive: scholar.is_active,
        alreadyBilled: Boolean(payrollClaim),
        initialDocs: application?.initial_docs,
        requirement,
      });
      return {
        id: scholar.id,
        applicantId: applicant.id,
        name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' ').toUpperCase(),
        initials: `${applicant.first_name?.[0] || ''}${applicant.last_name?.[0] || ''}`.toUpperCase(),
        scholarId: scholar.scholar_id || accountByApplicant.get(applicant.id)?.control_number || `Scholar #${scholar.id}`,
        controlNumber: accountByApplicant.get(applicant.id)?.control_number || null,
        email: applicant.email,
        municipality: applicant.municipality || 'Not specified',
        barangay: applicant.barangay || 'Not specified',
        school: school?.name || applicationPlan.school || 'Not specified',
        schoolType,
        schoolYear,
        semester,
        schoolYearSemester: `${schoolYear} · ${semester}`,
        yearLevel: requirement?.year_level || applicationPlan.incomingYearLevel || null,
        course: requirement?.course || applicationPlan.course || null,
        major: requirement?.major || null,
        status: scholar.is_active ? 'Active' : 'Inactive',
        documentStatus: documentsComplete ? 'Complete' : 'Review',
        documentsSubmitted: submittedDocuments.length,
        documentsTotal: documents.length,
        documents,
        billingEligible: billingEligibility.eligible,
        billingEligibilityReasons: billingEligibility.reasons,
        issuedAt: scholar.issued_at,
        notes: scholar.notes || '',
        billed: Boolean(payrollClaim),
        billingStatus: payrollClaim ? 'Billed' : 'Not billed yet',
        paid,
        payrollStatus: paid ? 'Paid' : 'Not paid yet',
        payReference: paid ? payrollClaim?.claimed_notes || payrollBatch?.batch_number || null : null,
        dateProcessed: payrollClaim?.updated_at || null,
        claimAmount: payrollClaim ? Number(payrollClaim.claim_amount) : null,
        claimStatus: payrollClaim?.claim_status || null,
        batchStatus: payrollBatch?.status || null,
        financialHistory,
      };
    }).filter(Boolean);
    return res.json({ scholars, activePeriod: serializeAcademicPeriod(activePeriod) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching scholar management records.' });
  }
};

const normalizeApplicantIds = (value) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  : [];

const processBillingSelection = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const applicantIds = normalizeApplicantIds(req.body.applicantIds);
    const suppliedOverrides = Array.isArray(req.body.billingOverrides) ? req.body.billingOverrides : [];
    if (!applicantIds.length) return res.status(400).json({ message: 'Select at least one scholar for billing.' });
    if (applicantIds.length > 500) return res.status(400).json({ message: 'A billing batch cannot exceed 500 scholars.' });
    if (suppliedOverrides.length > applicantIds.length) return res.status(400).json({ message: 'The billing override selection is invalid.' });
    if (suppliedOverrides.length && !['SuperAdmin', 'BillingPayrollAdmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only a Billing / Payroll Admin or Super Administrator can authorize billing overrides.' });
    }

    const overrideByApplicant = new Map();
    for (const suppliedOverride of suppliedOverrides) {
      const applicantId = Number(suppliedOverride?.applicantId);
      const reason = String(suppliedOverride?.reason || '').trim().replace(/\s+/g, ' ');
      if (!Number.isInteger(applicantId) || !applicantIds.includes(applicantId) || overrideByApplicant.has(applicantId)) {
        return res.status(400).json({ message: 'The billing override selection is invalid.' });
      }
      if (reason.length < 10 || reason.length > 500) {
        return res.status(400).json({ message: 'Each billing override requires a reason between 10 and 500 characters.' });
      }
      overrideByApplicant.set(applicantId, reason);
    }

    const [scholarAccounts, applications, requirements, periodBatches] = await Promise.all([
      prisma.scholar_accounts.findMany({
        where: { applicant_id: { in: applicantIds } },
        select: { applicant_id: true, is_active: true },
      }),
      prisma.application_submissions.findMany({
        where: { applicant_id: { in: applicantIds } },
        orderBy: { submitted_at: 'desc' },
        select: { applicant_id: true, initial_docs: true },
      }),
      prisma.scholar_requirements.findMany({
        where: { applicant_id: { in: applicantIds }, billing_period_id: activePeriod.id },
        select: {
          applicant_id: true,
          cert_tax_exemption_file: true,
          cert_tax_exemption_review_status: true,
          barangay_indigency_file: true,
          barangay_indigency_review_status: true,
          valid_id_photocopy_file: true,
          valid_id_photocopy_review_status: true,
          grade_report_file: true,
          grade_report_review_status: true,
          registration_form_file: true,
          registration_form_review_status: true,
          tuition_fee_receipt_file: true,
          tuition_fee_receipt_review_status: true,
          folder_physical_submitted: true,
        },
      }),
      prisma.payroll_batches.findMany({
        where: { billing_period_id: activePeriod.id },
        select: { id: true },
      }),
    ]);
    const periodBatchIds = periodBatches.map(({ id }) => id);
    const existingClaims = periodBatchIds.length
      ? await prisma.payroll_claims.findMany({
        where: { applicant_id: { in: applicantIds }, payroll_batch_id: { in: periodBatchIds } },
        select: { applicant_id: true },
      })
      : [];
    const billedIds = new Set(existingClaims.map(({ applicant_id }) => applicant_id));
    const scholarByApplicant = new Map(scholarAccounts.map((scholar) => [scholar.applicant_id, scholar]));
    const applicationByApplicant = new Map();
    applications.forEach((application) => {
      if (!applicationByApplicant.has(application.applicant_id)) applicationByApplicant.set(application.applicant_id, application);
    });
    const requirementByApplicant = new Map(requirements.map((requirement) => [requirement.applicant_id, requirement]));
    const eligibility = applicantIds.map((applicantId) => {
      const result = evaluateBillingEligibility({
        isActive: Boolean(scholarByApplicant.get(applicantId)?.is_active),
        alreadyBilled: billedIds.has(applicantId),
        initialDocs: applicationByApplicant.get(applicantId)?.initial_docs,
        requirement: requirementByApplicant.get(applicantId),
      });
      const suppliedReason = overrideByApplicant.get(applicantId);
      const override = suppliedReason ? evaluateBillingOverride({ eligibility: result, reason: suppliedReason }) : null;
      return { applicantId, ...result, override };
    });
    const ineligible = eligibility.filter(({ eligible, override }) => !eligible && !override?.allowed);
    if (ineligible.length) {
      return res.status(409).json({
        message: 'Some selected scholars are not ready for billing. Use an authorized override for incomplete requirements; inactive or already-billed scholars cannot be overridden.',
        ineligible: ineligible.map(({ applicantId, reasons, override }) => ({
          applicantId,
          reasons,
          overrideErrors: override?.errors || [],
        })),
      });
    }
    const eligibleIds = eligibility.map(({ applicantId }) => applicantId);
    const appliedOverrides = new Map(eligibility
      .filter(({ eligible, override }) => !eligible && override?.allowed)
      .map(({ applicantId, override }) => [applicantId, override.reason]));

    const timestamp = new Date();
    const batchNumber = `BILL-${timestamp.toISOString().replace(/\D/g, '').slice(0, 17)}`;
    const result = await prisma.$transaction(async (transaction) => {
      const batch = await transaction.payroll_batches.create({
        data: {
          batch_number: batchNumber,
          billing_period_id: activePeriod.id,
          total_scholars: eligibleIds.length,
          total_amount: 0,
          status: 'billed',
          prepared_by: req.user.id,
          prepared_at: timestamp,
          remarks: `${activePeriod.school_year} · ${activePeriod.semester} billing batch${appliedOverrides.size ? ` · ${appliedOverrides.size} eligibility override${appliedOverrides.size === 1 ? '' : 's'}` : ''}`,
          updated_at: timestamp,
        },
      });
      await transaction.payroll_claims.createMany({
        data: eligibleIds.map((applicantId) => ({
          payroll_batch_id: batch.id,
          academic_period_id: activePeriod.id,
          applicant_id: applicantId,
          claim_amount: 0,
          claim_status: 'pending',
          notes: appliedOverrides.has(applicantId)
            ? `Billing eligibility override: ${appliedOverrides.get(applicantId)}`
            : 'Added through Billing Management',
          updated_at: timestamp,
        })),
      });
      return batch;
    });

    res.locals.auditTargetId = result.id;
    if (appliedOverrides.size) {
      res.locals.auditAction = 'BILLING_OVERRIDE_PROCESSED';
      res.locals.auditDescription = `Processed ${eligibleIds.length} scholar${eligibleIds.length === 1 ? '' : 's'} for billing with ${appliedOverrides.size} eligibility override${appliedOverrides.size === 1 ? '' : 's'}.`;
    }

    return res.status(201).json({
      message: `${eligibleIds.length} scholar${eligibleIds.length === 1 ? '' : 's'} processed for billing and moved to For Payroll.`,
      batch: { id: result.id, batchNumber: result.batch_number, totalScholars: result.total_scholars },
      overrideCount: appliedOverrides.size,
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'One or more selected scholars were already billed for this academic period. Refresh the list and try again.' });
    }
    return res.status(500).json({ message: 'Server error processing the billing selection.' });
  }
};

const processPayrollSelection = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const applicantIds = normalizeApplicantIds(req.body.applicantIds);
    const suppliedReference = String(req.body.payReference || '').trim();
    if (!applicantIds.length) return res.status(400).json({ message: 'Select at least one billed scholar for payroll.' });
    if (applicantIds.length > 500) return res.status(400).json({ message: 'A payroll batch cannot exceed 500 scholars.' });
    if (suppliedReference.length > 50) return res.status(400).json({ message: 'The payment reference must not exceed 50 characters.' });

    const periodBatches = await prisma.payroll_batches.findMany({
      where: { billing_period_id: activePeriod.id },
      select: { id: true },
    });
    const claims = await prisma.payroll_claims.findMany({
      where: { applicant_id: { in: applicantIds }, payroll_batch_id: { in: periodBatches.map(({ id }) => id) } },
      orderBy: { updated_at: 'desc' },
    });
    const claimByApplicant = new Map();
    claims.forEach((claim) => {
      if (!claimByApplicant.has(claim.applicant_id)) claimByApplicant.set(claim.applicant_id, claim);
    });
    const payableClaims = applicantIds.map((id) => claimByApplicant.get(id)).filter(isPayableClaim);
    if (!payableClaims.length) return res.status(409).json({ message: 'The selected scholars have already been paid or are not yet billed.' });
    if (payableClaims.length !== applicantIds.length) {
      return res.status(409).json({ message: 'Some selected scholars are no longer ready for payroll. Refresh the list and try again.' });
    }

    const timestamp = new Date();
    const payReference = suppliedReference || `PAY-${timestamp.toISOString().replace(/\D/g, '').slice(0, 14)}`;
    const applicantRecords = await prisma.applicants.findMany({
      where: { id: { in: applicantIds }, deleted_at: null },
      select: { id: true, first_name: true, email: true },
    });
    const applicantById = new Map(applicantRecords.map((applicant) => [applicant.id, applicant]));
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.payroll_claims.updateMany({
        where: {
          id: { in: payableClaims.map(({ id }) => id) },
          claimed_date: null,
          claim_status: { notIn: ['paid', 'claimed', 'released'] },
        },
        data: {
          claim_status: 'paid',
          claimed_date: timestamp,
          claimed_notes: payReference,
          updated_at: timestamp,
        },
      });
      if (updated.count !== payableClaims.length) {
        const conflict = new Error('Payroll selection changed while it was being processed.');
        conflict.code = 'PAYROLL_CONFLICT';
        throw conflict;
      }
      await transaction.scholar_notifications.createMany({
        data: payableClaims.map((claim) => ({
          applicant_id: claim.applicant_id,
          academic_period_id: activePeriod.id,
          payroll_claim_id: claim.id,
          notification_type: 'payroll_processed',
          title: 'Your allowance has been processed',
          message: `Payroll for ${activePeriod.school_year} - ${activePeriod.semester} was completed.`,
          reference: payReference,
          amount: claim.claim_amount,
          created_at: timestamp,
        })),
        skipDuplicates: true,
      });
    });

    const emailResults = await Promise.all(payableClaims.map((claim) => {
      const applicant = applicantById.get(claim.applicant_id);
      return sendPayrollCompletedEmail({
        to: applicant?.email,
        firstName: applicant?.first_name,
        payReference,
        amount: claim.claim_amount,
        processedAt: timestamp,
        schoolYear: activePeriod.school_year,
        semester: activePeriod.semester,
      });
    }));

    return res.json({
      message: `${payableClaims.length} scholar${payableClaims.length === 1 ? '' : 's'} marked as paid.`,
      payReference,
      totalScholars: payableClaims.length,
      notificationsCreated: payableClaims.length,
      emailsSent: emailResults.filter(({ sent }) => sent).length,
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    console.error(error);
    if (error?.code === 'PAYROLL_CONFLICT' || error?.code === 'P2002') {
      return res.status(409).json({ message: 'The payroll selection was already processed or changed. Refresh the list and try again.' });
    }
    return res.status(500).json({ message: 'Server error processing the payroll selection.' });
  }
};

const submitOnlineExam = async (req, res) => {
  try {
    const applicantId = req.user.id;
    const activePeriod = await getActiveAcademicPeriodRecord();
    const score = Number(req.body.score);
    if (!Number.isFinite(score) || score < 0 || score > 20) return res.status(400).json({ message: 'Invalid examination score.' });
    const passingScore = 14;
    const applicant = await prisma.applicants.findUnique({
      where: { id: applicantId },
      select: { email: true, first_name: true, municipality: true },
    });
    const exam = await prisma.exams.findFirst({
      where: {
        is_active: true,
        academic_year: activePeriod.school_year,
        municipality: { equals: String(applicant?.municipality || '').trim(), mode: 'insensitive' },
      },
      orderBy: { updated_at: 'desc' },
    });
    if (!exam) {
      return res.status(409).json({ message: 'No active examination is available for your municipality.' });
    }
    const existing = await prisma.results.findFirst({ where: { applicant_id: applicantId, exam_id: exam.id } });
    if (existing) return res.status(409).json({ message: 'This examination has already been submitted. Please wait for the Scholarship Office to release the result.' });
    const submittedAt = new Date();
    const slot = await prisma.exam_slots.upsert({
      where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: exam.id } },
      create: { applicant_id: applicantId, exam_id: exam.id, appeared: true, appeared_at: submittedAt },
      update: { appeared: true, appeared_at: submittedAt, forfeited_at: null },
    });
    const data = { score, passing_score: passingScore, passed: score >= passingScore, updated_at: new Date() };
    const result = await prisma.results.create({ data: { exam_slot_id: slot.id, applicant_id: applicantId, exam_id: exam.id, ...data } });
    await prisma.application_submissions.updateMany({
      where: { applicant_id: applicantId, status: { not: 'Withdrawn' } },
      data: { status: APPLICATION_STATUSES.EXAMINED },
    });
    const account = await prisma.control_accounts.findFirst({
      where: { applicant_id: applicantId },
      select: { control_number: true },
    });
    const emailDelivery = await sendExamSubmittedEmail({
      to: applicant?.email,
      firstName: applicant?.first_name,
      controlNumber: account?.control_number,
      examTitle: exam.title,
      submittedAt: result.created_at,
    });
    return res.status(201).json({
      message: 'Examination submitted.',
      result,
      notification: { examReceiptEmailSent: emailDelivery.sent },
    });
  } catch (error) { console.error(error); return res.status(500).json({ message: 'Server error submitting examination.' }); }
};

const getMyApplication = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const application = await prisma.application_submissions.findFirst({
      where: {
        OR: [
          { applicant_id: req.user.id },
          { email: req.user.email },
        ],
      },
      orderBy: { submitted_at: 'desc' },
    });
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    const applicant = application.applicant_id
      ? await prisma.applicants.findUnique({ where: { id: application.applicant_id } })
      : await prisma.applicants.findFirst({ where: { email: application.email } });
    const applicantId = applicant?.id || application.applicant_id;
    const activePayrollBatches = await prisma.payroll_batches.findMany({
      where: { billing_period_id: activePeriod.id },
      select: { id: true },
    });
    const [result, scholar, scholarRequirement, payrollClaim, scheduledExam, eligibilityAssessment] = applicantId ? await Promise.all([
      prisma.results.findFirst({ where: { applicant_id: applicantId }, orderBy: { created_at: 'desc' } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
      prisma.scholar_requirements.findFirst({ where: { applicant_id: applicantId, billing_period_id: activePeriod.id } }),
      prisma.payroll_claims.findFirst({ where: { applicant_id: applicantId, payroll_batch_id: { in: activePayrollBatches.map(({ id }) => id) } }, orderBy: { updated_at: 'desc' } }),
      applicant?.municipality
        ? prisma.exams.findFirst({
          where: {
            municipality: { equals: applicant.municipality.trim(), mode: 'insensitive' },
            academic_year: activePeriod.school_year,
          },
          orderBy: { updated_at: 'desc' },
          select: { id: true, title: true, exam_date: true, exam_end_date: true, venue: true, municipality: true, academic_year: true, is_active: true },
        })
        : null,
      prisma.eligibility_assessments.findFirst({ where: { applicant_id: applicantId }, orderBy: { generated_at: 'desc' } }),
    ]) : [null, null, null, null, null, null];
    const exam = result
      ? await prisma.exams.findUnique({ where: { id: result.exam_id }, select: { title: true, exam_date: true, academic_year: true } })
      : null;
    const payrollBatch = payrollClaim
      ? await prisma.payroll_batches.findUnique({ where: { id: payrollClaim.payroll_batch_id } })
      : null;
    const guidance = buildApplicantGuidance({
      application,
      result,
      scholar,
      scholarRequirement,
      payrollClaim,
      payrollBatch,
      scheduledExam,
    });
    return res.json({
      application,
      applicant,
      guidance,
      eligibilityAssessment: scholar ? serializeAssessment(eligibilityAssessment) : null,
      scholar: scholar ? {
        id: scholar.id,
        scholarId: scholar.scholar_id,
        issuedAt: scholar.issued_at,
        isActive: scholar.is_active,
        notes: scholar.notes,
      } : null,
      scholarRequirements: {
        physicalFolderSubmitted: Boolean(scholarRequirement?.folder_physical_submitted),
        physicalFolderSubmittedAt: scholarRequirement?.folder_physical_submitted_at || null,
      },
      allowance: payrollClaim ? {
        amount: Number(payrollClaim.claim_amount),
        status: payrollClaim.claim_status,
        claimedDate: payrollClaim.claimed_date,
        payReference: payrollClaim.claimed_notes,
        batchStatus: payrollBatch?.status || null,
        releasedAt: payrollBatch?.released_at || null,
      } : null,
      examination: {
        completed: Boolean(result),
        status: scholar ? 'Accepted as scholar' : result ? 'Waiting for results' : 'Not completed',
        submittedAt: result?.created_at || null,
        examTitle: exam?.title || 'PGCEAP Qualifying Examination',
        examDate: exam?.exam_date || null,
        academicYear: exam?.academic_year || activePeriod.school_year,
        isScholar: Boolean(scholar),
        schedule: scheduledExam ? {
          id: scheduledExam.id,
          title: scheduledExam.title,
          municipality: scheduledExam.municipality,
          venue: scheduledExam.venue,
          date: scheduledExam.exam_date,
          endDate: scheduledExam.exam_end_date || scheduledExam.exam_date,
          academicYear: scheduledExam.academic_year,
          isActive: Boolean(scheduledExam.is_active),
        } : null,
      },
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching your application.' });
  }
};

const uploadMyRequirement = async (req, res) => {
  try {
    const { requirement, fileName, fileData } = req.body;
    const allowed = ['tax_exemption', 'indigency', 'valid_id', 'grades', 'registration_form', 'tuition_receipt'];
    if (!allowed.includes(requirement) || typeof fileName !== 'string' || typeof fileData !== 'string') {
      return res.status(400).json({ message: 'A valid requirement and file are required.' });
    }
    if (fileData.length > 8 * 1024 * 1024) {
      return res.status(413).json({ message: 'File is too large. Please upload a file smaller than 6 MB.' });
    }
    let parsedFile;
    try {
      parsedFile = parseDataUrl(fileData);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const allowedFileTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedFileTypes.includes(parsedFile.contentType)) {
      return res.status(400).json({ message: 'Only PDF, JPG, and PNG requirement files are allowed.' });
    }
    if (parsedFile.buffer.length > 6 * 1024 * 1024) {
      return res.status(413).json({ message: 'File is too large. Please upload a file smaller than 6 MB.' });
    }
    const application = await prisma.application_submissions.findFirst({
      where: { OR: [{ applicant_id: req.user.id }, { email: req.user.email }] },
      orderBy: { submitted_at: 'desc' },
    });
    if (!application) return res.status(404).json({ message: 'Application not found.' });
    const documents = application.initial_docs && typeof application.initial_docs === 'object' ? application.initial_docs : {};
    const existingRequirement = documents.requirements?.[requirement];
    const token = process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
    let storedFile;
    if (token || process.env.NODE_ENV === 'production') {
      const blob = await uploadDataUrl({
        dataUrl: fileData,
        fileName,
        contentType: parsedFile.contentType,
        pathSegments: ['scholar-requirements', req.user.id, requirement],
        token,
        access: 'private',
      });
      storedFile = {
        fileName,
        fileType: blob.contentType,
        fileUrl: blob.url,
        pathname: blob.pathname,
        storage: 'vercel-blob-private',
        status: 'Pending',
        uploadedAt: new Date().toISOString(),
      };
    } else {
      storedFile = {
        fileName,
        fileType: parsedFile.contentType,
        fileData,
        storage: 'database',
        status: 'Pending',
        uploadedAt: new Date().toISOString(),
      };
    }
    documents.requirements = { ...(documents.requirements || {}), [requirement]: storedFile };
    const updated = await prisma.application_submissions.update({ where: { id: application.id }, data: { initial_docs: documents } });
    if (existingRequirement?.fileUrl && existingRequirement.fileUrl !== storedFile.fileUrl) {
      await deleteBlob(existingRequirement.fileUrl, token);
    }
    return res.json({ message: 'Requirement uploaded and submitted for moderator review.', application: updated });
  } catch (error) {
    console.error(error);
    if (error instanceof BlobStorageConfigurationError) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: 'Server error uploading requirement.' });
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const [applicants, activeScholars, forfeitedAccounts, activity] = await Promise.all([
      prisma.applicants.findMany({ where: { deleted_at: null }, orderBy: { created_at: 'desc' }, take: 7, select: { id: true, first_name: true, middle_name: true, last_name: true, status: true } }),
      prisma.scholar_accounts.count({ where: { is_active: true } }),
      prisma.exam_slots.count({ where: { forfeited_at: { not: null } } }),
      prisma.activity_logs.findMany({ orderBy: { created_at: 'desc' }, take: 4, select: { id: true, action: true, description: true, created_at: true } }),
    ]);
    const applicantIds = applicants.map(({ id }) => id);
    const accounts = applicantIds.length ? await prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, control_number: true } }) : [];
    const controlNumbers = new Map(accounts.map((account) => [account.applicant_id, account.control_number]));
    return res.json({
      stats: { activeScholars, forfeitedAccounts },
      recentApplications: applicants.map((applicant) => ({ name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' ').toUpperCase(), controlNo: controlNumbers.get(applicant.id) || `Applicant #${applicant.id}`, status: applicant.status })),
      recentActivity: activity.map((entry) => ({ title: entry.action, detail: entry.description || 'System activity recorded', status: 'INFO', time: entry.created_at })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching dashboard summary.' });
  }
};

const getSchoolCatalog = async (req, res) => {
  try {
    const schools = await prisma.schools.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, school_type: true },
    });
    return res.json({
      schools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        classification: school.school_type,
      })),
    });
  } catch (error) {
    console.error('Error fetching school catalog:', error);
    return res.status(500).json({ message: 'Server error fetching the school catalog.' });
  }
};

const updateSchoolClassification = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const classification = String(req.body.classification || '').trim().toLowerCase();
    if (!name) return res.status(400).json({ message: 'A school name is required.' });
    if (!['public', 'private'].includes(classification)) {
      return res.status(400).json({ message: 'School classification must be Public or Private.' });
    }

    const existing = await prisma.schools.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    let school;
    if (existing) {
      school = await prisma.schools.update({
        where: { id: existing.id },
        data: { school_type: classification, updated_at: new Date() },
      });
    } else {
      school = await prisma.schools.create({
        data: {
          name,
          school_type: classification,
          updated_at: new Date(),
        },
      });
    }

    return res.json({
      message: `${school.name} is now classified as ${classification}.`,
      school: { id: school.id, name: school.name, classification: school.school_type },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating the school classification.' });
  }
};

const getApplicantManagement = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const applicants = await prisma.applicants.findMany({ where: { deleted_at: null }, orderBy: { created_at: 'desc' }, select: { id: true, first_name: true, middle_name: true, last_name: true, email: true, municipality: true, barangay: true, school_year: true, status: true, created_at: true } });
    const applicantIds = applicants.map(({ id }) => id);
    const [accounts, slots, results, exams, scholarAccounts, applications] = await Promise.all([
      prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, control_number: true, last_login_at: true } }),
      prisma.exam_slots.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, exam_id: true, appeared: true, appeared_at: true } }),
      prisma.results.findMany({ where: { applicant_id: { in: applicantIds } }, orderBy: { created_at: 'desc' }, select: { id: true, applicant_id: true, exam_id: true, score: true, passing_score: true, passed: true, remarks: true, created_at: true, updated_at: true } }),
      prisma.exams.findMany({
        orderBy: { updated_at: 'desc' },
        select: { id: true, title: true, exam_date: true, exam_end_date: true, venue: true, municipality: true, academic_year: true, is_active: true, updated_at: true },
      }),
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, scholar_id: true, is_active: true } }),
      prisma.application_submissions.findMany({ where: { applicant_id: { in: applicantIds }, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' }, select: { id: true, applicant_id: true, family: true, eligibility: true } }),
    ]);
    const accountByApplicant = new Map(accounts.map((account) => [account.applicant_id, account]));
    const slotByApplicant = new Map(slots.map((slot) => [slot.applicant_id, slot]));
    const resultByApplicant = new Map();
    results.forEach((result) => { if (!resultByApplicant.has(result.applicant_id)) resultByApplicant.set(result.applicant_id, result); });
    const applicationByApplicant = new Map();
    applications.forEach((application) => { if (!applicationByApplicant.has(application.applicant_id)) applicationByApplicant.set(application.applicant_id, application); });
    const examById = new Map(exams.map((exam) => [exam.id, exam]));
    const scheduledExamByMunicipality = indexExamsByMunicipality(exams, activePeriod.school_year);
    const scheduledApplicantCount = countScheduledApplicants({
      applicants,
      exams,
      slots,
      academicYear: activePeriod.school_year,
      legacySchoolYear: STALE_DEFAULT_SCHOOL_YEAR,
    });
    const scholarByApplicant = new Map(scholarAccounts.map((scholar) => [scholar.applicant_id, scholar]));
    return res.json({
      stats: { total: applicants.length, scheduled: scheduledApplicantCount, completed: results.length, passed: results.filter(({ passed }) => passed).length },
      applicants: applicants.map((applicant) => {
        const account = accountByApplicant.get(applicant.id);
        const slot = slotByApplicant.get(applicant.id);
        const result = resultByApplicant.get(applicant.id);
        const linkedExam = examById.get(result?.exam_id || slot?.exam_id);
        const scheduledExam = scheduledExamByMunicipality.get(normalizeMunicipality(applicant.municipality));
        const exam = linkedExam || scheduledExam;
        const scholar = scholarByApplicant.get(applicant.id);
        const eligibilityRecommendation = evaluateEligibility({
          application: applicationByApplicant.get(applicant.id),
          result,
        });
        return {
          id: applicant.id,
          name: [applicant.last_name, applicant.first_name, applicant.middle_name].filter(Boolean).join(', '),
          initials: `${applicant.first_name[0] || ''}${applicant.last_name[0] || ''}`.toUpperCase(),
          username: `${applicant.first_name}.${applicant.last_name}`.toLowerCase(),
          controlNo: account?.control_number || `Applicant #${applicant.id}`,
          email: applicant.email,
          municipality: applicant.municipality || 'Not specified',
          barangay: applicant.barangay || 'Not specified',
          schoolYear: !applicant.school_year || applicant.school_year === STALE_DEFAULT_SCHOOL_YEAR
            ? activePeriod.school_year
            : applicant.school_year,
          registered: applicant.created_at,
          lastLogin: account?.last_login_at || null,
          status: result?.passed ? 'Passed' : result ? 'Exam Completed' : applicant.status === 'pending' ? 'Pending' : applicant.status,
          resultStatus: result ? (result.passed ? 'Passed' : 'Failed') : slot?.appeared ? 'For review' : 'Pending',
          examScore: result?.score === null || result?.score === undefined ? null : Number(result.score),
          passingScore: result?.passing_score === null || result?.passing_score === undefined ? null : Number(result.passing_score),
          reviewerNotes: result?.remarks || '',
          reviewerNotesUpdatedAt: result?.remarks ? result.updated_at : null,
          examDate: exam?.exam_date || result?.created_at || slot?.appeared_at || null,
          examEndDate: exam?.exam_end_date || exam?.exam_date || null,
          examTitle: exam?.title || 'PGCEAP Qualifying Examination',
          examVenue: exam?.venue || null,
          examMunicipality: exam?.municipality || applicant.municipality || null,
          academicYear: exam?.academic_year || activePeriod.school_year,
          isScholar: Boolean(scholar?.is_active),
          scholarId: scholar?.scholar_id || null,
          eligibilityRecommendation,
        };
      }),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching applicants.' });
  }
};

const serializeExaminationSchedule = (exam) => ({
  id: exam.id,
  municipality: exam.municipality,
  venue: exam.venue,
  date: exam.exam_date,
  endDate: exam.exam_end_date || exam.exam_date,
  title: exam.title,
  academicYear: exam.academic_year,
  isActive: Boolean(exam.is_active),
  updatedAt: exam.updated_at,
});

const getExaminationManagement = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const examinations = await prisma.exams.findMany({
      where: { academic_year: activePeriod.school_year },
      orderBy: [{ municipality: 'asc' }, { updated_at: 'desc' }],
    });
    const uniqueByMunicipality = new Map();
    examinations.forEach((exam) => {
      const key = String(exam.municipality || '').trim().toLowerCase();
      if (key && !uniqueByMunicipality.has(key)) uniqueByMunicipality.set(key, exam);
    });
    return res.json({
      examinations: [...uniqueByMunicipality.values()].map(serializeExaminationSchedule),
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching examination schedules.' });
  }
};

const saveExaminationManagement = async (req, res) => {
  try {
    const activePeriod = await getActiveAcademicPeriodRecord();
    const schedules = Array.isArray(req.body.examinations) ? req.body.examinations : null;
    if (!schedules || !schedules.length) return res.status(400).json({ message: 'At least one examination schedule is required.' });
    if (schedules.length > 30) return res.status(400).json({ message: 'No more than 30 examination schedules can be saved at once.' });

    const normalizedSchedules = [];
    const municipalities = new Set();
    for (const schedule of schedules) {
      const municipality = String(schedule.municipality || '').trim();
      const venue = String(schedule.venue || '').trim();
      const examDate = new Date(schedule.date);
      const examEndDate = new Date(schedule.endDate || schedule.date);
      const municipalityKey = municipality.toLowerCase();
      if (!municipality || municipality.length > 100 || municipalities.has(municipalityKey)) {
        return res.status(400).json({ message: 'Every examination schedule must use a unique, valid municipality.' });
      }
      if (!venue || venue.length > 255) return res.status(400).json({ message: `A valid venue is required for ${municipality}.` });
      if (Number.isNaN(examDate.getTime()) || Number.isNaN(examEndDate.getTime())) {
        return res.status(400).json({ message: `A valid examination date is required for ${municipality}.` });
      }
      if (examEndDate < examDate) return res.status(400).json({ message: `The end date for ${municipality} cannot be before its start date.` });
      municipalities.add(municipalityKey);
      normalizedSchedules.push({ municipality, venue, examDate, examEndDate, isActive: Boolean(schedule.isActive) });
    }

    const saved = await prisma.$transaction(async (transaction) => {
      const records = [];
      for (const schedule of normalizedSchedules) {
        const existing = await transaction.exams.findFirst({
          where: {
            municipality: { equals: schedule.municipality, mode: 'insensitive' },
            academic_year: activePeriod.school_year,
          },
          orderBy: { updated_at: 'desc' },
        });
        const data = {
          title: 'PGCEAP Qualifying Examination',
          exam_date: schedule.examDate,
          exam_end_date: schedule.examEndDate,
          venue: schedule.venue,
          municipality: schedule.municipality,
          academic_year: activePeriod.school_year,
          is_active: schedule.isActive,
          updated_at: new Date(),
        };
        const record = existing
          ? await transaction.exams.update({ where: { id: existing.id }, data })
          : await transaction.exams.create({ data: { ...data, created_by: req.user.id } });
        records.push(record);
      }
      const assignments = await assignApplicantsToMunicipalityExams(transaction, {
        exams: records,
        academicYear: activePeriod.school_year,
        legacySchoolYear: STALE_DEFAULT_SCHOOL_YEAR,
      });
      return { records, assignments };
    }, { maxWait: 10_000, timeout: 30_000 });

    return res.json({
      message: `Examination schedules saved successfully. ${saved.assignments.created} new applicant assignment${saved.assignments.created === 1 ? '' : 's'} created.`,
      examinations: saved.records.map(serializeExaminationSchedule),
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    console.error('Error saving examination schedules:', error);
    return res.status(500).json({ message: 'Server error saving examination schedules.' });
  }
};

const acceptApplicantAsScholar = async (req, res) => {
  try {
    const applicantId = Number(req.params.applicantId);
    const activePeriod = await getActiveAcademicPeriodRecord();
    const reviewReason = String(req.body?.reviewReason || '').trim();
    if (!Number.isInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid applicant is required.' });
    if (reviewReason.length > 2000) return res.status(400).json({ message: 'The decision reason must not exceed 2,000 characters.' });

    const [applicant, latestResult, application, existingScholar] = await Promise.all([
      prisma.applicants.findFirst({
        where: { id: applicantId, deleted_at: null },
        select: { id: true, email: true, first_name: true, school_year: true },
      }),
      prisma.results.findFirst({ where: { applicant_id: applicantId }, orderBy: { created_at: 'desc' } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId } }),
    ]);
    if (!applicant) return res.status(404).json({ message: 'Applicant record not found.' });
    if (!application) return res.status(400).json({ message: 'A submitted application is required before a scholarship decision can be recorded.' });
    if (!latestResult?.passed) return res.status(400).json({ message: 'Only applicants whose latest examination result is passing can be accepted as scholars.' });

    if (existingScholar?.is_active) {
      return res.status(200).json({ message: 'Applicant is already an active scholar.', scholar: existingScholar });
    }

    const assessment = evaluateEligibility({ application, result: latestResult });
    if (assessment.requiresOverrideReason && !reviewReason) {
      return res.status(400).json({
        code: 'ELIGIBILITY_OVERRIDE_REASON_REQUIRED',
        message: 'Add a decision reason before accepting an applicant whose recommendation requires review or does not meet the configured criteria.',
        eligibilityRecommendation: assessment,
      });
    }

    const schoolYear = applicant.school_year === STALE_DEFAULT_SCHOOL_YEAR || !applicant.school_year
      ? activePeriod.school_year
      : applicant.school_year;
    const yearPrefix = String(schoolYear).split('-')[0];
    const scholarId = existingScholar?.scholar_id || `PGCEAP-${yearPrefix}-${String(applicantId).padStart(5, '0')}`;
    const scholar = await prisma.$transaction(async (transaction) => {
      const savedScholar = existingScholar
        ? await transaction.scholar_accounts.update({
          where: { id: existingScholar.id },
          data: { result_id: latestResult.id, scholar_id: scholarId, is_active: true, issued_by: req.user.id, issued_at: new Date(), updated_at: new Date() },
        })
        : await transaction.scholar_accounts.create({
          data: { applicant_id: applicantId, result_id: latestResult.id, scholar_id: scholarId, is_active: true, issued_by: req.user.id },
        });
      await transaction.eligibility_assessments.create({
        data: {
          applicant_id: applicantId,
          application_id: application.id,
          result_id: latestResult.id,
          academic_period_id: activePeriod.id,
          policy_version: assessment.policyVersion,
          policy_name: assessment.policyName,
          recommendation: assessment.recommendation,
          total_score: assessment.totalScore,
          max_score: assessment.maxScore,
          threshold_score: assessment.threshold,
          summary: assessment.summary,
          scorecard: assessment.factors,
          input_snapshot: assessment.inputSnapshot,
          generated_at: new Date(assessment.generatedAt),
          reviewed_by: req.user.id,
          review_decision: 'accepted',
          review_reason: reviewReason || null,
          reviewed_at: new Date(),
        },
      });
      await transaction.scholar_requirements.upsert({
        where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: activePeriod.id } },
        create: { applicant_id: applicantId, billing_period_id: activePeriod.id, updated_by: req.user.id },
        update: { updated_by: req.user.id },
      });
      return savedScholar;
    });
    const emailDelivery = await sendScholarApprovedEmail({
      to: applicant.email,
      firstName: applicant.first_name,
      scholarId: scholar.scholar_id,
      schoolYear,
    });
    res.locals.auditAction = assessment.requiresOverrideReason
      ? 'ELIGIBILITY_RECOMMENDATION_OVERRIDDEN'
      : 'APPLICANT_ACCEPTED_AS_SCHOLAR';
    res.locals.auditDescription = assessment.requiresOverrideReason
      ? `Accepted an applicant after a documented human override of eligibility policy ${assessment.policyVersion}.`
      : `Accepted an applicant after reviewing eligibility policy ${assessment.policyVersion}.`;
    return res.status(201).json({
      message: 'Applicant accepted as a scholar.',
      scholar,
      eligibilityAssessment: assessment,
      notification: { scholarApprovalEmailSent: emailDelivery.sent },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error accepting applicant as a scholar.' });
  }
};

const reevaluateExamResult = async (req, res) => {
  try {
    const applicantId = Number(req.params.applicantId);
    const score = Number(req.body.score);
    const remarks = String(req.body.remarks || '').trim();
    if (!Number.isInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid applicant is required.' });
    if (!Number.isFinite(score) || score < 0 || score > 20) return res.status(400).json({ message: 'The revised score must be between 0 and 20.' });
    if (!remarks) return res.status(400).json({ message: 'A re-evaluation remark is required.' });
    if (remarks.length > 2000) return res.status(400).json({ message: 'The re-evaluation remark must not exceed 2,000 characters.' });

    const [result, activeScholar] = await Promise.all([
      prisma.results.findFirst({ where: { applicant_id: applicantId }, orderBy: { created_at: 'desc' } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true }, select: { id: true } }),
    ]);
    if (!result) return res.status(404).json({ message: 'No examination result was found for this applicant.' });
    if (activeScholar) return res.status(409).json({ message: 'This result can no longer be re-evaluated because the applicant has already been accepted as a scholar.' });

    const passingScore = result.passing_score === null || result.passing_score === undefined
      ? 14
      : Number(result.passing_score);
    const passed = score >= passingScore;
    const updated = await prisma.results.update({
      where: { id: result.id },
      data: {
        score,
        passed,
        remarks,
        recorded_by: req.user.id,
        updated_at: new Date(),
      },
    });
    await prisma.application_submissions.updateMany({
      where: { applicant_id: applicantId, status: { not: 'Withdrawn' } },
      data: { status: passed ? APPLICATION_STATUSES.PASSED_EXAM : APPLICATION_STATUSES.EXAMINED },
    });

    return res.json({
      message: 'Examination result re-evaluated successfully.',
      result: {
        score: Number(updated.score),
        passingScore,
        status: passed ? 'Passed' : 'Failed',
        remarks: updated.remarks || '',
        updatedAt: updated.updated_at,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error re-evaluating examination result.' });
  }
};

module.exports = {
  getActiveAcademicPeriod,
  getAcademicPeriods,
  createAcademicPeriod,
  activateAcademicPeriod,
  createApplication,
  inputExamScore,
  submitOnlineExam,
  submitRequirements,
  activateScholar,
  markPayoutCompliant,
  markPaid,
  createPayrollBatch,
  releasePayrollBatch,
  getEligibleScholars,
  getScholarsByStatus,
  getScholarManagement,
  processBillingSelection,
  processPayrollSelection,
  getApplicationById,
  getMyApplication,
  uploadMyRequirement,
  createAnnouncement,
  getAnnouncementManagement,
  getLatestPublishedAnnouncement,
  updateAnnouncement,
  getDashboardSummary,
  getSchoolCatalog,
  updateSchoolClassification,
  getApplicantManagement,
  getExaminationManagement,
  saveExaminationManagement,
  acceptApplicantAsScholar,
  reevaluateExamResult,
};
