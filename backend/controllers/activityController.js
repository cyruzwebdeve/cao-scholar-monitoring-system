const prisma = require('../config/prisma');

const getStartOfPhilippineDay = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return new Date(`${values.year}-${values.month}-${values.day}T00:00:00+08:00`);
};

const getActivityLogs = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(req.query.pageSize, 10) || 25));
    const actorType = String(req.query.actorType || '').trim().toLowerCase();
    const search = String(req.query.search || '').trim().slice(0, 100);
    const allowedActorTypes = new Set(['admin', 'applicant', 'scholar']);
    const where = {
      ...(allowedActorTypes.has(actorType) ? { actor_type: actorType } : {}),
      ...(search ? {
        OR: [
          { action: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { target_table: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const now = new Date();
    const startOfToday = getStartOfPhilippineDay(now);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    const [logs, total, today, week, signIns, adminActions] = await Promise.all([
      prisma.activity_logs.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.activity_logs.count({ where }),
      prisma.activity_logs.count({ where: { created_at: { gte: startOfToday } } }),
      prisma.activity_logs.count({ where: { created_at: { gte: startOfWeek } } }),
      prisma.activity_logs.count({ where: { action: 'USER_LOGIN' } }),
      prisma.activity_logs.count({ where: { actor_type: 'admin' } }),
    ]);

    const adminIds = [...new Set(logs.filter((log) => log.actor_type === 'admin').map((log) => log.actor_id))];
    const applicantIds = [...new Set(logs.filter((log) => log.actor_type !== 'admin').map((log) => log.actor_id))];
    const [admins, applicants] = await Promise.all([
      adminIds.length ? prisma.admins.findMany({
        where: { id: { in: adminIds } },
        select: { id: true, full_name: true, email: true, role: true, is_super_admin: true },
      }) : [],
      applicantIds.length ? prisma.applicants.findMany({
        where: { id: { in: applicantIds } },
        select: { id: true, first_name: true, middle_name: true, last_name: true, email: true },
      }) : [],
    ]);
    const adminById = new Map(admins.map((admin) => [admin.id, admin]));
    const applicantById = new Map(applicants.map((applicant) => [applicant.id, applicant]));

    return res.json({
      stats: { today, week, signIns, adminActions },
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      logs: logs.map((log) => {
        const admin = log.actor_type === 'admin' ? adminById.get(log.actor_id) : null;
        const applicant = log.actor_type === 'admin' ? null : applicantById.get(log.actor_id);
        return {
          id: log.id.toString(),
          actorId: log.actor_id,
          action: log.action,
          description: log.description || 'System activity recorded.',
          actorType: log.actor_type,
          actorName: admin?.full_name
            || [applicant?.first_name, applicant?.middle_name, applicant?.last_name].filter(Boolean).join(' ')
            || `User #${log.actor_id}`,
          actorIdentifier: admin?.email || applicant?.email || null,
          targetTable: log.target_table,
          targetId: log.target_id,
          ipAddress: log.ip_address,
          createdAt: log.created_at,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return res.status(500).json({ message: 'Server error fetching activity logs.' });
  }
};

module.exports = { getActivityLogs, getStartOfPhilippineDay };
