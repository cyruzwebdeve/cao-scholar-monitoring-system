require('dotenv').config();

const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

const DEFAULT_SCHOOL_YEAR = '2026-2027';
const DEFAULT_SEMESTER = '1st Semester';

const ensureAcademicPeriod = async () => {
  const activePeriod = await prisma.academic_periods.findFirst({ where: { is_active: true } });
  if (activePeriod) {
    console.log(`Academic period already active: ${activePeriod.school_year} / ${activePeriod.semester}`);
    return;
  }

  const period = await prisma.academic_periods.upsert({
    where: { school_year_semester: { school_year: DEFAULT_SCHOOL_YEAR, semester: DEFAULT_SEMESTER } },
    update: { is_active: true, status: 'active' },
    create: {
      school_year: DEFAULT_SCHOOL_YEAR,
      semester: DEFAULT_SEMESTER,
      is_active: true,
      status: 'active',
    },
  });
  console.log(`Academic period ready: ${period.school_year} / ${period.semester}`);
};

const ensureAdminAccount = async ({
  label,
  nameVariable,
  emailVariable,
  passwordVariable,
  defaultName,
  role,
  isSuperAdmin = false,
}) => {
  const email = String(process.env[emailVariable] || '').trim().toLowerCase();
  const password = String(process.env[passwordVariable] || '');
  if (!password) {
    console.log(`${label} bootstrap skipped; no bootstrap password was supplied.`);
    return;
  }
  if (!email) throw new Error(`${emailVariable} is required when ${passwordVariable} is supplied.`);
  if (password.length < 12) throw new Error(`${passwordVariable} must contain at least 12 characters.`);

  const existing = await prisma.admins.findUnique({ where: { email } });
  if (existing) {
    console.log(`${label} bootstrap skipped; an administrator already uses ${email}.`);
    return;
  }

  await prisma.admins.create({
    data: {
      full_name: String(process.env[nameVariable] || defaultName).trim(),
      email,
      password_hash: await bcrypt.hash(password, 12),
      is_active: true,
      is_super_admin: isSuperAdmin,
      role,
    },
  });
  console.log(`${label} created: ${email}`);
};

const ensureSuperAdmin = () => ensureAdminAccount({
  label: 'Super administrator',
  nameVariable: 'BOOTSTRAP_ADMIN_NAME',
  emailVariable: 'BOOTSTRAP_ADMIN_EMAIL',
  passwordVariable: 'BOOTSTRAP_ADMIN_PASSWORD',
  defaultName: 'PGCEAP Super Administrator',
  role: 'superadmin',
  isSuperAdmin: true,
});

const ensureBillingAdmin = () => ensureAdminAccount({
  label: 'Billing and payroll administrator',
  nameVariable: 'BOOTSTRAP_BILLING_ADMIN_NAME',
  emailVariable: 'BOOTSTRAP_BILLING_ADMIN_EMAIL',
  passwordVariable: 'BOOTSTRAP_BILLING_ADMIN_PASSWORD',
  defaultName: 'Billing and Payroll Administrator',
  role: 'billing',
});

const ensureModerator = () => ensureAdminAccount({
  label: 'Content moderator',
  nameVariable: 'BOOTSTRAP_MODERATOR_NAME',
  emailVariable: 'BOOTSTRAP_MODERATOR_EMAIL',
  passwordVariable: 'BOOTSTRAP_MODERATOR_PASSWORD',
  defaultName: 'Content Moderator',
  role: 'moderator',
});

const main = async () => {
  await ensureAcademicPeriod();
  await ensureSuperAdmin();
  await ensureBillingAdmin();
  await ensureModerator();
};

main()
  .catch((error) => {
    console.error(`Production bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
