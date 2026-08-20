const prisma = require('../config/prisma');
const { evaluateBillingEligibility } = require('../services/lifecycleIntegrity');

const getLifecycleReport = async (req, res) => {
  try {
    const requestedSchoolYear = String(req.query.schoolYear || '').trim();
    const [period, availablePeriods] = await Promise.all([requestedSchoolYear
      ? prisma.academic_periods.findFirst({
        where: { school_year: requestedSchoolYear },
        orderBy: [{ is_active: 'desc' }, { updated_at: 'desc' }],
      })
      : prisma.academic_periods.findFirst({
        where: { is_active: true },
        orderBy: { updated_at: 'desc' },
      }), prisma.academic_periods.findMany({ orderBy: [{ school_year: 'desc' }, { start_date: 'desc' }] })]);
    if (!period) return res.status(404).json({ message: 'No academic period is available for this report.' });

    const applicants = await prisma.applicants.findMany({
      where: { school_year: period.school_year, deleted_at: null },
      select: { id: true },
    });
    const applicantIds = applicants.map(({ id }) => id);
    const [applications, scholars, requirements, exams, periodBatches, actionGroups, recentActivity] = await Promise.all([
      prisma.application_submissions.findMany({
        where: { applicant_id: { in: applicantIds } },
        orderBy: { submitted_at: 'desc' },
        select: { applicant_id: true, initial_docs: true },
      }),
      prisma.scholar_accounts.findMany({
        where: { applicant_id: { in: applicantIds } },
        select: { applicant_id: true, is_active: true },
      }),
      prisma.scholar_requirements.findMany({
        where: { applicant_id: { in: applicantIds }, billing_period_id: period.id },
      }),
      prisma.exams.findMany({
        where: { academic_year: period.school_year },
        select: { id: true },
      }),
      prisma.payroll_batches.findMany({
        where: { billing_period_id: period.id },
        select: { id: true, total_amount: true, status: true },
      }),
      prisma.activity_logs.groupBy({
        by: ['action'],
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      }),
      prisma.activity_logs.findMany({
        orderBy: { created_at: 'desc' },
        take: 8,
        select: { id: true, action: true, actor_type: true, description: true, created_at: true },
      }),
    ]);

    const examIds = exams.map(({ id }) => id);
    const batchIds = periodBatches.map(({ id }) => id);
    const [slots, results, claims] = await Promise.all([
      examIds.length ? prisma.exam_slots.findMany({ where: { exam_id: { in: examIds }, applicant_id: { in: applicantIds } }, select: { applicant_id: true, appeared: true } }) : [],
      examIds.length ? prisma.results.findMany({ where: { exam_id: { in: examIds }, applicant_id: { in: applicantIds } }, select: { applicant_id: true, passed: true } }) : [],
      batchIds.length ? prisma.payroll_claims.findMany({ where: { payroll_batch_id: { in: batchIds } } }) : [],
    ]);

    const applicationByApplicant = new Map();
    applications.forEach((application) => {
      if (!applicationByApplicant.has(application.applicant_id)) applicationByApplicant.set(application.applicant_id, application);
    });
    const requirementByApplicant = new Map(requirements.map((requirement) => [requirement.applicant_id, requirement]));
    const billedIds = new Set(claims.map(({ applicant_id }) => applicant_id));
    const requirementsCleared = scholars.filter((scholar) => evaluateBillingEligibility({
      isActive: scholar.is_active,
      alreadyBilled: false,
      initialDocs: applicationByApplicant.get(scholar.applicant_id)?.initial_docs,
      requirement: requirementByApplicant.get(scholar.applicant_id),
    }).eligible).length;
    const paidClaims = claims.filter((claim) => claim.claimed_date || ['paid', 'claimed', 'released'].includes(String(claim.claim_status || '').toLowerCase()));
    const paidAmount = paidClaims.reduce((total, claim) => total + Number(claim.claim_amount || 0), 0);

    return res.json({
      period: { id: period.id, schoolYear: period.school_year, semester: period.semester, isActive: period.is_active },
      periods: availablePeriods.map((item) => ({ id: item.id, schoolYear: item.school_year, semester: item.semester, isActive: item.is_active })),
      funnel: {
        applied: applicationByApplicant.size,
        scheduled: new Set(slots.map(({ applicant_id }) => applicant_id)).size,
        examined: new Set(results.map(({ applicant_id }) => applicant_id)).size,
        passed: new Set(results.filter(({ passed }) => passed).map(({ applicant_id }) => applicant_id)).size,
        scholars: scholars.filter(({ is_active }) => is_active).length,
        requirementsCleared,
        billed: billedIds.size,
        paid: new Set(paidClaims.map(({ applicant_id }) => applicant_id)).size,
      },
      finance: {
        billingBatches: periodBatches.length,
        billedClaims: claims.length,
        paidClaims: paidClaims.length,
        paidAmount,
      },
      audit: {
        actionCounts: actionGroups.map((group) => ({ action: group.action, count: group._count.action })),
        recent: recentActivity.map((log) => ({ ...log, id: log.id.toString() })),
      },
    });
  } catch (error) {
    console.error('Error fetching lifecycle report:', error);
    return res.status(500).json({ message: 'Server error fetching lifecycle report.' });
  }
};

module.exports = { getLifecycleReport };
