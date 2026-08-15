const { PrismaClient: SourceClient } = require('@prisma/client');
const { PrismaClient: CleanClient } = require('../generated/cleaned-client');
require('dotenv').config();

const CLEAN_SUFFIX = '_clean';

const databaseUrls = () => {
  const sourceUrl = new URL(process.env.DATABASE_URL);
  const targetUrl = new URL(sourceUrl.toString());
  targetUrl.pathname = `${sourceUrl.pathname}${CLEAN_SUFFIX}`;
  return { sourceUrl: sourceUrl.toString(), targetUrl: targetUrl.toString() };
};

const parseGuardianDetails = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return { guardianName: String(value) };
  }
};

const mapAdminRole = (admin) => {
  if (admin.is_super_admin) return 'super_admin';
  if (admin.role === 'billing') return 'billing_payroll_admin';
  return admin.role || 'admin';
};

const documentEntry = (fileName, uploadedAt, status, comment) => {
  if (!fileName && !uploadedAt && !comment) return null;
  return {
    fileName: fileName || null,
    uploadedAt: uploadedAt || null,
    status: status || 'pending',
    adminComment: comment || null,
  };
};

const compactRequirementDocuments = (row) => Object.fromEntries(Object.entries({
  tax_exemption: documentEntry(row.cert_tax_exemption_file, row.cert_tax_exemption_uploaded_at, row.cert_tax_exemption_review_status, row.cert_tax_exemption_admin_comment),
  indigency: documentEntry(row.barangay_indigency_file, row.barangay_indigency_uploaded_at, row.barangay_indigency_review_status, row.barangay_indigency_admin_comment),
  valid_id: documentEntry(row.valid_id_photocopy_file, row.valid_id_photocopy_uploaded_at, row.valid_id_photocopy_review_status, row.valid_id_photocopy_admin_comment),
  grades: documentEntry(row.grade_report_file, row.grade_report_uploaded_at, row.grade_report_review_status, row.grade_report_admin_comment),
  registration_form: documentEntry(row.registration_form_file || row.cor_file, row.registration_form_uploaded_at || row.cor_uploaded_at, row.registration_form_review_status || row.cor_review_status, row.registration_form_admin_comment || row.cor_admin_comment),
  tuition_receipt: documentEntry(row.tuition_fee_receipt_file, row.tuition_fee_receipt_uploaded_at, row.tuition_fee_receipt_review_status, row.tuition_fee_receipt_admin_comment),
}).filter(([, value]) => value));

const upsertById = (model, record) => model.upsert({
  where: { id: record.id },
  create: record,
  update: record,
});

const resetSequences = async (client) => {
  const tables = [
    'academic_periods', 'activity_logs', 'announcements', 'admins', 'applicants',
    'application_submissions', 'control_accounts', 'exams', 'exam_slots', 'results',
    'scholar_accounts', 'scholar_requirements', 'schools', 'payroll_batches', 'payroll_claims',
  ];
  for (const table of tables) {
    await client.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST(COALESCE((SELECT MAX(id) + 1 FROM "${table}"), 1), 1), false)`);
  }
};

const main = async () => {
  const { sourceUrl, targetUrl } = databaseUrls();
  const source = new SourceClient({ datasources: { db: { url: sourceUrl } } });
  const clean = new CleanClient({ datasources: { db: { url: targetUrl } } });

  try {
    const [periods, admins, schools, applications] = await Promise.all([
      source.academic_periods.findMany(),
      source.admins.findMany(),
      source.schools.findMany(),
      source.application_submissions.findMany({ orderBy: { submitted_at: 'desc' } }),
    ]);
    const activePeriod = periods.find(({ is_active: isActive }) => isActive) || periods[0];
    if (!activePeriod) throw new Error('At least one academic period is required before migration.');

    for (const row of periods) await upsertById(clean.academic_periods, row);
    for (const row of admins) {
      await upsertById(clean.admins, {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        password_hash: row.password_hash,
        role: mapAdminRole(row),
        is_active: row.is_active,
        last_login_at: row.last_login_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    for (const row of schools) {
      await upsertById(clean.schools, {
        id: row.id,
        name: row.name,
        school_type: row.school_type || 'public',
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    const periodByYear = new Map(periods.map((period) => [period.school_year, period]));
    const schoolByName = new Map(schools.map((school) => [school.name.trim().toLowerCase(), school]));
    const latestApplicationByApplicant = new Map();
    applications.forEach((application) => {
      if (application.applicant_id && !latestApplicationByApplicant.has(application.applicant_id)) {
        latestApplicationByApplicant.set(application.applicant_id, application);
      }
    });

    const applicants = await source.applicants.findMany();
    const applicantPeriod = new Map();
    for (const row of applicants) {
      const application = latestApplicationByApplicant.get(row.id);
      const plannedSchoolName = String(application?.school_plan?.school || '').trim().toLowerCase();
      const period = periodByYear.get(row.school_year) || activePeriod;
      const schoolId = row.school_id || schoolByName.get(plannedSchoolName)?.id || null;
      applicantPeriod.set(row.id, period.id);
      await upsertById(clean.applicants, {
        id: row.id,
        first_name: row.first_name,
        middle_name: row.middle_name,
        last_name: row.last_name,
        name_ext: row.name_ext,
        email: row.email,
        phone: row.phone,
        street: row.street,
        barangay: row.barangay,
        municipality: row.municipality,
        school_id: schoolId,
        academic_period_id: period.id,
        gender: row.gender,
        date_of_birth: row.date_of_birth,
        birthplace: row.birthplace,
        civil_status: row.civil_status,
        family_income: row.family_income,
        gwa: row.gwa,
        guardian_details: parseGuardianDetails(row.guardians),
        siblings_boys: row.siblings_boys,
        siblings_girls: row.siblings_girls,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
      });
    }

    for (const row of applications.filter(({ applicant_id: applicantId }) => applicantId)) {
      await upsertById(clean.application_submissions, {
        id: row.id,
        applicant_id: row.applicant_id,
        identity: row.identity,
        address: row.address,
        school_plan: row.school_plan,
        family: row.family,
        eligibility: row.eligibility,
        status: row.status,
        submitted_at: row.submitted_at,
        updated_at: row.updated_at,
      });
    }

    for (const row of await source.control_accounts.findMany()) await upsertById(clean.control_accounts, row);

    for (const row of await source.exams.findMany()) {
      const period = periodByYear.get(row.academic_year) || activePeriod;
      await upsertById(clean.exams, {
        id: row.id,
        academic_period_id: period.id,
        title: row.title,
        exam_date: row.exam_date,
        exam_end_date: null,
        venue: row.venue,
        municipality: row.municipality,
        instructions: row.instructions,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    for (const row of await source.exam_slots.findMany()) await upsertById(clean.exam_slots, row);

    for (const row of await source.results.findMany()) {
      await upsertById(clean.results, {
        id: row.id,
        exam_slot_id: row.exam_slot_id,
        score: row.score,
        passing_score: row.passing_score,
        passed: row.passed,
        remarks: row.remarks,
        recorded_by: row.recorded_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    const scholarAccounts = await source.scholar_accounts.findMany();
    for (const row of scholarAccounts) await upsertById(clean.scholar_accounts, row);

    for (const row of await source.scholar_requirements.findMany()) {
      await upsertById(clean.scholar_requirements, {
        id: row.id,
        applicant_id: row.applicant_id,
        academic_period_id: periodByYear.get(applicants.find(({ id }) => id === row.applicant_id)?.school_year)?.id || activePeriod.id,
        school_id: row.school_id,
        year_level: row.year_level,
        course: row.course,
        documents: compactRequirementDocuments(row),
        physical_folder_submitted: row.folder_physical_submitted,
        physical_folder_submitted_at: row.folder_physical_submitted_at,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    for (const scholar of scholarAccounts.filter(({ is_active: isActive }) => isActive)) {
      const application = latestApplicationByApplicant.get(scholar.applicant_id);
      if (!application) continue;
      const uploadedDocuments = application.initial_docs?.requirements || {};
      const periodId = applicantPeriod.get(scholar.applicant_id) || activePeriod.id;
      const existing = await clean.scholar_requirements.findUnique({
        where: { applicant_id_academic_period_id: { applicant_id: scholar.applicant_id, academic_period_id: periodId } },
      });
      const schoolName = String(application.school_plan?.school || '').trim().toLowerCase();
      const data = {
        school_id: schoolByName.get(schoolName)?.id || null,
        year_level: application.school_plan?.incomingYearLevel || null,
        course: application.school_plan?.course || null,
        documents: { ...(existing?.documents || {}), ...uploadedDocuments },
      };
      await clean.scholar_requirements.upsert({
        where: { applicant_id_academic_period_id: { applicant_id: scholar.applicant_id, academic_period_id: periodId } },
        create: { applicant_id: scholar.applicant_id, academic_period_id: periodId, ...data },
        update: data,
      });
    }

    for (const row of await source.payroll_batches.findMany()) {
      await upsertById(clean.payroll_batches, {
        id: row.id,
        batch_number: row.batch_number,
        academic_period_id: row.billing_period_id,
        total_scholars: row.total_scholars,
        total_amount: row.total_amount,
        status: row.status,
        prepared_by: row.prepared_by,
        released_by: row.released_by,
        prepared_at: row.prepared_at,
        released_at: row.released_at,
        remarks: row.remarks,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
    for (const row of await source.payroll_claims.findMany()) {
      await upsertById(clean.payroll_claims, {
        id: row.id,
        payroll_batch_id: row.payroll_batch_id,
        applicant_id: row.applicant_id,
        claim_amount: row.claim_amount,
        claim_status: row.claim_status,
        payment_reference: row.claimed_notes,
        notes: row.notes,
        paid_at: row.claimed_date,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }

    for (const row of await source.announcements.findMany()) await upsertById(clean.announcements, row);
    for (const row of await source.activity_logs.findMany()) await upsertById(clean.activity_logs, row);

    await resetSequences(clean);
    const counts = {
      applicants: await clean.applicants.count(),
      applications: await clean.application_submissions.count(),
      scholars: await clean.scholar_accounts.count(),
      requirements: await clean.scholar_requirements.count(),
      payrollClaims: await clean.payroll_claims.count(),
    };
    console.log('Clean database migration completed:', counts);
  } finally {
    await Promise.all([source.$disconnect(), clean.$disconnect()]);
  }
};

main().catch((error) => {
  console.error('Clean database migration failed:', error);
  process.exitCode = 1;
});
