const { createHash, createHmac, timingSafeEqual } = require('node:crypto');
const { loadResolvedScholarSchool, schoolClassification } = require('./scholarSchool');
const { assertScholarPeriodEligible } = require('./scholarProcessingPeriod');

const TEMPLATE_VERSION = 'individual-certification-v1';
const TOKEN_LIFETIME_MS = 10 * 60 * 1000;
const TOKEN_DOMAIN = 'cao-individual-scholar-certification-v1:';
const failure = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const positiveId = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw failure('Select a valid Scholar and academic period.');
  return id;
};
const metadataSelect = Object.freeze({ id: true, applicant_id: true, scholar_account_id: true,
  academic_period_id: true, reference_number: true, snapshot_hash: true, template_version: true,
  snapshot: true, generated_at: true, generated_by: true, generated_by_role: true, file_name: true });
const serialize = record => record ? ({ id: record.id, reference: record.reference_number,
  academicPeriodId: record.academic_period_id, schoolYear: record.snapshot.schoolYear,
  semester: record.snapshot.semester, generatedAt: new Date(record.generated_at).toISOString(),
  generatedBy: { id: record.generated_by, role: record.generated_by_role },
  fileName: record.file_name, snapshot: record.snapshot }) : null;
const snapshotHash = snapshot => createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
const text = (value, fallback) => String(value || fallback || '').trim();

// A generation ticket names authoritative data, not caller-supplied profile text.
const loadContext = async (client, applicantId, periodId) => {
  const [scholar, applicant, period, application, requirement, account] = await Promise.all([
    client.scholar_accounts.findUnique({ where: { applicant_id: applicantId } }),
    client.applicants.findFirst({ where: { id: applicantId, deleted_at: null } }),
    client.academic_periods.findUnique({ where: { id: periodId } }),
    client.application_submissions.findFirst({ where: { applicant_id: applicantId, status: { not: 'Withdrawn' } }, orderBy: { submitted_at: 'desc' } }),
    client.scholar_requirements.findUnique({ where: { applicant_id_billing_period_id: { applicant_id: applicantId, billing_period_id: periodId } } }),
    client.control_accounts.findFirst({ where: { applicant_id: applicantId } }),
  ]);
  if (!scholar || !applicant) throw failure('Scholar not found.', 404);
  if (!period) throw failure('Academic period not found.', 404);
  if (!application) throw failure('The Scholar application is unavailable.', 409);
  assertScholarPeriodEligible(applicant, period);
  const school = await loadResolvedScholarSchool(client, { applicantId, applicant, requirement, application });
  if (schoolClassification(school?.school_type) !== 'Private') throw failure('Individual certifications apply to Private-school Scholars.', 409);
  const plan = application.school_plan || {};
  const snapshot = {
    name: [applicant.first_name, applicant.middle_name, applicant.last_name, applicant.name_ext].filter(Boolean).join(' ').toUpperCase(),
    course: text(requirement?.course || plan.course, 'the declared program'),
    yearLevel: text(requirement?.year_level || plan.incomingYearLevel, 'enrolled'),
    school: school.name, schoolId: school.id, schoolType: 'Private',
    schoolYear: period.school_year, semester: period.semester, academicPeriodId: period.id,
    controlNumber: account?.control_number || scholar.scholar_id || null,
    scholarId: scholar.scholar_id || null,
    reference: `PGCEAP-CERT#${String(scholar.id).padStart(4, '0')}`,
    templateVersion: TEMPLATE_VERSION,
  };
  return { snapshot, snapshotHash: snapshotHash(snapshot), scholarId: scholar.id, applicantId, periodId: period.id };
};
const existingWhere = context => ({ scholar_account_id_academic_period_id_snapshot_hash: {
  scholar_account_id: context.scholarId, academic_period_id: context.periodId, snapshot_hash: context.snapshotHash,
} });
const findExisting = (client, context) => client.scholar_certifications.findUnique({ where: existingWhere(context), select: metadataSelect });
const secretFor = secret => {
  if (typeof secret !== 'string' || !secret) throw failure('Certificate generation is temporarily unavailable.', 503);
  return secret;
};
const signTicket = (payload, secret) => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secretFor(secret)).update(TOKEN_DOMAIN + encoded).digest('base64url');
  return `${encoded}.${signature}`;
};
const prepareTicket = (context, actor, now, secret) => signTicket({
  purpose: 'scholar-certification-generation', applicantId: context.applicantId, scholarId: context.scholarId,
  academicPeriodId: context.periodId, snapshotHash: context.snapshotHash, actorId: actor.id, actorRole: actor.role,
  generatedAt: new Date(now).toISOString(), expiresAt: new Date(now).getTime() + TOKEN_LIFETIME_MS,
}, secret);
const verifyTicket = (token, actor, applicantId, periodId, now, secret) => {
  if (typeof token !== 'string' || token.length > 4096 || token.split('.').length !== 2) throw failure('Prepare this certification again before saving.', 409);
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', secretFor(secret)).update(TOKEN_DOMAIN + encoded).digest();
  let actual, payload;
  try { actual = Buffer.from(signature, 'base64url'); payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()); }
  catch { throw failure('The certification request is invalid. Prepare it again.', 409); }
  const generatedTime = new Date(payload?.generatedAt).getTime(), currentTime = new Date(now).getTime();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)
    || payload.purpose !== 'scholar-certification-generation' || payload.actorId !== actor.id || payload.actorRole !== actor.role
    || payload.applicantId !== applicantId || payload.academicPeriodId !== periodId
    || !Number.isSafeInteger(payload.scholarId) || typeof payload.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(payload.snapshotHash)
    || !Number.isFinite(generatedTime) || generatedTime > currentTime || payload.expiresAt !== generatedTime + TOKEN_LIFETIME_MS || currentTime >= payload.expiresAt) {
    throw failure('This certification request expired or changed. Prepare it again.', 409);
  }
  return payload;
};
const matchContext = (context, ticket) => {
  if (context.scholarId !== ticket.scholarId || context.snapshotHash !== ticket.snapshotHash) throw failure('The Scholar details changed. Prepare the certification again.', 409);
};
module.exports = { TEMPLATE_VERSION, failure, positiveId, metadataSelect, serialize, loadContext, snapshotHash,
  findExisting, prepareTicket, verifyTicket, matchContext };
