const prisma = require('../config/prisma');
const { resolveBillingAmount } = require('../services/billingGrant');
const { validateTuitionAssistance, grantBreakdown, lockGrantRecords, error } = require('../services/grantPreparation');
const { loadResolvedScholarSchool, schoolClassification } = require('../services/scholarSchool');
const { resolveProcessingRoute } = require('../services/processingRoute');
const { loadContinuingSchedule } = require('../services/continuingSchedule');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { hasSectionAccess } = require('../services/sectionAccess');
const { getInitialRequirements, getWaveSet } = require('../services/requirementWaves');
const { streamDocument } = require('./documentReviewController');
const contextFor = async (client, req) => {
  const applicantId = Number(req.params.applicantId), periodId = Number(req.body?.academicPeriodId || req.query?.academicPeriodId);
  if (![applicantId,periodId].every((id) => Number.isSafeInteger(id) && id>0)) throw error('Select a Scholar and academic period.');
  const [period,scholar,applicant,application,requirement,primary] = await Promise.all([
    client.academic_periods.findFirst({where:{id:periodId,is_active:true}}),client.scholar_accounts.findFirst({where:{applicant_id:applicantId,is_active:true}}),client.applicants.findUnique({where:{id:applicantId}}),client.application_submissions.findFirst({where:{applicant_id:applicantId},orderBy:{submitted_at:'desc'}}),client.scholar_requirements.findUnique({where:{applicant_id_billing_period_id:{applicant_id:applicantId,billing_period_id:periodId}}}),findPrimaryActivePeriod(client),
  ]);
  if (!period || !scholar || !applicant || applicant.deleted_at || !application || !primary) throw error('Select an active Scholar and active academic period.',409);
  const school = await loadResolvedScholarSchool(client,{applicantId,applicant,application,requirement});
  if (schoolClassification(school?.school_type)!=='Private') throw error('Grant preparation applies only to Private-school Scholars.',409);
  const route = resolveProcessingRoute({requirement,schoolType:school.school_type,docs:application.initial_docs,period,schedule:await loadContinuingSchedule(client,period.id),applicantId,legacyPeriodId:primary.id});
  if (!hasSectionAccess(req.user,route)) throw error('Access Denied. This record belongs to the other processing section.',403);
  return {applicantId,periodId,requirement,period,application,primary};
};
const safe = (handler) => async (req,res) => {
  res.set('Cache-Control','private, no-store');
  try { return await handler(req,res); } catch (failure) {
    if (['P2002','P2034'].includes(failure.code)) return res.status(409).json({message:'This record changed during processing. Reload before retrying.'});
    if (!failure.statusCode) console.error('Grant preparation failed:',failure.code||failure.name);
    return res.status(failure.statusCode||500).json({message:failure.statusCode?failure.message:'Unable to save the grant preparation record.'});
  }
};
const save = safe(async(req,res)=>{
  let tuition;
  if (req.body.preparedAt != null && (typeof req.body.preparedAt !== 'string' || !Number.isFinite(+new Date(req.body.preparedAt)))) throw error('Reload the saved grant record before editing.');
  const saved = await prisma.$transaction(async(tx)=>{
    const applicantId=Number(req.params.applicantId),periodId=Number(req.body.academicPeriodId);
    if (![applicantId,periodId].every(id=>Number.isSafeInteger(id)&&id>0)) throw error('Select a Scholar and academic period.');
    await lockGrantRecords(tx,periodId,[applicantId]);
    const context = await contextFor(tx,req);
    const total = resolveBillingAmount('Private', context.requirement?.list_amount_override);
    tuition = validateTuitionAssistance(req.body?.tuitionFeeAssistance, total);
    if (await tx.payroll_claims.findFirst({where:{applicant_id:applicantId,academic_period_id:periodId}})) throw error('This grant record is locked because the Scholar is already included in a generated list.',409);
    if ((context.requirement?.grant_prepared_at ? +new Date(context.requirement.grant_prepared_at):null)!==(req.body.preparedAt ? +new Date(req.body.preparedAt):null)) throw error('Another staff member changed this preparation. Refresh before editing.',409);
    const timestamp=new Date(Math.max(Date.now(),+new Date(context.requirement?.grant_prepared_at||0)+1));
    const fields={tuition_fee_assistance:tuition,grant_prepared_at:timestamp,grant_prepared_by:req.user.id,billing_amount:total,updated_by:req.user.id};
    return tx.scholar_requirements.upsert({where:{applicant_id_billing_period_id:{applicant_id:applicantId,billing_period_id:periodId}},create:{applicant_id:applicantId,billing_period_id:periodId,...fields},update:fields});
  },{isolationLevel:'Serializable'});
  res.locals.auditTargetId=Number(req.params.applicantId);
  res.locals.auditAction='PRIVATE_GRANT_PREPARED';
  res.locals.auditDescription=`Prepared the Private grant breakdown for academic period ${Number(req.body.academicPeriodId)}: total PHP ${grantBreakdown(saved).totalGrant}; tuition assistance PHP ${tuition}; allowance PHP ${grantBreakdown(saved).allowance}.`;
  return res.json({message:'Private grant record saved as Prepared.',grant:grantBreakdown(saved)});
});
const receipt = safe(async(req,res)=>{
  const {application,periodId,primary} = await contextFor(prisma,req);
  const continuing = getWaveSet(application.initial_docs,periodId,'continuing',primary.id).requirements.tuition_receipt;
  const inherited = getInitialRequirements(application.initial_docs,periodId,primary.id);
  const currentInitial=getWaveSet(application.initial_docs,periodId,'initial',primary.id).requirements.tuition_receipt;
  const initialPeriodId=application.initial_docs?.initialRequirementPeriodId||primary.id;
  const file=continuing||(initialPeriodId===periodId ? inherited.requirements.tuition_receipt : null);
  if (!file?.fileName) throw error('No tuition receipt is available for this academic period. Earlier-period receipts are not used.',404);
  const sourcePeriod=continuing||currentInitial?periodId:inherited.originalPeriodId;
  return streamDocument({...req,params:{applicationId:String(application.id),requirementKey:'tuition_receipt'},query:{academicPeriodId:String(sourcePeriod),submissionWave:continuing?'continuing':'initial'}},res);
});
module.exports={save,receipt};
