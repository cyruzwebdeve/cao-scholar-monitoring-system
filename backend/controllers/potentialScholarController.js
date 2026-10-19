const prisma = require('../config/prisma');
const { findPrimaryActivePeriod } = require('../services/academicPeriod');
const { loadSchoolHistory } = require('../services/scholarSchool');
const { buildPotentialScholars } = require('../services/potentialScholars');
const index = async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const period = await findPrimaryActivePeriod(prisma);
    if (!period) return res.json({ period: null, applicants: [] });
    const members = await prisma.passer_list_members.findMany({ where: { academic_period_id: period.id, list: { status: 'posted', revisions: { none: { status: 'posted' } } } }, select: { applicant_id: true, application_id: true, result_id: true, exam_id: true, snapshot: true } });
    const ids = [...new Set(members.map(member => member.applicant_id))];
    if (!ids.length) return res.json({ period: { id: period.id, schoolYear: period.school_year, semester: period.semester }, applicants: [] });
    const [applicants, applications, results, exams, slots, scholars, accounts, schools, schoolHistory] = await Promise.all([
      prisma.applicants.findMany({ where: { id: { in: ids }, deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true, municipality: true, school_id: true, school_year: true, deleted_at: true } }),
      prisma.application_submissions.findMany({ where: { applicant_id: { in: ids } }, orderBy: [{ submitted_at: 'desc' }, { id: 'desc' }], select: { id: true, applicant_id: true, status: true, school_plan: true, initial_docs: true } }),
      prisma.results.findMany({ where: { id: { in: members.map(member => member.result_id) } }, select: { id: true, applicant_id: true, exam_id: true, exam_slot_id: true, passed: true, published_at: true, updated_at: true } }),
      prisma.exams.findMany({ where: { academic_year: period.school_year }, orderBy: { updated_at: 'desc' }, select: { id: true, municipality: true, academic_year: true, updated_at: true } }),
      prisma.exam_slots.findMany({ where: { applicant_id: { in: ids } }, select: { id: true, applicant_id: true, exam_id: true } }),
      prisma.scholar_accounts.findMany({ where: { applicant_id: { in: ids }, is_active: true }, select: { applicant_id: true, is_active: true } }),
      prisma.control_accounts.findMany({ where: { applicant_id: { in: ids } }, select: { applicant_id: true, control_number: true } }),
      prisma.schools.findMany({ select: { id: true, name: true, school_type: true } }),
      loadSchoolHistory(prisma, ids),
    ]);
    return res.json({ period: { id: period.id, schoolYear: period.school_year, semester: period.semester }, applicants: buildPotentialScholars({ period, members, applicants, applications, results, exams, slots, scholars, accounts, schools, schoolHistory }) });
  } catch (error) {
    console.error('Potential scholar queue unavailable:', error.code || error.name);
    return res.status(500).json({ message: 'Unable to load applicants with complete requirements. Please retry.' });
  }
};
module.exports = { index };
