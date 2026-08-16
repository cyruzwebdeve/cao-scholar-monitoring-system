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

const ensureSuperAdmin = async () => {
  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  if (!email && !password) {
    console.log('Super administrator bootstrap skipped; credentials were not supplied.');
    return;
  }
  if (!email || !password) throw new Error('Both BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD are required.');
  if (password.length < 12) throw new Error('BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters.');

  const existing = await prisma.admins.findUnique({ where: { email } });
  if (existing) {
    console.log(`Administrator already exists: ${email}`);
    return;
  }

  await prisma.admins.create({
    data: {
      full_name: String(process.env.BOOTSTRAP_ADMIN_NAME || 'PGCEAP Super Administrator').trim(),
      email,
      password_hash: await bcrypt.hash(password, 12),
      is_active: true,
      is_super_admin: true,
      role: 'superadmin',
    },
  });
  console.log(`Super administrator created: ${email}`);
};

const main = async () => {
  await ensureAcademicPeriod();
  await ensureSuperAdmin();
};

main()
  .catch((error) => {
    console.error(`Production bootstrap failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
