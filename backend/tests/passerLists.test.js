const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const controller = require('../controllers/passerListController');
let db;
const stamp = '2026-10-16T00:00:00.000Z';
const member = (id = 1) => ({ applicantId: id, applicationId: id, examId: 3, resultId: id, updatedAt: stamp });
const request = (overrides = {}) => ({ user: { id: 9 }, body: { academicPeriodId: 10, requestKey: '11111111-1111-4111-8111-111111111111', title: 'TEST Passers', status: 'draft', members: [member()], ...overrides } });
const response = () => ({ locals: {}, statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const requestKey = (id) => `${String(id).padStart(8, '0')}-2222-4222-8222-222222222222`;
const currentMember = (id = 1) => ({ ...member(id), updatedAt: db.results.find(result => result.id === id).updated_at });
const createList = async (overrides = {}) => { const res = response(); await controller.create(request(overrides), res); assert.equal(res.statusCode, 201, res.body?.message); return res.body.list; };
const enrich = (list) => list && ({ ...list, members: db.members.filter((m) => m.list_id === list.id), revisions: db.lists.filter((l) => l.supersedes_id === list.id) });
beforeEach(() => {
 db = { lists: [], members: [], results: [1,2].map((id) => ({ id, applicant_id:id, exam_id:3, exam_slot_id:id, score:18, passing_score:14, passed:true, published_at:null, updated_at:stamp })) };
 Object.assign(prisma, {
  intake_settings: { findUnique: async()=>({id:1,academic_period_id:10,revision:1}) },
  academic_periods: { findFirst: async()=>({id:99,school_year:'2025-2026',is_primary:true}), findUnique: async({where})=>where.id===10?{id:10,school_year:'2026-2027',is_primary:false,is_active:false}:null },
  $queryRaw: async()=>[{id:1}],
  applicants: { findUnique:async({where})=>({id:where.id,first_name:'TEST',last_name:String(where.id),municipality:'Daet',school_year:'2026-2027'}) },
  exams: { findUnique:async()=>({id:3,academic_year:'2026-2027'}),findFirst:async()=>({id:3}) },
  exam_slots:{findUnique:async({where})=>({id:where.applicant_id_exam_id.applicant_id})},
  application_submissions:{findFirst:async({where})=>({id:where.applicant_id,status:'Examined'})},
  scholar_accounts:{findFirst:async()=>null},
  results:{findFirst:async({where})=>db.results.find((r)=>r.id===where.id&&r.applicant_id===where.applicant_id&&(!where.exam_id||r.exam_id===where.exam_id)),updateMany:async({where,data})=>{const result=db.results.find(r=>r.id===where.id&&+new Date(r.updated_at)===+new Date(where.updated_at));if(!result)return{count:0};Object.assign(result,data);return{count:1};}},
  passer_lists:{findUnique:async({where})=>enrich(db.lists.find(l=>where.id?l.id===where.id:l.request_key===where.request_key)),findMany:async()=>db.lists.map(enrich),create:async({data})=>{const list={...data,id:db.lists.length+1,status:'draft'};delete list.members;db.lists.push(list);for(const m of data.members.create)db.members.push({...m,id:db.members.length+1,list_id:list.id});return enrich(list);},update:async({where,data})=>{const list=db.lists.find(l=>l.id===where.id);Object.assign(list,data);return enrich(list);}},
  passer_list_members:{findMany:async({where})=>db.members.filter(member=>{
    const list=db.lists.find(list=>list.id===member.list_id);
    return member.academic_period_id===where.academic_period_id
      && (!where.applicant_id || where.applicant_id.in.includes(member.applicant_id))
      && list?.status==='posted'
      && !db.lists.some(revision=>revision.supersedes_id===list.id&&revision.status==='posted');
  }),update:async({where,data})=>Object.assign(db.members.find(m=>m.id===where.id),data)},
  $transaction:async(callback,options)=>{assert.equal(options.isolationLevel,'Serializable');const before=structuredClone(db);try{return await callback(prisma);}catch(error){db=before;throw error;}},
 });
});
test('saving a draft retains source IDs and score snapshots without publishing or creating a Scholar',async()=>{
 const res=response();await controller.create(request(),res);assert.equal(res.statusCode,201);assert.equal(res.body.list.status,'draft');assert.equal(db.results[0].published_at,null);assert.equal(db.members[0].application_id,1);assert.equal(db.members[0].result_id,1);assert.equal(db.members[0].snapshot.score,18);
});
test('Post now publishes and locks in one transaction; retries reuse the same retained list',async()=>{
 const req=request({status:'posted'});let res=response();await controller.create(req,res);assert.equal(res.statusCode,201);assert.equal(db.lists[0].status,'posted');assert.ok(db.results[0].published_at);assert.equal(+new Date(db.members[0].snapshot.resultUpdatedAt),+new Date(db.results[0].updated_at));assert.equal(db.lists[0].posted_by,9);
 res=response();await controller.create(req,res);assert.equal(res.statusCode,201);assert.equal(db.lists.length,1);assert.equal(db.members.length,1);
});
test('stale, failed, wrong-exam, duplicate and unavailable selections cannot create a retained list',async()=>{
 for(const delta of [{members:[{...member(),updatedAt:'2026-10-15'}]},{members:[{...member(),examId:5}]},{members:[member(),member()]}]){const res=response();await controller.create(request(delta),res);assert.ok([400,409].includes(res.statusCode));assert.equal(db.lists.length,0);}
 db.results[0].passed=false;const res=response();await controller.create(request(),res);assert.equal(res.statusCode,409);assert.equal(db.lists.length,0);
});
test('saved drafts revalidate scores at posting and failed posting leaves results unpublished',async()=>{
 let res=response();await controller.create(request({members:[member(1),member(2)]}),res);assert.equal(res.statusCode,201);
 db.results[1].updated_at='2026-10-17';res=response();await controller.post({params:{id:'1'},user:{id:9}},res);assert.equal(res.statusCode,409);assert.equal(db.lists[0].status,'draft');assert.equal(db.results[0].published_at,null);
});
test('posted lists can only be superseded by a reasoned revision; drafts do not revoke an original',async()=>{
 let res=response();await controller.create(request({status:'posted'}),res);assert.equal(res.statusCode,201);
 const current={...member(),updatedAt:db.results[0].updated_at};res=response();await controller.create(request({requestKey:'22222222-2222-4222-8222-222222222222',supersedesId:1,revisionReason:'',members:[current]}),res);assert.equal(res.statusCode,400);
 res=response();await controller.create(request({requestKey:'22222222-2222-4222-8222-222222222222',status:'posted',supersedesId:1,revisionReason:'Corrected membership',members:[current]}),res);assert.equal(res.statusCode,201);assert.equal(db.lists.length,2);assert.equal(db.lists[0].status,'posted');assert.equal(db.lists[1].supersedes_id,1);
});

test('Passer Lists use the independent intake without reading or changing processing primary', async()=>{
 prisma.academic_periods.findFirst=async()=>{throw new Error('Processing primary must not be used for intake');};
 const res=response(); await controller.create(request(),res);
 assert.equal(res.statusCode,201); assert.equal(db.lists[0].academic_period_id,10);
});

test('stale intake periods and historical applicant years cannot create a new Passer List',async()=>{
 let res=response();await controller.create(request({academicPeriodId:99}),res);assert.equal(res.statusCode,409);assert.equal(db.lists.length,0);
 prisma.applicants.findUnique=async({where})=>({id:where.id,first_name:'TEST',municipality:'Daet',school_year:'2025-2026'});
 res=response();await controller.create(request(),res);assert.equal(res.statusCode,409);assert.equal(db.lists.length,0);
});

test('a switch before the intake lock cannot create or publish the old draft',async()=>{
 prisma.$queryRaw=async()=>{prisma.intake_settings.findUnique=async()=>({id:1,academic_period_id:11});return[{id:1}];};
 const find=prisma.academic_periods.findUnique;
 prisma.academic_periods.findUnique=async(payload)=>payload.where.id===11?{id:11,school_year:'2027-2028'}:find(payload);
 const res=response();await controller.create(request({status:'posted'}),res);
 assert.equal(res.statusCode,409);assert.equal(db.lists.length,0);assert.equal(db.results[0].published_at,null);
});

test('Passer List history includes all configured semesters while the default stays in exact intake',async()=>{
 const periods=[{id:10,school_year:'2026-2027'},{id:11,school_year:'2026-2027'},{id:99,school_year:'2025-2026'}];
 prisma.academic_periods.findMany=async({where})=>periods.filter(period=>!where.school_year||period.school_year===where.school_year);
 db.lists=periods.map(period=>({id:period.id,academic_period_id:period.id,status:'posted'}));
 db.members=[{id:1,list_id:99,application_id:1,result_id:1,applicant_id:1}];
 prisma.passer_lists.findMany=async({where,include})=>{assert.equal(include.members,true);return db.lists.filter(list=>where.academic_period_id.in.includes(list.academic_period_id)).map(enrich);};
 let res=response();await controller.index({query:{}},res);assert.deepEqual(res.body.lists.map(list=>list.id),[10]);
 res=response();await controller.index({query:{schoolYear:'2026-2027'}},res);assert.deepEqual(res.body.lists.map(list=>list.id),[10,11]);
 res=response();await controller.index({query:{schoolYear:'2025-2026'}},res);assert.equal(res.body.lists[0].members[0].result_id,1);
 res=response();await controller.index({query:{schoolYear:'all'}},res);assert.equal(res.body.lists.length,3);
 res=response();await controller.index({query:{schoolYear:'2026-2028'}},res);assert.equal(res.statusCode,400);
 assert.equal(db.lists.length,3);assert.equal(db.results[0].published_at,null);
});

test('a posted passer cannot create another new draft or posted list with a fresh request key', async () => {
 await createList({ status: 'posted' });
 const before = structuredClone(db);
 for (const [id, status] of [[2, 'draft'], [3, 'posted']]) {
  const res = response(); await controller.create(request({ requestKey: requestKey(id), status, members: [currentMember()] }), res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /already belongs to another posted Passer List/);
  assert.deepEqual(db, before);
 }
});

test('unposted drafts do not reserve a passer but posting another list blocks the saved draft', async () => {
 db.results[0].published_at = stamp;
 await createList();
 await createList({ requestKey: requestKey(2) });
 let res = response(); await controller.post({ params: { id: '1' }, user: { id: 9 } }, res);
 assert.equal(res.statusCode, 200);
 const before = structuredClone(db);
 res = response(); await controller.post({ params: { id: '2' }, user: { id: 9 } }, res);
 assert.equal(res.statusCode, 409);
 assert.match(res.body.message, /already belongs to another posted Passer List/);
 assert.deepEqual(db, before);
 assert.equal(db.lists[1].status, 'draft');
});

test('membership posted after draft validation is rechecked before publishing the saved draft', async () => {
 await createList();
 db.lists.push({ id: 2, academic_period_id: 10, status: 'posted' });
 db.members.push({ id: 2, list_id: 2, applicant_id: 1, academic_period_id: 10 });
 const before = structuredClone(db);
 const res = response(); await controller.post({ params: { id: '1' }, user: { id: 9 } }, res);
 assert.equal(res.statusCode, 409);
 assert.deepEqual(db, before);
 assert.equal(db.results[0].published_at, null);
});

test('already-posted and request-key retries preserve the same list without consulting availability again', async () => {
 const originalRequest = request({ status: 'posted' });
 let res = response(); await controller.create(originalRequest, res); assert.equal(res.statusCode, 201);
 const before = structuredClone(db);
 prisma.passer_list_members.findMany = async () => { throw new Error('Idempotent posted responses must not re-run ownership checks'); };
 res = response(); await controller.create(originalRequest, res); assert.equal(res.statusCode, 201);
 res = response(); await controller.post({ params: { id: '1' }, user: { id: 9 } }, res); assert.equal(res.statusCode, 200);
 assert.equal(res.body.list.id, 1);
 assert.deepEqual(db, before);
});

test('a reasoned revision retains its own passers and can add an unlisted passer', async () => {
 await createList({ status: 'posted' });
 const revision = await createList({ requestKey: requestKey(2), status: 'posted', supersedesId: 1, revisionReason: 'Added another qualified passer', members: [currentMember(1), currentMember(2)] });
 assert.equal(revision.supersedes_id, 1);
 assert.deepEqual(revision.members.map(member => member.applicant_id), [1, 2]);
 const res = response(); await controller.index({ query: {} }, res);
 assert.deepEqual(res.body.postedMemberships, [{ listId: 2, applicantId: 1 }, { listId: 2, applicantId: 2 }]);
 assert.equal(db.lists[0].status, 'posted');
});

test('a revision cannot take a passer from an unrelated active posted list', async () => {
 await createList({ status: 'posted' });
 await createList({ requestKey: requestKey(2), status: 'posted', members: [currentMember(2)] });
 const before = structuredClone(db);
 const res = response(); await controller.create(request({ requestKey: requestKey(3), status: 'posted', supersedesId: 1, revisionReason: 'Correct membership', members: [currentMember(1), currentMember(2)] }), res);
 assert.equal(res.statusCode, 409);
 assert.match(res.body.message, /already belongs to another posted Passer List/);
 assert.deepEqual(db, before);
});

test('a saved revision draft rechecks unrelated ownership when it is posted', async () => {
 await createList({ status: 'posted' });
 await createList({ requestKey: requestKey(2), supersedesId: 1, revisionReason: 'Add another passer', members: [currentMember(1), currentMember(2)] });
 await createList({ requestKey: requestKey(3), status: 'posted', members: [currentMember(2)] });
 const before = structuredClone(db);
 const res = response(); await controller.post({ params: { id: '2' }, user: { id: 9 } }, res);
 assert.equal(res.statusCode, 409);
 assert.deepEqual(db, before);
 assert.equal(db.lists[1].status, 'draft');
});

test('a draft revision keeps original ownership until posting and removed passers become available afterwards', async () => {
 await createList({ status: 'posted', members: [member(1), member(2)] });
 await createList({ requestKey: requestKey(2), supersedesId: 1, revisionReason: 'Retain only the second passer', members: [currentMember(2)] });
 let res = response(); await controller.index({ query: {} }, res);
 assert.deepEqual(res.body.postedMemberships, [{ listId: 1, applicantId: 1 }, { listId: 1, applicantId: 2 }]);
 res = response(); await controller.post({ params: { id: '2' }, user: { id: 9 } }, res); assert.equal(res.statusCode, 200);
 res = response(); await controller.index({ query: {} }, res);
 assert.deepEqual(res.body.postedMemberships, [{ listId: 2, applicantId: 2 }]);
 await createList({ requestKey: requestKey(3), status: 'posted', members: [currentMember(1)] });
 assert.equal(db.lists.length, 3);
 assert.deepEqual(db.members.filter(member => member.list_id === 1).map(member => member.applicant_id), [1, 2]);
});

test('a missing, wrong-period or already-revised source cannot create a new revision draft', async () => {
 await createList({ status: 'posted' });
 for (const source of [99, 2, 3]) {
  db.lists = db.lists.filter(list => list.id === 1);
  db.lists.push({ id: 2, academic_period_id: 11, status: 'posted' }, { id: 3, academic_period_id: 10, status: 'posted' }, { id: 4, academic_period_id: 10, status: 'posted', supersedes_id: 3 });
  const before = structuredClone(db);
  const res = response(); await controller.create(request({ requestKey: requestKey(5), supersedesId: source, revisionReason: 'A correction', members: [currentMember(2)] }), res);
  assert.equal(res.statusCode, 409);
  assert.deepEqual(db, before);
 }
});

test('other semesters and historical years do not reserve current-intake passers', async () => {
 db.lists = [{ id: 1, academic_period_id: 11, status: 'posted' }, { id: 2, academic_period_id: 99, status: 'posted' }];
 db.members = [{ id: 1, list_id: 1, applicant_id: 1, academic_period_id: 11 }, { id: 2, list_id: 2, applicant_id: 1, academic_period_id: 99 }];
 const res = response(); await controller.index({ query: {} }, res);
 assert.deepEqual(res.body.postingScope, { academicPeriodId: 10 });
 assert.deepEqual(res.body.postedMemberships, []);
 await createList({ status: 'posted' });
 assert.equal(db.lists.at(-1).academic_period_id, 10);
 assert.equal(db.members.filter(member => member.academic_period_id === 10).length, 1);
});

test('complete current-intake ownership is returned separately from the latest 100 retained lists', async () => {
 db.lists = Array.from({ length: 105 }, (_, index) => ({ id: index + 1, academic_period_id: 10, status: 'posted' }));
 db.lists.push({ id: 106, academic_period_id: 11, status: 'posted' }, { id: 107, academic_period_id: 99, status: 'posted' });
 db.members = db.lists.map(list => ({ id: list.id, list_id: list.id, academic_period_id: list.academic_period_id, applicant_id: list.id }));
 prisma.passer_lists.findMany = async ({ where, take }) => { assert.equal(take, 100); return db.lists.filter(list => where.academic_period_id.in.includes(list.academic_period_id)).sort((left, right) => right.id - left.id).slice(0, take).map(enrich); };
 prisma.academic_periods.findMany = async () => [{ id: 10 }, { id: 11 }, { id: 99 }];
 for (const query of [{}, { schoolYear: 'all' }]) {
  const res = response(); await controller.index({ query }, res);
  assert.equal(res.body.lists.length, 100);
  assert.deepEqual(res.body.postingScope, { academicPeriodId: 10 });
  assert.equal(res.body.postedMemberships.length, 105);
  assert.ok(res.body.postedMemberships.some(member => member.listId === 1 && member.applicantId === 1));
  assert.ok(res.body.postedMemberships.every(member => member.listId <= 105));
 }
});

test('no current intake returns a truthful empty ownership scope without querying membership', async () => {
 prisma.intake_settings.findUnique = async () => ({ id: 1, academic_period_id: null });
 prisma.passer_list_members.findMany = async () => { throw new Error('No period should not query posted membership'); };
 const res = response(); await controller.index({ query: {} }, res);
 assert.equal(res.statusCode, 200);
 assert.deepEqual(res.body.postingScope, { academicPeriodId: null });
 assert.deepEqual(res.body.postedMemberships, []);
 assert.deepEqual(res.body.lists, []);
});

test('serializable conflicts at commit return 409 and roll back a proposed post without partial publication', async () => {
 const run = prisma.$transaction;
 prisma.$transaction = async (callback, options) => run(async tx => { await callback(tx); throw Object.assign(new Error('Serialization conflict'), { code: 'P2034' }); }, options);
 const before = structuredClone(db);
 const res = response(); await controller.create(request({ status: 'posted' }), res);
 assert.equal(res.statusCode, 409);
 assert.deepEqual(db, before);
 assert.equal(db.results[0].published_at, null);
});
