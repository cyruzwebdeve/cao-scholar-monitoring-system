const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { normalizeSectionAccess } = require('../services/sectionAccess');

const resolveUser = async (payload) => {
  if (payload.accountType === 'admin') {
    const admin = await prisma.admins.findUnique({ where: { id: payload.userId } });
    if (!admin || !admin.is_active) return null;
    if ((payload.authVersion ?? 0) !== admin.auth_version) return null;
    const role = admin.is_super_admin ? 'SuperAdmin' : admin.role === 'moderator' ? 'Moderator' : admin.role === 'admin' ? 'RegularAdmin' : 'BillingPayrollAdmin';
    return { id: admin.id, email: admin.email, role, sectionAccess: normalizeSectionAccess(admin.section_access, role) };
  }

  const account = await prisma.control_accounts.findFirst({ where: { applicant_id: payload.userId } });
  const applicant = await prisma.applicants.findUnique({ where: { id: payload.userId } });
  if (!account || !applicant || !account.is_active) return null;
  if ((payload.authVersion ?? 0) !== account.auth_version) return null;
  const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: applicant.id, is_active: true } });
  return { id: applicant.id, email: applicant.email, firstName: applicant.first_name, middleName: applicant.middle_name, lastName: applicant.last_name, role: scholar ? 'Scholar' : 'Applicant', controlNumber: account.control_number };
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized. Missing token.' });
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'supersecret');
    const user = await resolveUser(payload);
    if (!user) return res.status(401).json({ message: 'Unauthorized. User not found.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized. Invalid token.' });
  }
};

const authenticateOptional = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || 'supersecret');
    req.user = await resolveUser(payload) || undefined;
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized. Invalid token.' });
  }
};

module.exports = { authenticate, authenticateOptional };
