const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const {
  assertAccessChangeAllowed,
  getRoleConfig,
  resolvePortalRole,
  serializeStaff,
} = require('../services/staffAccounts');
const { normalizeSectionAccess } = require('../services/sectionAccess');

const parseStaffId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const getStaffManagement = async (req, res) => {
  try {
    const staff = await prisma.admins.findMany({
      orderBy: [{ is_super_admin: 'desc' }, { created_at: 'asc' }],
    });
    const serialized = staff.map((admin) => serializeStaff(admin, req.user.id));
    return res.json({
      stats: {
        total: serialized.length,
        active: serialized.filter((member) => member.isActive).length,
        inactive: serialized.filter((member) => !member.isActive).length,
        superAdmins: serialized.filter((member) => member.role === 'SuperAdmin' && member.isActive).length,
      },
      staff: serialized,
    });
  } catch (error) {
    console.error('Error loading staff accounts:', error);
    return res.status(500).json({ message: 'Server error loading staff accounts.' });
  }
};

const createStaffAccount = async (req, res) => {
  try {
    const { fullName, email, password, role, sectionAccess } = req.body;
    const roleConfig = getRoleConfig(role);
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.admins.create({
      data: {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        role: roleConfig.databaseRole,
        is_super_admin: roleConfig.isSuperAdmin,
        is_active: true,
        section_access: normalizeSectionAccess(sectionAccess, role),
      },
    });
    res.locals.auditTargetId = admin.id;
    return res.status(201).json({
      message: 'Staff account created successfully.',
      staff: serializeStaff(admin, req.user.id),
    });
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'A staff account already uses this email address.' });
    console.error('Error creating staff account:', error);
    return res.status(500).json({ message: 'Server error creating the staff account.' });
  }
};

const updateStaffAccount = async (req, res) => {
  try {
    const id = parseStaffId(req.params.id);
    if (!id) return res.status(400).json({ message: 'A valid staff account ID is required.' });

    const target = await prisma.admins.findUnique({ where: { id } });
    if (!target) return res.status(404).json({ message: 'Staff account not found.' });

    const { fullName, email, role, isActive, sectionAccess } = req.body;
    const roleConfig = getRoleConfig(role);
    const normalizedSections = normalizeSectionAccess(sectionAccess, role);
    const previousSections = normalizeSectionAccess(target.section_access, resolvePortalRole(target));
    const accessChanged = target.is_active !== isActive
      || target.role !== roleConfig.databaseRole
      || target.is_super_admin !== roleConfig.isSuperAdmin
      || JSON.stringify(previousSections.sort()) !== JSON.stringify([...normalizedSections].sort());

    if (accessChanged) {
      const otherActiveSuperAdmins = await prisma.admins.count({
        where: { id: { not: id }, is_active: true, is_super_admin: true },
      });
      assertAccessChangeAllowed({
        actorId: req.user.id,
        target,
        nextRole: role,
        nextIsActive: isActive,
        otherActiveSuperAdmins,
      });
    }

    const admin = await prisma.admins.update({
      where: { id },
      data: {
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: roleConfig.databaseRole,
        is_super_admin: roleConfig.isSuperAdmin,
        is_active: isActive,
        section_access: normalizedSections,
        ...(accessChanged ? { auth_version: { increment: 1 } } : {}),
      },
    });
    return res.json({
      message: accessChanged
        ? 'Staff account updated. Existing sessions for this account were signed out.'
        : 'Staff account updated successfully.',
      staff: serializeStaff(admin, req.user.id),
    });
  } catch (error) {
    if (error?.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error?.code === 'P2002') return res.status(409).json({ message: 'A staff account already uses this email address.' });
    console.error('Error updating staff account:', error);
    return res.status(500).json({ message: 'Server error updating the staff account.' });
  }
};

const changeStaffPassword = async (req, res) => {
  try {
    const id = parseStaffId(req.params.id);
    if (!id) return res.status(400).json({ message: 'A valid staff account ID is required.' });

    const [actor, target] = await Promise.all([
      prisma.admins.findUnique({ where: { id: req.user.id } }),
      prisma.admins.findUnique({ where: { id } }),
    ]);
    if (!actor || !actor.is_active || !actor.is_super_admin) return res.status(403).json({ message: 'Super Administrator access is required.' });
    if (!target) return res.status(404).json({ message: 'Staff account not found.' });

    const currentPasswordMatches = await bcrypt.compare(req.body.currentPassword, actor.password_hash);
    if (!currentPasswordMatches) return res.status(401).json({ message: 'Your current administrator password is incorrect.' });

    const passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    await prisma.$transaction([
      prisma.admins.update({
        where: { id },
        data: { password_hash: passwordHash, auth_version: { increment: 1 } },
      }),
      prisma.password_reset_tokens.updateMany({
        where: { account_type: 'admin', account_id: id, used_at: null },
        data: { used_at: new Date() },
      }),
    ]);

    return res.json({
      message: 'Password changed successfully. Existing sessions for this account were signed out.',
      requiresReauthentication: id === req.user.id,
    });
  } catch (error) {
    console.error('Error changing staff password:', error);
    return res.status(500).json({ message: 'Server error changing the staff password.' });
  }
};

module.exports = {
  changeStaffPassword,
  createStaffAccount,
  getStaffManagement,
  updateStaffAccount,
};
