const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { validateGraduation, validateReview, serialize, metadataSelect } = require('../services/scholarGraduation');
const { createGraduationController } = require('../controllers/scholarGraduationController');
const valid = { graduationDate: '2026-06-01', academicYear: '2025-2026', latinHonor: 'cum_laude', school: 'Synthetic University', course: 'Synthetic Degree', expectedVersion: 0, fileName: 'proof.pdf', fileData: 'synthetic-document' };
const res = () => ({ statusCode: 200, headers: {}, set(key, value) { this.headers[key] = value; return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } });
let row, controller, exists, deleted, badProof, client, selectedWhere;
const req = (body = valid, staff = false) => ({ user: { id: staff ? 11 : 7, role: staff ? 'RegularAdmin' : 'Scholar' }, params: { applicantId: staff ? '7' : '99' }, body, query: {} });
const selected = (record, select) => record && Object.fromEntries(Object.keys(select || record).map(key => [key, record[key]]));
beforeEach(() => {
  row = null; exists = true; deleted = false; badProof = false;
  client = {
    scholar_accounts: { findUnique: async () => exists ? { applicant_id: 7 } : null, findMany: async () => [{ applicant_id: 7, scholar_id: 'TEST-007' }] },
    applicants: { findFirst: async () => deleted ? null : { id: 7 }, findMany: async () => deleted ? [] : [{ id: 7, first_name: 'Synthetic', middle_name: null, last_name: 'Graduate' }] },
    scholar_graduations: {
      findUnique: async ({ select, where }) => where.applicant_id === 7 ? selected(row, select) : null,
      create: async ({ data }) => { row = { ...data, version: 1, updated_at: new Date() }; return row; },
      updateMany: async ({ where, data }) => {
        if (!row || row.applicant_id !== where.applicant_id || row.version !== where.version || where.review_status && row.review_status !== where.review_status) return { count: 0 };
        row = { ...row, ...data, version: row.version + 1, updated_at: new Date() }; return { count: 1 };
      },
      findMany: async ({ where, select }) => { selectedWhere = where; return row && (!where.review_status || row.review_status === where.review_status) && (typeof where.latin_honor === 'string' ? row.latin_honor === where.latin_honor : where.latin_honor?.not ? row.latin_honor !== where.latin_honor.not : true) && where.applicant_id.in.includes(7) ? [selected(row, select)] : []; },
      count: async ({ where }) => row && (!where.review_status || row.review_status === where.review_status) && (where.latin_honor?.not ? row.latin_honor !== where.latin_honor.not : true) && where.applicant_id.in.includes(7) ? 1 : 0,
    },
    $transaction: async operation => Array.isArray(operation) ? Promise.all(operation) : operation(client),
  };
  controller = createGraduationController({ prisma: client, validateDocumentUpload: async () => { if (badProof) throw Object.assign(new Error('Invalid proof'), { statusCode: 400 }); return { contentType: 'application/pdf', buffer: Buffer.from('private-proof') }; } });
});
test('graduation validates actual past dates, matching consecutive years and controlled honors', () => {
  const now = new Date('2026-10-21T00:00:00Z');
  assert.equal(validateGraduation(valid, now).latin_honor, 'cum_laude');
  for (const patch of [{ graduationDate: '2026-02-30' }, { graduationDate: '2027-01-01' }, { academicYear: '2025-2027' }, { academicYear: '2020-2021' }, { latinHonor: 'honor_student' }, { latinHonor: {} }, { school: '' }, { course: 'x'.repeat(201) }, { expectedVersion: '0' }]) assert.throws(() => validateGraduation({ ...valid, ...patch }, now));
});
test('Scholar submission is bound to own ID and cannot self-verify or expose proof bytes', async () => {
  const response = res(); await controller.save(req({ ...valid, review_status: 'verified', reviewed_by: 7 }), response);
  assert.equal(response.statusCode, 200); assert.equal(row.applicant_id, 7); assert.equal(row.review_status, 'pending'); assert.equal(row.reviewed_by, null);
  assert.equal(response.body.graduation.proofName, 'proof.pdf');
  for (const key of ['proof_data', 'proof_type', 'fileData', 'reviewed_by']) assert.equal(key in response.body.graduation, false);
  assert.equal(metadataSelect.proof_data, undefined);
});
test('missing, unreadable or invalid replacement proof never writes', async () => {
  let response = res(); await controller.save(req({ ...valid, fileName: undefined, fileData: undefined }), response); assert.equal(response.statusCode, 400); assert.equal(row, null);
  await controller.save(req(), res()); const previous = { ...row, proof_data: Buffer.from(row.proof_data) }; badProof = true;
  response = res(); await controller.save(req({ ...valid, expectedVersion: 1 }), response); assert.equal(response.statusCode, 400); assert.deepEqual(row, previous);
});
test('review requires proof attestation; stale saves/reviews and duplicate decisions are rejected', async () => {
  await controller.save(req(), res());
  const review = { decision: 'verified', expectedVersion: 1, proofReviewed: true };
  assert.throws(() => validateReview({ ...review, proofReviewed: false })); assert.throws(() => validateReview({ decision: 'rejected', expectedVersion: 1, notes: '' }));
  let response = res(); await controller.review(req(review, true), response); assert.equal(response.statusCode, 200); assert.equal(row.review_status, 'verified'); assert.equal(row.reviewed_by, 11); assert.equal(row.version, 2);
  response = res(); await controller.review(req(review, true), response); assert.equal(response.statusCode, 409);
  response = res(); await controller.save(req({ ...valid, expectedVersion: 1 }), response); assert.equal(response.statusCode, 409); assert.equal(row.review_status, 'verified');
  response = res(); await controller.save(req({ ...valid, expectedVersion: 2, fileName: undefined, fileData: undefined, latinHonor: 'magna_cum_laude' }), response); assert.equal(response.statusCode, 200); assert.equal(row.review_status, 'pending'); assert.equal(row.reviewed_at, null); assert.equal(row.proof_data.toString(), 'private-proof');
});
test('return for correction retains proof and returns notes to Scholar', async () => {
  await controller.save(req(), res()); const response = res(); await controller.review(req({ decision: 'rejected', expectedVersion: 1, notes: 'Please provide official honor certification.' }, true), response);
  assert.equal(response.statusCode, 200); assert.equal(response.body.graduation.reviewStatus, 'rejected'); assert.match(response.body.graduation.reviewNotes, /official honor/); assert.ok(row.proof_data);
});
test('non-scholars and soft-deleted applicants cannot read, submit or download graduation records', async () => {
  for (const state of ['missing', 'deleted']) {
    exists = state !== 'missing'; deleted = state === 'deleted';
    for (const action of ['read', 'save', 'file']) { const response = res(); await controller[action](req(), response); assert.equal(response.statusCode, 404); }
  }
  assert.equal(row, null);
});
test('recognition defaults to verified Latin honors and excludes pending and no-honor graduates', async () => {
  await controller.save(req(), res()); let response = res(); await controller.index(req(), response); assert.equal(response.body.records.length, 0);
  await controller.review(req({ decision: 'verified', proofReviewed: true, expectedVersion: 1 }, true), res());
  response = res(); await controller.index(req(), response); assert.equal(response.body.records.length, 1); assert.equal(response.body.records[0].name, 'Synthetic Graduate'); assert.equal(selectedWhere.review_status, 'verified'); assert.equal(selectedWhere.latin_honor.not, 'none'); assert.equal(JSON.stringify(response.body).includes('private-proof'), false);
  row.latin_honor = 'none'; response = res(); await controller.index(req(), response); assert.equal(response.body.records.length, 0);
  const request = req(); request.query = { honor: 'all', status: 'all', q: 'Synthetic Graduate', year: '2025-2026' }; response = res(); await controller.index(request, response); assert.equal(response.body.records.length, 1); assert.equal(selectedWhere.academic_year, '2025-2026'); assert.deepEqual(selectedWhere.OR[0].applicant_id.in, [7]);
  deleted = true; response = res(); await controller.index(req(), response); assert.equal(response.body.total, 0);
});
test('proof download uses authorized record only and private/no-store response headers', async () => {
  await controller.save(req(), res()); const response = res(); await controller.file(req(), response);
  assert.equal(response.body.toString(), 'private-proof'); assert.equal(response.headers['Cache-Control'], 'private, no-store'); assert.equal(response.headers['X-Content-Type-Options'], 'nosniff'); assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.equal(serialize(null), null);
});
test('directory rejects invalid filters and pagination without database reads', async () => {
  for (const query of [{ status: 'paid' }, { honor: 'deans_list' }, { page: 0 }, { page: '1.5' }, { q: 'x'.repeat(101) }, { year: 'bad' }, { q: ['bad'] }, { year: ['2025-2026'] }]) {
    const request = req(); request.query = query; const response = res(); await controller.index(request, response); assert.equal(response.statusCode, 400);
  }
});
test('graduation proof uses real file-content inspection and rejects renamed or corrupt documents before mutation', async () => {
  const { validateDocumentUpload } = require('../services/documentFilePolicy');
  const { png, dataUrl } = require('./fixtures/documentFiles');
  const actual = createGraduationController({ prisma: client, validateDocumentUpload });
  for (const fields of [{ fileName: 'proof.exe', fileData: dataUrl() }, { fileName: 'proof.pdf', fileData: dataUrl(png, 'image/png') }, { fileName: 'proof.pdf', fileData: dataUrl(Buffer.from('%PDF-1.4\ninvalid\n%%EOF')) }]) {
    const response = res(); await actual.save(req({ ...valid, ...fields }), response); assert.equal(response.statusCode, 400); assert.equal(row, null);
  }
  const response = res(); await actual.save(req({ ...valid, fileData: dataUrl() }), response); assert.equal(response.statusCode, 200); assert.equal(row.review_status, 'pending');
});
