const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express'), jwt = require('jsonwebtoken');
process.env.JWT_SECRET = require('node:crypto').randomBytes(32).toString('hex');
const prisma = {}, mail = [];
let state, writes, transactionEvents, failEmail;
for (const [path, exports] of [['../config/prisma', prisma], ['../services/mailer', { sendScholarApprovedEmail: async message => { mail.push(message); assert.equal(transactionEvents.at(-1), 'commit'); if (failEmail) throw new Error('Synthetic mail failure'); return { sent: true }; } }]]) {
  const id = require.resolve(path); require.cache[id] = { id, filename: id, loaded: true, exports };
}
const { add, acceptBatch } = require('../controllers/potentialScholarController');
const { loadScholarReview } = require('../services/scholarAcceptance');
const { reviewFingerprint } = require('../services/potentialReview');
const period = { id: 10, school_year: '2027-2028', semester: '1st Semester' };
const response = () => ({ locals: {}, statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const actor = { id: 99, role: 'SuperAdmin' };
const setup = () => {
  mail.length = 0; failEmail = false; writes = []; transactionEvents = [];
  state = { applicants: [], applications: [], results: [], scholars: [], assessments: [], requirements: [] };
  for (const id of [1,2,3]) {
    state.applicants.push({ id, first_name: `Synthetic${id}`, email: `synthetic${id}@example.com`, municipality: 'Test place', school_year: period.school_year, school_id: 5 });
    state.applications.push({ id: 10+id, applicant_id: id, status: 'Applied', family: {}, eligibility: {}, school_plan: { incomingYearLevel: '2nd Year' }, initial_docs: { retainedMetadata: 'preserve', requirements: Object.fromEntries(['tax_exemption','valid_id','grades','registration_form'].map(key => [key, { fileName: 'synthetic.pdf', status: 'Approved' }])) } });
    state.results.push({ id: 20+id, applicant_id: id, exam_id: 40, exam_slot_id: 50+id, score: 16, passing_score: 14, passed: true, published_at: '2026-10-19T00:00:00Z', updated_at: '2026-10-19T00:00:00Z' });
  }
  prisma.academic_periods = { findFirst: async () => period };
  prisma.applicants = { findFirst: async ({ where }) => state.applicants.find(row => row.id === where.id), findUnique: async ({ where }) => state.applicants.find(row => row.id === where.id) };
  prisma.application_submissions = {
    findFirst: async ({ where }) => state.applications.find(row => row.applicant_id === where.applicant_id),
    updateMany: async ({ where, data }) => { const row=state.applications.find(row=>row.id===where.id); if (!row || JSON.stringify(row.initial_docs)!==JSON.stringify(where.initial_docs.equals)) return {count:0}; Object.assign(row,data); writes.push('application'); return {count:1}; },
  };
  prisma.results = { findFirst: async ({ where }) => state.results.find(row => row.id === where.id && row.applicant_id === where.applicant_id && (!where.exam_id || row.exam_id === where.exam_id)) };
  const exam = { id: 40, academic_year: period.school_year, municipality: 'Test place' };
  prisma.exams = { findUnique: async () => exam, findFirst: async () => exam };
  prisma.exam_slots = { findUnique: async ({ where }) => ({ id: 50+where.applicant_id_exam_id.applicant_id, applicant_id: where.applicant_id_exam_id.applicant_id, exam_id:40 }) };
  prisma.scholar_accounts = {
    findFirst: async ({ where }) => state.scholars.find(row => row.applicant_id===where.applicant_id),
    create: async ({ data }) => { if(state.scholars.some(row=>row.applicant_id===data.applicant_id)) throw Object.assign(new Error('unique'),{code:'P2002'}); const row={id:state.scholars.length+1,...data}; state.scholars.push(row);writes.push('scholar');return row; },
  };
  prisma.passer_list_members = { findMany: async ({ where }) => { const id=where.applicant_id;return [{application_id:10+id,result_id:20+id,snapshot:{resultUpdatedAt:state.results.find(row=>row.applicant_id===id)?.updated_at}}]; } };
  prisma.schools = { findMany: async () => [{ id:5, name:'Synthetic College', school_type:'Public' }] };
  prisma.scholar_requirements = { findMany: async () => [], upsert: async ({create}) => {state.requirements.push(create);writes.push('requirements');return create;} };
  prisma.eligibility_assessments = { create: async ({data}) => { state.assessments.push(data);writes.push('assessment');return data;} };
  let pending=Promise.resolve();
  prisma.$transaction = (fn,options) => {
    const run=pending.then(async()=>{assert.equal(options.isolationLevel,'Serializable');const before=structuredClone(state), count=writes.length;transactionEvents.push('begin');try{const result=await fn(prisma);transactionEvents.push('commit');return result;}catch(error){state=before;writes.length=count;transactionEvents.push('rollback');throw error;}});pending=run.catch(()=>{});return run;
  };
};
const review = id => ({examId:40,resultId:20+id,applicationId:10+id,academicPeriodId:10,updatedAt:'2026-10-19T00:00:00Z'});
const addOne = async (id, body) => { const res=response(); await add({params:{applicantId:String(id)},body:body||{...review(id),reviewToken:reviewFingerprint(await loadScholarReview(prisma,id,review(id)))},user:actor},res);return res; };
const selection = ids => ({academicPeriodId:10,selected:ids.map(id=>({applicantId:id,reviewId:state.applications.find(row=>row.applicant_id===id).initial_docs.potentialScholarReviews[10].reviewId}))});
const accept = async body => {const res=response();await acceptBatch({body,user:actor},res);return res;};
test('explicit add persists a checked review without activation or email and is idempotent',async()=>{
  setup();const res=await addOne(1);assert.equal(res.statusCode,201);assert.equal(state.scholars.length,0);assert.equal(mail.length,0);
  const docs=state.applications[0].initial_docs;assert.equal(docs.retainedMetadata,'preserve');assert.equal(docs.potentialScholarReviews[10].addedBy,99);
  const repeated=await addOne(1);assert.equal(repeated.body.potentialReview.reviewId,res.body.potentialReview.reviewId);assert.equal(writes.length,1);
});
test('add rejects unchecked/missing/stale input or requirements changed after the Results view',async()=>{
  setup();assert.equal((await addOne(1,{})).statusCode,400);
  const body={...review(1),reviewToken:reviewFingerprint(await loadScholarReview(prisma,1,review(1)))};
  state.applications[0].initial_docs.requirements.valid_id.fileName='replacement.pdf';
  assert.equal((await addOne(1,body)).statusCode,409);assert.equal(writes.length,0);
  state.applications[0].initial_docs.requirements.valid_id.status='Rejected';assert.equal((await addOne(1,body)).statusCode,400);
});
test('batch accepts only specifically selected checked candidates, consumes reviews and emails after commit',async()=>{
  setup();for(const id of [1,2,3])await addOne(id);mail.length=0;const res=await accept(selection([1,3]));
  assert.equal(res.statusCode,201);assert.deepEqual(res.body.acceptedIds,[1,3]);assert.deepEqual(state.scholars.map(row=>row.applicant_id),[1,3]);assert.equal(state.assessments.length,2);assert.equal(mail.length,2);
  assert.equal(state.applications[0].initial_docs.potentialScholarReviews[10].status,'accepted');assert.equal(state.applications[1].initial_docs.potentialScholarReviews[10].status,'potential');
});
test('one changed selected review rolls back the entire batch with no activation, assessments or emails',async()=>{
  setup();await addOne(1);await addOne(3);const body=selection([1,3]),before=writes.length;
  state.applications[2].initial_docs.requirements.grades.fileName='changed.pdf';
  const res=await accept(body);assert.equal(res.statusCode,409);assert.equal(state.scholars.length,0);assert.equal(state.assessments.length,0);assert.equal(state.requirements.length,0);assert.equal(mail.length,0);assert.equal(writes.length,before);
  assert.equal(state.applications[0].initial_docs.potentialScholarReviews[10].status,'potential');
});
test('unmarked records, duplicate IDs, overlong batches and stale periods cannot be batch accepted',async()=>{
  setup();await addOne(1);const valid=selection([1]);
  for(const body of [{...valid,academicPeriodId:999},{...valid,selected:[{applicantId:2,reviewId:valid.selected[0].reviewId}]},{...valid,selected:[valid.selected[0],valid.selected[0]]},{...valid,selected:Array.from({length:51},(_,i)=>({applicantId:i+1,reviewId:valid.selected[0].reviewId}))}])assert.ok((await accept(body)).statusCode>=400);
  assert.equal(state.scholars.length,0);assert.equal(mail.length,0);
});
test('concurrent/retried batch requests cannot accept or email the same applicant twice',async()=>{
  setup();await addOne(1);const body=selection([1]);const results=await Promise.all([accept(body),accept(body)]);
  assert.deepEqual(results.map(row=>row.statusCode).sort(),[201,409]);assert.equal(state.scholars.length,1);assert.equal(mail.length,1);
});
test('email failure does not roll back the committed selected batch or permit duplicate acceptance',async()=>{
  setup();await addOne(1);failEmail=true;const res=await accept(selection([1]));assert.equal(res.statusCode,201);assert.equal(state.scholars.length,1);assert.equal(res.body.notification.emailsNotSent,1);
});
let server,base;
test.before(async()=>{const app=express();app.use(express.json());app.use(require('../routes/applicationRoutes'));await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}`;});
test.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
test('real routes keep checking permissions separate from final approval and validate server-side selection',async()=>{
  setup();prisma.admins={findUnique:async({where})=>({id:where.id,is_active:true,auth_version:0,is_super_admin:where.id===1,role:where.id===3?'admin':'billing',section_access:where.id===4?['applicants']:['applicants','examination']})};
  const headers=id=>({'Content-Type':'application/json',Authorization:`Bearer ${jwt.sign({userId:id,accountType:'admin',authVersion:0},process.env.JWT_SECRET)}`});
  for(const [id,status] of [[3,403],[4,403],[2,400],[1,400]]){const res=await fetch(base+'/potential-scholars/accept-batch',{method:'POST',headers:headers(id),body:'{}'});assert.equal(res.status,status);}
  const body={...review(1),reviewToken:reviewFingerprint(await loadScholarReview(prisma,1,review(1)))};
  const res=await fetch(base+'/potential-scholars/1',{method:'POST',headers:headers(3),body:JSON.stringify(body)});assert.equal(res.status,201);assert.equal(state.scholars.length,0);
});
