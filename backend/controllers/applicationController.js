const { getScheduledApplicantIds } = require('../services/examAssignments');
const { isFirstYearEntry } = require('../services/initialAcademicEvidence');
const { grantBreakdown, preparationBlocker, snapshotPrivateGrants } = require('../services/grantPreparation');
const { getPostedPasser, canRecordInitial, initialChecklist, initialApproved } = require('../services/passerIntake');
const { resolveProcessingRoute, assertProcessingRoutes } = require('../services/processingRoute');
const { hasSectionAccess } = require('../services/sectionAccess');
const { loadContinuingSchedule, evaluateContinuingSchedule, projectContinuingAccess } = require('../services/continuingSchedule');
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
  sendScholarApprovedEmail,
} = require('../services/mailer');
const {
  evaluateListEligibility,
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
const { canAccessOnlineExamination, getExaminationSettings, isExaminationScheduleOpen } = require('../services/examinationAccess');
const { buildApplicantGuidance } = require('../services/applicantGuidance');
const { resolveExaminationProgress } = require('../services/examinationProgress');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { isExaminationApplicationEligible, isCurrentExaminationApplicant } = require('../services/examinationEligibility');
const { evaluateEligibility, serializeAssessment } = require('../services/eligibilityRecommendation');
const { PRIORITY_PROOFS, selectedPriorityCriteria } = require('../services/priorityEligibility');
const { createReferencedListBatch } = require('../services/billingReference');
const { resolveBillingAmount } = require('../services/billingGrant');
const { getOrStartAttempt, assertAttemptOpen, AttemptError } = require('../services/onlineExamAttempt');
const { assertAutomaticGrading, loadConfiguration, publicConfiguration, scoreConfiguredAnswers, createExamTicket, verifyExamTicket } = require('../services/onlineExamConfiguration');
const { INITIAL_KEYS, CONTINUING_KEYS, getWaveSet, getInitialRequirements, getEffectiveRequirements, continuingIsOpen, saveWaveDocument, mutateRequirementWaves } = require('../services/requirementWaves');
const { resolveRequirementSubmission } = require('../services/requirementSubmission');
const { serializePayrollListMembership } = require('../services/payrollListScope');
const { latestCertificationCreatedAt } = require('../services/certificationDate');
const { loadSchoolHistory, loadResolvedScholarSchool, normalizeSchoolName, resolveScholarSchool, schoolClassification } = require('../services/scholarSchool');

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
  requirementsDeadline: period.requirements_deadline,
  requirementsSubmission: resolveRequirementSubmission(period),
  status: period.status,
  isActive: period.is_active,
  isPrimary: Boolean(period.is_primary),
  createdAt: period.created_at,
  updatedAt: period.updated_at,
});

const getActiveAcademicPeriodRecord = async (client = prisma) => {
  const period = await findPrimaryActivePeriod(client);
  return period || {
    id: Number(CURRENT_SCHOOL_YEAR.replace('-', '')),
    school_year: CURRENT_SCHOOL_YEAR,
    semester: DEFAULT_SEMESTER,
    start_date: null,
    end_date: null,
    requirements_deadline: null,
    status: 'active',
    is_active: true,
    is_primary: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
};

const getSelectedActiveAcademicPeriodRecord = async (value, client = prisma) => {
  if (value === undefined || value === null || value === '') return getActiveAcademicPeriodRecord(client);
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) return null;
  return client.academic_periods.findFirst({ where: { id, is_active: true } });
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
    const guardianRelationship = family.guardianSameAsParent
      ? family.guardianParentRole === 'father' ? 'Father' : 'Mother'
      : String(family.guardianRelationship || '').trim();
    const storedFamily = { ...family, guardianRelationship };
    delete storedFamily.guardianOccupation;

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
            guardianRelationship,
            guardianSameAsParent: family.guardianSameAsParent,
            guardianParentRole: family.guardianParentRole || null,
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
          family: storedFamily,
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
      notification: { accountEmailSent: emailDelivery.sent, reason: emailDelivery.reason || null },
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
    const hasPrimary = await prisma.academic_periods.findFirst({ where: { is_primary: true, is_active: true }, select: { id: true } });
    const period = await prisma.academic_periods.update({
      where: { id },
      data: { is_active: true, is_primary: !hasPrimary, status: 'active' },
    });
    return res.json({
      message: `${period.school_year} · ${period.semester} is now active${period.is_primary ? ' and is the Primary System Period' : ''}.`,
      period: serializeAcademicPeriod(period),
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'The database is still completing the multiple-period update. Please retry shortly.' });
    }
    console.error(error);
    return res.status(500).json({ message: 'Server error activating the academic period.' });
  }
};

const updateAcademicPeriodRequirementsDeadline = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Select a valid academic period.' });
    }
    const existing = await prisma.academic_periods.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Academic period not found.' });

    const deadlineValue = req.body?.deadline;
    let deadline = null;
    if (deadlineValue !== null && deadlineValue !== undefined && deadlineValue !== '') {
      if (typeof deadlineValue !== 'string') {
        return res.status(400).json({ message: 'Enter a valid requirements deadline.' });
      }
      deadline = new Date(deadlineValue);
      if (Number.isNaN(deadline.getTime())) {
        return res.status(400).json({ message: 'Enter a valid requirements deadline.' });
      }
    }

    const period = await prisma.academic_periods.update({
      where: { id },
      data: { requirements_deadline: deadline },
    });
    res.locals.auditTargetId = period.id;
    res.locals.auditDescription = deadline
      ? `Set the semester-requirements deadline for ${period.school_year} ${period.semester}.`
      : `Cleared the semester-requirements deadline for ${period.school_year} ${period.semester}.`;
    return res.json({
      message: deadline ? 'Requirements submission deadline saved.' : 'Requirements submission deadline cleared.',
      period: serializeAcademicPeriod(period),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating the requirements deadline.' });
  }
};

const setPrimaryAcademicPeriod = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Select a valid academic period.' });
    const existing = await prisma.academic_periods.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Academic period not found.' });
    if (existing.is_primary && existing.is_active) return res.json({ message: 'This is already the Primary System Period.', period: serializeAcademicPeriod(existing) });
    const period = await prisma.$transaction(async (transaction) => {
      await transaction.academic_periods.updateMany({ where: { is_primary: true }, data: { is_primary: false } });
      return transaction.academic_periods.update({ where: { id }, data: { is_active: true, is_primary: true, status: 'active' } });
    });
    return res.json({ message: `${period.school_year} · ${period.semester} is now the Primary System Period.`, period: serializeAcademicPeriod(period) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error setting the Primary System Period.' });
  }
};

const deactivateAcademicPeriod = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Select a valid academic period.' });
    const existing = await prisma.academic_periods.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Academic period not found.' });
    if (!existing.is_active) return res.json({ message: 'This academic period is already inactive.', period: serializeAcademicPeriod(existing) });
    if (existing.is_primary) return res.status(409).json({ message: 'Choose another Primary System Period before deactivating this period.' });
    const period = await prisma.academic_periods.update({ where: { id }, data: { is_active: false, is_primary: false, status: 'archived' } });
    return res.json({ message: `${period.school_year} · ${period.semester} was deactivated. Historical records remain available.`, period: serializeAcademicPeriod(period) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error deactivating the academic period.' });
  }
};
const ANNOUNCEMENT_AUDIENCES = ['all', 'applicants', 'scholars', 'applicants_scholars', 'admins'];
const ANNOUNCEMENT_PRIORITIES = ['normal', 'high', 'urgent'];
const ANNOUNCEMENT_STATUSES = ['draft', 'scheduled', 'published', 'archived'];
const { normalizeFacebookPostUrl } = require('../services/announcementLinks');
const { validateAnnouncementImage, latestPriorityAnnouncement } = require('../services/announcementPolicy');

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
  externalUrl: announcement.external_url,
  createdBy: announcement.created_by,
  createdAt: announcement.created_at,
  updatedAt: announcement.updated_at,
  notifyEmail: announcement.notify_email,
  emailQueuedAt: announcement.email_queued_at,
});

const parseAnnouncementPayload = (body, existing = null) => {
  const postNow = body.action === 'post-now';
  if (body.action && !postNow) return { error: 'Select a valid announcement action.' };
  const title = String(body.title || '').trim();
  const content = String(body.content || '').trim();
  const audience = String(body.audience || 'all').toLowerCase();
  const priority = String(body.priority || 'normal').toLowerCase();
  const status = postNow ? 'published' : String(body.status || 'draft').toLowerCase();
  const publishAt = !postNow && body.publishAt ? new Date(body.publishAt) : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const imageName = body.imageName ? String(body.imageName).trim().slice(0, 255) : null;
  let imageType = body.imageType ? String(body.imageType).trim().slice(0, 100) : null;
  const imageData = body.imageData ? String(body.imageData) : null;
  const rawExternalUrl = String(body.externalUrl || '').trim();
  const externalUrl = normalizeFacebookPostUrl(rawExternalUrl);
  if (!title || title.length > 200) return { error: 'Announcement title is required and must not exceed 200 characters.' };
  if (!content || content.length > 5000) return { error: 'Announcement content is required and must not exceed 5,000 characters.' };
  if (!ANNOUNCEMENT_AUDIENCES.includes(audience)) return { error: 'Select a valid announcement audience.' };
  if (!ANNOUNCEMENT_PRIORITIES.includes(priority)) return { error: 'Select a valid announcement priority.' };
  if (!ANNOUNCEMENT_STATUSES.includes(status)) return { error: 'Select a valid publishing status.' };
  if (publishAt && Number.isNaN(publishAt.getTime())) return { error: 'Enter a valid publishing date.' };
  if (expiresAt && Number.isNaN(expiresAt.getTime())) return { error: 'Enter a valid expiration date.' };
  if (status === 'scheduled' && !publishAt) return { error: 'A publishing date is required for scheduled announcements.' };
  if (rawExternalUrl && !externalUrl) return { error: 'Enter a valid HTTPS Facebook post URL.' };
  const isImageDataUrl = /^data:image\/(jpeg|png|webp|gif);base64,/i.test(imageData || '');
  if (imageData && !isImageDataUrl && !isBlobUrl(imageData)) return { error: 'Upload a valid JPG, PNG, WEBP, or GIF image.' };
  if (isImageDataUrl) {
    try { imageType = validateAnnouncementImage(imageData, imageType); }
    catch (error) { return { error: error.message }; }
  }
  const preservesWindow = existing && !postNow && existing.status === status && +new Date(existing.publish_at) === +new Date(publishAt);
  const effectivePublishDate = publishAt || (existing && !postNow ? existing.published_at : null) || new Date();
  if (expiresAt && expiresAt <= effectivePublishDate && !(['draft', 'archived'].includes(status) || (preservesWindow && +new Date(expiresAt) === +new Date(existing.expires_at)))) return { error: 'Expiration must be later than the publishing date.' };
  return { title, content, audience, priority, status, publishAt, expiresAt, imageName, imageType, imageData, externalUrl, postNow };
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
    data: { status: 'published', published_at: now, notify_email: true },
  });
};

const getAnnouncementManagement = async (req, res) => {
  try {
    await publishDueAnnouncements();
    const announcements = await prisma.announcements.findMany({ orderBy: { updated_at: 'desc' } });
    const deliveryCounts = await prisma.announcement_email_deliveries.groupBy({
      by: ['announcement_id', 'status'], _count: { _all: true },
    });
    return res.json({ announcements: announcements.map((announcement) => ({
      ...serializeAnnouncement(announcement),
      emailDeliveries: Object.fromEntries(deliveryCounts.filter((row) => row.announcement_id === announcement.id)
        .map((row) => [row.status, row._count._all])),
    })) });
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
    const announcement = await latestPriorityAnnouncement(prisma, {
        status: 'published',
        audience: { in: roleAudiences },
        OR: [{ publish_at: null }, { publish_at: { lte: now } }],
        AND: [{ OR: [{ expires_at: null }, { expires_at: { gt: now } }] }],
      });
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
        notify_email: true,
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
        external_url: payload.externalUrl,
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
  let uploadedImage = null;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'A valid announcement is required.' });
    const existing = await prisma.announcements.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Announcement not found.' });
    if (typeof req.body.updatedAt !== 'string' || !Number.isFinite(+new Date(req.body.updatedAt))) return res.status(400).json({ message: 'Reload the announcement before editing or posting it.' });
    if (+new Date(existing.updated_at) !== +new Date(req.body.updatedAt)) return res.status(409).json({ message: 'This announcement changed. Reload before saving your edits.' });
    const payload = parseAnnouncementPayload(req.body, existing);
    if (payload.error) return res.status(400).json({ message: payload.error });
    const storedImage = await persistAnnouncementImage(payload);
    if (storedImage !== payload.imageData) uploadedImage = storedImage;
    const announcement = await prisma.$transaction(async (tx) => {
      const changed = await tx.announcements.updateMany({
      where: { id, updated_at: new Date(req.body.updatedAt) },
      data: {
        title: payload.title,
        // Internal rollout marker, not a staff preference. Do not retroactively
        // broadcast historical published notices on an ordinary content edit.
        notify_email: Boolean(existing.notify_email || payload.postNow || payload.status === 'scheduled'
          || (payload.status === 'published' && existing.status !== 'published')),
        content: payload.content,
        audience: payload.audience,
        priority: payload.priority,
        status: payload.status,
        publish_at: payload.publishAt,
        expires_at: payload.expiresAt,
        published_at: payload.postNow ? new Date() : payload.status === 'published' ? existing.published_at || new Date() : existing.published_at,
        updated_at: new Date(Math.max(Date.now(), +new Date(existing.updated_at) + 1)),
        image_name: payload.imageName,
        image_type: payload.imageType,
        image_data: storedImage,
        external_url: payload.externalUrl,
      },
      });
      if (changed.count !== 1) throw Object.assign(new Error('This announcement changed. Reload before saving your edits.'), { status: 409 });
      return tx.announcements.findUnique({ where: { id } });
    }, { isolationLevel: 'Serializable' });
    uploadedImage = null;
    if (existing.image_data && existing.image_data !== storedImage) {
      await deleteBlob(existing.image_data, process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN);
    }
    return res.json({ message: 'Announcement updated successfully.', announcement: serializeAnnouncement(announcement) });
  } catch (error) {
    if (uploadedImage) await deleteBlob(uploadedImage, process.env.ANNOUNCEMENT_BLOB_READ_WRITE_TOKEN);
    if (error.status === 409 || ['P2034', 'P2002'].includes(error.code)) return res.status(409).json({ message: 'This announcement changed. Reload before saving your edits.' });
    console.error(error);
    if (error instanceof BlobStorageConfigurationError) return res.status(error.statusCode).json({ message: error.message });
    return res.status(500).json({ message: 'Server error updating the announcement.' });
  }
};

const getScholarManagement = async (req, res) => {
  try {
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.query.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period.' });
    const continuingSchedule = await loadContinuingSchedule(prisma, activePeriod.id);
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
        select: { id: true, applicant_id: true, school_plan: true, initial_docs: true },
      }),
      prisma.payroll_claims.findMany({ where: { applicant_id: { in: applicantIds } }, orderBy: { updated_at: 'desc' } }),
      prisma.academic_periods.findMany(),
    ]);
    const schoolHistoryByApplicant = await loadSchoolHistory(prisma, applicantIds);
    const payrollBatchIds = [...new Set(payrollClaims.map((claim) => claim.payroll_batch_id).filter(Boolean))];
    const payrollBatches = await prisma.payroll_batches.findMany({ where: { OR: [{ id: { in: payrollBatchIds } }, { billing_period_id: activePeriod.id }] } });
    const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
    const accountByApplicant = new Map(accounts.map((account) => [account.applicant_id, account]));
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const schoolByName = new Map(schools.map((school) => [normalizeSchoolName(school.name), school]));
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
    const sortedAcademicPeriods = [...academicPeriods]
      .sort((left, right) => right.school_year.localeCompare(left.school_year) || left.semester.localeCompare(right.semester));
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
      ['Grade 12 Report Card (optional, incoming/1st-year college)', null, null, 'report_card'],
      ['Registration Form (currently enrolled semester)', 'registration_form_file', 'registration_form_review_status', 'registration_form'],
      ['Official Receipt of Tuition Fee (private school scholars)', 'tuition_fee_receipt_file', 'tuition_fee_receipt_review_status', 'tuition_receipt'],
    ];
    const scholars = scholarAccounts.map((scholar) => {
      const applicant = applicantById.get(scholar.applicant_id);
      if (!applicant) return null;
      const requirement = requirementByApplicant.get(applicant.id);
      const application = applicationByApplicant.get(applicant.id);
      const applicationPlan = application?.school_plan || {};
      const school = resolveScholarSchool({ applicant, requirement, application, schoolById, schoolByName, schoolHistory: schoolHistoryByApplicant.get(applicant.id) });
      const resolvedSchoolType = String(school?.school_type || '').trim().toLowerCase();
      const schoolType = resolvedSchoolType === 'private' ? 'Private' : resolvedSchoolType === 'public' ? 'Public' : 'Unclassified';
      const continuingAccess = evaluateContinuingSchedule({ schedule: continuingSchedule, period: activePeriod, docs: application?.initial_docs, applicantId: applicant.id, schoolType, legacyPeriodId: primaryPeriod.id, entryYearLevel: application?.school_plan?.incomingYearLevel });
      if (application) application.initial_docs = projectContinuingAccess(application.initial_docs, activePeriod.id, continuingAccess);
      const applicationRequirements = getEffectiveRequirements(application?.initial_docs, activePeriod.id, primaryPeriod.id).requirements;
      const configuredBillingAmount = requirement?.billing_amount === null || requirement?.billing_amount === undefined
        ? 0
        : Number(requirement.billing_amount);
      const effectiveBillingAmount = resolveBillingAmount(schoolType, configuredBillingAmount);
      const payrollClaim = payrollClaimByApplicant.get(applicant.id);
      const payrollBatch = payrollClaim ? payrollBatchById.get(payrollClaim.payroll_batch_id) : null;
      const currentRecordRoute = payrollBatch
        ? (String(payrollBatch.batch_number || '').startsWith('BILL-') || String(payrollBatch.status || '').toLowerCase() === 'billed' ? 'billing' : 'payroll')
        : null;
      const billed = Boolean(payrollClaim && currentRecordRoute === 'billing');
      const inPayroll = Boolean(payrollClaim && currentRecordRoute === 'payroll');
      const processRoute = currentRecordRoute || resolveProcessingRoute({ schoolType, requirement, docs: application?.initial_docs, period: activePeriod, schedule: continuingSchedule, applicantId: applicant.id, legacyPeriodId: primaryPeriod.id });
      const schoolYear = activePeriod.school_year;
      const semester = activePeriod.semester;
      const billingSchoolYear = requirement?.billing_school_year || schoolYear;
      const billingSemester = requirement?.billing_semester || semester;
      const billingAcademicPeriod = academicPeriods.find((period) => (
        period.school_year === billingSchoolYear && period.semester === billingSemester
      )) || activePeriod;
      const financialHistory = (payrollClaimsByApplicant.get(applicant.id) || []).map((claim) => {
        const batch = payrollBatchById.get(claim.payroll_batch_id);
        const historyRoute = String(batch?.batch_number || '').startsWith('BILL-') || String(batch?.status || '').toLowerCase() === 'billed'
          ? 'billing'
          : 'payroll';
        const period = academicPeriodById.get(batch?.billing_period_id);
        return {
          academicPeriodId: batch?.billing_period_id || null,
          schoolYear: period?.school_year || (batch?.billing_period_id === activePeriod.id ? activePeriod.school_year : 'Legacy period'),
          semester: period?.semester || (batch?.billing_period_id === activePeriod.id ? activePeriod.semester : 'Not specified'),
          processRoute: historyRoute,
          billed: historyRoute === 'billing',
          inPayroll: historyRoute === 'payroll',
          billingStatus: historyRoute === 'billing' ? 'Certification listed' : 'Not applicable',
          payrollStatus: historyRoute === 'payroll' ? 'Included in payroll list' : 'Not applicable',
          billingReference: historyRoute === 'billing' ? batch?.batch_number || null : null,
          payReference: historyRoute === 'payroll' ? batch?.batch_number || null : null,
          dateProcessed: batch?.prepared_at || claim.created_at || null,
          claimAmount: Number(claim.claim_amount),
          tuitionFeeAssistance: claim.tuition_fee_assistance == null ? null : Number(claim.tuition_fee_assistance),
          allowance: claim.allowance == null ? null : Number(claim.allowance),
          preparationStatus: 'Listed',
          isActivePeriod: batch?.billing_period_id === activePeriod.id,
        };
      });
      const applicableRequirementFields = requirementFields.filter(([, , , key]) => (schoolType === 'Private' || key !== 'tuition_receipt') && (key !== 'report_card' || isFirstYearEntry(application?.school_plan?.incomingYearLevel) || getInitialRequirements(application?.initial_docs, activePeriod.id, primaryPeriod.id).requirements.report_card?.fileName));
      const mapDocuments = (wave) => {
        const inherited = wave === 'initial' ? getInitialRequirements(application?.initial_docs, activePeriod.id, primaryPeriod.id) : null;
        const set = getWaveSet(application?.initial_docs, activePeriod.id, wave, primaryPeriod.id);
        const files = inherited?.requirements || set.requirements;
        return applicableRequirementFields.map(([label, , , requirementKey]) => {
          const file = files[requirementKey];
          const sourcePeriodId = wave === 'initial' && !set.requirements[requirementKey] ? inherited.originalPeriodId : activePeriod.id;
          const sourcePeriod = academicPeriodById.get(sourcePeriodId) || activePeriod;
          return {
            label: requirementKey === 'indigency' ? 'Barangay Indigency (optional)' : label, optional: ['indigency', 'report_card'].includes(requirementKey) || (wave === 'initial' && requirementKey === 'grades' && isFirstYearEntry(application?.school_plan?.incomingYearLevel)), alternativeGroup: wave === 'initial' && isFirstYearEntry(application?.school_plan?.incomingYearLevel) && ['grades', 'report_card'].includes(requirementKey) ? 'initial_grades' : null, requirementKey, submitted: Boolean(file?.fileName), applicationId: application?.id || null,
            academicPeriodId: sourcePeriodId, submissionWave: wave, periodLabel: `${sourcePeriod.school_year} · ${sourcePeriod.semester}`, legacy: Boolean((set.requirements[requirementKey] ? set.legacy : inherited?.original.legacy) && !file?.uploadedByRole), versionId: file?.versionId || null, revision: file?.revision || 0, reviewHistory: file?.reviewHistory || [],
            fileName: file?.fileName || null, fileType: file?.fileType || 'application/octet-stream',
            uploadedAt: file?.uploadedAt || null, reviewedAt: file?.reviewedAt || null,
            reviewNotes: file?.reviewNotes || '', status: file?.status || 'Pending',
          };
        });
      };
      const initialDocuments = mapDocuments('initial');
      const continuingDocuments = mapDocuments('continuing').filter(({ requirementKey }) => CONTINUING_KEYS.includes(requirementKey));
      const documentHistory = Object.values(application?.initial_docs?.requirementSets || {}).flatMap((set) => (
        [...(set.history || []), ...(set.academicPeriodId !== activePeriod.id ? Object.entries(set.requirements || {}).map(([requirementKey, file]) => ({ ...file, requirementKey })) : [])].map((file) => ({
          applicationId: application.id, academicPeriodId: set.academicPeriodId, submissionWave: set.wave, periodLabel: academicPeriodById.has(set.academicPeriodId) ? `${academicPeriodById.get(set.academicPeriodId).school_year} · ${academicPeriodById.get(set.academicPeriodId).semester}` : "Earlier submission",
          requirementKey: file.requirementKey, versionId: file.versionId, fileName: file.fileName, fileType: file.fileType,
          uploadedAt: file.uploadedAt, reviewedAt: file.reviewedAt, status: file.status, reviewNotes: file.reviewNotes, reviewHistory: file.reviewHistory || [],
        }))
      ));
      const documents = applicableRequirementFields.map(([label, fileField, statusField, uploadKey]) => {
        const uploadedDocument = uploadKey ? applicationRequirements[uploadKey] : null;
        const submitted = Boolean(uploadedDocument?.fileName || (!application?.initial_docs?.requirementSets && !continuingIsOpen(application?.initial_docs, activePeriod.id) && requirement?.[fileField]));
        return {
          label: uploadKey === 'indigency' ? 'Barangay Indigency (optional)' : label,
          optional: uploadKey === 'indigency',
          submitted,
          applicationId: application?.id || null,
          requirementKey: uploadKey,
          fileName: uploadedDocument?.fileName || null,
          fileType: uploadedDocument?.fileType || 'application/octet-stream',
          uploadedAt: uploadedDocument?.uploadedAt || null,
          reviewedAt: uploadedDocument?.reviewedAt || null,
          reviewNotes: uploadedDocument?.reviewNotes || '',
          status: statusField
            ? uploadedDocument?.status || (!application?.initial_docs?.requirementSets && !continuingIsOpen(application?.initial_docs, activePeriod.id) ? requirement?.[statusField] : null) || 'pending'
            : submitted ? 'approved' : 'pending',
        };
      });
      const requiredDocuments = documents.filter(({ optional }) => !optional);
      const submittedDocuments = requiredDocuments.filter(({ submitted }) => submitted);
      const hasReviewItems = submittedDocuments.some(({ status }) => !['approved', 'complete', 'completed'].includes(String(status).toLowerCase()));
      const documentsComplete = submittedDocuments.length === requiredDocuments.length && !hasReviewItems;
      let billingEligibility = evaluateListEligibility({
        isActive: scholar.is_active,
        alreadyBilled: billed,
        alreadyProcessedForPeriod: !billed && (payrollClaimsByApplicant.get(applicant.id) || []).some((claim) => (
          claim.academic_period_id === activePeriod.id || payrollBatchById.get(claim.payroll_batch_id)?.billing_period_id === activePeriod.id
        )),
        initialDocs: getEffectiveRequirements(application?.initial_docs, activePeriod.id, primaryPeriod.id),
        requirement: application?.initial_docs?.requirementSets ? undefined : requirement,
        schoolType: school?.school_type,
        requireSchoolClassification: true,
      });
      const grantBlocker = preparationBlocker(schoolType, requirement, Boolean(payrollClaim));
      if (grantBlocker) billingEligibility = { ...billingEligibility, eligible: false, reasons: [...billingEligibility.reasons, grantBlocker] };
      const savedGrant = payrollClaim?.tuition_fee_assistance != null
        ? { grantPrepared: true, totalGrant: 5000, tuitionFeeAssistance: Number(payrollClaim.tuition_fee_assistance), allowance: Number(payrollClaim.allowance), grantPreparedAt: requirement?.grant_prepared_at || null }
        : payrollClaim || schoolType !== 'Private' ? { grantPrepared: false, totalGrant: schoolType === 'Private' ? 5000 : 3000, tuitionFeeAssistance: null, allowance: null, grantPreparedAt: null } : grantBreakdown(requirement);
      return {
        ...savedGrant,
        totalGrant: payrollClaim ? Number(payrollClaim.claim_amount) : resolveBillingAmount(schoolType),
        preparationStatus: payrollClaim ? 'Listed' : schoolType !== 'Private' ? 'Not applicable' : savedGrant.grantPrepared ? 'Prepared' : 'Not prepared',
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
        schoolId: school?.id || null,
        schoolType,
        processRoute,
        notYetIncluded: !payrollClaim && !(payrollClaimsByApplicant.get(applicant.id) || []).some((claim) => claim.academic_period_id === activePeriod.id),
        payrollRequested: Boolean(requirement?.payroll_requested_at),
        canPreparePayroll: scholar.is_active && !payrollClaim && !((payrollClaimsByApplicant.get(applicant.id) || []).some((claim) => claim.academic_period_id === activePeriod.id)) && schoolType === 'Private' && processRoute === 'billing' && payrollBatches.some((batch) => batch.billing_period_id === activePeriod.id && ['billed', 'generated'].includes(batch.status)) && hasSectionAccess(req.user, 'payroll'),
        academicPeriodId: activePeriod.id,
        schoolYear,
        semester,
        schoolYearSemester: `${schoolYear} · ${semester}`,
        yearLevel: requirement?.year_level || applicationPlan.incomingYearLevel || null,
        course: requirement?.course || applicationPlan.course || null,
        major: requirement?.major || null,
        billingAmount: effectiveBillingAmount,
        billingNotes: requirement?.billing_notes || '',
        billingReference: requirement?.billing_reference || null,
        billingAcademicPeriodId: billingAcademicPeriod.id,
        billingSchoolYear,
        billingSemester,
        billingSchoolYearSemester: `${billingSchoolYear} · ${billingSemester}`,
        status: scholar.is_active ? 'Active' : 'Inactive',
        documentStatus: documentsComplete ? 'Complete' : 'Review',
        documentsSubmitted: submittedDocuments.length,
        documentsTotal: requiredDocuments.length,
        documents, initialDocuments, continuingDocuments, documentHistory,
        continuingOpen: continuingAccess.visible, continuingSubmission: continuingAccess,
        billingEligible: billingEligibility.eligible,
        billingEligibilityReasons: billingEligibility.reasons,
        processingWarnings: billingEligibility.warnings,
        issuedAt: scholar.issued_at,
        notes: scholar.notes || '',
        processEligible: billingEligibility.eligible,
        billed,
        billingStatus: processRoute === 'billing' ? (billed ? 'Certification listed' : 'Not listed yet') : 'Not applicable',
        inPayroll,
        payrollStatus: processRoute === 'payroll' ? (inPayroll ? 'Included in payroll list' : 'Not included yet') : 'Not applicable',
        payReference: inPayroll ? payrollBatch?.batch_number || null : null,
        dateProcessed: payrollBatch?.prepared_at || payrollClaim?.created_at || null,
        claimAmount: payrollClaim ? resolveBillingAmount(schoolType, payrollClaim.claim_amount) : effectiveBillingAmount,
        financialHistory,
      };
    }).filter(Boolean);
    return res.json({
      scholars,
      schools: schools.filter((school) => school.is_active !== false).map((school) => ({
        id: school.id,
        name: school.name,
        schoolType: schoolClassification(school.school_type),
      })),
      activePeriod: serializeAcademicPeriod(activePeriod),
      activePeriods: sortedAcademicPeriods.filter((period) => period.is_active).map(serializeAcademicPeriod),
      academicPeriods: sortedAcademicPeriods.map(serializeAcademicPeriod),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error fetching scholar management records.' });
  }
};

const normalizeApplicantIds = (value) => Array.isArray(value)
  ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
  : [];

const updateScholarBillingDetails = async (req, res) => {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid scholar is required.' });
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period.' });
    const [scholar, school, processedClaim] = await Promise.all([
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true }, select: { id: true } }),
      prisma.schools.findFirst({ where: { id: Number(req.body.schoolId), is_active: true }, select: { id: true, name: true, school_type: true } }),
      prisma.payroll_claims.findFirst({ where: { applicant_id: applicantId, academic_period_id: activePeriod.id }, select: { id: true } }),
    ]);
    if (!scholar) return res.status(404).json({ message: 'Active scholar account not found.' });
    if (!school) return res.status(400).json({ message: 'Select an active school from the catalog.' });
    if (schoolClassification(school.school_type) === 'Unclassified') return res.status(400).json({ message: 'Save the Public or Private classification for this school in School Catalog first.' });
    if (processedClaim) return res.status(409).json({ message: 'Billing details are locked after the scholar is processed for the active period.' });

    const billingAmount = resolveBillingAmount(school.school_type, req.body.billingAmount);
    const details = await prisma.scholar_requirements.upsert({
      where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: activePeriod.id } },
      create: {
        applicant_id: applicantId,
        billing_period_id: activePeriod.id,
        school_id: school.id,
        year_level: req.body.yearLevel.trim() || null,
        course: req.body.course.trim() || null,
        major: req.body.major.trim() || null,
        billing_amount: billingAmount,
        billing_notes: req.body.billingNotes.trim() || null,
        updated_by: req.user.id,
      },
      update: {
        school_id: school.id,
        year_level: req.body.yearLevel.trim() || null,
        course: req.body.course.trim() || null,
        major: req.body.major.trim() || null,
        billing_amount: billingAmount,
        billing_notes: req.body.billingNotes.trim() || null,
        updated_by: req.user.id,
      },
    });
    res.locals.auditTargetId = applicantId;
    return res.json({
      message: 'Scholar billing details updated.',
      billingDetails: {
        schoolId: school.id,
        school: school.name,
        schoolType: schoolClassification(school.school_type),
        yearLevel: details.year_level,
        course: details.course,
        major: details.major,
        billingAmount: Number(details.billing_amount || 0),
        billingNotes: details.billing_notes || '',
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating scholar billing details.' });
  }
};

const updateScholarBillingMetadata = async (req, res) => {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid scholar is required.' });
    const selectedPeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!selectedPeriod) return res.status(400).json({ message: 'Select an active school year and semester.' });
    const [scholar, processedClaim] = await Promise.all([
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true }, select: { id: true } }),
      prisma.payroll_claims.findFirst({ where: { applicant_id: applicantId, academic_period_id: selectedPeriod.id }, select: { id: true } }),
    ]);
    if (!scholar) return res.status(404).json({ message: 'Active scholar account not found.' });
    if (processedClaim) return res.status(409).json({ message: 'This scholar session is locked because the selected period was already processed.' });

    const [applicant, application, requirement] = await Promise.all([
      prisma.applicants.findUnique({ where: { id: applicantId } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
      prisma.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: selectedPeriod.id } } }),
    ]);
    const school = await loadResolvedScholarSchool(prisma, { applicantId, applicant, application, requirement });
    if (!['Public', 'Private'].includes(schoolClassification(school?.school_type))) return res.status(409).json({ message: 'Correct the school classification before preparing a session.' });
    if (!hasSectionAccess(req.user, resolveProcessingRoute({ schoolType: school.school_type, requirement, docs: application?.initial_docs, period: selectedPeriod, schedule: await loadContinuingSchedule(prisma, selectedPeriod.id), applicantId, legacyPeriodId: (await getActiveAcademicPeriodRecord()).id }))) return res.status(403).json({ message: 'Access Denied. The required processing section is not assigned to your staff account.' });

    const metadata = await prisma.scholar_requirements.upsert({
      where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: selectedPeriod.id } },
      create: {
        applicant_id: applicantId,
        billing_period_id: selectedPeriod.id,
        billing_school_year: selectedPeriod.school_year,
        billing_semester: selectedPeriod.semester,
        billing_status: req.body.billingStatus,
        updated_by: req.user.id,
      },
      update: {
        billing_school_year: selectedPeriod.school_year,
        billing_semester: selectedPeriod.semester,
        billing_status: req.body.billingStatus,
        updated_by: req.user.id,
      },
    });
    res.locals.auditTargetId = applicantId;
    return res.json({
      message: 'Billing and payroll details updated.',
      billingMetadata: {
        billingReference: metadata.billing_reference,
        academicPeriodId: selectedPeriod.id,
        schoolYear: selectedPeriod.school_year,
        semester: selectedPeriod.semester,
        billingStatus: metadata.billing_status,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating billing and payroll details.' });
  }
};

const processBillingSelection = async (req, res) => {
  try {
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period for billing.' });
    const continuingSchedule = await loadContinuingSchedule(prisma, activePeriod.id);
    const applicantIds = normalizeApplicantIds(req.body.applicantIds);
    if (!applicantIds.length) return res.status(400).json({ message: 'Select at least one scholar for billing.' });
    if (applicantIds.length > 500) return res.status(400).json({ message: 'A billing batch cannot exceed 500 scholars.' });
    // Older clients must reload rather than authorize a retired exception path.
    if (req.body.billingOverrides != null && (!Array.isArray(req.body.billingOverrides) || req.body.billingOverrides.length)) {
      return res.status(400).json({ message: 'Requirement overrides have been removed. Refresh and generate the list without an override.' });
    }

    const [scholarAccounts, applicants, applications, requirements, schools, periodBatches] = await Promise.all([
      prisma.scholar_accounts.findMany({
        where: { applicant_id: { in: applicantIds } },
        select: { applicant_id: true, is_active: true },
      }),
      prisma.applicants.findMany({
        where: { id: { in: applicantIds }, deleted_at: null },
        select: { id: true, school_id: true },
      }),
      prisma.application_submissions.findMany({
        where: { applicant_id: { in: applicantIds } },
        orderBy: { submitted_at: 'desc' },
        select: { applicant_id: true, initial_docs: true, school_plan: true },
      }),
      prisma.scholar_requirements.findMany({
        where: { applicant_id: { in: applicantIds }, billing_period_id: activePeriod.id },
        select: {
          applicant_id: true,
          school_id: true,
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
          billing_amount: true,
          tuition_fee_assistance: true,
          grant_prepared_at: true,
          grant_prepared_by: true,
        },
      }),
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true, is_active: true } }),
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
    const schoolHistoryByApplicant = await loadSchoolHistory(prisma, applicantIds);
    const billedIds = new Set(existingClaims.map(({ applicant_id }) => applicant_id));
    const scholarByApplicant = new Map(scholarAccounts.map((scholar) => [scholar.applicant_id, scholar]));
    const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const schoolByName = new Map(schools.map((school) => [normalizeSchoolName(school.name), school]));
    const applicationByApplicant = new Map();
    applications.forEach((application) => {
      if (!applicationByApplicant.has(application.applicant_id)) applicationByApplicant.set(application.applicant_id, application);
    });
    const requirementByApplicant = new Map(requirements.map((requirement) => [requirement.applicant_id, requirement]));
    const eligibility = applicantIds.map((applicantId) => {
      const application = applicationByApplicant.get(applicantId);
      const requirement = requirementByApplicant.get(applicantId);
      const school = resolveScholarSchool({
        applicant: applicantById.get(applicantId),
        requirement,
        application,
        schoolById,
        schoolByName,
        schoolHistory: schoolHistoryByApplicant.get(applicantId),
      });
      const access = evaluateContinuingSchedule({ schedule: continuingSchedule, period: activePeriod, docs: application?.initial_docs, applicantId, schoolType: school?.school_type, legacyPeriodId: primaryPeriod.id, entryYearLevel: application?.school_plan?.incomingYearLevel });
      let result = evaluateListEligibility({
        isActive: Boolean(scholarByApplicant.get(applicantId)?.is_active),
        alreadyBilled: billedIds.has(applicantId),
        initialDocs: getEffectiveRequirements(projectContinuingAccess(application?.initial_docs, activePeriod.id, access), activePeriod.id, primaryPeriod.id),
        requirement: application?.initial_docs?.requirementSets || access.visible && continuingSchedule ? undefined : requirement,
        schoolType: school?.school_type,
        requireSchoolClassification: true,
      });
      const grantBlocker = preparationBlocker(school?.school_type, requirement, billedIds.has(applicantId));
      if (grantBlocker) result = { ...result, eligible: false, reasons: [...result.reasons, grantBlocker] };
      if (school && resolveProcessingRoute({ schoolType: school.school_type, requirement, docs: application?.initial_docs, period: activePeriod, schedule: continuingSchedule, applicantId, legacyPeriodId: primaryPeriod.id }) !== 'billing') {
        result = {
          ...result,
          eligible: false,
          reasons: [...result.reasons, {
            code: 'PUBLIC_SCHOOL_PAYROLL_ROUTE',
            message: 'Initial, Public and late submissions go to Payroll. Billing is for subsequent regular Private submissions.',
          }],
        };
      }
      if (!applicantById.has(applicantId)) {
        result = { ...result, eligible: false, reasons: [...result.reasons, { code: 'APPLICANT_UNAVAILABLE', message: 'The scholar applicant record is unavailable.' }] };
      }
      return { applicantId, schoolType: String(school?.school_type || 'public').toLowerCase(), ...result };
    });
    const ineligible = eligibility.filter(({ eligible }) => !eligible);
    if (ineligible.length) {
      return res.status(409).json({
        message: 'Some selected scholars are not ready for the Private-scholar certification list. Correct the account, school routing, or existing list membership before retrying.',
        ineligible: ineligible.map(({ applicantId, reasons }) => ({
          applicantId,
          reasons,
        })),
      });
    }
    const eligibleIds = eligibility.map(({ applicantId }) => applicantId);
    const warningsByApplicant = new Map(eligibility.map(({ applicantId, warnings }) => [applicantId, warnings]));
    const incompleteRequirementsCount = eligibility.filter(({ warnings }) => warnings.length > 0).length;
    const requirementAmountByApplicant = new Map(requirements.map((requirement) => [requirement.applicant_id, Number(requirement.billing_amount || 0)]));
    const billingAmountByApplicant = new Map(eligibility.map(({ applicantId, schoolType }) => [
      applicantId,
      resolveBillingAmount(schoolType, requirementAmountByApplicant.get(applicantId)),
    ]));
    const batchTotal = eligibleIds.reduce((total, applicantId) => total + (billingAmountByApplicant.get(applicantId) || 0), 0);

    const timestamp = new Date();
    const result = await prisma.$transaction(async (transaction) => {
      const grantSnapshots = await snapshotPrivateGrants(transaction, activePeriod.id, eligibleIds);
      await assertProcessingRoutes(transaction, activePeriod, eligibility, applicationByApplicant, primaryPeriod.id, 'billing');
      const batch = await createReferencedListBatch(transaction, 'billing', {
        billing_period_id: activePeriod.id,
        total_scholars: eligibleIds.length,
        total_amount: batchTotal,
        status: 'billed',
        prepared_by: req.user.id,
        prepared_at: timestamp,
        remarks: `${activePeriod.school_year} · ${activePeriod.semester} billing batch${incompleteRequirementsCount ? ` · ${incompleteRequirementsCount} with incomplete requirements` : ''}`,
        updated_at: timestamp,
      });
      await transaction.payroll_claims.createMany({
        data: eligibleIds.map((applicantId) => ({
          payroll_batch_id: batch.id,
          academic_period_id: activePeriod.id,
          applicant_id: applicantId,
          claim_amount: billingAmountByApplicant.get(applicantId) || 0,
          ...grantSnapshots.get(applicantId),
          claim_status: 'pending',
          notes: warningsByApplicant.get(applicantId)?.length
            ? 'Added through Billing Management. Requirements incomplete at list generation: ' + warningsByApplicant.get(applicantId).map(({ message }) => message).join(' ')
            : 'Added through Billing Management',
          updated_at: timestamp,
        })),
      });
      await transaction.scholar_requirements.updateMany({
        where: { applicant_id: { in: eligibleIds }, billing_period_id: activePeriod.id },
        data: { billing_reference: batch.batch_number, updated_by: req.user.id },
      });
      const scholarsWithoutRequirementRows = eligibleIds.filter((applicantId) => !requirementByApplicant.has(applicantId));
      if (scholarsWithoutRequirementRows.length) {
        await transaction.scholar_requirements.createMany({
          data: scholarsWithoutRequirementRows.map((applicantId) => ({
            applicant_id: applicantId,
            billing_period_id: activePeriod.id,
            billing_reference: batch.batch_number,
            updated_by: req.user.id,
          })),
        });
      }
      return { ...batch, grantBreakdowns: [...grantSnapshots].map(([applicantId, value]) => ({ applicantId, totalGrant: 5000, tuitionFeeAssistance: value.tuition_fee_assistance, allowance: value.allowance })) };
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 120000 });

    res.locals.auditTargetId = result.id;
    res.locals.auditDescription = `Generated a Private-scholar certification list for ${eligibleIds.length} scholars; ${incompleteRequirementsCount} with incomplete requirements.`;

    return res.status(201).json({
      message: `Private-scholar certification list generated for ${eligibleIds.length} scholar${eligibleIds.length === 1 ? '' : 's'}.`,
      batch: { id: result.id, batchNumber: result.batch_number, billingReference: result.batch_number, totalScholars: result.total_scholars },
      incompleteRequirementsCount,
      grantBreakdowns: result.grantBreakdowns,
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    if (error?.code === 'P2034') return res.status(409).json({ message: 'The preparation or list changed concurrently. Refresh and retry.' });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'One or more selected scholars were already billed for this academic period. Refresh the list and try again.' });
    }
    return res.status(500).json({ message: 'Server error processing the billing selection.' });
  }
};

const processPayrollSelection = async (req, res) => {
  try {
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period for the payroll list.' });
    const continuingSchedule = await loadContinuingSchedule(prisma, activePeriod.id);
    const applicantIds = normalizeApplicantIds(req.body.applicantIds);
    if (!applicantIds.length) return res.status(400).json({ message: 'Select at least one scholar for the payroll list.' });
    if (applicantIds.length > 500) return res.status(400).json({ message: 'A payroll list cannot exceed 500 scholars.' });

    // Older clients must reload rather than authorize a retired exception path.
    if (req.body.payrollOverrides != null && (!Array.isArray(req.body.payrollOverrides) || req.body.payrollOverrides.length)) {
      return res.status(400).json({ message: 'Requirement overrides have been removed. Refresh and generate the list without an override.' });
    }

    const [scholarAccounts, applicants, applications, requirements, schools, existingClaims] = await Promise.all([
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, is_active: true } }),
      prisma.applicants.findMany({ where: { id: { in: applicantIds }, deleted_at: null }, select: { id: true, school_id: true } }),
      prisma.application_submissions.findMany({
        where: { applicant_id: { in: applicantIds } },
        orderBy: { submitted_at: 'desc' },
        select: { applicant_id: true, initial_docs: true, school_plan: true },
      }),
      prisma.scholar_requirements.findMany({ where: { applicant_id: { in: applicantIds }, billing_period_id: activePeriod.id } }),
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true } }),
      prisma.payroll_claims.findMany({
        where: { applicant_id: { in: applicantIds }, academic_period_id: activePeriod.id },
        select: { applicant_id: true },
      }),
    ]);
    const schoolHistoryByApplicant = await loadSchoolHistory(prisma, applicantIds);
    const processedIds = new Set(existingClaims.map(({ applicant_id }) => applicant_id));
    const scholarByApplicant = new Map(scholarAccounts.map((scholar) => [scholar.applicant_id, scholar]));
    const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));
    const applicationByApplicant = new Map();
    applications.forEach((application) => {
      if (!applicationByApplicant.has(application.applicant_id)) applicationByApplicant.set(application.applicant_id, application);
    });
    const requirementByApplicant = new Map(requirements.map((requirement) => [requirement.applicant_id, requirement]));
    const schoolById = new Map(schools.map((school) => [school.id, school]));
    const schoolByName = new Map(schools.map((school) => [normalizeSchoolName(school.name), school]));
    const eligibility = applicantIds.map((applicantId) => {
      const application = applicationByApplicant.get(applicantId);
      const requirement = requirementByApplicant.get(applicantId);
      const school = resolveScholarSchool({ applicant: applicantById.get(applicantId), requirement, application, schoolById, schoolByName, schoolHistory: schoolHistoryByApplicant.get(applicantId) });
      const access = evaluateContinuingSchedule({ schedule: continuingSchedule, period: activePeriod, docs: application?.initial_docs, applicantId, schoolType: school?.school_type, legacyPeriodId: primaryPeriod.id, entryYearLevel: application?.school_plan?.incomingYearLevel });
      const readiness = evaluateListEligibility({
        isActive: Boolean(scholarByApplicant.get(applicantId)?.is_active),
        alreadyBilled: false,
        alreadyProcessedForPeriod: processedIds.has(applicantId),
        initialDocs: getEffectiveRequirements(projectContinuingAccess(application?.initial_docs, activePeriod.id, access), activePeriod.id, primaryPeriod.id),
        requirement: application?.initial_docs?.requirementSets || access.visible && continuingSchedule ? undefined : requirement,
        schoolType: school?.school_type,
        requireSchoolClassification: true,
      });
      const reasons = [...readiness.reasons];
      const grantBlocker = preparationBlocker(school?.school_type, requirement, processedIds.has(applicantId));
      if (grantBlocker) reasons.push(grantBlocker);
      if (school && resolveProcessingRoute({ schoolType: school.school_type, requirement, docs: application?.initial_docs, period: activePeriod, schedule: continuingSchedule, applicantId, legacyPeriodId: primaryPeriod.id }) !== 'payroll') {
        reasons.push({ code: 'PRIVATE_SCHOOL_BILLING_ROUTE', message: 'Private continuing records go to Billing until staff explicitly sends this period to Payroll.' });
      }
      if (!applicantById.has(applicantId)) {
        reasons.push({ code: 'APPLICANT_UNAVAILABLE', message: 'The scholar applicant record is unavailable.' });
      }
      return { applicantId, schoolType: school?.school_type, eligible: reasons.length === 0, reasons, warnings: readiness.warnings };
    });
    const ineligible = eligibility.filter(({ eligible }) => !eligible);
    if (ineligible.length) {
      return res.status(409).json({
        message: 'Some selected scholars are not ready for the payroll list. Correct the account, school routing, or existing list membership before retrying.',
        ineligible: ineligible.map(({ applicantId, reasons }) => ({ applicantId, reasons })),
      });
    }

    const warningsByApplicant = new Map(eligibility.map(({ applicantId, warnings }) => [applicantId, warnings]));
    const incompleteRequirementsCount = eligibility.filter(({ warnings }) => warnings.length > 0).length;

    const timestamp = new Date();
    const amountByApplicant = new Map(applicantIds.map((applicantId) => [applicantId, resolveBillingAmount(resolveScholarSchool({ applicant: applicantById.get(applicantId), requirement: requirementByApplicant.get(applicantId), application: applicationByApplicant.get(applicantId), schoolById, schoolByName, schoolHistory: schoolHistoryByApplicant.get(applicantId) })?.school_type)]));
    const totalAmount = applicantIds.reduce((total, applicantId) => total + amountByApplicant.get(applicantId), 0);
    const batch = await prisma.$transaction(async (transaction) => {
      const grantSnapshots = await snapshotPrivateGrants(transaction, activePeriod.id, eligibility.filter((item) => String(item.schoolType).toLowerCase() === 'private').map((item) => item.applicantId));
      await assertProcessingRoutes(transaction, activePeriod, eligibility, applicationByApplicant, primaryPeriod.id, 'payroll');
      const createdBatch = await createReferencedListBatch(transaction, 'payroll', {
        billing_period_id: activePeriod.id,
        total_scholars: applicantIds.length,
        total_amount: totalAmount,
        status: 'generated',
        prepared_by: req.user.id,
        prepared_at: timestamp,
        remarks: `${activePeriod.school_year} · ${activePeriod.semester} official payroll list for scholars`,
        updated_at: timestamp,
      });
      await transaction.payroll_claims.createMany({
        data: applicantIds.map((applicantId) => ({
          payroll_batch_id: createdBatch.id,
          academic_period_id: activePeriod.id,
          applicant_id: applicantId,
          claim_amount: amountByApplicant.get(applicantId),
          ...grantSnapshots.get(applicantId),
          claim_status: 'listed',
          notes: warningsByApplicant.get(applicantId)?.length
            ? 'Included in the official scholar payroll list. Requirements incomplete at list generation: ' + warningsByApplicant.get(applicantId).map(({ message }) => message).join(' ')
            : 'Included in the official scholar payroll list',
          updated_at: timestamp,
        })),
      });
      return { ...createdBatch, grantBreakdowns: [...grantSnapshots].map(([applicantId, value]) => ({ applicantId, totalGrant: 5000, tuitionFeeAssistance: value.tuition_fee_assistance, allowance: value.allowance })) };
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 120000 });

    res.locals.auditTargetId = batch.id;
    res.locals.auditDescription = `Generated an official payroll list for ${applicantIds.length} scholars; ${incompleteRequirementsCount} with incomplete requirements.`;
    return res.status(201).json({
      message: `Official payroll list generated for ${applicantIds.length} scholar${applicantIds.length === 1 ? '' : 's'}.`,
      incompleteRequirementsCount,
      grantBreakdowns: batch.grantBreakdowns,
      batch: { id: batch.id, batchNumber: batch.batch_number, totalScholars: batch.total_scholars },
      activePeriod: serializeAcademicPeriod(activePeriod),
    });
  } catch (error) {
    if (error?.code === 'P2034') return res.status(409).json({ message: 'The preparation or list changed concurrently. Refresh and retry.' });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    if (error?.code === 'P2002') {
      return res.status(409).json({ message: 'The payroll selection was already included or changed. Refresh the list and try again.' });
    }
    return res.status(500).json({ message: 'Server error generating the payroll list.' });
  }
};
const getOnlineExamQuestions = async (req, res) => {
  try {
    const applicantId = req.user.id;
    const [activePeriod, examinationSettings, applicant, application] = await Promise.all([
      getActiveAcademicPeriodRecord(),
      getExaminationSettings(prisma),
      prisma.applicants.findUnique({ where: { id: applicantId }, select: { municipality: true, school_year: true, deleted_at: true } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
    ]);
    if (!isCurrentExaminationApplicant(applicant, activePeriod.school_year, STALE_DEFAULT_SCHOOL_YEAR) || !isExaminationApplicationEligible(application)) {
      return res.status(403).json({ message: 'Your application is not available for examination. Contact CAO.' });
    }
    const exam = await prisma.exams.findFirst({
      where: {
        is_active: true,
        academic_year: activePeriod.school_year,
        municipality: { equals: String(applicant?.municipality || '').trim(), mode: 'insensitive' },
      },
      orderBy: { updated_at: 'desc' },
    });
    const examSlot = exam ? await prisma.exam_slots.findUnique({
      where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: exam.id } },
    }) : null;
    const completed = exam ? Boolean(await prisma.results.findFirst({
      where: { applicant_id: applicantId, exam_id: exam.id }, select: { id: true },
    })) : false;
    if (completed) return res.status(409).json({ message: 'This examination has already been submitted.' });
    if (examSlot?.online_started_at) assertAttemptOpen(examSlot);
    if (!canAccessOnlineExamination({ completed, settings: examinationSettings, exam, examSlot })) {
      return res.status(403).json({ message: 'The secured question view is unavailable until Online Examination is active and CAO marks your attendance as Present.' });
    }
    res.set('Cache-Control', 'no-store, private');
    const { slot: attempt, configuration } = await getOrStartAttempt(prisma, examSlot);
    return res.json({
      examination: { id: exam.id, title: exam.title, academicYear: exam.academic_year },
      ...publicConfiguration(configuration),
      attempt: { id: attempt.id, applicantId, configurationId: configuration.id, startedAt: attempt.online_started_at, deadlineAt: attempt.online_deadline_at, serverTime: new Date(), durationSeconds: 45 * 60 },
      examTicket: createExamTicket({ applicantId, examId: exam.id, configurationId: configuration.id, deadlineAt: attempt.online_deadline_at }),
    });
  } catch (error) {
    if (error instanceof AttemptError) return res.status(error.status).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: 'Server error loading examination questions.' });
  }
};

const submitOnlineExam = async (req, res) => {
  const receivedAt = Date.now();
  try {
    const applicantId = req.user.id;
    const [activePeriod, examinationSettings] = await Promise.all([
      getActiveAcademicPeriodRecord(),
      getExaminationSettings(prisma),
    ]);
    if (!examinationSettings.isEnabled || examinationSettings.deliveryMode !== 'online') {
      return res.status(403).json({ message: 'The online examination is not currently available.' });
    }
    const applicant = await prisma.applicants.findUnique({
      where: { id: applicantId },
      select: { email: true, first_name: true, municipality: true, school_year: true, deleted_at: true },
    });
    if (!isCurrentExaminationApplicant(applicant, activePeriod.school_year, STALE_DEFAULT_SCHOOL_YEAR)) return res.status(403).json({ message: 'Your application is not available for this academic year.' });
    const exam = await prisma.exams.findFirst({
      where: {
        is_active: true,
        academic_year: activePeriod.school_year,
        municipality: { equals: String(applicant?.municipality || '').trim(), mode: 'insensitive' },
      },
      orderBy: { updated_at: 'desc' },
    });
    if (!exam || !isExaminationScheduleOpen(exam)) {
      return res.status(409).json({ message: 'The examination is outside the active testing window for your municipality.' });
    }
    const slot = await prisma.exam_slots.findUnique({
      where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: exam.id } },
    });
    if (!slot?.appeared) {
      return res.status(403).json({ message: 'Your online examination is locked until CAO marks your attendance as Present.' });
    }
    const existing = await prisma.results.findFirst({ where: { applicant_id: applicantId, exam_id: exam.id } });
    if (existing) return res.status(409).json({ message: 'This examination has already been submitted. Please wait for the Scholarship Office to release the result.' });
    assertAttemptOpen(slot, receivedAt);
    let configurationId;
    try {
      configurationId = verifyExamTicket(req.body?.examTicket, { applicantId, examId: exam.id }, process.env.JWT_SECRET, receivedAt);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    if (configurationId !== slot.online_configuration_id) return res.status(409).json({ message: 'Your question version does not match this timed attempt. Reopen the examination.' });
    const configuration = await loadConfiguration(prisma, configurationId);
    try { assertAutomaticGrading(configuration); }
    catch { return res.status(409).json({ message: 'This question version uses unsupported grading and cannot be submitted. Contact CAO before reopening the examination; your answers have not been recorded.' }); }
    let score;
    try { score = scoreConfiguredAnswers(req.body?.answers, configuration); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    const passingScore = configuration.passingScore;
    const data = { score, passing_score: passingScore, passed: score >= passingScore, online_configuration_id: configurationId, delivery_mode: 'online', updated_at: new Date() };
    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } });
      if (!isExaminationApplicationEligible(application)) throw new AttemptError('Your application is no longer available for examination submission. Contact CAO.');
      const recorded = await tx.results.create({ data: { exam_slot_id: slot.id, applicant_id: applicantId, exam_id: exam.id, ...data } });
      const updated = await tx.application_submissions.updateMany({
        where: { id: application.id, applicant_id: applicantId, status: application.status },
        data: { status: APPLICATION_STATUSES.EXAMINED },
      });
      if (updated.count !== 1) {
        throw new AttemptError('Your application is no longer available for examination submission. Contact CAO.');
      }
      return recorded;
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
      receipt: { recorded: true, submittedAt: result.created_at },
      notification: { examReceiptEmailSent: emailDelivery.sent },
    });
  } catch (error) {
    if (error instanceof AttemptError) return res.status(error.status).json({ message: error.message });
    if (error?.code === 'P2002') return res.status(409).json({ message: 'This examination has already been submitted.' });
    console.error(error); return res.status(500).json({ message: 'Server error submitting examination.' });
  }
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
      where: {
        billing_period_id: activePeriod.id,
        NOT: [
          { status: 'billed' },
          { batch_number: { startsWith: 'BILL-' } },
        ],
      },
      select: { id: true },
    });
    const [scholar, scholarRequirement, payrollClaim, scheduledExam, eligibilityAssessment, examSlots, examinationSettings] = applicantId ? await Promise.all([
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
      prisma.exam_slots.findMany({ where: { applicant_id: applicantId }, orderBy: { updated_at: 'desc' } }),
      getExaminationSettings(prisma),
    ]) : [null, null, null, null, null, null, await getExaminationSettings(prisma)];
    const result = scholar?.result_id
      ? await prisma.results.findFirst({ where: { id: scholar.result_id, applicant_id: applicantId } })
      : !scholar && scheduledExam ? await prisma.results.findFirst({ where: { applicant_id: applicantId, exam_id: scheduledExam.id } }) : null;
    const exam = result
      ? await prisma.exams.findUnique({ where: { id: result.exam_id }, select: { title: true, exam_date: true, academic_year: true } })
      : null;
    const examSlot = examSlots?.find((slot) => slot.exam_id === (result?.exam_id || scheduledExam?.id)) || null;
    const [schoolCatalog, schoolHistory] = await Promise.all([
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true } }),
      loadSchoolHistory(prisma, applicantId ? [applicantId] : []),
    ]);
    const selectedSchool = resolveScholarSchool({
      applicant, requirement: scholarRequirement, application,
      schoolById: new Map(schoolCatalog.map((school) => [school.id, school])),
      schoolByName: new Map(schoolCatalog.map((school) => [normalizeSchoolName(school.name), school])),
      schoolHistory: schoolHistory.get(applicantId),
    });
    const requirementPeriod = req.query?.requirementPeriodId
      ? await getSelectedActiveAcademicPeriodRecord(req.query.requirementPeriodId) : activePeriod;
    if (!requirementPeriod) return res.status(400).json({ message: 'Select an active continuing-requirements period.' });
    const requirementPeriodRecord = requirementPeriod.id === activePeriod.id ? scholarRequirement
      : await prisma.scholar_requirements.findFirst({ where: { applicant_id: applicantId, billing_period_id: requirementPeriod.id } });
    const requirementSchool = resolveScholarSchool({ applicant, requirement: requirementPeriodRecord, application,
      schoolById: new Map(schoolCatalog.map((school) => [school.id, school])), schoolByName: new Map(schoolCatalog.map((school) => [normalizeSchoolName(school.name), school])), schoolHistory: schoolHistory.get(applicantId) });
    const continuingAccess = evaluateContinuingSchedule({ schedule: await loadContinuingSchedule(prisma, requirementPeriod.id), period: requirementPeriod, docs: application.initial_docs, applicantId, schoolType: requirementSchool?.school_type, legacyPeriodId: activePeriod.id, entryYearLevel: application?.school_plan?.incomingYearLevel });
    const requirementDocs = projectContinuingAccess(application.initial_docs, requirementPeriod.id, continuingAccess);
    const payrollBatch = payrollClaim
      ? await prisma.payroll_batches.findUnique({ where: { id: payrollClaim.payroll_batch_id } })
      : null;
    const certificationDate = await latestCertificationCreatedAt(prisma, applicantId, selectedSchool?.school_type);
    const postedPasser = result?.passed && result?.published_at ? await getPostedPasser(prisma, applicantId, activePeriod.id, result, application.id) : null;
    const initialVerification = !scholar && postedPasser ? { listId: postedPasser.list_id, verified: initialApproved(application.initial_docs, activePeriod.id, selectedSchool?.school_type, activePeriod.id, application.school_plan?.incomingYearLevel), documents: initialChecklist(application.initial_docs, activePeriod.id, selectedSchool?.school_type, activePeriod.id, application.id, application.school_plan?.incomingYearLevel) } : null;
    const guidance = buildApplicantGuidance({
      application: scholar ? { ...application, initial_docs: getEffectiveRequirements(requirementDocs, requirementPeriod.id, activePeriod.id) } : application,
      continuingOpen: continuingAccess.visible,
      result,
      scholar,
      scholarRequirement: application.initial_docs?.requirementSets || continuingAccess.visible && continuingAccess.scheduled ? undefined : requirementPeriodRecord,
      payrollClaim,
      payrollBatch,
      scheduledExam,
      examinationSettings,
      examSlot,
      schoolType: schoolClassification(requirementSchool?.school_type),
      requirementSubmission: continuingAccess,
      initialVerification,
    });
    return res.json({
      initialVerification,
      application,
      requirementWave: {
        entryYearLevel: application.school_plan?.incomingYearLevel || null, academicPeriodId: requirementPeriod.id, periodLabel: `${requirementPeriod.school_year} · ${requirementPeriod.semester}`, schoolType: schoolClassification(requirementSchool?.school_type), continuingOpen: continuingAccess.visible, submission: continuingAccess,
        initial: getInitialRequirements(application.initial_docs, requirementPeriod.id, activePeriod.id).requirements,
        continuing: getWaveSet(application.initial_docs, requirementPeriod.id, 'continuing', activePeriod.id).requirements,
      },
      continuingPeriods: scholar ? (await prisma.academic_periods.findMany({ where: { is_active: true }, orderBy: [{ school_year: 'desc' }, { id: 'desc' }] })).map(serializeAcademicPeriod) : [],
      applicant,
      school: selectedSchool ? {
        name: selectedSchool.name,
        schoolType: schoolClassification(selectedSchool.school_type),
      } : null,
      guidance,
      certificationCreatedAt: certificationDate,
      eligibilityAssessment: scholar ? serializeAssessment(eligibilityAssessment) : null,
      scholar: scholar ? {
        id: scholar.id,
        scholarId: scholar.scholar_id,
        issuedAt: scholar.issued_at,
        isActive: scholar.is_active,
        notes: scholar.notes,
      } : null,
      processingRoute: payrollBatch ? (String(payrollBatch.batch_number || '').startsWith('BILL-') || payrollBatch.status === 'billed' ? 'billing' : 'payroll') : resolveProcessingRoute({ schoolType: selectedSchool?.school_type, requirement: scholarRequirement, docs: application.initial_docs, period: activePeriod, schedule: await loadContinuingSchedule(prisma, activePeriod.id), applicantId, legacyPeriodId: activePeriod.id }),
      payrollList: serializePayrollListMembership(payrollClaim, payrollBatch),
      examination: {
        ...resolveExaminationProgress({ result, scholar, examSlot, fallbackStatus: application.status, applicantFacing: true, scheduledExam }),
        deliveryMode: result?.delivery_mode || examinationSettings.deliveryMode,
        publishedAt: result?.published_at || null,
        score: result?.published_at ? Number(result.score) : null,
        passingScore: result?.published_at ? Number(result.passing_score ?? 14) : null,
        submittedAt: result?.created_at || null,
        examTitle: exam?.title || 'PGCEAP Qualifying Examination',
        examDate: exam?.exam_date || null,
        academicYear: exam?.academic_year || activePeriod.school_year,
        isScholar: Boolean(scholar),
        access: {
          allowed: canAccessOnlineExamination({
            completed: Boolean(result),
            applicationEligible: isExaminationApplicationEligible(application) && isCurrentExaminationApplicant(applicant, activePeriod.school_year, STALE_DEFAULT_SCHOOL_YEAR),
            settings: examinationSettings,
            exam: scheduledExam,
            examSlot,
          }),
          isEnabled: examinationSettings.isEnabled,
          deliveryMode: examinationSettings.deliveryMode,
        },
        attendance: {
          status: examSlot?.appeared ? 'Present' : examSlot?.forfeited_at ? 'Absent' : 'Pending',
          appearedAt: examSlot?.appeared_at || null,
          forfeitedAt: examSlot?.forfeited_at || null,
        },
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

const parseRequirementUpload = (fileName, fileData) => {
  if (typeof fileName !== 'string' || !fileName.trim() || fileName.length > 255 || typeof fileData !== 'string') {
    throw Object.assign(new Error('A valid file name and file are required.'), { statusCode: 400 });
  }
  if (fileData.length > 8 * 1024 * 1024 + 512) throw Object.assign(new Error('Use a file no larger than 6 MB.'), { statusCode: 413 });
  let parsed;
  try { parsed = parseDataUrl(fileData); } catch (error) { throw Object.assign(error, { statusCode: 400 }); }
  if (!PRIORITY_PROOF_FILE_TYPES.has(parsed.contentType)) throw Object.assign(new Error('Only PDF, JPG, and PNG requirement files are allowed.'), { statusCode: 400 });
  if (parsed.buffer.length > 6 * 1024 * 1024) throw Object.assign(new Error('Use a file no larger than 6 MB.'), { statusCode: 413 });
  return parsed;
};
const storeRequirementUpload = async ({ applicantId, periodId, wave, key, fileName, fileData, parsed }) => {
  const token = process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN;
  if (token || process.env.NODE_ENV === 'production') {
    const blob = await uploadDataUrl({ dataUrl: fileData, fileName: fileName.trim(), contentType: parsed.contentType,
      pathSegments: ['scholar-requirements', applicantId, periodId, wave, key], token, access: 'private' });
    return { fileName: fileName.trim(), fileType: blob.contentType, fileUrl: blob.url, pathname: blob.pathname, storage: 'vercel-blob-private' };
  }
  return { fileName: fileName.trim(), fileType: parsed.contentType, fileData, storage: 'database' };
};

const uploadMyRequirement = async (req, res) => {
  let uploadedFile;
  try {
    const { requirement: key, fileName, fileData } = req.body || {};
    if (!CONTINUING_KEYS.includes(key)) return res.status(400).json({ message: 'Scholars upload only continuing grades, registration forms, and applicable tuition receipts.' });
    if (!Number.isInteger(Number(req.body.academicPeriodId)) || Number(req.body.academicPeriodId) <= 0) return res.status(400).json({ message: 'Refresh and select an active academic period for this submission.' });
    const parsed = parseRequirementUpload(fileName, fileData);
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period.' });
    const [scholar, application, applicant, requirementRecord] = await Promise.all([
      prisma.scholar_accounts.findFirst({ where: { applicant_id: req.user.id, is_active: true } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: req.user.id, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
      prisma.applicants.findUnique({ where: { id: req.user.id } }),
      prisma.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: req.user.id, billing_period_id: activePeriod.id } } }),
    ]);
    if (!scholar || !application) return res.status(404).json({ message: 'Active scholar application not found.' });
    const school = await loadResolvedScholarSchool(prisma, { applicantId: req.user.id, applicant, requirement: requirementRecord, application });
    const requirementSubmission = evaluateContinuingSchedule({ schedule: await loadContinuingSchedule(prisma, activePeriod.id), period: activePeriod, docs: application.initial_docs, applicantId: req.user.id, schoolType: school?.school_type, legacyPeriodId: primaryPeriod.id, entryYearLevel: application?.school_plan?.incomingYearLevel });
    if (!requirementSubmission.isOpen) return res.status(403).json({ message: 'Continuing uploads are unavailable. Initial documents must be approved and continuing uploads must be open for this academic period.', requirementSubmission });
    if (key === 'tuition_receipt') {
      if (schoolClassification(school?.school_type) !== 'Private') return res.status(400).json({ message: 'Only Private-school scholars can upload an Official Receipt of Tuition Fee.' });
    }
    uploadedFile = await storeRequirementUpload({ applicantId: req.user.id, periodId: activePeriod.id, wave: 'continuing', key, fileName, fileData, parsed });
    const saved = await mutateRequirementWaves(prisma, application.id, primaryPeriod.id, async (docs, tx, latestApplication) => {
      const latestPeriod = await tx.academic_periods.findFirst({ where: { id: activePeriod.id } });
      const access = evaluateContinuingSchedule({ schedule: await loadContinuingSchedule(tx, activePeriod.id), period: latestPeriod || activePeriod, docs, applicantId: req.user.id, schoolType: school?.school_type, legacyPeriodId: primaryPeriod.id, entryYearLevel: latestApplication?.school_plan?.incomingYearLevel });
      if (latestPeriod?.is_active === false || !access.isOpen) throw Object.assign(new Error('The upload window closed or initial approval changed. Refresh before submitting.'), { statusCode: 403 });
      if (access.scheduled) docs.requirementWaves[activePeriod.id] = { ...docs.requirementWaves[activePeriod.id], continuingOpenedAt: docs.requirementWaves[activePeriod.id]?.continuingOpenedAt || new Date().toISOString(), openingSource: 'period_access' };
      return { document: saveWaveDocument(docs, { periodId: activePeriod.id, wave: 'continuing', key, file: uploadedFile, actorId: req.user.id, actorRole: 'Scholar' }) };
    });
    uploadedFile = null;
    res.locals.auditTargetId = application.id;
    return res.json({ message: 'Continuing requirement submitted for Billing staff review. Initial files are preserved.', application: saved.application,
      continuingRequirements: getWaveSet(saved.application.initial_docs, activePeriod.id, 'continuing', primaryPeriod.id).requirements });
  } catch (error) {
    if (uploadedFile?.fileUrl) await deleteBlob(uploadedFile.fileUrl, process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: 'Server error uploading continuing requirement.' });
  }
};

const uploadScholarRequirementByAdmin = async (req, res) => {
  let uploadedFile;
  try {
    const applicantId = Number(req.params.applicantId);
    const key = String(req.params.requirementKey || '');
    if (!Number.isInteger(applicantId) || applicantId <= 0 || !INITIAL_KEYS.includes(key)) return res.status(400).json({ message: 'A valid scholar and initial requirement are required.' });
    const { fileName, fileData } = req.body || {};
    if (!Number.isInteger(Number(req.body.academicPeriodId)) || Number(req.body.academicPeriodId) <= 0) return res.status(400).json({ message: 'Refresh and select an active academic period for this submission.' });
    const parsed = parseRequirementUpload(fileName, fileData);
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const activePeriod = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!activePeriod) return res.status(400).json({ message: 'Select an active academic period.' });
    const [scholar, application, requirementRecord, applicant] = await Promise.all([
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
      prisma.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: activePeriod.id } } }),
      prisma.applicants.findUnique({ where: { id: applicantId } }),
    ]);
    if (!application || (!scholar && !await canRecordInitial(prisma, applicantId, activePeriod.id, application))) return res.status(409).json({ message: 'Post the current passing result in a locked Passer List before initial intake.' });
    if (key === 'report_card' && !isFirstYearEntry(application.school_plan?.incomingYearLevel)) return res.status(400).json({ message: 'A Grade 12 report card is an initial COG alternative only for incoming or first-year college applicants.' });
    if (key === 'tuition_receipt') {
      const school = await loadResolvedScholarSchool(prisma, { applicantId, applicant, requirement: requirementRecord, application });
      if (schoolClassification(school?.school_type) !== 'Private') return res.status(400).json({ message: 'A tuition receipt applies only to private-school scholars.' });
    }
    uploadedFile = await storeRequirementUpload({ applicantId, periodId: activePeriod.id, wave: 'initial', key, fileName, fileData, parsed });
    const saved = await mutateRequirementWaves(prisma, application.id, primaryPeriod.id, async (docs, tx, latestApplication) => {
      if (!scholar && !await canRecordInitial(tx, applicantId, activePeriod.id, latestApplication)) throw Object.assign(new Error('The posted passer or result changed. Reload before uploading.'), { statusCode: 409 });
      if (key === 'report_card' && !isFirstYearEntry(latestApplication.school_plan?.incomingYearLevel)) throw Object.assign(new Error('The initial entry year changed. Refresh before uploading a report card.'), { statusCode: 409 });
      return { document: saveWaveDocument(docs, { periodId: activePeriod.id, wave: 'initial', key, file: uploadedFile, actorId: req.user.id, actorRole: req.user.role }) };
    });
    uploadedFile = null;
    res.locals.auditTargetId = application.id;
    res.locals.auditDescription = `Uploaded initial requirement ${key} for academic period ${activePeriod.id}.`;
    return res.json({ message: 'Initial requirement uploaded and approved. Other waves and previous files are preserved.', document: {
      requirementKey: key, academicPeriodId: activePeriod.id, submissionWave: 'initial', fileName: saved.document.fileName,
      fileType: saved.document.fileType, status: saved.document.status, uploadedAt: saved.document.uploadedAt,
    } });
  } catch (error) {
    if (uploadedFile?.fileUrl) await deleteBlob(uploadedFile.fileUrl, process.env.DOCUMENT_BLOB_READ_WRITE_TOKEN);
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    console.error(error);
    return res.status(500).json({ message: 'Server error uploading the initial requirement.' });
  }
};

const openContinuingRequirements = async (req, res) => {
  try {
    const applicantId = Number(req.params.applicantId);
    if (!Number.isInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid scholar is required.' });
    if (!Number.isInteger(Number(req.body.academicPeriodId)) || Number(req.body.academicPeriodId) <= 0) return res.status(400).json({ message: 'Select an active academic period.' });
    const primaryPeriod = await getActiveAcademicPeriodRecord();
    const period = await getSelectedActiveAcademicPeriodRecord(req.body.academicPeriodId);
    if (!period) return res.status(400).json({ message: 'Select an active academic period.' });
    const [scholar, application] = await Promise.all([
      prisma.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
      prisma.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
    ]);
    if (!scholar || !application) return res.status(404).json({ message: 'Active scholar application not found.' });
    await mutateRequirementWaves(prisma, application.id, primaryPeriod.id, (docs) => {
      docs.requirementWaves[period.id] ||= { continuingOpenedAt: new Date().toISOString(), openedBy: req.user.id };
      return {};
    });
    res.locals.auditTargetId = application.id;
    res.locals.auditDescription = `Opened continuing requirements for academic period ${period.id}.`;
    return res.json({ message: 'Continuing submission is open for this scholar and period. Initial documents remain unchanged.' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to open continuing submissions.' });
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
      metricAccess: { activeScholars: hasSectionAccess(req.user, 'scholars'), forfeitedAccounts: hasSectionAccess(req.user, 'examination') },
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
    if (!name || name.length > 255) return res.status(400).json({ message: 'A school name of at most 255 characters is required.' });
    if (!['public', 'private'].includes(classification)) {
      return res.status(400).json({ message: 'School classification must be Public or Private.' });
    }

    const catalog = await prisma.schools.findMany({ select: { id: true, name: true } });
    const existing = catalog.find((school) => normalizeSchoolName(school.name) === normalizeSchoolName(name));
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
    const applicants = await prisma.applicants.findMany({ where: { deleted_at: null }, orderBy: { created_at: 'desc' }, select: { id: true, first_name: true, middle_name: true, last_name: true, name_ext: true, email: true, phone: true, street: true, municipality: true, barangay: true, school_year: true, status: true, gender: true, date_of_birth: true, birthplace: true, civil_status: true, family_income: true, gwa: true, siblings_boys: true, siblings_girls: true, created_at: true } });
    const applicantIds = applicants.map(({ id }) => id);
    const [accounts, slots, results, exams, scholarAccounts, applications] = await Promise.all([
      prisma.control_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, control_number: true, username: true, last_login_at: true } }),
      prisma.exam_slots.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, exam_id: true, appeared: true, appeared_at: true, forfeited_at: true, online_started_at: true, online_deadline_at: true } }),
      prisma.results.findMany({ where: { applicant_id: { in: applicantIds } }, orderBy: { created_at: 'desc' }, select: { id: true, applicant_id: true, exam_id: true, score: true, passing_score: true, passed: true, remarks: true, delivery_mode: true, published_at: true, published_by: true, recorded_by: true, created_at: true, updated_at: true } }),
      prisma.exams.findMany({
        orderBy: { updated_at: 'desc' },
        select: { id: true, title: true, exam_date: true, exam_end_date: true, venue: true, municipality: true, academic_year: true, is_active: true, updated_at: true },
      }),
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: applicantIds } }, select: { applicant_id: true, scholar_id: true, result_id: true, is_active: true } }),
      prisma.application_submissions.findMany({ where: { applicant_id: { in: applicantIds } }, orderBy: { submitted_at: 'desc' }, select: { id: true, applicant_id: true, status: true, identity: true, address: true, school_plan: true, family: true, eligibility: true, submitted_at: true } }),
    ]);
    const accountByApplicant = new Map(accounts.map((account) => [account.applicant_id, account]));
    const slotByAssignment = new Map(slots.map((slot) => [`${slot.applicant_id}:${slot.exam_id}`, slot]));
    const resultByAssignment = new Map(results.map((result) => [`${result.applicant_id}:${result.exam_id}`, result]));
    const resultById = new Map(results.map((result) => [result.id, result]));
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
    const metricPersonById = new Map(applicants.map(applicant => [applicant.id, {
      name: [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' ').toUpperCase(),
      controlNo: accountByApplicant.get(applicant.id)?.control_number || 'Not assigned', municipality: applicant.municipality || 'Not specified',
    }]));
    const scheduledIds = getScheduledApplicantIds({ applicants, exams, slots, academicYear: activePeriod.school_year, legacySchoolYear: STALE_DEFAULT_SCHOOL_YEAR });
    const resultMetricRecords = results.map(result => ({ id: `result-${result.id}`, ...metricPersonById.get(result.applicant_id), status: result.passed ? 'Passed' : 'Failed', examination: examById.get(result.exam_id)?.title || `Examination #${result.exam_id}` }));

    return res.json({
      stats: { total: applicants.length, scheduled: scheduledApplicantCount, completed: results.length, passed: results.filter(({ passed }) => passed).length },
      metricRecords: {
        scheduled: scheduledIds.map(id => ({ id, ...metricPersonById.get(id), status: 'Scheduled' })),
        completed: resultMetricRecords,
        passed: resultMetricRecords.filter(row => row.status === 'Passed'),
      },
      applicants: applicants.map((applicant) => {
        const account = accountByApplicant.get(applicant.id);
        const scholar = scholarByApplicant.get(applicant.id);
        const scheduledExam = scheduledExamByMunicipality.get(normalizeMunicipality(applicant.municipality));
        const result = scholar?.is_active ? resultById.get(scholar.result_id) : resultByAssignment.get(`${applicant.id}:${scheduledExam?.id}`);
        const resultExam = examById.get(result?.exam_id);
        const exam = resultExam || scheduledExam;
        const slot = exam ? slotByAssignment.get(`${applicant.id}:${exam.id}`) : null;
        const application = applicationByApplicant.get(applicant.id);
        const identity = application?.identity || {};
        const address = application?.address || {};
        const schoolPlan = application?.school_plan || {};
        const family = application?.family || {};
        const eligibilityRecommendation = evaluateEligibility({
          application,
          result,
        });
        return {
          id: applicant.id,
          name: [applicant.last_name, [applicant.first_name, applicant.middle_name, applicant.name_ext].filter(Boolean).join(' ')].filter(Boolean).join(', '),
          initials: `${applicant.first_name[0] || ''}${applicant.last_name[0] || ''}`.toUpperCase(),
          username: account?.username || `${applicant.first_name}.${applicant.last_name}`.toLowerCase(),
          controlNo: account?.control_number || `Applicant #${applicant.id}`,
          email: applicant.email,
          phone: identity.mobile || applicant.phone || null,
          birthDate: identity.birthday || applicant.date_of_birth || null,
          birthplace: identity.birthplace || applicant.birthplace || null,
          gender: identity.sex || applicant.gender || null,
          civilStatus: identity.civilStatus || applicant.civil_status || null,
          street: address.houseNumber || applicant.street || null,
          municipality: applicant.municipality || 'Not specified',
          barangay: applicant.barangay || 'Not specified',
          school: schoolPlan.school || null,
          course: schoolPlan.course || null,
          yearLevel: schoolPlan.incomingYearLevel || null,
          gwa: family.gwa || (applicant.gwa === null || applicant.gwa === undefined ? null : Number(applicant.gwa)),
          familyIncome: family.familyIncome || applicant.family_income || null,
          fatherName: family.fatherName || null,
          fatherOccupation: family.fatherOccupation || null,
          motherName: family.motherName || null,
          motherOccupation: family.motherOccupation || null,
          guardianName: family.guardianName || null,
          guardianRelationship: family.guardianRelationship || (family.guardianSameAsParent
            ? family.guardianParentRole === 'father' ? 'Father' : family.guardianParentRole === 'mother' ? 'Mother' : 'Parent'
            : 'Guardian'),
          brothersCount: family.brothersCount ?? applicant.siblings_boys ?? 0,
          sistersCount: family.sistersCount ?? applicant.siblings_girls ?? 0,
          eligibility: application?.eligibility || {},
          schoolYear: !applicant.school_year || applicant.school_year === STALE_DEFAULT_SCHOOL_YEAR
            ? activePeriod.school_year
            : applicant.school_year,
          registered: applicant.created_at,
          lastLogin: account?.last_login_at || null,
          ...resolveExaminationProgress({ result, scholar, examSlot: slot, fallbackStatus: applicant.status, applicationStatus: application?.status }),
          appearedAt: slot?.appeared_at || null,
          applicationId: application?.id || null,
          academicPeriodId: activePeriod.id,
          resultId: result?.id || null,
          resultUpdatedAt: result?.updated_at || null,
          resultPublishedAt: result?.published_at || null,
          resultDeliveryMode: result?.delivery_mode || null,
          examId: exam?.id || null,
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

const updateExaminationAttendance = async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const applicantId = Number(req.params.applicantId);
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!Number.isInteger(examId) || examId <= 0 || !Number.isInteger(applicantId) || applicantId <= 0) {
      return res.status(400).json({ message: 'A valid examination and applicant are required.' });
    }
    if (!['pending', 'present'].includes(status)) {
      return res.status(400).json({ message: 'Attendance status must be Pending or Present.' });
    }

    const activePeriod = await getActiveAcademicPeriodRecord();
    const [exam, slot, result] = await Promise.all([
      prisma.exams.findFirst({ where: { id: examId, academic_year: activePeriod.school_year }, select: { id: true } }),
      prisma.exam_slots.findUnique({ where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: examId } } }),
      prisma.results.findFirst({ where: { applicant_id: applicantId, exam_id: examId }, select: { id: true } }),
    ]);
    if (!exam) return res.status(404).json({ message: 'The active-period examination was not found.' });
    if (!slot) return res.status(404).json({ message: 'The applicant is not assigned to this examination.' });
    if (result && status !== 'present') {
      return res.status(409).json({ message: 'Attendance cannot be changed after the examination has been submitted.' });
    }

    const recordedAt = new Date();
    const updated = await prisma.exam_slots.update({
      where: { id: slot.id },
      data: status === 'present'
        ? { appeared: true, appeared_at: slot.appeared_at || recordedAt, forfeited_at: null }
        : { appeared: false, appeared_at: null, forfeited_at: null },
    });
    res.locals.auditTargetId = updated.id;
    res.locals.auditDescription = `Updated examination attendance to ${status}.`;
    return res.json({
      message: `Attendance marked ${status}.`,
      attendance: {
        status: updated.appeared ? 'Present' : updated.forfeited_at ? 'Absent' : 'Pending',
        appearedAt: updated.appeared_at || null,
        forfeitedAt: updated.forfeited_at || null,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error updating examination attendance.' });
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
    const review = req.body || {};
    const reviewReason = String(review.reviewReason || '').trim();
    if (!Number.isSafeInteger(applicantId) || applicantId <= 0) return res.status(400).json({ message: 'A valid applicant is required.' });
    if (reviewReason.length > 2000) return res.status(400).json({ message: 'The decision reason must not exceed 2,000 characters.' });
    if (!['examId', 'resultId', 'applicationId', 'academicPeriodId'].every((key) => Number.isSafeInteger(review[key]) && review[key] > 0) || typeof review.updatedAt !== 'string' || !Number.isFinite(+new Date(review.updatedAt))) return res.status(400).json({ message: 'Reload Results Management and review the exact result before accepting.' });
    const decision = await prisma.$transaction(async (transaction) => {
      const activePeriod = await findPrimaryActivePeriod(transaction);
      if (!activePeriod || activePeriod.id !== review.academicPeriodId) throw new AttemptError('The primary period changed. Reload Results Management before deciding.');
      const [applicant, latestResult, application, existingScholar, exam, slot] = await Promise.all([
        transaction.applicants.findFirst({
          where: { id: applicantId, deleted_at: null },
          select: { id: true, email: true, first_name: true, school_id: true, school_year: true, municipality: true, deleted_at: true },
        }),
        transaction.results.findFirst({ where: { id: review.resultId, applicant_id: applicantId, exam_id: review.examId } }),
        transaction.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
        transaction.scholar_accounts.findFirst({ where: { applicant_id: applicantId } }),
        transaction.exams.findUnique({ where: { id: review.examId } }),
        transaction.exam_slots.findUnique({ where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: review.examId } } }),
      ]);
      if (!isCurrentExaminationApplicant(applicant, activePeriod.school_year, STALE_DEFAULT_SCHOOL_YEAR)) throw new AttemptError('The applicant is unavailable in the primary academic year.');
      if (!isExaminationApplicationEligible(application) || application.id !== review.applicationId) throw new AttemptError('The application changed or is unavailable. Reload before deciding.');
      if (!exam || exam.academic_year !== activePeriod.school_year || normalizeMunicipality(exam.municipality) !== normalizeMunicipality(applicant.municipality) || !slot || slot.exam_id !== exam.id || slot.applicant_id !== applicantId) throw new AttemptError('Use the applicant’s assigned examination in the primary academic year.');
      const scheduledExam = await transaction.exams.findFirst({ where: { academic_year: activePeriod.school_year, municipality: { equals: String(applicant.municipality || '').trim(), mode: 'insensitive' } }, orderBy: { updated_at: 'desc' } });
      if (scheduledExam?.id !== exam.id) throw new AttemptError('The assigned examination changed. Reload before deciding.');
      if (!latestResult || latestResult.id !== review.resultId || latestResult.exam_id !== review.examId || latestResult.applicant_id !== applicantId || latestResult.exam_slot_id !== slot.id || +new Date(latestResult.updated_at) !== +new Date(review.updatedAt)) throw new AttemptError('The reviewed result changed. Reload before deciding.');
      if (existingScholar?.is_active) return { scholar: existingScholar, alreadyAccepted: true };
      if (!latestResult.passed) throw new AttemptError('Only applicants with a passing reviewed result can be accepted.', 400);
      if (!latestResult.published_at) throw new AttemptError('Publish the reviewed examination result before scholarship acceptance.');

      if (!await getPostedPasser(transaction, applicantId, activePeriod.id, latestResult, application.id)) throw new AttemptError('Post this reviewed passing result in a locked Passer List before acceptance.', 400);
      const intakeSchool = await loadResolvedScholarSchool(transaction, { applicantId, applicant, application });
      if (!initialApproved(application.initial_docs, activePeriod.id, intakeSchool?.school_type, activePeriod.id, application.school_plan?.incomingYearLevel)) throw new AttemptError('Upload and approve all required initial documents before accepting as Scholar. Barangay Indigency is optional.', 400);
      const assessment = evaluateEligibility({ application, result: latestResult });
      const schoolYear = applicant.school_year === STALE_DEFAULT_SCHOOL_YEAR || !applicant.school_year
        ? activePeriod.school_year
        : applicant.school_year;
      const yearPrefix = String(schoolYear).split('-')[0];
      const scholarId = existingScholar?.scholar_id || `PGCEAP-${yearPrefix}-${String(applicantId).padStart(5, '0')}`;

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
      return { scholar: savedScholar, applicant, schoolYear, assessment };
    }, { isolationLevel: 'Serializable' });
    if (decision.alreadyAccepted) return res.json({ message: 'Applicant is already an active scholar.', scholar: decision.scholar });
    const { scholar, applicant, schoolYear, assessment } = decision;
    const emailDelivery = await sendScholarApprovedEmail({
      to: applicant.email,
      firstName: applicant.first_name,
      scholarId: scholar.scholar_id,
      schoolYear,
    });
    res.locals.auditAction = assessment.recommendation !== 'MEETS_CONFIGURED_CRITERIA'
      ? 'ELIGIBILITY_RECOMMENDATION_OVERRIDDEN'
      : 'APPLICANT_ACCEPTED_AS_SCHOLAR';
    res.locals.auditDescription = assessment.recommendation !== 'MEETS_CONFIGURED_CRITERIA'
      ? `Accepted an applicant by staff decision despite the recommendation of eligibility policy ${assessment.policyVersion}.`
      : `Accepted an applicant after reviewing eligibility policy ${assessment.policyVersion}.`;
    return res.status(201).json({
      message: 'Applicant accepted as a scholar.',
      scholar,
      eligibilityAssessment: assessment,
      notification: { scholarApprovalEmailSent: emailDelivery.sent },
    });
  } catch (error) {
    if (error instanceof AttemptError) return res.status(error.status).json({ message: error.message, ...(error.assessment ? { code: 'ELIGIBILITY_OVERRIDE_REASON_REQUIRED', eligibilityRecommendation: error.assessment } : {}) });
    if (['P2002', 'P2034'].includes(error?.code)) return res.status(409).json({ message: 'The examination decision changed concurrently. Reload and review before retrying.' });
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
  updateAcademicPeriodRequirementsDeadline,
  setPrimaryAcademicPeriod,
  deactivateAcademicPeriod,
  createApplication,
  inputExamScore,
  getOnlineExamQuestions,
  submitOnlineExam,
  submitRequirements,
  activateScholar,
  getScholarManagement,
  updateScholarBillingDetails,
  updateScholarBillingMetadata,
  processBillingSelection,
  processPayrollSelection,
  getApplicationById,
  getMyApplication,
  uploadMyRequirement,
  uploadScholarRequirementByAdmin,
  openContinuingRequirements,
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
  updateExaminationAttendance,
  acceptApplicantAsScholar,
  reevaluateExamResult,
};
