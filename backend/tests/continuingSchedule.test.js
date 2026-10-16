const test = require('node:test');
const assert = require('node:assert/strict');
const { initialApproved, evaluateContinuingSchedule, projectContinuingAccess } = require('../services/continuingSchedule');
const { evaluateListEligibility } = require('../services/lifecycleIntegrity');
const { getEffectiveRequirements } = require('../services/requirementWaves');
const period = { id:10, is_active:true, requirements_deadline:'2020-01-01' };
const docs = { requirements: Object.fromEntries(['tax_exemption','valid_id','grades','registration_form'].map(key=>[key,{fileName:key+'.pdf',status:'Approved'}])) };
const access = (extra={}) => evaluateContinuingSchedule({period,docs,schoolType:'Public',now:'2026-10-16',...extra});
test('four approved Public and five Private initial documents gate access; Indigency remains optional',()=>{
 assert.equal(initialApproved(docs,10,'Public'),true);assert.equal(initialApproved(docs,10,'Private'),false);assert.equal(initialApproved(docs,10,'Unknown'),false);
 assert.equal(initialApproved({requirements:{...docs.requirements,tuition_receipt:{fileName:'receipt.pdf',status:'Approved'}}},10,'Private'),true);
 assert.equal(access({docs:{}}).isOpen,false);
});
test('eligible active-period uploads default open without a schedule or manual wave',()=>{assert.equal(access().isOpen,true);assert.equal(access().deadline,null);assert.equal(access().state,'open');});
test('retired deadlines and late authorizations never close access or gate individual Scholars',()=>{
 const schedule={uploads_open:true,opens_at:'2020-01-01',closes_at:'2020-01-02',late_scope:'selected',late_applicant_ids:[7],late_closes_at:'2020-01-03'};
 for(const applicantId of [7,8])assert.equal(access({schedule,applicantId}).isOpen,true);
});
test('period closure is enforced and reopening preserves visibility',()=>{
 const closed=access({schedule:{uploads_open:false}});assert.equal(closed.isOpen,false);assert.equal(closed.visible,true);assert.equal(closed.state,'closed');
 assert.equal(access({schedule:{uploads_open:true}}).isOpen,true);assert.equal(access({period:{...period,is_active:false}}).isOpen,false);
});
test('projection preserves initial/history data and does not mutate source when closed',()=>{
 const original=JSON.stringify(docs);const result=projectContinuingAccess(docs,10,access({schedule:{uploads_open:false}}));
 assert.equal(JSON.stringify(docs),original);assert.ok(result.requirementWaves[10].continuingOpenedAt);assert.equal(getEffectiveRequirements(result,10).requirements.grades,undefined);
});
test('closed or incomplete uploads warn but never add a list blocker; duplicate membership still blocks',()=>{
 const options={isActive:true,schoolType:'Public',requireSchoolClassification:true,initialDocs:getEffectiveRequirements(projectContinuingAccess(docs,10,access({schedule:{uploads_open:false}})),10)};
 assert.equal(evaluateListEligibility(options).eligible,true);assert.equal(evaluateListEligibility(options).warnings.length,2);assert.equal(evaluateListEligibility({...options,alreadyProcessedForPeriod:true}).eligible,false);
});
