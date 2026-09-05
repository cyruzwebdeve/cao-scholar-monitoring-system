const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { sendPasswordResetEmail } = require('../services/mailer');
const {
  RESET_TOKEN_TTL_MS,
  generateResetToken,
  hashResetToken,
} = require('../services/passwordReset');
const { recordSuccessfulLogin } = require('../services/activityLog');
const { normalizeSectionAccess } = require('../services/sectionAccess');

const createToken = (id, accountType, role, authVersion = 0) => jwt.sign(
  { userId: id, accountType, role, authVersion },
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
  return { id: admin.id, email: admin.email, role, sectionAccess: normalizeSectionAccess(admin.section_access, role), accountType: 'admin', account: admin };
};

const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.applicants.findFirst({ where: { email: normalizedEmail } });
    if (existing) return res.status(409).json({ message: 'User already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const { applicant, account } = await prisma.$transaction(async (transaction) => {
      const applicant = await transaction.applicants.create({
        data: { first_name: 'New', last_name: 'Applicant', email: normalizedEmail },
      });
      const account = await transaction.control_accounts.create({
        data: {
          applicant_id: applicant.id,
          control_number: `PGCEAP-${String(applicant.id).padStart(3, '0')}`,
          username: normalizedEmail,
          password_hash: passwordHash,
        },
      });
      return { applicant, account };
    });
    const token = createToken(applicant.id, 'applicant', 'Applicant', account.auth_version);
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

    await recordSuccessfulLogin(prisma, accountUser, { ipAddress: req.ip });

    const token = createToken(
      accountUser.id,
      accountUser.accountType,
      accountUser.role,
      accountUser.account.auth_version,
    );
    return res.status(200).json({ token, user: { id: accountUser.id, email: accountUser.email, firstName: accountUser.firstName, middleName: accountUser.middleName, lastName: accountUser.lastName, role: accountUser.role, sectionAccess: accountUser.sectionAccess, controlNumber: accountUser.account.control_number } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
};

const me = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized. User not authenticated.' });
  return res.status(200).json({ user: req.user });
};

const findPasswordResetAccount = async (rawIdentifier) => {
  const identifier = rawIdentifier.trim();
  const normalizedIdentifier = identifier.toLowerCase();

  if (identifier.includes('@')) {
    const admin = await prisma.admins.findFirst({
      where: { email: normalizedIdentifier, is_active: true },
    });
    if (admin) {
      return {
        accountType: 'admin',
        accountId: admin.id,
        email: admin.email,
        firstName: admin.full_name.split(/\s+/)[0],
      };
    }
  }

  const controlAccount = await prisma.control_accounts.findFirst({
    where: {
      is_active: true,
      OR: [
        { control_number: identifier.toUpperCase() },
        { username: normalizedIdentifier },
      ],
    },
  });
  if (!controlAccount) return null;

  const applicant = await prisma.applicants.findFirst({
    where: { id: controlAccount.applicant_id, deleted_at: null },
  });
  if (!applicant) return null;

  return {
    accountType: 'applicant',
    accountId: controlAccount.id,
    email: applicant.email,
    firstName: applicant.first_name,
  };
};

const requestPasswordReset = async (req, res) => {
  const genericMessage = 'If an active account matches those details, a password reset link has been sent.';
  try {
    const account = await findPasswordResetAccount(req.body.identifier);
    if (!account) return res.status(200).json({ message: genericMessage });

    const resetToken = generateResetToken();
    const tokenHash = hashResetToken(resetToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);

    await prisma.$transaction(async (transaction) => {
      await transaction.password_reset_tokens.updateMany({
        where: {
          account_type: account.accountType,
          account_id: account.accountId,
          used_at: null,
        },
        data: { used_at: now },
      });
      await transaction.password_reset_tokens.create({
        data: {
          account_type: account.accountType,
          account_id: account.accountId,
          token_hash: tokenHash,
          expires_at: expiresAt,
          requested_ip: String(req.ip || '').slice(0, 45) || null,
        },
      });
      await transaction.password_reset_tokens.deleteMany({
        where: {
          OR: [
            { expires_at: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
            { used_at: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
          ],
        },
      });
    });

    const delivery = await sendPasswordResetEmail({
      to: account.email,
      firstName: account.firstName,
      resetToken,
      expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60_000),
    });
    if (!delivery.sent) {
      await prisma.password_reset_tokens.deleteMany({ where: { token_hash: tokenHash } }).catch(() => {});
    }

    return res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error('Password reset request failed.', { code: error.code || 'PASSWORD_RESET_REQUEST_ERROR' });
    return res.status(500).json({ message: 'Unable to process the password reset request right now.' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const tokenHash = hashResetToken(req.body.token);
    const now = new Date();
    const resetRecord = await prisma.password_reset_tokens.findFirst({
      where: {
        token_hash: tokenHash,
        used_at: null,
        expires_at: { gt: now },
      },
    });
    if (!resetRecord) {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(req.body.password, 12);
    await prisma.$transaction(async (transaction) => {
      const claimed = await transaction.password_reset_tokens.updateMany({
        where: {
          id: resetRecord.id,
          used_at: null,
          expires_at: { gt: now },
        },
        data: { used_at: now },
      });
      if (claimed.count !== 1) throw Object.assign(new Error('Reset token already used.'), { code: 'RESET_TOKEN_USED' });

      const accountUpdate = resetRecord.account_type === 'admin'
        ? await transaction.admins.updateMany({
          where: { id: resetRecord.account_id, is_active: true },
          data: { password_hash: passwordHash, auth_version: { increment: 1 } },
        })
        : await transaction.control_accounts.updateMany({
          where: { id: resetRecord.account_id, is_active: true },
          data: { password_hash: passwordHash, auth_version: { increment: 1 } },
        });
      if (accountUpdate.count !== 1) throw Object.assign(new Error('Reset account unavailable.'), { code: 'RESET_ACCOUNT_UNAVAILABLE' });

      await transaction.password_reset_tokens.updateMany({
        where: {
          account_type: resetRecord.account_type,
          account_id: resetRecord.account_id,
          used_at: null,
        },
        data: { used_at: now },
      });
    });

    return res.status(200).json({ message: 'Your password has been updated. You can now sign in.' });
  } catch (error) {
    if (error.code === 'RESET_TOKEN_USED' || error.code === 'RESET_ACCOUNT_UNAVAILABLE') {
      return res.status(400).json({ message: 'This password reset link is invalid or has expired.' });
    }
    console.error('Password reset failed.', { code: error.code || 'PASSWORD_RESET_ERROR' });
    return res.status(500).json({ message: 'Unable to reset the password right now.' });
  }
};

module.exports = { register, login, me, requestPasswordReset, resetPassword };
