const queueScheduleEmails = async (tx, schedule, event, applicantIds) => {
  const recipients = [...new Set(applicantIds)];
  if (!['published', 'rescheduled', 'cancelled'].includes(event)) throw new Error('Invalid schedule email event.');
  // Called inside the schedule/portal-notification transaction: all or nothing.
  for (let offset = 0; offset < recipients.length; offset += 500) {
    await tx.payout_schedule_email_deliveries.createMany({
      data: recipients.slice(offset, offset + 500).map(applicant_id => ({ schedule_id: schedule.id, revision: schedule.revision, applicant_id, event })),
      skipDuplicates: true,
    });
  }
  return recipients.length;
};

const createScheduleEmailNotifications = ({ prisma, mailer, now = () => new Date() }) => {
  let running = false;
  const deliver = async (row) => {
    const claimed = await prisma.payout_schedule_email_deliveries.updateMany({
      where: { id: row.id, status: 'pending', available_at: { lte: now() } },
      data: { status: 'sending', attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const [schedule, applicant, account, scholar, recipient] = await Promise.all([
      prisma.payout_schedules.findUnique({ where: { id: row.schedule_id } }),
      prisma.applicants.findUnique({ where: { id: row.applicant_id } }),
      prisma.control_accounts.findFirst({ where: { applicant_id: row.applicant_id, is_active: true } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: row.applicant_id, is_active: true } }),
      prisma.payout_schedule_recipients.findUnique({ where: { schedule_id_applicant_id: { schedule_id: row.schedule_id, applicant_id: row.applicant_id } } }),
    ]);
    const expectedStatus = row.event === 'cancelled' ? 'cancelled' : 'published';
    // A queued old date must not arrive after a reschedule/cancellation. Cancel
    // obsolete revisions; the latest saved event has its own recipient outbox.
    const stale = !schedule || schedule.revision !== row.revision || schedule.status !== expectedStatus;
    if (stale || !recipient || !account || !scholar || !applicant?.email || applicant.deleted_at) {
      await prisma.payout_schedule_email_deliveries.update({ where: { id: row.id },
        data: { status: 'cancelled', last_reason: stale ? 'superseded_schedule' : 'recipient_unavailable' } });
      return;
    }
    const batch = await prisma.payroll_batches.findUnique({ where: { id: schedule.payroll_batch_id } });
    if (!batch) {
      await prisma.payout_schedule_email_deliveries.update({ where: { id: row.id }, data: { status: 'cancelled', last_reason: 'batch_unavailable' } });
      return;
    }
    const result = await mailer.sendScheduleEmail({
      to: applicant.email, firstName: applicant.first_name, title: schedule.title, event: row.event,
      reference: batch.batch_number, startsAt: schedule.starts_at, endsAt: schedule.ends_at,
      venue: schedule.venue, instructions: schedule.instructions, cancellationReason: schedule.cancellation_reason,
    });
    const attempts = row.attempts + 1;
    await prisma.payout_schedule_email_deliveries.update({ where: { id: row.id }, data: result.sent
      ? { status: 'sent', sent_at: now(), last_reason: null }
      : { status: attempts < 3 ? 'pending' : 'failed', available_at: new Date(now().getTime() + attempts * 5 * 60_000), last_reason: result.reason || 'delivery_failed' },
    });
  };
  const runOnce = async () => {
    if (running || !mailer.configured) return;
    running = true;
    try {
      const rows = await prisma.payout_schedule_email_deliveries.findMany({
        where: { status: 'pending', available_at: { lte: now() } }, orderBy: { id: 'asc' }, take: 25,
      });
      for (const row of rows) {
        try { await deliver(row); } catch {
          // Ambiguous provider/DB interruption: do not blindly resend a row in
          // sending state. Staff can see the count and investigate first.
          console.error('Schedule email delivery interrupted; inspect sending-state queue records before retrying.');
        }
      }
    } finally { running = false; }
  };
  const start = () => {
    const tick = () => runOnce().catch(() => console.error('Schedule email worker failed; verify database connectivity and applied migrations.'));
    const timer = setInterval(tick, 30_000); timer.unref(); void tick();
    return () => clearInterval(timer);
  };
  return { runOnce, start };
};
module.exports = { queueScheduleEmails, createScheduleEmailNotifications };
