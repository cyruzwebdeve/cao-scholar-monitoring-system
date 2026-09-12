require('dotenv').config();

if (process.env.NODE_ENV === 'production' || process.env.DATABASE_TARGET === 'cloud') {
  throw new Error('Local workflow fixtures cannot run against a cloud or production database.');
}

const prisma = require('../config/prisma');

const FIXTURES = [
  ['PGC-BILL-001', 'ALYSSA', 'MAE', 'SANTOS', 'Daet', 'Bagasbas', 'private'],
  ['PGC-BILL-002', 'BENJAMIN', 'LUIS', 'REYES', 'Basud', 'Poblacion 1', 'private'],
  ['PGC-BILL-003', 'CAMILLE', 'JOY', 'GARCIA', 'Labo', 'Kabatuhan', 'private'],
  ['PGC-BILL-004', 'DANIEL', 'CRUZ', 'MENDOZA', 'Mercedes', 'San Roque', 'private'],
  ['PGC-BILL-005', 'ELENA', 'ROSE', 'FLORES', 'Talisay', 'Poblacion', 'private'],
  ['PGC-BILL-006', 'KATRINA', 'MAE', 'AQUINO', 'Capalonga', 'Poblacion', 'private'],
  ['PGC-BILL-007', 'LORENZO', 'PAUL', 'BAUTISTA', 'San Lorenzo Ruiz', 'Matacong', 'private'],
  ['PGC-BILL-008', 'MARIEL', 'JOY', 'DE LEON', 'Santa Elena', 'San Lorenzo', 'private'],
  ['PGC-BILL-009', 'NATHAN', 'LUIS', 'EVANGELISTA', 'Daet', 'Alawihao', 'private'],
  ['PGC-BILL-010', 'OLIVIA', 'ANNE', 'FERNANDEZ', 'Basud', 'San Felipe', 'private'],
  ['PGC-PAY-001', 'FRANCIS', 'JOSE', 'RAMOS', 'Daet', 'Gahonon', 'public'],
  ['PGC-PAY-002', 'GABRIELA', 'MAE', 'TORRES', 'Jose Panganiban', 'Larap', 'public'],
  ['PGC-PAY-003', 'HENRY', 'LEE', 'NAVARRO', 'Paracale', 'Tugos', 'public'],
  ['PGC-PAY-004', 'ISABEL', 'ANNE', 'CASTILLO', 'Vinzons', 'Sabang', 'public'],
  ['PGC-PAY-005', 'JOSHUA', 'PAUL', 'CRUZ', 'San Vicente', 'Poblacion', 'public'],
].map(([control, first, middle, last, municipality, barangay, schoolType], index) => ({
  control, first, middle, last, municipality, barangay, schoolType,
  email: `${control.toLowerCase()}@pgceap.test`,
  amount: schoolType === 'private' ? 5000 : 3000,
  route: schoolType === 'private' ? 'billing' : 'payroll', sequence: index + 1,
}));

const approvedDocument = (key) => ({
  fileName: `DUMMY-${key.toUpperCase()}.pdf`, fileType: 'application/pdf',
  uploadedAt: new Date().toISOString(), status: 'approved', reviewedAt: new Date().toISOString(),
  reviewNotes: 'Approved local test fixture',
});

const main = async () => {
  const period = await prisma.academic_periods.findFirst({
    where: { is_active: true },
    orderBy: [{ is_primary: 'desc' }, { updated_at: 'desc' }, { id: 'desc' }],
  });
  if (!period) throw new Error('Create and activate an academic period before seeding workflow fixtures.');

  const schools = {};
  for (const schoolType of ['private', 'public']) {
    const label = schoolType === 'private' ? 'Private Billing' : 'Public Payroll';
    schools[schoolType] = await prisma.schools.upsert({
      where: { name: `PGCEAP ${label} Local Test School` },
      create: { name: `PGCEAP ${label} Local Test School`, school_type: schoolType, is_active: true },
      update: { school_type: schoolType, is_active: true },
    });
  }

  const results = [];
  const skipped = [];
  for (const fixture of FIXTURES) {
    const existing = await prisma.applicants.findUnique({ where: { email: fixture.email } });
    if (existing) {
      const claim = await prisma.payroll_claims.findUnique({
        where: { applicant_id_academic_period_id: { applicant_id: existing.id, academic_period_id: period.id } },
      });
      if (claim) {
        skipped.push({ controlNumber: fixture.control, reason: 'Already belongs to a generated list; history was preserved.' });
        continue;
      }
    }

    const school = schools[fixture.schoolType];
    const applicant = await prisma.$transaction(async (tx) => {
      const savedApplicant = await tx.applicants.upsert({
        where: { email: fixture.email },
        create: {
          first_name: fixture.first, middle_name: fixture.middle, last_name: fixture.last,
          email: fixture.email, phone: `09000000${String(fixture.sequence).padStart(2, '0')}`,
          street: 'DUMMY ADDRESS - LOCAL TEST ONLY', barangay: fixture.barangay,
          municipality: fixture.municipality, school_id: school.id, family_income: 'DUMMY TEST DATA',
          gwa: 1.5, guardians: 'DUMMY PARENT OR GUARDIAN', status: 'passed', school_year: period.school_year,
        },
        update: {
          first_name: fixture.first, middle_name: fixture.middle, last_name: fixture.last,
          school_id: school.id, status: 'passed', school_year: period.school_year, deleted_at: null,
        },
      });

      await tx.control_accounts.upsert({
        where: { applicant_id: savedApplicant.id },
        create: {
          applicant_id: savedApplicant.id, control_number: fixture.control, username: fixture.email,
          password_hash: '$2a$12$uwVCP8UU9XX7uGuV7CzejO8.RoykcULtIVo2DLvM2bhLI5/62oTUC', is_active: false,
        },
        update: { control_number: fixture.control, username: fixture.email, is_active: false },
      });

      const requirements = {
        tax_exemption: approvedDocument('tax-exemption'), indigency: approvedDocument('indigency'),
        valid_id: approvedDocument('valid-id'), grades: approvedDocument('grades'),
        registration_form: approvedDocument('registration-form'),
        ...(fixture.schoolType === 'private' ? { tuition_receipt: approvedDocument('tuition-receipt') } : {}),
      };
      const applicationData = {
        email: fixture.email,
        identity: { firstName: fixture.first, middleName: fixture.middle, familyName: fixture.last, email: fixture.email },
        address: { street: 'DUMMY ADDRESS - LOCAL TEST ONLY', municipality: fixture.municipality, barangay: fixture.barangay },
        school_plan: { school: school.name, course: 'DUMMY TEST PROGRAM', incomingYearLevel: '1st Year' },
        family: { familyIncome: 'DUMMY TEST DATA', gwa: '1.50' }, eligibility: {},
        initial_docs: { requirements }, status: 'Scholar',
      };
      const submission = await tx.application_submissions.findFirst({
        where: { applicant_id: savedApplicant.id }, orderBy: { submitted_at: 'desc' },
      });
      if (submission) await tx.application_submissions.update({ where: { id: submission.id }, data: applicationData });
      else await tx.application_submissions.create({ data: { applicant_id: savedApplicant.id, ...applicationData } });

      await tx.scholar_accounts.upsert({
        where: { applicant_id: savedApplicant.id },
        create: { applicant_id: savedApplicant.id, scholar_id: `TEST-${fixture.control}`, is_active: true, notes: 'DUMMY DATA - local workflow testing only' },
        update: { is_active: true, notes: 'DUMMY DATA - local workflow testing only' },
      });

      const files = {
        cert_tax_exemption_file: 'DUMMY-APPROVED-TAX-EXEMPTION', cert_tax_exemption_review_status: 'approved',
        barangay_indigency_file: 'DUMMY-APPROVED-INDIGENCY', barangay_indigency_review_status: 'approved',
        valid_id_photocopy_file: 'DUMMY-APPROVED-VALID-ID', valid_id_photocopy_review_status: 'approved',
        registration_form_file: 'DUMMY-APPROVED-REGISTRATION', registration_form_review_status: 'approved',
        grade_report_file: 'DUMMY-APPROVED-GRADES', grade_report_review_status: 'approved',
        tuition_fee_receipt_file: fixture.schoolType === 'private' ? 'DUMMY-APPROVED-TUITION-RECEIPT' : null,
        tuition_fee_receipt_review_status: fixture.schoolType === 'private' ? 'approved' : 'pending',
      };
      await tx.scholar_requirements.upsert({
        where: { applicant_id_billing_period_id: { applicant_id: savedApplicant.id, billing_period_id: period.id } },
        create: {
          applicant_id: savedApplicant.id, billing_period_id: period.id, school_id: school.id,
          year_level: '1st Year', course: 'DUMMY TEST PROGRAM', billing_amount: fixture.amount,
          billing_notes: `DUMMY DATA - Ready for local ${fixture.route} test`, billing_reference: null,
          billing_school_year: period.school_year, billing_semester: period.semester,
          billing_status: fixture.route === 'billing' ? 'Ready for certification' : 'Not applicable', ...files,
        },
        update: {
          school_id: school.id, year_level: '1st Year', course: 'DUMMY TEST PROGRAM',
          billing_amount: fixture.amount, billing_reference: null,
          billing_school_year: period.school_year, billing_semester: period.semester,
          billing_status: fixture.route === 'billing' ? 'Ready for certification' : 'Not applicable',
          billing_notes: `DUMMY DATA - Ready for local ${fixture.route} test`, ...files,
        },
      });
      return savedApplicant;
    });
    results.push({ controlNumber: fixture.control, name: `${applicant.last_name}, ${applicant.first_name} ${applicant.middle_name}`, schoolType: fixture.schoolType, route: fixture.route, amount: fixture.amount });
  }

  console.log(JSON.stringify({ createdOrRefreshed: results.length, skipped, schoolYear: period.school_year, semester: period.semester, fixtures: results }, null, 2));
};

main().catch((error) => {
  console.error(`Unable to seed local workflow fixtures: ${error.message}`); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
