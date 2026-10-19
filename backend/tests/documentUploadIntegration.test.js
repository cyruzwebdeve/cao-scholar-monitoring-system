const test = require('node:test'), assert = require('node:assert/strict');
const prisma={}, prismaPath=require.resolve('../config/prisma');
require.cache[prismaPath]={id:prismaPath,filename:prismaPath,loaded:true,exports:prisma};
const { createApplication }=require('../controllers/applicationController');
const {dataUrl,png}=require('./fixtures/documentFiles');
const response=()=>({statusCode:200,locals:{},status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
test('invalid eligibility proof is rejected before applicant/account creation or document storage',async()=>{
 let writes=0;
 Object.assign(prisma,{application_settings:{findUnique:async()=>({is_enabled:true})},applicants:{findFirst:async()=>null},application_submissions:{findFirst:async()=>null,findMany:async()=>[]},academic_periods:{findFirst:async()=>({id:10,school_year:'2027-2028',semester:'1st Semester',is_active:true})},$transaction:async()=>{writes++;throw new Error('Unexpected write');}});
 for(const [fileName,fileData]of [['proof.exe',dataUrl()],['proof.pdf',dataUrl(png,'image/png')],['proof.pdf',dataUrl(Buffer.from('%PDF-1.4\ninvalid\n%%EOF'))]]){
  const res=response();await createApplication({body:{email:'synthetic@example.com',personalInfo:{identity:{firstName:'Synthetic',familyName:'Applicant'},address:{},family:{fatherName:'Synthetic Father',motherName:'Synthetic Mother'},eligibility:{pwd:'Yes',siblingRuleAccepted:true}},initialDocs:{priorityProof:{proofKey:'priority_pwd',fileName,fileData}}}},res);
  assert.equal(res.statusCode,400);assert.equal(writes,0);
 }
});
