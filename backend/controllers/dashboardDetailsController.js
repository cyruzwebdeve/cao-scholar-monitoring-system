const prisma = require('../config/prisma');
const { hasSectionAccess } = require('../services/sectionAccess');

const metricSections = Object.freeze({ activeScholars: 'scholars', forfeitedAccounts: 'examination' });
const getDashboardDetails = async (req, res) => {
  const metric = req.params.metric;
  if (!Object.hasOwn(metricSections, metric)) return res.status(400).json({ message: 'Unknown dashboard metric.' });
  if (!hasSectionAccess(req.user, metricSections[metric])) return res.status(403).json({ message: 'This record directory is not assigned to your staff account.' });
  const page = Number(req.query.page || 1);
  const search = String(req.query.search || '').trim();
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 100) return res.status(400).json({ message: 'Invalid page or search.' });
  const pageSize = 25;
  try {
    const matches = search ? await prisma.applicants.findMany({
      where: { deleted_at: null, AND: search.split(/\s+/).map(part => ({ OR: ['first_name', 'middle_name', 'last_name', 'municipality'].map(key => ({ [key]: { contains: part, mode: 'insensitive' } })) })) }, select: { id: true },
    }) : null;
    const model = metric === 'activeScholars' ? prisma.scholar_accounts : prisma.exam_slots;
    const where = { ...(metric === 'activeScholars' ? { is_active: true } : { forfeited_at: { not: null } }), ...(matches ? { applicant_id: { in: matches.map(row => row.id) } } : {}) };
    const total = await model.count({ where });
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pages);
    const records = await model.findMany({ where, orderBy: { id: 'desc' }, skip: (currentPage - 1) * pageSize, take: pageSize,
      select: metric === 'activeScholars' ? { id: true, applicant_id: true, scholar_id: true } : { id: true, applicant_id: true, exam_id: true, forfeited_at: true } });
    const ids = records.map(row => row.applicant_id);
    const applicants = ids.length ? await prisma.applicants.findMany({ where: { id: { in: ids }, deleted_at: null }, select: { id: true, first_name: true, middle_name: true, last_name: true, municipality: true } }) : [];
    const byId = new Map(applicants.map(row => [row.id, row]));
    return res.json({ pagination: { page: currentPage, pageSize, total, pages }, rows: records.map(row => {
      const applicant = byId.get(row.applicant_id);
      return { id: row.id, name: applicant ? [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(' ').toUpperCase() : 'Applicant record unavailable',
        municipality: applicant?.municipality || 'Not specified', reference: metric === 'activeScholars' ? row.scholar_id || 'Not assigned' : `Examination #${row.exam_id}`,
        status: metric === 'activeScholars' ? 'Active' : 'Forfeited', recordedAt: row.forfeited_at || null };
    }) });
  } catch (error) {
    console.error('Unable to load dashboard metric records:', error);
    return res.status(500).json({ message: 'Unable to load dashboard records. Please retry.' });
  }
};
module.exports = { getDashboardDetails, metricSections };
