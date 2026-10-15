const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prisma = {};
const prismaPath = require.resolve('../config/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };
const controller = require('../controllers/passerListController');
let db;
const stamp = '2026-10-16T00:00:00.000Z';
const member = (id = 1) => ({ applicantId: id, applicationId: id, examId: 3, resultId: id, updatedAt: stamp });
const request = (overrides = {}) => ({ user: { id: 9 }, body: { requestKey: '11111111-1111-4111-8111-111111111111', title: 'TEST Passers', status: 'draft', members: [member()], ...overrides } });
const response = () => ({ locals: {}, statusCode: 200, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const enrich = (list) => list && ({ ...list, members: db.members.filter((m) => m.list_id === list.id), revisions: db.lists.filter((l) => l.supersedes_id === list.id) });
beforeEach(() => {
 db = { lists: [], members: [], results: [1,2].map((id) => ({ id, applicant_id:id, exam_id:3, exam_slot_id:id, score:18, passing_score:14, passed:true, published_at:null, updated_at:stamp })) };
 Object.assign(prisma, {
  academic_periods: { findFirst: async()=>({id:10,school_year:'2026-2027',is_primary:true}) },
  applicants: { findUnique:async({where})=>({id:where.id,first_name:'TEST',last_name:String(where.id),municipality:'Daet'}) },
  exams: { findUnique:async()=>({id:3,academic_year:'2026-2027'}),findFirst:async()=>({id:3}) },
  exam_slots:{findUnique:async({where})=>({id:where.applicant_id_exam_id.applicant_id})},
  application_submissions:{findFirst:async({where})=>({id:where.applicant_id,status:'Examined'})},
  scholar_accounts:{findFirst:async()=>null},
  results:{findFirst:async({where})=>db.results.find((r)=>r.id===where.id&&r.applicant_id===where.applicant_id&&(!where.exam_id||r.exam_id===where.exam_id)),updateMany:async({where,data})=>{const result=db.results.find(r=>r.id===where.id&&+new Date(r.updated_at)===+new Date(where.updated_at));if(!result)return{count:0};Object.assign(result,data);return{count:1};}},
  passer_lists:{findUnique:async({where})=>enrich(db.lists.find(l=>where.id?l.id===where.id:l.request_key===where.request_key)),findMany:async()=>db.lists.map(enrich),create:async({data})=>{const list={...data,id:db.lists.length+1,status:'draft'};delete list.members;db.lists.push(list);for(const m of data.members.create)db.members.push({...m,id:db.members.length+1,list_id:list.id});return enrich(list);},update:async({where,data})=>{const list=db.lists.find(l=>l.id===where.id);Object.assign(list,data);return enrich(list);}},
  passer_list_members:{update:async({where,data})=>Object.assign(db.members.find(m=>m.id===where.id),data)},
  $transaction:async(callback)=>{const before=structuredClone(db);try{return await callback(prisma);}catch(error){db=before;throw error;}},
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
