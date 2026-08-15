const { PrismaClient: SourceClient } = require('@prisma/client');
const { PrismaClient: TargetClient } = require('../generated/application-client');
require('dotenv').config();

const urls = () => {
  const source = new URL(process.env.DATABASE_URL);
  const target = new URL(source.toString());
  target.pathname = `${source.pathname}_v2`;
  return { sourceUrl: source.toString(), targetUrl: target.toString() };
};

const upsert = (model, data) => model.upsert({ where: { id: data.id }, create: data, update: data });

const resetSequences = async (client) => {
  const tables = ['academic_periods', 'activity_logs', 'announcements', 'admins', 'applicants', 'application_submissions', 'control_accounts', 'exams', 'exam_slots', 'results', 'scholar_accounts', 'scholar_requirements', 'schools', 'payroll_batches', 'payroll_claims'];
  for (const table of tables) {
    await client.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST(COALESCE((SELECT MAX(id) + 1 FROM "${table}"), 1), 1), false)`);
  }
};

const main = async () => {
  const { sourceUrl, targetUrl } = urls();
  const source = new SourceClient({ datasources: { db: { url: sourceUrl } } });
  const target = new TargetClient({ datasources: { db: { url: targetUrl } } });
  try {
    for (const row of await source.academic_periods.findMany()) await upsert(target.academic_periods, row);
    for (const row of await source.activity_logs.findMany()) await upsert(target.activity_logs, row);
    for (const row of await source.announcements.findMany()) await upsert(target.announcements, row);
    for (const row of await source.admins.findMany()) await upsert(target.admins, row);
    for (const row of await source.schools.findMany()) {
      await upsert(target.schools, { id: row.id, name: row.name, school_type: row.school_type || 'public', is_active: row.is_active, created_at: row.created_at, updated_at: row.updated_at });
    }
    for (const row of await source.applicants.findMany()) {
      await upsert(target.applicants, {
        id: row.id, first_name: row.first_name, middle_name: row.middle_name, last_name: row.last_name,
        name_ext: row.name_ext, email: row.email, phone: row.phone, street: row.street,
        barangay: row.barangay, municipality: row.municipality, school_id: row.school_id,
        gender: row.gender, date_of_birth: row.date_of_birth, birthplace: row.birthplace,
        civil_status: row.civil_status, family_income: row.family_income, gwa: row.gwa,
        guardians: row.guardians, siblings_boys: row.siblings_boys, siblings_girls: row.siblings_girls,
        status: row.status, school_year: row.school_year, created_at: row.created_at,
        updated_at: row.updated_at, deleted_at: row.deleted_at,
      });
    }
    for (const row of await source.application_submissions.findMany()) await upsert(target.application_submissions, row);
    for (const row of await source.control_accounts.findMany()) await upsert(target.control_accounts, row);
    for (const row of await source.exams.findMany()) await upsert(target.exams, { ...row, exam_end_date: null });
    for (const row of await source.exam_slots.findMany()) await upsert(target.exam_slots, row);
    for (const row of await source.results.findMany()) await upsert(target.results, row);
    for (const row of await source.scholar_accounts.findMany()) await upsert(target.scholar_accounts, row);
    for (const row of await source.scholar_requirements.findMany()) {
      await upsert(target.scholar_requirements, {
        id: row.id, applicant_id: row.applicant_id, billing_period_id: row.billing_period_id,
        school_id: row.school_id, year_level: row.year_level, course: row.course, major: row.major,
        cert_tax_exemption_file: row.cert_tax_exemption_file, cert_tax_exemption_review_status: row.cert_tax_exemption_review_status,
        barangay_indigency_file: row.barangay_indigency_file, barangay_indigency_review_status: row.barangay_indigency_review_status,
        valid_id_photocopy_file: row.valid_id_photocopy_file, valid_id_photocopy_review_status: row.valid_id_photocopy_review_status,
        registration_form_file: row.registration_form_file || row.cor_file, registration_form_review_status: row.registration_form_review_status || row.cor_review_status,
        tuition_fee_receipt_file: row.tuition_fee_receipt_file, tuition_fee_receipt_review_status: row.tuition_fee_receipt_review_status,
        folder_physical_submitted: row.folder_physical_submitted, folder_physical_submitted_at: row.folder_physical_submitted_at,
        grade_report_file: row.grade_report_file, grade_report_review_status: row.grade_report_review_status,
        updated_by: row.updated_by, created_at: row.created_at, updated_at: row.updated_at,
      });
    }
    for (const row of await source.payroll_batches.findMany()) {
      await upsert(target.payroll_batches, {
        id: row.id, batch_number: row.batch_number, billing_period_id: row.billing_period_id,
        total_scholars: row.total_scholars, total_amount: row.total_amount, status: row.status,
        prepared_by: row.prepared_by, released_by: row.released_by, prepared_at: row.prepared_at,
        released_at: row.released_at, remarks: row.remarks, created_at: row.created_at, updated_at: row.updated_at,
      });
    }
    for (const row of await source.payroll_claims.findMany()) {
      await upsert(target.payroll_claims, {
        id: row.id, payroll_batch_id: row.payroll_batch_id, applicant_id: row.applicant_id,
        claim_amount: row.claim_amount, claim_status: row.claim_status, notes: row.notes,
        claimed_date: row.claimed_date, claimed_notes: row.claimed_notes,
        created_at: row.created_at, updated_at: row.updated_at,
      });
    }
    await resetSequences(target);
    console.log('Application database migration completed.');
  } finally {
    await Promise.all([source.$disconnect(), target.$disconnect()]);
  }
};

main().catch((error) => {
  console.error('Application database migration failed:', error);
  process.exitCode = 1;
});
