const {test,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const prisma={};const prismaPath=require.resolve('../config/prisma');require.cache[prismaPath]={id:prismaPath,filename:prismaPath,loaded:true,exports:prisma};
const {save}=require('../controllers/grantPreparationController');
const {validateTuitionAssistance,grantBreakdown,preparationBlocker,snapshotPrivateGrants}=require('../services/grantPreparation');
let row,listed,type,active,events;
const response=()=>({locals:{},statusCode:200,set(){return this;},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
const request=(value,extra={})=>({params:{applicantId:'7'},body:{academicPeriodId:10,tuitionFeeAssistance:value,preparedAt:row?.grant_prepared_at?new Date(row.grant_prepared_at).toISOString():null,...extra},user:{id:9,role:'SuperAdmin'}});
beforeEach(()=>{
 row=null;listed=false;type='private';active=true;events=[];
 const period={id:10,is_active:true,school_year:'2026-2027',semester:'1st Semester'};
 Object.assign(prisma,{
 academic_periods:{findFirst:async()=>active?period:null},scholar_accounts:{findFirst:async()=>({id:1,is_active:true})},applicants:{findUnique:async()=>({id:7,school_id:1})},application_submissions:{findFirst:async()=>({id:1,initial_docs:{initialRequirementPeriodId:10}})},schools:{findMany:async()=>[{id:1,school_type:type}]},
 scholar_requirements:{findUnique:async()=>row,findMany:async()=>row?[row]:[],upsert:async({create,update})=>{events.push('save');row=row?{...row,...update}:create;return row;}},payroll_claims:{findFirst:async()=>{events.push('check-list');return listed?{id:1}:null;}},$queryRaw:async()=>{events.push('lock');return[{value:1}];},$transaction:async(fn)=>{const previous=structuredClone(row);try{return await fn(prisma);}catch(error){row=previous;throw error;}},
 });
});
test('manual assistance produces exact remaining allowance, including zero and full grant',()=>{
 for(const [tuition,allowance] of [[0,5000],[5000,0],[3500,1500],[1234.56,3765.44],[0.01,4999.99]]){
  assert.equal(validateTuitionAssistance(tuition),tuition);const result=grantBreakdown({tuition_fee_assistance:tuition,grant_prepared_at:new Date()});assert.equal(result.totalGrant,5000);assert.equal(result.allowance,allowance);
 }
 for(const value of [-1,5000.01,NaN,Infinity,null,'3500',true,1.001,1e-10])assert.throws(()=>validateTuitionAssistance(value));
 assert.equal(grantBreakdown({}).grantPrepared,false);assert.ok(preparationBlocker('Private',{}));assert.equal(preparationBlocker('Public',{}),null);assert.equal(preparationBlocker('Private',{},true),null);
});
test('save creates a period-bound preparation, ignores forged totals and does not generate a list',async()=>{
 const res=response();await save(request(3500,{totalGrant:99999,allowance:99999}),res);assert.equal(res.statusCode,200);assert.equal(res.body.grant.allowance,1500);assert.equal(row.applicant_id,7);assert.equal(row.billing_period_id,10);assert.equal(row.grant_prepared_by,9);assert.equal(row.billing_amount,5000);assert.deepEqual(events,['lock','check-list','save']);
});
test('zero must be explicit; invalid values never write and prepared values survive reload',async()=>{
 for(const value of [undefined,null,-1,5001,0.001]){const res=response();await save(request(value),res);assert.equal(res.statusCode,400);assert.equal(row,null);}
 const res=response();await save(request(0),res);assert.equal(res.statusCode,200);assert.equal(grantBreakdown(await prisma.scholar_requirements.findUnique()).allowance,5000);
});
test('listed records, stale edits, inactive periods and Public Scholars cannot be overwritten',async()=>{
 let res=response();await save(request(2500),res);const original=structuredClone(row);
 listed=true;res=response();await save(request(3000),res);assert.equal(res.statusCode,409);assert.deepEqual(row,original);listed=false;
 res=response();await save(request(3000,{preparedAt:null}),res);assert.equal(res.statusCode,409);assert.deepEqual(row,original);
 active=false;res=response();await save(request(3000),res);assert.equal(res.statusCode,409);active=true;
 type='public';res=response();await save(request(3000),res);assert.equal(res.statusCode,409);assert.deepEqual(row,original);
});
test('destination permission follows Private initial Payroll rather than Billing',async()=>{
 const req=request(2500);req.user={id:9,role:'RegularAdmin',sectionAccess:['billing']};let res=response();await save(req,res);assert.equal(res.statusCode,403);assert.equal(row,null);
 req.user.sectionAccess=['payroll'];res=response();await save(req,res);assert.equal(res.statusCode,200);
});
test('list snapshots lock first and use fresh saved amounts; absent preparation fails closed',async()=>{
 await assert.rejects(snapshotPrivateGrants(prisma,10,[7]),/no saved grant/);events=[];
 let res=response();await save(request(3500),res);events=[];
 const map=await snapshotPrivateGrants(prisma,10,[7]);assert.equal(events[0],'lock');assert.deepEqual(map.get(7),{tuition_fee_assistance:3500,allowance:1500});
 res=response();await save(request(4000),res);assert.equal(row.tuition_fee_assistance,4000);assert.equal(map.get(7).allowance,1500);
});

test('receipt access never substitutes an earlier initial receipt for a later continuing period',async()=>{
 prisma.application_submissions.findFirst=async()=>({id:1,initial_docs:{initialRequirementPeriodId:9,requirementSets:{'9:initial':{requirements:{tuition_receipt:{fileName:'old.pdf'}}}}}});
 const {receipt}=require('../controllers/grantPreparationController');const res=response();await receipt({params:{applicantId:'7'},query:{academicPeriodId:'10'},user:{id:9,role:'SuperAdmin'}},res);assert.equal(res.statusCode,404);assert.match(res.body.message,/Earlier-period/);
});

test('grant preparation respects an explicit period amount without resurrecting legacy ignored values', async () => {
 row={applicant_id:7,billing_period_id:10,billing_amount:9999,list_amount_override:6500.75};
 let res=response();await save(request(5500.25),res);assert.equal(res.statusCode,200);assert.equal(res.body.grant.totalGrant,6500.75);assert.equal(res.body.grant.allowance,1000.5);
 const original=structuredClone(row);res=response();await save(request(6500.76),res);assert.equal(res.statusCode,400);assert.deepEqual(row,original);
 row={applicant_id:7,billing_period_id:10,billing_amount:9999};res=response();await save(request(3500),res);assert.equal(res.body.grant.totalGrant,5000);
});
