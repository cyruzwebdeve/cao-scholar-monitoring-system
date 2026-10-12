const prisma = require('../config/prisma');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { isExaminationApplicationEligible } = require('../services/examinationEligibility');

const fault = (status, message) => Object.assign(new Error(message), { status });
const serializeResult = (result) => ({
  id: result.id, examId: result.exam_id, score: Number(result.score),
  passingScore: Number(result.passing_score ?? 14), status: result.passed ? 'Passed' : 'Failed',
  deliveryMode: result.delivery_mode, remarks: result.remarks || '',
  publishedAt: result.published_at || null, updatedAt: result.updated_at,
});
const hasTwoDecimalPlaces = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8;
const validateScores = (body, correction = false) => {
  if (typeof body.score !== 'number' || !Number.isFinite(body.score) || body.score < 0 || body.score > 20 || !hasTwoDecimalPlaces(body.score)) {
    throw fault(400, 'Enter a score between 0 and 20 with at most two decimal places.');
  }
  if (!correction && (typeof body.passingScore !== 'number' || !Number.isFinite(body.passingScore) || body.passingScore < 1 || body.passingScore > 20 || !hasTwoDecimalPlaces(body.passingScore))) {
    throw fault(400, 'Enter a passing score between 1 and 20 with at most two decimal places.');
  }
  if (typeof body.remarks !== 'string' || !body.remarks.trim() || body.remarks.length > 2000) {
    throw fault(400, correction ? 'A correction reason of at most 2,000 characters is required.' : 'Add a recording remark of at most 2,000 characters.');
  }
};

const createExaminationResultController = (client = prisma) => {
  const mutate = (operation) => async (req, res) => {
    try {
      const applicantId = Number(req.params.applicantId);
      const examId = Number(req.params.examId);
      if (!Number.isSafeInteger(applicantId) || applicantId <= 0 || !Number.isSafeInteger(examId) || examId <= 0) throw fault(400, 'A valid examination and applicant are required.');
      const body = req.body || {};
      if (operation !== 'publish') validateScores(body, operation === 'correct');
      if (operation !== 'record' && (!Number.isSafeInteger(body.resultId) || typeof body.updatedAt !== 'string' || Number.isNaN(new Date(body.updatedAt).getTime()))) throw fault(400, 'Reload the result before changing or publishing it.');
      let timestamp = new Date();
      const result = await client.$transaction(async (tx) => {
        const [period, exam, applicant, slot, scholar, application] = await Promise.all([
          findPrimaryActivePeriod(tx),
          tx.exams.findUnique({ where: { id: examId } }),
          tx.applicants.findUnique({ where: { id: applicantId } }),
          tx.exam_slots.findUnique({ where: { applicant_id_exam_id: { applicant_id: applicantId, exam_id: examId } } }),
          tx.scholar_accounts.findFirst({ where: { applicant_id: applicantId, is_active: true } }),
          tx.application_submissions.findFirst({ where: { applicant_id: applicantId }, orderBy: { submitted_at: 'desc' } }),
        ]);
        if (!period || !exam || exam.academic_year !== period.school_year) throw fault(409, 'Select an examination in the active academic year.');
        if (!applicant || applicant.deleted_at || !slot || slot.exam_id !== examId || slot.applicant_id !== applicantId) throw fault(404, 'The applicant is not assigned to this examination.');
        if (!isExaminationApplicationEligible(application)) throw fault(409, 'This application is unavailable for examination result changes.');
        if (scholar) throw fault(409, 'Results are locked after scholarship acceptance.');
        const existing = await tx.results.findFirst({ where: { applicant_id: applicantId, exam_id: examId } });
        let saved;
        if (operation === 'record') {
          if (existing) throw fault(409, 'A result already exists. Reload and use Correct score.');
          const settings = await tx.application_settings.findUnique({ where: { id: 1 } });
          if (settings?.exam_delivery_mode === 'online') throw fault(409, 'Online examination scores are computed automatically.');
          if (!slot.appeared) throw fault(409, 'CAO must mark attendance as Present before recording a paper score.');
          saved = await tx.results.create({ data: {
            exam_slot_id: slot.id, applicant_id: applicantId, exam_id: examId,
            score: body.score, passing_score: body.passingScore, passed: body.score >= body.passingScore,
            delivery_mode: 'paper', recorded_by: req.user.id, remarks: body.remarks.trim(), updated_at: timestamp,
            review_history: [{ operation: 'record', actorId: req.user.id, at: timestamp.toISOString(), score: body.score, passingScore: body.passingScore, reason: body.remarks.trim() }],
          } });
        } else {
          if (!existing || existing.id !== body.resultId || new Date(existing.updated_at).getTime() !== new Date(body.updatedAt).getTime()) throw fault(409, 'The result changed. Reload before continuing.');
          if (operation === 'publish' && (existing.score === null || existing.score === undefined || !Number.isFinite(Number(existing.score)))) throw fault(409, 'Record a valid score before publication or correction.');
          if (operation === 'publish' && existing.published_at) throw fault(409, 'This result is already published.');
          timestamp = new Date(Math.max(Date.now(), new Date(existing.updated_at).getTime() + 1));
          const data = operation === 'publish'
            ? { published_at: timestamp, published_by: req.user.id, updated_at: timestamp }
            : { score: body.score, passed: body.score >= Number(existing.passing_score ?? 14), remarks: body.remarks.trim(), recorded_by: req.user.id, published_at: null, published_by: null, updated_at: timestamp };
          data.review_history = [...(Array.isArray(existing.review_history) ? existing.review_history : []), { operation, actorId: req.user.id, at: timestamp.toISOString(), previousScore: existing.score === null || existing.score === undefined ? null : Number(existing.score), score: operation === 'correct' ? body.score : Number(existing.score), passingScore: Number(existing.passing_score ?? 14), previousPublishedAt: existing.published_at ? new Date(existing.published_at).toISOString() : null, reason: operation === 'correct' ? body.remarks.trim() : 'CAO published the reviewed result' }];
          const changed = await tx.results.updateMany({ where: { id: existing.id, updated_at: existing.updated_at }, data });
          if (changed.count !== 1) throw fault(409, 'The result changed. Reload before continuing.');
          saved = await tx.results.findUnique({ where: { id: existing.id } });
        }
        await tx.application_submissions.updateMany({ where: { id: application.id }, data: { status: 'Examined' } });
        res.locals.auditDescription = operation === 'correct'
          ? `Corrected examination result ${saved.id}: score ${existing.score} to ${saved.score}. Reason: ${body.remarks.trim()}. Publication reset for CAO review.`
          : operation === 'publish' ? `Published examination result ${saved.id}.` : `Recorded paper examination result ${saved.id}.`;
        return saved;
      }, { isolationLevel: 'Serializable' });
      res.locals.auditTargetId = result.id;
      return res.status(operation === 'record' ? 201 : 200).json({
        message: operation === 'publish' ? 'Examination result published.' : 'Score saved for CAO review. Publish separately to notify the applicant in their dashboard.',
        result: serializeResult(result),
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ message: error.message });
      if (['P2002', 'P2034'].includes(error.code)) return res.status(409).json({ message: 'The record changed concurrently. Reload and try again.' });
      console.error('Examination result operation failed:', error.message);
      return res.status(500).json({ message: 'Unable to save the examination result.' });
    }
  };
  return { record: mutate('record'), correct: mutate('correct'), publish: mutate('publish') };
};
module.exports = { createExaminationResultController, examinationResultController: createExaminationResultController(), serializeResult };
