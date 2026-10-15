const test = require('node:test');
const assert = require('node:assert/strict');
const { initialApproved } = require('../services/continuingSchedule');
const { resolveProcessingRoute } = require('../services/processingRoute');
const { getPostedPasser, canRecordInitial } = require('../services/passerIntake');
const period = { id: 10 };
const docs = (original = 10) => ({ initialRequirementPeriodId: original, requirementSets: { [`${original}:initial`]: { requirements: Object.fromEntries(['tax_exemption','valid_id','grades','registration_form','tuition_receipt'].map((key) => [key,{fileName:key+'.pdf',status:'Approved'}])) } } });
test('initial verification requires four Public or five Private approved files; Indigency is optional', () => {
 const record=docs();delete record.requirementSets['10:initial'].requirements.tuition_receipt;
 assert.equal(initialApproved(record,10,'Public'),true);assert.equal(initialApproved(record,10,'Private'),false);
 record.requirementSets['10:initial'].requirements.tuition_receipt={fileName:'receipt.pdf',status:'Pending'};assert.equal(initialApproved(record,10,'Private'),false);
 record.requirementSets['10:initial'].requirements.tuition_receipt.status='Approved';assert.equal(initialApproved(record,10,'Private'),true);
 record.requirementSets['10:initial'].requirements.valid_id.status='Rejected';assert.equal(initialApproved(record,10,'Public'),false);
 assert.equal(initialApproved(record,10,'Unclassified'),false);
});
test('both initial school types enter Payroll; subsequent regular Public uses Payroll and Private Billing',()=>{
 for(const schoolType of ['Public','Private']) assert.equal(resolveProcessingRoute({schoolType,docs:docs(),period}), 'payroll');
 assert.equal(resolveProcessingRoute({schoolType:'Private',docs:docs(9),period,legacyPeriodId:9}),'billing');
 assert.equal(resolveProcessingRoute({schoolType:'Public',docs:docs(9),period,legacyPeriodId:9}),'payroll');
});
test('actual authorized late continuing uploads route both school types to Payroll and stay there after closure',()=>{
 const schedule={late_scope:'selected',late_applicant_ids:[7],late_opens_at:'2026-10-10',late_closes_at:'2026-10-12'};
 const record=docs(9);record.requirementSets['10:continuing']={requirements:{grades:{uploadedAt:'2026-10-11T12:00:00Z'}}};
 for(const schoolType of ['Public','Private']) assert.equal(resolveProcessingRoute({schoolType,docs:record,period,schedule,applicantId:7,legacyPeriodId:9}),'payroll');
 assert.equal(resolveProcessingRoute({schoolType:'Private',docs:record,period,schedule,applicantId:8,legacyPeriodId:9}),'billing');
 record.requirementSets['10:continuing'].requirements.grades.uploadedAt='2026-10-01';assert.equal(resolveProcessingRoute({schoolType:'Private',docs:record,period,schedule,applicantId:7,legacyPeriodId:9}),'billing');
});
test('posted intake rejects missing/stale/failed/unpublished results and binds the original application',async()=>{
 const result={id:20,passed:true,published_at:'2026-10-10',updated_at:'2026-10-10'};
 let members=[{result_id:20,application_id:3,snapshot:{resultUpdatedAt:'2026-10-10'}}];
 const client={passer_list_members:{findMany:async({where})=>{assert.equal(where.list.status,'posted');assert.deepEqual(where.list.revisions,{none:{status:'posted'}});return members;}},results:{findFirst:async()=>result}};
 assert.ok(await getPostedPasser(client,7,10,result,3));assert.equal(await getPostedPasser(client,7,10,result,99),null);
 assert.equal(await getPostedPasser(client,7,10,{...result,updated_at:'2026-10-11'},3),null);
 assert.equal(await getPostedPasser(client,7,10,{...result,passed:false},3),null);assert.equal(await getPostedPasser(client,7,10,{...result,published_at:null},3),null);
 assert.equal(await canRecordInitial(client,7,10,{id:3,status:'Examined'}),true);assert.equal(await canRecordInitial(client,7,10,{id:3,status:'Withdrawn'}),false);
 members=[];assert.equal(await canRecordInitial(client,7,10,{id:3,status:'Examined'}),false);
});
