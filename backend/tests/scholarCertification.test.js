const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, randomBytes } = require('node:crypto');
const { Writable } = require('node:stream');
const service = require('../services/scholarCertification');
const { createScholarCertificationController } = require('../controllers/scholarCertificationController');
const { dataUrl, pdf, png } = require('./fixtures/documentFiles');
const secret = randomBytes(32).toString('hex');
const initialTime = new Date('2026-11-17T01:02:03.000Z');
const actor = { id: 11, role: 'RegularAdmin', sectionAccess: ['scholars'] };
const response = () => ({ statusCode: 200, headers: {}, locals: {}, setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  send(body) { this.body = body; return this; }, end() { this.ended = true; } });
const request = (body = {}, user = actor, params = {}) => ({ user, params: { applicantId: '7', ...params }, body });
const selected = (record, select) => record && Object.fromEntries(Object.keys(select || record).map(key => [key, record[key]]));
let state, client, controller;
beforeEach(() => {
  state = { rows: [], time: initialTime, creates: 0, transactions: 0, uploaded: [], removed: [],
    applicant: { id: 7, first_name: 'Synthetic', middle_name: 'Test', last_name: 'Scholar', school_id: 20, school_year: '2026-2027' },
    scholar: { id: 4, applicant_id: 7, scholar_id: 'TEST-004', is_active: true },
    period: { id: 10, school_year: '2026-2027', semester: '1st Semester', is_active: true },
    application: { id: 17, school_plan: { school: 'Synthetic Academy', course: 'Synthetic Degree', incomingYearLevel: '1st Year' } },
    requirement: { school_id: 20, year_level: '2nd Year', course: 'Period Degree' },
    school: { id: 20, name: 'Synthetic Academy', school_type: 'private' }, token: null };
  client = {
    scholar_accounts: { findUnique: async ({ where }) => where.applicant_id === 7 ? state.scholar : null },
    applicants: { findFirst: async ({ where }) => where.id === 7 ? state.applicant : null },
    academic_periods: { findUnique: async ({ where }) => where.id === state.period?.id ? state.period : null },
    application_submissions: { findFirst: async () => state.application },
    scholar_requirements: { findUnique: async () => state.requirement, findMany: async () => [] },
    control_accounts: { findFirst: async () => ({ control_number: 'SYNTHETIC-007' }) },
    schools: { findMany: async () => state.school ? [state.school] : [] },
    scholar_certifications: {
      findUnique: async ({ where, select }) => selected(state.rows.find(row => Object.entries(where.scholar_account_id_academic_period_id_snapshot_hash).every(([key, value]) => row[key] === value)), select),
      findMany: async ({ where, select }) => state.rows.filter(row => row.applicant_id === where.applicant_id).sort((a, b) => b.generated_at - a.generated_at || b.id - a.id).map(row => selected(row, select)),
      findFirst: async ({ where, select }) => selected(state.rows.find(row => row.id === where.id && row.applicant_id === where.applicant_id), select),
      create: async ({ data, select }) => {
        const row = { id: state.rows.length + 1, ...structuredClone(data) };
        state.rows.push(row); state.creates++;
        if (state.uniqueConflict) throw Object.assign(new Error('Concurrent duplicate'), { code: 'P2002' });
        return selected(row, select);
      },
    },
    $transaction: async (operation, options) => {
      state.transactions++; assert.equal(options.isolationLevel, 'Serializable');
      if (state.beforeTransaction) await state.beforeTransaction();
      return operation(client);
    },
  };
  controller = makeController();
});
function makeController(overrides = {}) {
  return createScholarCertificationController({ prisma: client, getSecret: () => secret, now: () => state.time,
    getStorageToken: () => state.token,
    validateDocumentUpload: async () => ({ contentType: 'application/pdf', buffer: pdf }),
    uploadDataUrl: async details => { state.uploaded.push(details); return { url: 'https://synthetic.blob.vercel-storage.com/private.pdf', pathname: 'synthetic/private.pdf' }; },
    deleteBlob: async (url, token) => state.removed.push({ url, token }), ...overrides });
}
async function prepare() { const res = response(); await controller.prepare(request({ academicPeriodId: 10 }), res); assert.equal(res.statusCode, 200, res.body?.message); return res.body; }
async function save(prepared, extras = {}) { const res = response(); await controller.save(request({ academicPeriodId: 10, generationToken: prepared.generationToken, fileData: dataUrl(), ...extras }), res); return res; }
const signed = payload => {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret).update('cao-individual-scholar-certification-v1:' + encoded).digest('base64url')}`;
};

test('prepare uses authoritative period details, stable Scholar reference and server time', async () => {
  const res = response(); await controller.prepare(request({ academicPeriodId: 10, name: 'Forged', reference: 'Forged', generatedAt: '1900-01-01' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.snapshot.name, 'SYNTHETIC TEST SCHOLAR');
  assert.equal(res.body.snapshot.course, 'Period Degree'); assert.equal(res.body.snapshot.yearLevel, '2nd Year');
  assert.equal(res.body.snapshot.school, 'Synthetic Academy'); assert.equal(res.body.snapshot.controlNumber, 'SYNTHETIC-007');
  assert.equal(res.body.snapshot.reference, 'PGCEAP-CERT#0004'); assert.equal(res.body.snapshot.academicPeriodId, 10);
  assert.equal(res.body.snapshot.schoolYear, '2026-2027'); assert.equal(res.body.generatedAt, initialTime.toISOString());
  assert.equal(res.body.existingCertification, null); assert.equal(state.rows.length, 0);
  assert.throws(() => require('jsonwebtoken').verify(res.body.generationToken, secret));
});

test('authorized staff save a PDF once; repeated saves and prepare reuse the immutable original', async () => {
  const prepared = await prepare(); let res = await save(prepared, { snapshot: { name: 'Forged' }, generatedAt: '1900-01-01' });
  assert.equal(res.statusCode, 201); assert.equal(res.body.reused, false); assert.equal(state.creates, 1);
  assert.equal(state.rows[0].file_data, dataUrl()); assert.equal(state.rows[0].snapshot.name, prepared.snapshot.name);
  assert.equal(state.rows[0].generated_at.toISOString(), prepared.generatedAt);
  assert.equal(res.locals.auditTargetId, 1); assert.match(res.locals.auditDescription, /individual Scholar certification/);
  state.time = new Date(initialTime.getTime() + 60000);
  res = await save(prepared, { fileData: 'ignored duplicate' });
  assert.equal(res.statusCode, 200); assert.equal(res.body.reused, true); assert.equal(res.locals.auditSkip, true); assert.equal(state.creates, 1);
  const reused = await prepare(); assert.equal(reused.generationToken, null); assert.equal(reused.existingCertification.id, 1); assert.equal(reused.generatedAt, prepared.generatedAt);
  for (const key of ['file_data', 'file_url', 'file_pathname', 'snapshot_hash', 'generationToken']) assert.equal(key in res.body.certification, false);
});

test('proof rejects scope changes, bad signatures, expiry, future issuance and invalid purpose', async () => {
  const context = await service.loadContext(client, 7, 10);
  const proof = service.prepareTicket(context, actor, initialTime, secret);
  const payload = service.verifyTicket(proof, actor, 7, 10, initialTime, secret);
  for (const [user, applicantId, periodId, time, suppliedSecret] of [
    [{ ...actor, id: 12 }, 7, 10, initialTime, secret], [{ ...actor, role: 'SuperAdmin' }, 7, 10, initialTime, secret],
    [actor, 8, 10, initialTime, secret], [actor, 7, 11, initialTime, secret],
    [actor, 7, 10, new Date(initialTime.getTime() + 600000), secret], [actor, 7, 10, new Date(initialTime.getTime() - 1), secret],
    [actor, 7, 10, initialTime, secret + 'wrong'],
  ]) assert.throws(() => service.verifyTicket(proof, user, applicantId, periodId, time, suppliedSecret), { statusCode: 409 });
  for (const patch of [{ purpose: 'authentication' }, { expiresAt: payload.expiresAt + 1 }, { snapshotHash: 'bad' }, { scholarId: '4' }]) {
    assert.throws(() => service.verifyTicket(signed({ ...payload, ...patch }), actor, 7, 10, initialTime, secret), { statusCode: 409 });
  }
  for (const token of [null, 'not-a-ticket', proof + '.extra', 'bad.bad', 'x'.repeat(4097)]) assert.throws(() => service.verifyTicket(token, actor, 7, 10, initialTime, secret), { statusCode: 409 });
});

test('every endpoint independently blocks anonymous, non-staff and staff without Scholars access', async () => {
  for (const user of [null, { id: 7, role: 'Scholar' }, { id: 7, role: 'Applicant' }, { ...actor, sectionAccess: [] }]) {
    for (const action of ['index', 'prepare', 'save', 'file']) {
      const res = response(); await controller[action](request({ academicPeriodId: 10 }, user, { certificationId: '1' }), res);
      assert.equal(res.statusCode, user ? 403 : 401); assert.match(res.headers['Cache-Control'], /private.*no-store/);
    }
  }
  assert.equal(state.creates, 0);
  for (const role of ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin']) {
    const res = response(); await controller.prepare(request({ academicPeriodId: 10 }, { ...actor, role }), res); assert.equal(res.statusCode, 200);
  }
});

test('generation rejects missing, Public/unclassified, invalid and pre-entry period selections', async () => {
  for (const mutation of [() => state.scholar = null, () => state.applicant = null, () => state.application = null,
    () => state.period = null, () => state.school.school_type = 'public', () => state.school.school_type = 'unclassified',
    () => state.period.school_year = '2025-2026']) {
    const backup = structuredClone(state); mutation(); const res = response(); await controller.prepare(request({ academicPeriodId: 10 }), res);
    assert.ok([404, 409].includes(res.statusCode), res.statusCode); Object.assign(state, backup);
  }
  for (const academicPeriodId of [0, -1, '1.5', 'bad', null]) { const res = response(); await controller.prepare(request({ academicPeriodId }), res); assert.equal(res.statusCode, 400); }
  state.period.is_active = false; state.period.status = 'archived'; state.scholar.is_active = false;
  assert.ok((await prepare()).generationToken); // Preserve the existing inactive-Scholar/historical-generation rule.
});

test('stale profile before save or during transaction cannot archive a mismatched PDF', async () => {
  const prepared = await prepare(); state.requirement.course = 'Changed Course';
  let res = await save(prepared); assert.equal(res.statusCode, 409); assert.equal(state.rows.length, 0);
  state.requirement.course = 'Period Degree'; state.token = 'synthetic-token';
  state.beforeTransaction = () => { state.requirement.year_level = '3rd Year'; };
  res = await save(prepared); assert.equal(res.statusCode, 409); assert.equal(state.rows.length, 0); assert.equal(state.removed.length, 1);
});

test('valid file inspection rejects corrupt, renamed, empty, malformed and oversized PDFs before any mutation', async () => {
  controller = makeController({ validateDocumentUpload: require('../services/documentFilePolicy').validateDocumentUpload });
  const prepared = await prepare();
  const invalid = [dataUrl(png, 'image/png'), dataUrl(Buffer.from('%PDF-1.4\ninvalid\n%%EOF')), dataUrl(Buffer.alloc(0)), 'data:application/pdf;base64,broken', dataUrl(Buffer.alloc(6 * 1024 * 1024 + 1))];
  for (const fileData of invalid) { const res = await save(prepared, { fileData }); assert.ok([400, 413].includes(res.statusCode)); assert.equal(state.rows.length, 0); }
  const res = await save(prepared); assert.equal(res.statusCode, 201); assert.equal(state.rows.length, 1);
});

test('history and downloaded bytes remain unchanged after school, course and selected-period changes', async () => {
  const prepared = await prepare(); await save(prepared); const original = structuredClone(state.rows[0]);
  state.school.school_type = 'public'; state.school.name = 'Changed School'; state.requirement.course = 'Changed Course'; state.period.school_year = '2027-2028';
  let res = response(); await controller.index(request(), res); assert.equal(res.statusCode, 200); assert.equal(res.body.certifications.length, 1);
  assert.deepEqual(res.body.certifications[0].snapshot, prepared.snapshot);
  res = response(); await controller.file(request({}, actor, { certificationId: '1' }), res);
  assert.deepEqual(res.body, pdf); assert.equal(res.headers['Content-Type'], 'application/pdf'); assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(res.headers['Content-Disposition'], /PGCEAP-CERT#0004\.pdf/); assert.deepEqual(state.rows[0], original);
  res = response(); await controller.file(request({}, actor, { applicantId: '8', certificationId: '1' }), res); assert.equal(res.statusCode, 404);
});

test('new legitimate snapshots produce separate history records without overwriting earlier PDFs', async () => {
  await save(await prepare()); state.requirement.year_level = '3rd Year'; state.time = new Date(initialTime.getTime() + 60000);
  await save(await prepare()); assert.equal(state.rows.length, 2); assert.equal(state.rows[0].snapshot.yearLevel, '2nd Year'); assert.equal(state.rows[1].snapshot.yearLevel, '3rd Year');
  const res = response(); await controller.index(request(), res); assert.deepEqual(res.body.certifications.map(row => row.id), [2, 1]);
});

test('private Blob is retained on success and cleaned up on transaction errors or concurrent duplicates', async () => {
  state.token = 'synthetic-token'; const prepared = await prepare(); let res = await save(prepared);
  assert.equal(res.statusCode, 201); assert.equal(state.uploaded[0].access, 'private'); assert.equal(state.rows[0].file_data, null);
  assert.equal(state.rows[0].storage, 'vercel-blob-private'); assert.equal(state.removed.length, 0);
  state.rows = []; state.uniqueConflict = true; res = await save(prepared);
  assert.equal(res.statusCode, 200); assert.equal(res.body.reused, true); assert.equal(res.locals.auditSkip, true); assert.equal(state.rows.length, 1); assert.equal(state.removed.length, 1);
  state.rows = []; state.uniqueConflict = false; state.beforeTransaction = () => { throw Object.assign(new Error('Concurrent update'), { code: 'P2034' }); };
  res = await save(prepared); assert.equal(res.statusCode, 409); assert.equal(state.rows.length, 0); assert.equal(state.removed.length, 2);
});

test('a transaction that finds an existing snapshot reuses it and cleans up the unused upload', async () => {
  const prepared = await prepare(); await save(prepared); const original = state.rows[0]; state.rows = [];
  state.token = 'synthetic-token'; state.beforeTransaction = () => state.rows.push(original);
  const res = await save(prepared); assert.equal(res.statusCode, 200); assert.equal(res.locals.auditSkip, true); assert.equal(state.creates, 1); assert.equal(state.removed.length, 1);
});

test('remote download streams privately and handles a storage stream failure without an unhandled error', async () => {
  state.token = 'synthetic-token'; await save(await prepare());
  const chunks = [];
  const sink = () => {
    const res = new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); } });
    res.headers = {}; res.locals = {}; res.statusCode = 200;
    res.setHeader = (key, value) => { res.headers[key] = value; }; res.status = code => { res.statusCode = code; return res; };
    res.json = body => { res.body = body; return res; }; return res;
  };
  controller = makeController({ blobGet: async (url, options) => { assert.equal(url, state.rows[0].file_url); assert.equal(options.access, 'private'); assert.equal(options.token, state.token); return { stream: new ReadableStream({ start(out) { out.enqueue(pdf); out.close(); } }) }; } });
  let res = sink(); await controller.file(request({}, actor, { certificationId: '1' }), res); assert.deepEqual(Buffer.concat(chunks), pdf); assert.equal(res.headers['Cache-Control'], 'private, no-store');
  controller = makeController({ blobGet: async () => ({ stream: new ReadableStream({ start(out) { out.error(new Error('Synthetic storage failure')); } }) }) });
  res = sink(); await controller.file(request({}, actor, { certificationId: '1' }), res); assert.equal(res.statusCode, 500); assert.equal(res.destroyed, true);
});

test('missing schema and signing/storage configuration fail safely without generating records', async () => {
  const prepared = await prepare(); controller = makeController({ getSecret: () => '' });
  let res = await save(prepared); assert.equal(res.statusCode, 503); assert.equal(state.rows.length, 0);
  controller = makeController({ prisma: { ...client, scholar_certifications: undefined } });
  res = response(); await controller.index(request(), res); assert.equal(res.statusCode, 503);
  controller = makeController(); const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'production';
  try { res = await save(prepared); assert.equal(res.statusCode, 503); assert.equal(state.rows.length, 0); }
  finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
  state.token = 'synthetic-token'; controller = makeController({ uploadDataUrl: async () => { throw new Error('Synthetic upload failure'); } });
  res = await save(prepared); assert.equal(res.statusCode, 500); assert.equal(state.rows.length, 0);
});
