const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const createToken = (id, accountType, role) => jwt.sign(
  { userId: id, accountType, role },
  process.env.JWT_SECRET || 'supersecret',
  { expiresIn: '8h' },
);

const getApplicantAccount = async (identifier) => {
  const account = await prisma.control_accounts.findFirst({
    where: { OR: [{ control_number: identifier }, { username: identifier }] },
  });
  if (!account) return null;

  const applicant = await prisma.applicants.findUnique({ where: { id: account.applicant_id } });
  if (!applicant || !account.is_active) return null;
  const scholar = await prisma.scholar_accounts.findFirst({ where: { applicant_id: applicant.id, is_active: true } });

  return {
    id: applicant.id,
    email: applicant.email,
    firstName: applicant.first_name,
    middleName: applicant.middle_name,
    lastName: applicant.last_name,
    role: scholar ? 'Scholar' : 'Applicant',
    accountType: 'applicant',
    account,
  };
};

const getAdminAccount = async (email) => {
  const admin = await prisma.admins.findFirst({ where: { email } });
  if (!admin || !admin.is_active) return null;
  const role = admin.is_super_admin ? 'SuperAdmin' : admin.role === 'moderator' ? 'Moderator' : admin.role === 'admin' ? 'RegularAdmin' : 'BillingPayrollAdmin';
  return { id: admin.id, email: admin.email, role, accountType: 'admin', account: admin };
};

const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.applicants.findFirst({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'User already exists.' });

    const nextApplicant = await prisma.applicants.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const nextAccount = await prisma.control_accounts.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const passwordHash = await bcrypt.hash(password, 12);
    const applicant = await prisma.applicants.create({
      data: { id: (nextApplicant?.id || 0) + 1, first_name: 'New', last_name: 'Applicant', email: normalizedEmail },
    });
    const account = await prisma.control_accounts.create({
      data: {
        id: (nextAccount?.id || 0) + 1,
        applicant_id: applicant.id,
        control_number: `PGCEAP-${String(applicant.id).padStart(3, '0')}`,
        username: normalizedEmail,
        password_hash: passwordHash,
      },
    });
    const token = createToken(applicant.id, 'applicant', 'Applicant');
    return res.status(201).json({ token, user: { id: applicant.id, email: applicant.email, firstName: applicant.first_name, lastName: applicant.last_name, role: 'Applicant', controlNumber: account.control_number } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

const login = async (req, res) => {
  try {
    const { email: rawIdentifier, password } = req.body;
    const identifier = rawIdentifier.trim();
    let accountUser = identifier.includes('@') ? await getAdminAccount(identifier.toLowerCase()) : null;
    if (accountUser) {
      if (!(await bcrypt.compare(password, accountUser.account.password_hash))) return res.status(401).json({ message: 'Invalid credentials.' });
    } else {
      accountUser = await getApplicantAccount(identifier);
      if (!accountUser || !(await bcrypt.compare(password, accountUser.account.password_hash))) return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = createToken(accountUser.id, accountUser.accountType, accountUser.role);
    return res.status(200).json({ token, user: { id: accountUser.id, email: accountUser.email, firstName: accountUser.firstName, middleName: accountUser.middleName, lastName: accountUser.lastName, role: accountUser.role, controlNumber: accountUser.account.control_number } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

const me = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
  return res.status(200).json({ user: req.user });
};

module.exports = { register, login, me };
