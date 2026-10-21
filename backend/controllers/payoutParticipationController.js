const {
  fail,
  positiveId,
  isPayrollBatch,
} = require('../services/payoutSchedulePolicy');
const {
  ATTENDANCE,
  expectedVersion,
  receiptInput,
  attendanceView,
  receiptView,
} = require('../services/payoutParticipation');
function createPayoutParticipationController({
  prisma,
  now = () => new Date(),
}) {
  const handle = (operation) => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      return await operation(req, res);
    } catch (error) {
      if (['P2002', 'P2034'].includes(error.code))
        return res
          .status(409)
          .json({
            message:
              'This schedule or record changed. Reload before saving again.',
          });
      return res
        .status(error.status || 500)
        .json({
          message: error.status
            ? error.message
            : 'Unable to load or save attendance and receipt reports. Please retry.',
        });
    }
  };
  async function scope(db, id) {
    const schedule = await db.payout_schedules.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!schedule || !['published', 'cancelled'].includes(schedule.status))
      fail('Published schedule not found.', 404);
    const batch = await db.payroll_batches.findUnique({
      where: { id: schedule.payroll_batch_id },
    });
    if (!isPayrollBatch(batch))
      fail('This schedule does not refer to a saved Payroll list.', 404);
    return { schedule, batch };
  }
  async function member(db, schedule, applicantId) {
    const recipient = schedule.recipients.find(
      (row) =>
        row.applicant_id === applicantId &&
        row.payroll_batch_id === schedule.payroll_batch_id
    );
    if (!recipient) fail('You are not a recipient of this schedule.', 404);
    const [claim, applicant] = await Promise.all([
      db.payroll_claims.findUnique({
        where: {
          payroll_batch_id_applicant_id: {
            payroll_batch_id: schedule.payroll_batch_id,
            applicant_id: applicantId,
          },
        },
        select: { id: true, payroll_batch_id: true, applicant_id: true },
      }),
      db.applicants.findFirst({ where: { id: applicantId, deleted_at: null } }),
    ]);
    if (!claim || !applicant) fail('Scheduled Scholar not found.', 404);
    return { claim, recipient };
  }
  function canWrite(schedule, recipient, revision) {
    if (schedule.status !== 'published' || !recipient.active)
      fail('This schedule is no longer active. Reload schedules.', 409);
    if (revision !== schedule.revision)
      fail(
        'This schedule changed. Reload it before recording attendance or receipt.',
        409
      );
    if (+now() < +new Date(schedule.starts_at))
      fail(
        'Attendance and receipt confirmation open at the scheduled start.',
        409
      );
  }
  const index = handle(async (req, res) => {
    const { schedule, batch } = await scope(prisma, positiveId(req.params.id));
    const ids = schedule.recipients
      .filter((row) => row.payroll_batch_id === batch.id)
      .map((row) => row.applicant_id);
    const [people, claims, attendance, periods] = await Promise.all([
      prisma.applicants.findMany({
        where: { id: { in: ids }, deleted_at: null },
        select: {
          id: true,
          first_name: true,
          middle_name: true,
          last_name: true,
          name_ext: true,
          municipality: true,
        },
      }),
      prisma.payroll_claims.findMany({
        where: { payroll_batch_id: batch.id, applicant_id: { in: ids } },
        select: { id: true, payroll_batch_id: true, applicant_id: true },
      }),
      prisma.payout_schedule_attendance.findMany({
        where: { schedule_id: schedule.id },
      }),
      prisma.academic_periods.findMany({
        where: { id: batch.billing_period_id },
      }),
    ]);
    const receipts = await prisma.scholar_payout_receipts.findMany({
      where: { payroll_claim_id: { in: claims.map((row) => row.id) } },
    });
    const claimByPerson = new Map(claims.map((row) => [row.applicant_id, row])),
      attendanceByPerson = new Map(
        attendance
          .filter(
            (row) =>
              +new Date(row.session_starts_at) === +new Date(schedule.starts_at)
          )
          .map((row) => [row.applicant_id, row])
      ),
      receiptByClaim = new Map(
        receipts.map((row) => [row.payroll_claim_id, row])
      );
    const latestAttendance = new Map();
    for (const record of attendance) {
      const previous = latestAttendance.get(record.applicant_id);
      if (
        !previous ||
        +new Date(record.updated_at) > +new Date(previous.updated_at)
      )
        latestAttendance.set(record.applicant_id, record);
    }
    const rows = people
      .filter((person) => claimByPerson.has(person.id))
      .map((person) => ({
        applicantId: person.id,
        name: [
          person.first_name,
          person.middle_name,
          person.last_name,
          person.name_ext,
        ]
          .filter(Boolean)
          .join(' '),
        municipality: person.municipality || '',
        attendance: attendanceView(attendanceByPerson.get(person.id)),
        previousAttendance: attendanceByPerson.has(person.id)
          ? null
          : attendanceView(latestAttendance.get(person.id)),
        receipt: receiptView(
          receiptByClaim.get(claimByPerson.get(person.id).id)
        ),
      }));
    res.json({
      schedule: {
        id: schedule.id,
        title: schedule.title,
        revision: schedule.revision,
        status: schedule.status,
        startsAt: schedule.starts_at,
        venue: schedule.venue,
        reference: batch.batch_number,
        schoolYear: periods[0]?.school_year,
        semester: periods[0]?.semester,
        canRecord:
          schedule.status === 'published' &&
          +now() >= +new Date(schedule.starts_at),
      },
      rows,
    });
  });
  const attendance = handle(async (req, res) => {
    const id = positiveId(req.params.id),
      applicantId = positiveId(req.params.applicantId),
      body = req.body || {};
    expectedVersion(body.expectedVersion);
    if (
      !ATTENDANCE.includes(body.attendance) ||
      !Number.isSafeInteger(body.scheduleRevision)
    )
      fail('Select a valid attendance status and reload the schedule.');
    const saved = await prisma.$transaction(
      async (tx) => {
        const { schedule } = await scope(tx, id),
          { recipient } = await member(tx, schedule, applicantId);
        canWrite(schedule, recipient, body.scheduleRevision);
        const key = {
          schedule_id: id,
          applicant_id: applicantId,
          session_starts_at: schedule.starts_at,
        };
        const current = await tx.payout_schedule_attendance.findUnique({
          where: { schedule_id_applicant_id_session_starts_at: key },
        });
        if ((current?.version || 0) !== body.expectedVersion)
          fail('Attendance changed. Reload before saving.', 409);
        const data = {
          attendance: body.attendance,
          recorded_by: req.user.id,
          updated_at: now(),
        };
        if (current) {
          const changed = await tx.payout_schedule_attendance.updateMany({
            where: { ...key, version: body.expectedVersion },
            data: { ...data, version: { increment: 1 } },
          });
          if (changed.count !== 1)
            fail('Attendance changed. Reload before saving.', 409);
        } else
          await tx.payout_schedule_attendance.create({
            data: { ...key, ...data },
          });
        return attendanceView(
          await tx.payout_schedule_attendance.findUnique({
            where: { schedule_id_applicant_id_session_starts_at: key },
          })
        );
      },
      { isolationLevel: 'Serializable' }
    );
    res.locals.auditTargetId = id;
    res.json({ attendance: saved });
  });
  const receipt = handle(async (req, res) => {
    const id = positiveId(req.params.id),
      body = req.body || {};
    expectedVersion(body.expectedVersion);
    const saved = await prisma.$transaction(
      async (tx) => {
        const { schedule } = await scope(tx, id),
          { claim, recipient } = await member(tx, schedule, req.user.id);
        if (body.action === 'withdraw') {
          if (body.scheduleRevision !== schedule.revision)
            fail(
              'This schedule changed. Reload it before correcting your report.',
              409
            );
        } else canWrite(schedule, recipient, body.scheduleRevision);
        const data = {
          ...receiptInput(body, schedule, now()),
          schedule_id: id,
          updated_at: now(),
        };
        const current = await tx.scholar_payout_receipts.findUnique({
          where: { payroll_claim_id: claim.id },
        });
        if ((current?.version || 0) !== body.expectedVersion)
          fail(
            'Your receipt report changed. Reload before confirming again.',
            409
          );
        if (body.action === 'withdraw' && !current?.is_received)
          fail('There is no confirmed receipt report to withdraw.');
        if (current) {
          const changed = await tx.scholar_payout_receipts.updateMany({
            where: {
              payroll_claim_id: claim.id,
              version: body.expectedVersion,
            },
            data: { ...data, version: { increment: 1 } },
          });
          if (changed.count !== 1)
            fail(
              'Your receipt report changed. Reload before confirming again.',
              409
            );
        } else
          await tx.scholar_payout_receipts.create({
            data: { payroll_claim_id: claim.id, ...data },
          });
        return receiptView(
          await tx.scholar_payout_receipts.findUnique({
            where: { payroll_claim_id: claim.id },
          })
        );
      },
      { isolationLevel: 'Serializable' }
    );
    res.locals.auditTargetId = id;
    res.locals.auditAction =
      body.action === 'withdraw'
        ? 'SCHOLAR_RECEIPT_REPORT_WITHDRAWN'
        : 'SCHOLAR_RECEIPT_REPORTED';
    res.json({ receipt: saved });
  });
  const mine = handle(async (req, res) => {
    if (
      !(await prisma.applicants.findFirst({
        where: { id: req.user.id, deleted_at: null },
      }))
    )
      fail('Scholar not found.', 404);
    const schedules = await prisma.payout_schedules.findMany({
      where: {
        status: { in: ['published', 'cancelled'] },
        recipients: { some: { applicant_id: req.user.id } },
      },
      include: { recipients: { where: { applicant_id: req.user.id } } },
      orderBy: { starts_at: 'desc' },
    });
    const batchIds = [...new Set(schedules.map((row) => row.payroll_batch_id))];
    const [batches, claims, attendance] = await Promise.all([
      prisma.payroll_batches.findMany({ where: { id: { in: batchIds } } }),
      prisma.payroll_claims.findMany({
        where: {
          applicant_id: req.user.id,
          payroll_batch_id: { in: batchIds },
        },
        select: { id: true, payroll_batch_id: true, applicant_id: true },
      }),
      prisma.payout_schedule_attendance.findMany({
        where: {
          applicant_id: req.user.id,
          schedule_id: { in: schedules.map((row) => row.id) },
        },
      }),
    ]);
    const [periods, receipts] = await Promise.all([
      prisma.academic_periods.findMany({
        where: { id: { in: batches.map((row) => row.billing_period_id) } },
      }),
      prisma.scholar_payout_receipts.findMany({
        where: { payroll_claim_id: { in: claims.map((row) => row.id) } },
      }),
    ]);
    const batchById = new Map(
        batches.filter(isPayrollBatch).map((row) => [row.id, row])
      ),
      claimsByBatch = new Map(claims.map((row) => [row.payroll_batch_id, row])),
      receiptByClaim = new Map(
        receipts.map((row) => [row.payroll_claim_id, row])
      ),
      periodById = new Map(periods.map((row) => [row.id, row]));
    res.json({
      schedules: schedules
        .filter(
          (row) =>
            batchById.has(row.payroll_batch_id) &&
            claimsByBatch.has(row.payroll_batch_id) &&
            row.recipients.some(
              (r) =>
                r.applicant_id === req.user.id &&
                r.payroll_batch_id === row.payroll_batch_id
            )
        )
        .map((row) => {
          const batch = batchById.get(row.payroll_batch_id),
            period = periodById.get(batch.billing_period_id),
            claim = claimsByBatch.get(batch.id),
            recipient = row.recipients.find(
              (r) =>
                r.applicant_id === req.user.id &&
                r.payroll_batch_id === batch.id
            );
          return {
            id: row.id,
            payrollEntryId: claim.id,
            title: row.title,
            status: row.status,
            revision: row.revision,
            startsAt: row.starts_at,
            endsAt: row.ends_at,
            venue: row.venue,
            instructions: row.instructions,
            cancellationReason: row.cancellation_reason,
            reference: batch.batch_number,
            schoolYear: period?.school_year,
            semester: period?.semester,
            canConfirm:
              row.status === 'published' &&
              Boolean(recipient?.active) &&
              +now() >= +new Date(row.starts_at),
            attendance: attendanceView(
              attendance.find(
                (a) =>
                  a.schedule_id === row.id &&
                  +new Date(a.session_starts_at) === +new Date(row.starts_at)
              )
            ),
            receipt: receiptView(receiptByClaim.get(claim.id)),
          };
        }),
    });
  });
  return { index, attendance, receipt, mine };
}
module.exports = { createPayoutParticipationController };
