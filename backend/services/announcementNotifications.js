const audiences = ['all', 'applicants', 'scholars', 'applicants_scholars'];
const isDeliverableAnnouncement = (a, now = new Date()) => Boolean(a?.notify_email
  && a.status === 'published' && audiences.includes(a.audience)
  && (!a.publish_at || new Date(a.publish_at) <= now)
  && (!a.expires_at || new Date(a.expires_at) > now));
const matchesAudience = (audience, isScholar) => audiences.includes(audience)
  && (audience !== 'applicants' || !isScholar) && (audience !== 'scholars' || isScholar);

// Durable, individually addressed deliveries; injected dependencies keep tests offline.
const createAnnouncementNotifications = ({ prisma, mailer, now = () => new Date() }) => {
  let running = false;
  const queueAnnouncement = (id) => prisma.$transaction(async (tx) => {
    const timestamp = now();
    const claim = await tx.announcements.updateMany({
      where: { id, notify_email: true, email_queued_at: null, status: 'published', audience: { in: audiences }, AND: [
        { OR: [{ publish_at: null }, { publish_at: { lte: timestamp } }] },
        { OR: [{ expires_at: null }, { expires_at: { gt: timestamp } }] },
      ] }, data: { email_queued_at: timestamp },
    });
    if (!claim.count) return;
    const announcement = await tx.announcements.findUnique({ where: { id } });
    const [accounts, scholars] = await Promise.all([
      tx.control_accounts.findMany({ where: { is_active: true }, select: { applicant_id: true } }),
      tx.scholar_accounts.findMany({ where: { is_active: true }, select: { applicant_id: true } }),
    ]);
    const scholarIds = new Set(scholars.map(({ applicant_id }) => applicant_id));
    const ids = [...new Set(accounts.map(({ applicant_id }) => applicant_id))]
      .filter((applicantId) => matchesAudience(announcement.audience, scholarIds.has(applicantId)));
    for (let offset = 0; offset < ids.length; offset += 500) {
      const applicants = await tx.applicants.findMany({
        where: { id: { in: ids.slice(offset, offset + 500) }, deleted_at: null }, select: { id: true },
      });
      if (applicants.length) await tx.announcement_email_deliveries.createMany({
        data: applicants.map(({ id: applicantId }) => ({ announcement_id: id, applicant_id: applicantId })), skipDuplicates: true,
      });
    }
  }, { timeout: 30_000 });

  const deliver = async (delivery) => {
    const claimed = await prisma.announcement_email_deliveries.updateMany({
      where: { id: delivery.id, status: 'pending', available_at: { lte: now() } },
      data: { status: 'sending', attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const [announcement, applicant, account, scholar] = await Promise.all([
      prisma.announcements.findUnique({ where: { id: delivery.announcement_id } }),
      prisma.applicants.findUnique({ where: { id: delivery.applicant_id } }),
      prisma.control_accounts.findFirst({ where: { applicant_id: delivery.applicant_id, is_active: true } }),
      prisma.scholar_accounts.findFirst({ where: { applicant_id: delivery.applicant_id, is_active: true } }),
    ]);
    if (!isDeliverableAnnouncement(announcement, now()) || !applicant || applicant.deleted_at || !account
      || !matchesAudience(announcement.audience, Boolean(scholar)) || !applicant.email) {
      await prisma.announcement_email_deliveries.update({ where: { id: delivery.id }, data: { status: 'cancelled', last_reason: 'no_longer_eligible' } });
      return;
    }
    const result = await mailer.sendAnnouncementEmail({ to: applicant.email, firstName: applicant.first_name,
      title: announcement.title, content: announcement.content, priority: announcement.priority });
    const attempts = delivery.attempts + 1;
    await prisma.announcement_email_deliveries.update({ where: { id: delivery.id }, data: result.sent
      ? { status: 'sent', sent_at: now(), last_reason: null }
      : { status: attempts < 3 ? 'pending' : 'failed', available_at: new Date(now().getTime() + attempts * 5 * 60_000), last_reason: result.reason || 'delivery_failed' },
    });
  };

  const runOnce = async () => {
    if (running) return;
    running = true;
    try {
      const timestamp = now();
      await prisma.announcements.updateMany({ where: { status: 'scheduled', publish_at: { lte: timestamp } }, data: { status: 'published', published_at: timestamp } });
      const announcements = await prisma.announcements.findMany({ where: {
        notify_email: true, email_queued_at: null, status: 'published', audience: { in: audiences },
        AND: [{ OR: [{ publish_at: null }, { publish_at: { lte: timestamp } }] }, { OR: [{ expires_at: null }, { expires_at: { gt: timestamp } }] }],
      }, orderBy: { id: 'asc' }, take: 10 });
      for (const announcement of announcements) if (isDeliverableAnnouncement(announcement, timestamp)) await queueAnnouncement(announcement.id);
      if (!mailer.configured) return;
      const deliveries = await prisma.announcement_email_deliveries.findMany({
        where: { status: 'pending', available_at: { lte: now() } }, orderBy: { id: 'asc' }, take: 25,
      });
      for (const delivery of deliveries) {
        try { await deliver(delivery); } catch {
          // A provider may have accepted mail before a DB/network failure. Do not
          // automatically reclaim "sending" rows and risk duplicate notifications.
          console.error('Announcement delivery interrupted; review sending-state queue records before retrying.');
        }
      }
    } finally { running = false; }
  };
  const start = () => {
    const tick = () => runOnce().catch(() => console.error('Announcement notification worker failed; inspect database connectivity and migration status.'));
    const timer = setInterval(tick, 30_000);
    timer.unref();
    void tick();
    return () => clearInterval(timer);
  };
  return { runOnce, start };
};
module.exports = { createAnnouncementNotifications, isDeliverableAnnouncement, matchesAudience };
